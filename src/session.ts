import { Bot, Context, sleep } from 'koishi'
import { Card, createShoe, format, score, value } from './cards'
import { Config } from './config'
import { createEconomy } from './economy'

export enum Phase { Joining, Dealing, Insurance, Surrender, PlayerTurn, DealerTurn, Ended }

export interface Hand {
  cards: Card[]
  bet: number
  finished: boolean
  doubled: boolean
  surrendered: boolean
  insurance: number
  fromSplit: boolean
}

export interface Player {
  userId: string
  username: string
  platform: string
  bet: number
  hands: Hand[]
  handIndex: number
}

const newHand = (bet: number, fromSplit = false): Hand => ({
  cards: [], bet, finished: false, doubled: false, surrendered: false, insurance: 0, fromSplit,
})

/** 起手两张 21 点才是 Blackjack；分牌出来的不算。 */
export const isBlackjack = (hand: Hand) =>
  !hand.fromSplit && hand.cards.length === 2 && score(hand.cards) === 21

/** 软 17：算上被当作 11 的 A 恰好 17 点。 */
const isSoft17 = (cards: Card[]) =>
  score(cards) === 17 && cards.some((card) => card.rank === 'A')
  && cards.reduce((sum, card) => sum + (card.rank === 'A' ? 1 : value(card)), 0) !== 17

export type Economy = ReturnType<typeof createEconomy>

export class Game {
  phase = Phase.Joining
  players: Player[] = []
  dealer: Card[] = []
  shoe: Card[] = []
  turn = 0
  /** 逐条动作串行处理，避免连点把同一手牌算两次。 */
  private busy = false
  private dispose: () => void = null

  constructor(
    private ctx: Context,
    private config: Config,
    private economy: Economy,
    private bot: Bot,
    public channelId: string,
    public pvp: boolean,
    private onEnd: () => void,
  ) {
    this.wait(() => this.joinTimeout(), config.joinPhaseTimeout)
  }

  // --- 基础设施 ---

  private wait(callback: () => Promise<void> | void, seconds: number) {
    this.clear()
    this.dispose = this.ctx.setTimeout(async () => {
      this.dispose = null
      if (this.phase !== Phase.Ended) await callback()
    }, seconds * 1000)
  }

  private clear() {
    this.dispose?.()
    this.dispose = null
  }

  async say(message: string) {
    if (!message) return
    try {
      await this.bot.sendMessage(this.channelId, message)
    } catch (error) {
      this.ctx.logger('card-21-game').warn('发送消息失败：%s', error.message)
    }
  }

  private draw(): Card {
    if (!this.shoe.length) this.shoe = createShoe(this.config.deckCount)
    return this.shoe.shift()
  }

  end() {
    this.clear()
    this.phase = Phase.Ended
    this.onEnd()
  }

  async refundAll() {
    for (const player of this.players) {
      // 加倍与分牌都会追加下注，退款要按每手实际注金算
      const staked = player.hands.reduce((sum, hand) => sum + hand.bet + hand.insurance, 0)
      await this.economy.payout(player.platform, player.userId, staked)
    }
  }

  // --- 加入阶段 ---

  /** 加入对局；已加入的玩家再次下注视为调整注金（先退旧注，再扣新注）。 */
  async join(platform: string, userId: string, username: string, bet: number): Promise<string> {
    if (this.phase !== Phase.Joining) return '⚠️ 游戏已经开始了。'
    if (bet < this.config.minBet) return `⚠️ 最低下注金额为 ${this.config.minBet}。`
    if (this.busy) return ''

    this.busy = true
    try {
      const existing = this.players.find((player) => player.userId === userId)
      if (existing) {
        await this.economy.payout(platform, userId, existing.bet)
        if (!await this.economy.charge(platform, userId, bet)) {
          await this.economy.payout(platform, userId, existing.bet)
          const have = await this.economy.balance(platform, userId)
          return `⚠️ 余额不足，无法调整为 ${bet}（当前 ${have}），维持原注 ${existing.bet}。`
        }
        existing.username = username
        existing.bet = bet
        existing.hands = [newHand(bet)]
        this.wait(() => this.joinTimeout(), this.config.joinPhaseTimeout)
        return `✅ ${username} 调整下注为 ${bet}。`
      }
      if (!await this.economy.charge(platform, userId, bet)) {
        const have = await this.economy.balance(platform, userId)
        return `⚠️ 余额不足，无法下注 ${bet}（当前 ${have}）。`
      }
      this.players.push({ userId, username, platform, bet, hands: [newHand(bet)], handIndex: 0 })
    } finally {
      this.busy = false
    }

    this.wait(() => this.joinTimeout(), this.config.joinPhaseTimeout)
    return `✅ ${username} 加入成功（下注 ${bet}）。当前玩家：${this.players.length} 人。`
  }

