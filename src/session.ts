import { Bot, Context, sleep } from 'koishi'
import { Card, createShoe, format, score, value } from './cards'
import { Config } from './config'
import { createEconomy } from './economy'

export enum Phase { Joining, Dealing, Insurance, Surrender, PlayerTurn, DealerTurn, Ended }

/** 庄家横扫全场的连续局数（氛围播报用，重启归零）。 */
let dealerSweep = 0

/** 连势播报尾巴：两连胜/连败起才有戏可唱。 */
const streakMark = (streak: number) =>
  streak >= 2 ? ` 🔥 ${streak} 连胜` : streak <= -2 ? ` 🥶 ${-streak} 连败` : ''

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
  /** 已退款或已结算，防止结算路径与 .结束 各赔一次。 */
  private settled = false
  private dispose: () => void = null
  /** 保险 / 投降阶段已表态的玩家；全员表态就不必等满窗口。 */
  private decided = new Set<string>()

  constructor(
    private ctx: Context,
    private config: Config,
    private economy: Economy,
    private bot: Bot,
    public channelId: string,
    public pvp: boolean,
    /** 发起这一局的人；结束他人对局要卡在这里。 */
    public initiator: string,
    private onEnd: () => void,
  ) {
    this.wait(() => this.joinTimeout(), config.joinPhaseTimeout)
  }

  // --- 基础设施 ---

  private wait(callback: () => Promise<void> | void, seconds: number) {
    if (this.phase === Phase.Ended) return
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

  /** 等待期间可能已被 .结束 收掉；用取值器读，避免被类型收窄误判。 */
  private get isEnded() {
    return this.phase === Phase.Ended
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
    if (this.settled) return false
    this.settled = true
    let success = true
    for (const player of this.players) {
      // 加倍与分牌都会追加下注，退款要按每手实际注金算
      const staked = player.hands.reduce((sum, hand) => sum + hand.bet + hand.insurance, 0)
      if (!await this.economy.payout(player.platform, player.userId, staked)) success = false
    }
    return success
  }

  // --- 加入阶段 ---

  /** 已入座玩家的当前注金；未入座返回 null。 */
  seated(userId: string): number | null {
    return this.players.find((player) => player.userId === userId)?.bet ?? null
  }

  /** 加入对局；注额由上层随机定夺，这里只管扣款入座。 */
  async join(platform: string, userId: string, username: string, bet: number): Promise<string> {
    if (this.phase !== Phase.Joining) return '💡 这一局已经开始了，下一局再入座。'
    if (this.busy) return '⏳ 正在处理上一位入座，稍后再发。'

    this.busy = true
    try {
      if (!await this.economy.charge(platform, userId, bet)) {
        const have = await this.economy.balance(platform, userId)
        return `⚠️ 余额不足\n下注 ${bet} 还差 ${bet - have}，当前余额 ${have}。`
      }
      this.players.push({ userId, username, platform, bet, hands: [newHand(bet)], handIndex: 0 })
    } finally {
      this.busy = false
    }

    this.wait(() => this.joinTimeout(), this.config.joinPhaseTimeout)
    return `✅ ${username} 加入成功（下注 ${bet}）。当前 ${this.players.length} 人。`
  }

  private async joinTimeout() {
    if (!this.players.length) {
      await this.say('💡 无人入座，这一局作罢\n发送「bj.来一局」再开一桌。')
      return this.end()
    }
    if (this.pvp && this.players.length < 2) {
      const refunded = await this.refundAll()
      await this.say(`人数不够，本局结束。${refunded ? '注金已退还。' : '部分退款尚未确认，请联系管理员使用「bj.待核对」核对。'}\n发送「bj.来一局」可重新开局。`)
      return this.end()
    }
    await this.say('⏳ 准备时间结束，自动开始。')
    await this.start()
  }

  async start(): Promise<string> {
    if (this.phase !== Phase.Joining) return '💡 这一局已经过了入座阶段。'
    if (!this.players.length) return '💡 还没有人入座，发送「bj.下注」坐上牌桌。'
    if (this.pvp && this.players.length < 2) return '⚠️ PVP 至少需要 2 人\n再等一位，或发送「bj.结束」换成 PVE。'

    this.clear()
    this.phase = Phase.Dealing
    this.shoe = createShoe(this.config.deckCount)

    for (let round = 0; round < 2; round++) {
      for (const player of this.players) player.hands[0].cards.push(this.draw())
      if (!this.pvp) this.dealer.push(this.draw())
      if (!round) await sleep(500)
    }

    await this.say(this.table('✅ 对局开始，发牌完毕。'))

    if (!this.pvp && this.dealer[0]?.rank === 'A') {
      this.phase = Phase.Insurance
      this.decided.clear()
      await this.say(`💡 庄家明牌为 A，要买保险吗\n发送「bj.保险」买入，或发送「bj.跳过」。\n全员表态或 ${this.config.decisionTimeout} 秒后进入投降阶段。`)
      this.wait(() => this.surrenderPhase(), this.config.decisionTimeout)
      return ''
    }
    await this.surrenderPhase()
    return ''
  }

  private async surrenderPhase() {
    this.phase = Phase.Surrender
    this.decided.clear()
    await this.say(`💡 投降阶段 · 牌型不佳可发送「bj.投降」，只输一半注金\n不投降就发送「bj.跳过」；全员表态或 ${this.config.decisionTimeout} 秒后进入玩家回合。`)
    this.wait(() => this.playerTurns(), this.config.decisionTimeout)
  }

  /** 记下一位玩家的表态；全员表态后稍等片刻进入下一阶段，好让这条回复先发出去。 */
  private decide(userId: string) {
    this.decided.add(userId)
    if (!this.players.every((player) => this.decided.has(player.userId))) return
    this.wait(() => this.phase === Phase.Insurance ? this.surrenderPhase() : this.playerTurns(), 0.5)
  }

  /** 不买保险或不投降。只有入座且尚未表态的玩家才算数。 */
  skip(userId: string): string {
    if (this.phase !== Phase.Insurance && this.phase !== Phase.Surrender) return ''
    if (!this.players.some((player) => player.userId === userId) || this.decided.has(userId)) return ''
    this.decide(userId)
    return ''
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
      await this.say(`🏆 ${player.username} 摸出 Blackjack，天选之牌！`)
      return this.next()
    }

    const total = score(hand.cards)
    if (total >= 21) {
      hand.finished = true
      if (total > 21) await this.say(`💥 ${player.username} 爆牌（${total}）`)
      return this.next()
    }

    const actions = ['要牌', '停牌']
    if (this.canDouble(hand)) actions.push('加倍')
    if (this.canSplit(player)) actions.push('分牌')

    const which = player.hands.length > 1 ? `（手牌 ${player.handIndex + 1}/${player.hands.length}）` : ''
    await this.say(`⏳ 轮到 ${player.username}${which}\n当前牌：${format(hand.cards)} [${total}]\n可发送：${actions.map(a => 'bj.' + a).join(' · ')}。${this.config.playerTurnTimeout} 秒内不动作将自动停牌。`)

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
    if (this.phase !== Phase.PlayerTurn) return ''
    if (this.busy) return '⏳ 上一手还在处理，稍后再发。'
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
        return `${player.username} 要牌：${format([card])} → [${total}]${total === 21 ? ' 🎯 恰到好处' : ''}`
      }

      if (action === 'double') {
        if (!this.canDouble(hand)) return this.pvp ? '💡 PVP 模式不支持加倍。' : '💡 加倍只能在首轮使用。'
        if (!await this.economy.charge(player.platform, player.userId, hand.bet)) return '⚠️ 余额不足，加倍需要再付一份注金。'
        hand.bet *= 2
        hand.doubled = true
        const card = this.draw()
        hand.cards.push(card)
        hand.finished = true
        this.wait(() => this.advance(), 1)
        return `${player.username} 加倍，注金 ${hand.bet}。发牌：${format([card])} → [${score(hand.cards)}]`
      }

      if (!this.canSplit(player)) return this.pvp ? '💡 PVP 模式不支持分牌。' : '💡 只有起手对子才能分牌。'
      if (!await this.economy.charge(player.platform, player.userId, hand.bet)) return '⚠️ 余额不足，分牌需要再付一份注金。'

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
    this.decide(userId)
    return `${player.username} 选择投降（保留一半注金）。`
  }

  async insure(userId: string): Promise<string> {
    if (this.phase !== Phase.Insurance) return ''
    const player = this.players.find((item) => item.userId === userId)
    if (!player || player.hands[0].insurance > 0) return ''
    const cost = Math.floor(player.hands[0].bet / 2)
    if (!await this.economy.charge(player.platform, player.userId, cost)) return `⚠️ 余额不足，保险需要 ${cost}。`
    player.hands[0].insurance = cost
    this.decide(userId)
    return `✅ ${player.username} 购买了保险（花费 ${cost}）。`
  }

  // --- 庄家与结算 ---

  private async dealerTurn() {
    this.clear()
    if (this.pvp) return this.settlePvp()

    this.phase = Phase.DealerTurn
    await this.say(`庄家亮牌：${format(this.dealer)} [${score(this.dealer)}]`)
    await sleep(1000)
    if (this.isEnded) return

    // 快速模式：庄家的牌一次抽完，一次说完
    if (this.config.quickMode) {
      while (score(this.dealer) < 17 || (this.config.dealerHitSoft17 && isSoft17(this.dealer))) {
        this.dealer.push(this.draw())
      }
      const quick = score(this.dealer)
      const board = `庄家：${format(this.dealer)} [${quick}]`
      await this.say(quick > 21 ? `${board}\n💥 庄家爆牌（${quick}），全场松了口气。` : board)
      await this.settlePve()
      return
    }

    while (score(this.dealer) < 17 || (this.config.dealerHitSoft17 && isSoft17(this.dealer))) {
      const card = this.draw()
      this.dealer.push(card)
      await this.say(`庄家要牌：${format([card])} → [${score(this.dealer)}]`)
      await sleep(1500)
      if (this.isEnded) return
    }

    const total = score(this.dealer)
    await this.say(total > 21 ? `💥 庄家爆牌（${total}），全场松了口气。` : `庄家最终点数：${total}`)
    await this.settlePve()
  }

  private async settlePve() {
    if (this.settled) return
    this.settled = true
    const dealerScore = score(this.dealer)
    const dealerBj = this.dealer.length === 2 && dealerScore === 21
    const dealerBust = dealerScore > 21
    const lines: string[] = []
    let swept = true

    for (const player of this.players) {
      let profit = 0
      const marks: string[] = []

      for (const hand of player.hands) {
        if (hand.insurance > 0) {
          if (dealerBj) {
            await this.economy.payout(player.platform, player.userId, hand.insurance * 3)
            profit += hand.insurance * 2
            marks.push('🛡️ 保赢')
          } else {
            profit -= hand.insurance
            marks.push('🛡️ 保亏')
          }
        }

        if (hand.surrendered) {
          await this.economy.payout(player.platform, player.userId, hand.bet / 2)
          profit -= hand.bet / 2
          marks.push('🏳️ 投降')
          continue
        }

        const total = score(hand.cards)
        const playerBj = isBlackjack(hand)

        if (total > 21) {
          profit -= hand.bet
          marks.push(`💥 爆 -${hand.bet}`)
        } else if (playerBj && !dealerBj) {
          await this.economy.payout(player.platform, player.userId, hand.bet * 2.5)
          profit += hand.bet * 1.5
          marks.push(`⚡️ BJ 胜 +${hand.bet * 1.5}`)
        } else if (playerBj || (!dealerBj && (dealerBust || total > dealerScore))) {
          if (playerBj) {
            await this.economy.payout(player.platform, player.userId, hand.bet)
            marks.push('🤝 BJ 平')
          } else {
            await this.economy.payout(player.platform, player.userId, hand.bet * 2)
            profit += hand.bet
            // 差一步险胜，回味最久
            marks.push(!dealerBust && total - dealerScore <= 1 ? `🥊 险胜 +${hand.bet}` : `🎉 胜 +${hand.bet}`)
          }
        } else if (!dealerBj && total === dealerScore) {
          await this.economy.payout(player.platform, player.userId, hand.bet)
          marks.push('🤝 平')
        } else {
          profit -= hand.bet
          marks.push(`🔻 败 -${hand.bet}`)
        }
      }

      if (profit >= 0) swept = false
      lines.push(`${player.username}：${marks.join(' · ')}${streakMark(await this.record(player, profit))}`)
    }

    dealerSweep = swept ? dealerSweep + 1 : 0
    if (swept) {
      lines.push(dealerSweep >= 2
        ? `庄家横扫全场 🏛️ 已连庄 ${dealerSweep} 局，今晚的赌桌格外冷酷。`
        : '庄家横扫全场 🏛️')
    }

    for (const player of this.players) {
      if (await this.economy.pending(player.platform, player.userId)) lines.push(`${player.username}：入账尚未确认，以上为对局应得金额。请联系管理员用「bj.待核对」核对，勿重复付款。`)
    }
    await this.say([this.table(), '', '📋 结算报告', ...lines].join('\n'))
    this.end()
  }

  private async settlePvp() {
    if (this.settled) return
    this.settled = true
    const lines: string[] = []
    let pool = 0

    for (const player of this.players) {
      const hand = player.hands[0]
      if (hand.surrendered) {
        await this.economy.payout(player.platform, player.userId, player.bet / 2)
        pool += player.bet / 2
        lines.push(`${player.username}：🏳️ 投降${streakMark(await this.record(player, -player.bet / 2))}`)
      } else {
        pool += player.bet
      }
    }

    const alive = this.players.filter((player) =>
      !player.hands[0].surrendered && score(player.hands[0].cards) <= 21)

    if (!alive.length) {
      lines.push('💥 全员爆牌或投降，注金由系统收回。')
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
        lines.push(`${player.username}：🔻 败 -${player.bet}${streakMark(await this.record(player, -player.bet))}`)
      }

      const share = Math.floor(pool / winners.length)
      for (const winner of winners) {
        await this.economy.payout(winner.platform, winner.userId, share)
        lines.push(`${winner.username}：🏆 胜 +${share - winner.bet}${streakMark(await this.record(winner, share - winner.bet))}`)
      }
    }

    for (const player of this.players) {
      if (await this.economy.pending(player.platform, player.userId)) lines.push(`${player.username}：入账尚未确认，以上为对局应得金额。请联系管理员用「bj.待核对」核对，勿重复付款。`)
    }
    await this.say([this.table(), '', '📋 结算报告', ...lines].join('\n'))
    this.end()
  }

  /** 记录战绩并返回玩家当前连势（正连胜、负连败）。 */
  private async record(player: Player, profit: number): Promise<number> {
    const rounded = Math.round(profit)
    const [stat] = await this.ctx.database.get('blackjack_stats', { userId: player.userId })
    const blackjacks = player.hands.filter(isBlackjack).length
    // 平局不断连势；胜负则延续或重开
    const streak = rounded > 0 ? Math.max(stat?.streak ?? 0, 0) + 1
      : rounded < 0 ? Math.min(stat?.streak ?? 0, 0) - 1
      : stat?.streak ?? 0
    if (!stat) {
      await this.ctx.database.create('blackjack_stats', {
        userId: player.userId,
        username: player.username,
        wins: rounded > 0 ? 1 : 0,
        loses: rounded < 0 ? 1 : 0,
        draws: rounded === 0 ? 1 : 0,
        bjCount: blackjacks,
        totalProfit: rounded,
        streak,
      })
      return streak
    }
    await this.ctx.database.set('blackjack_stats', { id: stat.id }, {
      username: player.username,
      wins: stat.wins + (rounded > 0 ? 1 : 0),
      loses: stat.loses + (rounded < 0 ? 1 : 0),
      draws: stat.draws + (rounded === 0 ? 1 : 0),
      bjCount: stat.bjCount + blackjacks,
      totalProfit: stat.totalProfit + rounded,
      streak,
    })
    return streak
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
