import { Context, Random, Session } from 'koishi'
import {} from 'koishi-plugin-monetary'
import { Config } from './config'
import { createEconomy } from './economy'
import { Game, Phase } from './session'

export { Config }
export const name = 'card-21-game'
export const inject = { required: ['database'], optional: ['monetary'] }

export const usage = `## 使用

发送 \`bj.来一局\` 开桌，加 \`-n\` 启用 PVP。发送 \`下注\` 入座，注额由系统按余额随机安排；余额用尽时自动领取每日一次的东山再起资金。再发送 \`开始\` 或等待倒计时。

## 指令

| 指令 | 说明 |
| --- | --- |
| \`bj.来一局\` | 开一桌新对局，加 \`-n\` 启用 PVP |
| \`bj.战绩 [@某人]\` | 查询战绩 |
| \`bj.排行榜\` | 查看盈亏排行榜 |
| \`bj.结束\` | 结束当前对局并退款，发起者或权限 2 |

对局中的动作写成 \`bj.动作\`，也接受裸词（无需指令前缀）：

| 动作 | 裸词 | 说明 |
| --- | --- | --- |
| \`bj.下注\` | \`下注\` | 入座，注额由系统按余额随机安排 |
| \`bj.开始\` | \`开始\` | 发牌并进入下一阶段 |
| \`bj.要牌\` | \`要牌\` / \`h\` | |
| \`bj.停牌\` | \`停牌\` / \`s\` | |
| \`bj.加倍\` | \`加倍\` / \`d\` | 首轮将注金翻倍 |
| \`bj.分牌\` | \`分牌\` / \`p\` | 起手对子可用 |
| \`bj.投降\` | \`投降\` | 开局 5 秒内可用 |
| \`bj.保险\` | \`保险\` | 庄家明牌为 A 时可用 |

## 规则

点数不超过 21 且尽量接近 21。Blackjack 赔率 3:2，庄家点数小于 17 时必须要牌。`

declare module 'koishi' {
  interface Tables {
    blackjack_stats: BlackjackStats
    blackjack_welfare: BlackjackWelfare
  }
}

export interface BlackjackStats {
  id: number
  userId: string
  username: string
  wins: number
  loses: number
  draws: number
  bjCount: number
  totalProfit: number
  /** 当前连势：正数为连胜，负数为连败，0 无连势。 */
  streak: number
}

/** 每日低保的领取记录，date 为本地日期（YYYY-MM-DD）。 */
export interface BlackjackWelfare {
  userId: string
  date: string
}

/** 一局里能做的动作。 */
type Action = 'join' | 'start' | 'insure' | 'skip' | 'surrender' | 'hit' | 'stand' | 'double' | 'split'

/** 聊天里可以直接发的动作词，与 bj.* 子指令一一对应。 */
const BARE_ACTIONS: Record<string, Action> = {
  下注: 'join', bet: 'join',
  开始: 'start', start: 'start', continue: 'start', 继续: 'start',
  保险: 'insure', insure: 'insure', yes: 'insure',
  跳过: 'skip', skip: 'skip', no: 'skip',
  投降: 'surrender', surrender: 'surrender',
  要牌: 'hit', hit: 'hit', h: 'hit',
  停牌: 'stand', stand: 'stand', s: 'stand',
  加倍: 'double', double: 'double', d: 'double',
  分牌: 'split', split: 'split', p: 'split',
}

/** bj.* 子指令：完整入口，关掉裸词后仍然打得出。 */
const ACTION_COMMANDS: Array<[string, string, Action, string]> = [
  ['.下注', '.bet', 'join', '入座，注额由系统按余额随机安排'],
  ['.开始', '.start', 'start', '发牌并进入下一阶段'],
  ['.保险', '.insure', 'insure', '庄家明牌为 A 时买入'],
  ['.跳过', '.skip', 'skip', '不买保险，等窗口到时继续'],
  ['.投降', '.surrender', 'surrender', '认输，只输一半注金'],
  ['.要牌', '.hit', 'hit', '再要一张牌'],
  ['.停牌', '.stand', 'stand', '不再要牌，交给下一位'],
  ['.加倍', '.double', 'double', '首轮将注金翻倍'],
  ['.分牌', '.split', 'split', '起手对子时分开两手牌'],
]