  private async joinTimeout() {
    if (!this.players.length) {
      await this.say('⚠️ 无人加入，游戏取消。')
      return this.end()
    }
    if (this.pvp && this.players.length < 2) {
      await this.say('⚠️ 人数不足，PVP 模式取消，注金已退还。')
      await this.refundAll()
      return this.end()
    }
    await this.say('⏳ 准备时间结束，自动开始。')
    await this.start()
  }

  async start(): Promise<string> {
    if (this.phase !== Phase.Joining) return '⚠️ 不在准备阶段。'
    if (!this.players.length) return '⚠️ 还没有人加入。'
    if (this.pvp && this.players.length < 2) return '⚠️ PVP 模式至少需要 2 人。'

    this.clear()
    this.phase = Phase.Dealing
    this.shoe = createShoe(this.config.deckCount)

    for (let round = 0; round < 2; round++) {
      for (const player of this.players) player.hands[0].cards.push(this.draw())
      if (!this.pvp) this.dealer.push(this.draw())
      if (!round) await sleep(500)
    }

    await this.say(this.table('✅ 游戏开始，发牌完毕。'))

    if (!this.pvp && this.dealer[0]?.rank === 'A') {
      this.phase = Phase.Insurance
      await this.say('⚠️ 庄家明牌为 A，是否购买保险？（回复「保险」或「跳过」）')
      this.wait(() => this.surrenderPhase(), 10)
      return ''
    }
    await this.surrenderPhase()
    return ''
  }

  private async surrenderPhase() {
    this.phase = Phase.Surrender
    await this.say('⚠️ 投降阶段：牌型不佳可输入「投降」（输一半）。\n⏳ 5 秒后进入玩家回合。')
    this.wait(() => this.playerTurns(), 5)
  }

  async playerTurns() {
    this.clear()
    this.phase = Phase.PlayerTurn
    this.turn = 0
    await this.advance()
  }

  // --- 玩家回合 ---

  private current() {
    const player = this.players[this.turn]
    return player ? { player, hand: player.hands[player.handIndex] } : null
  }

  /** 推进到下一手 / 下一人。 */
  private async next() {
    const player = this.players[this.turn]
    if (player && player.handIndex < player.hands.length - 1) player.handIndex++
    else this.turn++
    this.wait(() => this.advance(), 0.8)
  }

  private async advance() {
    this.clear()
    if (this.turn >= this.players.length) return this.dealerTurn()

    const { player, hand } = this.current()
    if (hand.finished || hand.surrendered) return this.next()

    if (isBlackjack(hand)) {
      hand.finished = true
      await this.say(`✅ ${player.username} 拿到 Blackjack。`)
      return this.next()
    }

    const total = score(hand.cards)
    if (total >= 21) {
      hand.finished = true
      if (total > 21) await this.say(`❌ ${player.username} 爆牌（${total}）`)
      return this.next()
    }

    const actions = ['要牌', '停牌']
    if (this.canDouble(hand)) actions.push('加倍')
    if (this.canSplit(player)) actions.push('分牌')

    const which = player.hands.length > 1 ? `（手牌 ${player.handIndex + 1}/${player.hands.length}）` : ''
    await this.say(`轮到 ${player.username}${which}\n当前牌：${format(hand.cards)} [${total}]\n指令：${actions.join(' | ')}`)

    this.wait(async () => {
      await this.say(`⏳ ${player.username} 操作超时，自动停牌。`)
      await this.say(await this.hit(player.userId, 'stand'))
    }, this.config.playerTurnTimeout)
  }

  /** PVP 无庄，结算只比第一手，因此不开放会追加注金的加倍与分牌。 */
  private canDouble = (hand: Hand) => !this.pvp && hand.cards.length === 2 && !hand.fromSplit
  private canSplit(player: Player) {
    if (this.pvp || player.hands.length >= 2) return false
    const hand = player.hands[player.handIndex]
    return hand.cards.length === 2 && value(hand.cards[0]) === value(hand.cards[1])
  }

