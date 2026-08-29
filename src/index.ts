import { Context } from 'koishi'
import {} from 'koishi-plugin-monetary'
import { Config } from './config'
import { createEconomy } from './economy'
import { Game, Phase } from './session'

export { Config }
export const name = 'card-21-game'
export const inject = { required: ['database'], optional: ['monetary'] }

export const usage = `## 🃏 21 点（Blackjack）

还原真实赌场规则，支持分牌、加倍、保险与投降。

### 🎮 快速开始

1. \`blackjack.来一局\` 创建对局（加 \`-n\` 为无庄家的 PVP 模式）。
2. 发送 \`下注 100\` 或 \`bet 100\` 加入。
3. 发送 \`开始\` 立即发牌，等待超时也会自动开始。

### 🕹️ 游戏操作

轮到你时直接发送：\`要牌\` / \`停牌\` / \`加倍\` / \`分牌\`，
以及阶段性的 \`投降\`（开局前 5 秒）与 \`保险\`（庄家明牌为 A 时）。

### ⚙️ 规则

- Blackjack 赔 3:2，分牌后的 21 点不算 Blackjack。
- 庄家点数小于 17 必须要牌；软 17 是否要牌可在配置里切换。
- 分 A 后每手只发一张牌并强制结束。
- PVP 模式为玩家互相比大小，不支持加倍与分牌。
`

declare module 'koishi' {
  interface Tables {
    blackjack_stats: BlackjackStats
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
}

/** 聊天里可以直接发的动作词。 */
const ACTIONS = {
  要牌: 'hit', hit: 'hit', h: 'hit',
  停牌: 'stand', stand: 'stand', s: 'stand',
  加倍: 'double', double: 'double', d: 'double',
  分牌: 'split', split: 'split', p: 'split',
} as const

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
  }, { primary: 'id', autoInc: true })

  const economy = createEconomy(ctx, config)
  const games = new Map<string, Game>()

  ctx.on('dispose', () => {
    for (const game of games.values()) {
      game.refundAll().catch(() => {})
      game.end()
    }
    games.clear()
  })

  // 对局中的频道才解析这些裸指令；其余频道只做一次 Map 查询
  ctx.middleware(async (session, next) => {
    const game = games.get(session.channelId)
    if (!game || game.phase === Phase.Ended) return next()

    const text = session.content.trim().toLowerCase()
    const username = session.username || session.userId
    const reply = async (message: string) => { if (message) await session.send(message) }

    if (game.phase === Phase.Joining) {
      const bet = /^(下注|bet)\s*(\d+)$/.exec(text)
      if (bet) return reply(await game.join(session.platform, session.userId, username, +bet[2]))
      if (text === '开始' || text === 'start') return reply(await game.start())
    }

    if (game.phase === Phase.Insurance) {
      if (['保险', 'yes', 'insure'].includes(text)) return reply(await game.insure(session.userId))
      if (['跳过', 'no', 'skip'].includes(text)) return
    }

    if (game.phase === Phase.Surrender) {
      if (['投降', 'surrender'].includes(text)) return reply(await game.surrender(session.userId))
      if (['开始', '继续', 'start'].includes(text)) return game.playerTurns()
    }

    if (game.phase === Phase.PlayerTurn && ACTIONS[text]) {
      return reply(await game.hit(session.userId, ACTIONS[text]))
    }

    return next()
  })

  const cmd = ctx.command('blackjack', '21 点纸牌游戏')
    .action(() => [
      '🃏 21 点',
      '',
      '指令',
      '▸ blackjack.来一局 [-n]　创建对局（-n 为 PVP）',
      '▸ blackjack.强制结束　　结束当前对局并退款',
      '▸ blackjack.战绩　　　　查询个人战绩',
      '▸ blackjack.排行 [-l N]　盈亏排行榜',
      '',
      '核心规则',
      '▸ Blackjack 赔 3:2，庄家点数小于 17 必须要牌，分 A 只发一张',
    ].join('\n'))

  cmd.subcommand('.来一局', '创建一局新游戏')
    .option('nodealer', '-n 无庄家的 PVP 模式')
    .action(async ({ session, options }) => {
      if (games.has(session.channelId)) return '⚠️ 当前频道已有对局正在进行。'
      const game = new Game(ctx, config, economy, session.bot, session.channelId,
        !!options.nodealer, () => games.delete(session.channelId))
      games.set(session.channelId, game)
      return [
        `✅ 21 点对局已创建（${options.nodealer ? 'PVP' : 'PVE'}）`,
        '请发送「下注 100」这样的消息加入游戏（金额自定）。',
        '发送「开始」立即发牌。',
      ].join('\n')
    })

  cmd.subcommand('.强制结束', '强制结束当前对局')
    .action(async ({ session }) => {
      const game = games.get(session.channelId)
      if (!game) return '⚠️ 当前没有进行中的对局。'
      await game.refundAll()
      game.end()
      return '✅ 对局已强制结束，注金已退回。'
    })

  cmd.subcommand('.战绩 [target:user]', '查询战绩')
    .action(async ({ session }, target) => {
      const userId = target ? target.split(':')[1] : session.userId
      const [stat] = await ctx.database.get('blackjack_stats', { userId })
      if (!stat) return '⚠️ 还没有战绩记录。'
      const total = stat.wins + stat.loses + stat.draws
      const rate = total ? (stat.wins / total * 100).toFixed(1) : '0.0'
      return [
        `📋 ${stat.username} 的战绩`,
        `💰 总盈亏：${stat.totalProfit > 0 ? '+' : ''}${stat.totalProfit}`,
        `🏆 胜 ${stat.wins} | ❌ 负 ${stat.loses} | 🤝 平 ${stat.draws}`,
        `⚡️ Blackjack：${stat.bjCount} 次`,
        `📈 胜率：${rate}%`,
      ].join('\n')
    })

  cmd.subcommand('.排行', '查看盈亏排行榜')
    .alias('blackjack.rank')
    .option('limit', '-l <limit:posint> 显示数量', { fallback: 10 })
    .action(async ({ options }) => {
      const rows = await ctx.database
        .select('blackjack_stats')
        .orderBy('totalProfit', 'desc')
        .limit(Math.min(options.limit, 20))
        .execute()
      if (!rows.length) return '⚠️ 暂时没有排名数据。'
      const medals = ['🥇', '🥈', '🥉']
      return [`📋 21 点盈亏排行榜（前 ${rows.length}）`, '———————————————',
        ...rows.map((stat, index) =>
          `${medals[index] ?? `${index + 1}.`} ${stat.username}：${stat.totalProfit > 0 ? '+' : ''}${stat.totalProfit}`),
      ].join('\n')
    })
}