export function apply(ctx: Context, config: Config) {
  ctx.model.extend('blackjack_stats', {
    id: 'unsigned',
    userId: 'string',
    username: 'string',
    wins: 'unsigned',
    loses: 'unsigned',
    draws: 'unsigned',
    bjCount: 'unsigned',
    totalProfit: 'double',
    streak: 'integer',
  }, { primary: 'id', autoInc: true })

  ctx.model.extend('blackjack_welfare', {
    userId: 'string',
    date: 'string',
  }, { primary: 'userId' })

  const economy = createEconomy(ctx, config)
  const games = new Map<string, Game>()

  /** 山穷水尽（余额不足起注）时自动发放当日低保，返回发放金额；不可领返回 0。 */
  async function claimWelfare(platform: string, userId: string, balance: number) {
    if (!config.welfareEnabled || balance >= config.minBet) return 0
    const today = new Date().toLocaleDateString('sv')
    const [record] = await ctx.database.get('blackjack_welfare', { userId })
    if (record?.date === today) return 0
    await ctx.database.upsert('blackjack_welfare', [{ userId, date: today }])
    await economy.payout(platform, userId, config.welfareAmount)
    return config.welfareAmount
  }

  /**
   * 下注入口：注额由系统按余额随机安排，玩家无需操心；
   * 余额见底则先自动领当日低保——一条消息就能坐上牌桌。
   */
  async function autoJoin(game: Game, session: Session, username: string) {
    const { platform, userId } = session
    const seated = game.seated(userId)
    if (seated !== null) return `💡 ${username} 已在牌桌上，注 ${seated}\n发送「开始」立即发牌。`

    let balance = await economy.balance(platform, userId)
    const welfare = await claimWelfare(platform, userId, balance)
    if (welfare) balance += welfare

    if (balance < config.minBet) {
      const reason = welfare
        ? `已发放今日低保 ${welfare}，仍不够起注 ${config.minBet}。`
        : config.welfareEnabled ? '今日低保已领过，跨零点后重置。' : '余额见底，先攒一点再来。'
      return [`⚠️ 余额不足，当前 ${balance}`, reason, '发送「bj.战绩」看看战绩。'].join('\n')
    }

    const amount = Random.int(config.minBet, Math.min(balance, config.minBet * 10))
    const joined = await game.join(platform, userId, username, amount)
    // 结果行在最前，余额见底的说明退到正文
    return welfare ? `${joined}\n余额见底，已自动发放今日低保 ${welfare}，愿你东山再起。` : joined
  }

  ctx.on('dispose', () => {
    for (const game of games.values()) {
      game.refundAll().catch(() => {})
      game.end()
    }
    games.clear()
  })

  /**
   * 动作的唯一实现：裸词中间件与 bj.* 子指令都走这里。
   * 返回空串表示这次不适用，调用方据此交还给下一个中间件。
   */
  async function act(session: Session, action: Action): Promise<string | undefined> {
    const game = games.get(session.channelId)
    if (!game || game.phase === Phase.Ended) return undefined

    if (action === 'join') {
      // 注额由系统按余额随机安排
      return game.phase === Phase.Joining ? autoJoin(game, session, session.username || session.userId) : undefined
    }
    if (action === 'start') {
      if (game.phase === Phase.Joining) return game.start()
      if (game.phase === Phase.Surrender) {
        game.playerTurns()
        return ''
      }
      return undefined
    }
    if (action === 'insure') {
      return game.phase === Phase.Insurance ? game.insure(session.userId) : undefined
    }
    if (action === 'skip') {
      // 跳过保险只是不作声，等窗口到时自己往下走
      return game.phase === Phase.Insurance ? '' : undefined
    }
    if (action === 'surrender') {
      return game.phase === Phase.Surrender ? game.surrender(session.userId) : undefined
    }
    if (game.phase !== Phase.PlayerTurn) return undefined
    // hit() 用空串表示「这一手不归你」，这里换算成「不适用」，好让裸词交还给下一个中间件
    const out = await game.hit(session.userId, action)
    return out === '' ? undefined : out
  }

  // 对局中的频道才解析这些裸指令；其余频道只做一次 Map 查询
  ctx.middleware(async (session, next) => {
    if (!config.enableDirectInput) return next()
    const game = games.get(session.channelId)
    if (!game || game.phase === Phase.Ended) return next()

    // 下注允许带上金额，金额本身由系统安排，这里只看形状
    const raw = session.content.trim().toLowerCase()
    const text = /^(下注|bet)(\s*\d+)?$/.test(raw) ? '下注' : raw
    const action = BARE_ACTIONS[text]
    if (!action) return next()

    const reply = await act(session, action)
    // 不适用就交出去，不把别人的消息吞掉；空串表示已接手但没有话要说
    if (reply === undefined) return next()
    if (reply) await session.send(reply)
  })

  const cmd = ctx.command('bj', '21 点纸牌游戏')
    .alias('blackjack')
    .action(({ session }) => session.execute('help bj'))

  cmd.subcommand('.来一局', '开一桌新对局')
    .option('nodealer', '-n 无庄家的 PVP 模式')
    .action(async ({ session, options }) => {
      if (games.has(session.channelId)) return '⚠️ 本频道已有对局正在进行\n发送「bj.结束」结束它，再开新的。'
      const game = new Game(ctx, config, economy, session.bot, session.channelId,
        !!options.nodealer, session.userId, () => games.delete(session.channelId))
      games.set(session.channelId, game)
      return [
        `✅ 21 点对局已创建（${options.nodealer ? 'PVP' : 'PVE'}）`,
        `发送「下注」入座，注额由系统按余额随机安排。${config.joinPhaseTimeout} 秒后自动开始。`,
        '发送「开始」立即发牌。',
      ].join('\n')
    })

  cmd.subcommand('.结束', '结束当前对局并退款')
    .userFields(['id', 'name', 'authority'])
    .action(async ({ session }) => {
      const game = games.get(session.channelId)
      if (!game) return '💡 本频道没有进行中的对局。\n发送「bj.来一局」开一桌。'
      if (game.phase === Phase.DealerTurn) return '⏳ 正在结算\n等这局收完再结束。'
      const authority = session.user?.authority ?? 0
      if (session.userId !== game.initiator && authority < 2) {
        return '⚠️ 权限不够\n只有发起者或权限 2 以上的人能结束这一局。'
      }
      await game.refundAll()
      game.end()
      return '✅ 对局已结束，注金已退回。'
    })

  // 动作的完整入口：关掉 enableDirectInput 之后靠这些指令打完一局
  for (const [name, alias, action, description] of ACTION_COMMANDS) {
    cmd.subcommand(name, description)
      .alias(alias)
      .action(async ({ session }) => {
        const reply = await act(session, action)
        return reply ?? '💡 现在不是这个动作的时候\n发送「bj.战绩」看战绩，或等下一次机会。'
      })
  }

  cmd.subcommand('.战绩 [target:user]', '查询战绩')
    .action(async ({ session }, target) => {
      const userId = target ? target.split(':')[1] : session.userId
      const [stat] = await ctx.database.get('blackjack_stats', { userId })
      if (!stat) return '📋 还没有战绩\n打完第一局后，这里会记下盈亏、胜率与连胜。\n发送「bj.来一局」开一桌。'
      const total = stat.wins + stat.loses + stat.draws
      const rate = total ? (stat.wins / total * 100).toFixed(1) : '0.0'
      return [
        `📋 ${stat.username} 的战绩`,
        `总盈亏：${stat.totalProfit > 0 ? '+' : ''}${stat.totalProfit} 💰`,
        `胜 ${stat.wins} · 负 ${stat.loses} · 平 ${stat.draws} 🤝`,
        `Blackjack ${stat.bjCount} 次`,
        `胜率 ${rate}%${stat.streak >= 2 ? ` · 当前 ${stat.streak} 连胜` : ''}${stat.streak <= -2 ? ` · 当前 ${-stat.streak} 连败` : ''}`,
      ].join('\n')
    })

  cmd.subcommand('.排行榜 [count:posint]', '查看盈亏排行榜')
    .action(async ({ session }, count = 10) => {
      const rows = await ctx.database
        .select('blackjack_stats')
        .orderBy('totalProfit', 'desc')
        .limit(Math.min(count, 20))
        .execute()
      if (!rows.length) return '📋 排行榜还空着\n第一个坐上牌桌的人，名字会写在这里。\n发送「bj.来一局」开一桌。'
      const medals = ['🥇', '🥈', '🥉']
      // 纯文本不出图，列四条封顶，其余折成一行汇总
      const shown = rows.slice(0, 4)
      return [`📋 21 点盈亏排行榜 · 前 ${shown.length} 位`,
        ...shown.map((stat, index) =>
          `${medals[index] ?? `${index + 1}.`} ${stat.username}：${stat.totalProfit > 0 ? '+' : ''}${stat.totalProfit}`),
      ].join('\n')
    })
}