  /** 玩家回合内的四个动作。 */
  async hit(userId: string, action: 'hit' | 'stand' | 'double' | 'split'): Promise<string> {
    if (this.phase !== Phase.PlayerTurn || this.busy) return ''
    const seat = this.current()
    if (!seat || seat.player.userId !== userId) return ''
    const { player, hand } = seat

    this.busy = true
    try {
      if (action === 'stand') {
        hand.finished = true
        this.wait(() => this.advance(), 0.1)
        return `${player.username} 停牌 [${score(hand.cards)}]`
      }

      if (action === 'hit') {
        const card = this.draw()
        hand.cards.push(card)
        const total = score(hand.cards)
        if (total >= 21) hand.finished = true
        this.wait(() => this.advance(), 0.5)
        return `${player.username} 要牌：${format([card])} → [${total}]`
      }

      if (action === 'double') {
        if (!this.canDouble(hand)) return this.pvp ? '⚠️ PVP 模式不支持加倍。' : '⚠️ 只能在首轮加倍。'
        if (!await this.economy.charge(player.platform, player.userId, hand.bet)) return '⚠️ 余额不足，无法加倍。'
        hand.bet *= 2
        hand.doubled = true
        const card = this.draw()
        hand.cards.push(card)
        hand.finished = true
        this.wait(() => this.advance(), 1)
        return `${player.username} 加倍，注金 ${hand.bet}。发牌：${format([card])} → [${score(hand.cards)}]`
      }

      if (!this.canSplit(player)) return this.pvp ? '⚠️ PVP 模式不支持分牌。' : '⚠️ 当前无法分牌。'
      if (!await this.economy.charge(player.platform, player.userId, hand.bet)) return '⚠️ 余额不足，无法分牌。'

      const [first, second] = hand.cards
      const splitAces = first.rank === 'A'
      hand.cards = [first, this.draw()]
      hand.fromSplit = true
      hand.finished = splitAces

      const extra = newHand(hand.bet, true)
      extra.cards = [second, this.draw()]
      extra.finished = splitAces
      player.hands.push(extra)

      this.wait(() => this.advance(), 1)
      return `✅ ${player.username} 完成分牌。${splitAces ? '（分 A 只发一张牌）' : ''}`
    } finally {
      this.busy = false
    }
  }

  async surrender(userId: string): Promise<string> {
    if (this.phase !== Phase.Surrender) return ''
    const player = this.players.find((item) => item.userId === userId)
    if (!player || player.hands[0].surrendered) return ''
    player.hands[0].surrendered = true
    player.hands[0].finished = true
    return `${player.username} 选择投降（保留一半注金）。`
  }

  async insure(userId: string): Promise<string> {
    if (this.phase !== Phase.Insurance) return ''
    const player = this.players.find((item) => item.userId === userId)
    if (!player || player.hands[0].insurance > 0) return ''
    const cost = Math.floor(player.hands[0].bet / 2)
    if (!await this.economy.charge(player.platform, player.userId, cost)) return '⚠️ 余额不足，买不了保险。'
    player.hands[0].insurance = cost
    return `✅ ${player.username} 购买了保险（花费 ${cost}）。`
  }

  // --- 庄家与结算 ---

  private async dealerTurn() {
    this.clear()
    if (this.pvp) return this.settlePvp()

    this.phase = Phase.DealerTurn
    await this.say(`庄家亮牌：${format(this.dealer)} [${score(this.dealer)}]`)
    await sleep(1000)

    while (score(this.dealer) < 17 || (this.config.dealerHitSoft17 && isSoft17(this.dealer))) {
      const card = this.draw()
      this.dealer.push(card)
      await this.say(`庄家要牌：${format([card])} → [${score(this.dealer)}]`)
      await sleep(1500)
    }

    const total = score(this.dealer)
    await this.say(total > 21 ? '❌ 庄家爆牌。' : `庄家最终点数：${total}`)
    await this.settlePve()
  }

  private async settlePve() {
    const dealerScore = score(this.dealer)
    const dealerBj = this.dealer.length === 2 && dealerScore === 21
    const dealerBust = dealerScore > 21
    const lines: string[] = []

    for (const player of this.players) {
      let profit = 0
      const marks: string[] = []

      for (const hand of player.hands) {
        if (hand.insurance > 0) {
          if (dealerBj) {
            await this.economy.payout(player.platform, player.userId, hand.insurance * 3)
            profit += hand.insurance * 2
            marks.push('🛡️保赢')
          } else {
            profit -= hand.insurance
            marks.push('🛡️保亏')
          }
        }

        if (hand.surrendered) {
          await this.economy.payout(player.platform, player.userId, hand.bet / 2)
          profit -= hand.bet / 2
          marks.push('🏳️投降')
          continue
        }

        const total = score(hand.cards)
        const playerBj = isBlackjack(hand)

        if (total > 21) {
          profit -= hand.bet
          marks.push(`💥爆(-${hand.bet})`)
        } else if (playerBj && !dealerBj) {
          await this.economy.payout(player.platform, player.userId, hand.bet * 2.5)
          profit += hand.bet * 1.5
          marks.push(`⚡️BJ胜(+${hand.bet * 1.5})`)
        } else if (playerBj || (!dealerBj && (dealerBust || total > dealerScore))) {
          if (playerBj) {
            await this.economy.payout(player.platform, player.userId, hand.bet)
            marks.push('🤝BJ平')
          } else {
            await this.economy.payout(player.platform, player.userId, hand.bet * 2)
            profit += hand.bet
            marks.push(`🎉胜(+${hand.bet})`)
          }
        } else if (!dealerBj && total === dealerScore) {
          await this.economy.payout(player.platform, player.userId, hand.bet)
          marks.push('🤝平')
        } else {
          profit -= hand.bet
          marks.push(`❌败(-${hand.bet})`)
        }
      }

      lines.push(`${player.username}：${marks.join(' ')}`)
      await this.record(player, profit)
    }

    await this.say(['📋 结算报告', '———————————————', ...lines].join('\n'))
    this.end()
  }

  private async settlePvp() {
    const lines: string[] = []
    let pool = 0

    for (const player of this.players) {
      const hand = player.hands[0]
      if (hand.surrendered) {
        await this.economy.payout(player.platform, player.userId, player.bet / 2)
        pool += player.bet / 2
        lines.push(`${player.username}：🏳️ 投降`)
        await this.record(player, -player.bet / 2)
      } else {
        pool += player.bet
      }
    }

    const alive = this.players.filter((player) =>
      !player.hands[0].surrendered && score(player.hands[0].cards) <= 21)

    if (!alive.length) {
      lines.push('⚠️ 全员爆牌或投降，注金由系统收回。')
      for (const player of this.players) {
        if (!player.hands[0].surrendered) await this.record(player, -player.bet)
      }
    } else {
      const rank = (player: Player) => isBlackjack(player.hands[0]) ? 22 : score(player.hands[0].cards)
      const best = Math.max(...alive.map(rank))
      const winners = alive.filter((player) => rank(player) === best)
      const winnerIds = new Set(winners.map((player) => player.userId))

      for (const player of this.players) {
        if (winnerIds.has(player.userId) || player.hands[0].surrendered) continue
        lines.push(`${player.username}：❌ 输（-${player.bet}）`)
        await this.record(player, -player.bet)
      }

      const share = Math.floor(pool / winners.length)
      for (const winner of winners) {
        await this.economy.payout(winner.platform, winner.userId, share)
        lines.push(`${winner.username}：🏆 赢（+${share - winner.bet}）`)
        await this.record(winner, share - winner.bet)
      }
    }

    await this.say(['📋 结算报告', '———————————————', ...lines].join('\n'))
    this.end()
  }

  private async record(player: Player, profit: number) {
    const rounded = Math.round(profit)
    const [stat] = await this.ctx.database.get('blackjack_stats', { userId: player.userId })
    const blackjacks = player.hands.filter(isBlackjack).length
    if (!stat) {
      await this.ctx.database.create('blackjack_stats', {
        userId: player.userId,
        username: player.username,
        wins: rounded > 0 ? 1 : 0,
        loses: rounded < 0 ? 1 : 0,
        draws: rounded === 0 ? 1 : 0,
        bjCount: blackjacks,
        totalProfit: rounded,
      })
      return
    }
    await this.ctx.database.set('blackjack_stats', { id: stat.id }, {
      username: player.username,
      wins: stat.wins + (rounded > 0 ? 1 : 0),
      loses: stat.loses + (rounded < 0 ? 1 : 0),
      draws: stat.draws + (rounded === 0 ? 1 : 0),
      bjCount: stat.bjCount + blackjacks,
      totalProfit: stat.totalProfit + rounded,
    })
  }

  table(footer = '') {
    const lines = ['🃏 21 点']
    if (!this.pvp && this.dealer.length) {
      const reveal = this.phase === Phase.DealerTurn || this.phase === Phase.Ended
      lines.push(reveal
        ? `庄家：${format(this.dealer)} [${score(this.dealer)}]`
        : `庄家：${format([this.dealer[0]])} [?]`, '')
    }
    for (const player of this.players) {
      const hands = player.hands.map((hand) => {
        const marks = [hand.surrendered && '🏳️', hand.doubled && '💰', hand.insurance && '🛡️', hand.fromSplit && '🔱']
        return `${format(hand.cards)} [${score(hand.cards)}] ${marks.filter(Boolean).join('')}`.trim()
      })
      lines.push(`${player.username}（${player.bet}）：${hands.join(' | ')}`)
    }
    if (footer) lines.push('', footer)
    return lines.join('\n')
  }
}
