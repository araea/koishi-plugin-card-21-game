import { Context, Random } from 'koishi'
import {} from 'koishi-plugin-monetary'
import { Config } from './config'
import { createEconomy } from './economy'
import { Game, Phase } from './session'

export { Config }
export const name = 'card-21-game'
export const inject = { required: ['database'], optional: ['monetary'] }

export const usage = `## 使用

\`bj.来一局\` 开桌，PVP 加 \`-n\`。\`下注 100\` 入座（不带金额则随机下注），\`开始\` 或等倒计时。

## 操作

| 指令 | 别名 | 说明 |
| --- | --- | --- |
| 要牌 | \`hit\` / \`h\` | |
| 停牌 | \`stand\` / \`s\` | |
| 加倍 | \`double\` / \`d\` | 首轮，注金翻倍 |
| 分牌 | \`split\` / \`p\` | 起手对子 |
| 投降 | | 开局 5 秒内 |
| 保险 | | 庄家明牌为 A |

## 规则

接近 21 点但不超过。Blackjack 赔率 3:2。庄家小于 17 必须要牌。`

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
}

/** 每日低保的领取记录，date 为本地日期（YYYY-MM-DD）。 */
export interface BlackjackWelfare {
  userId: string
  date: string
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

  ctx.model.extend('blackjack_welfare', {
    userId: 'string',
    date: 'string',
  }, { primary: 'userId' })

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
      const bet = /^(下注|bet)\s*(\S+)?$/.exec(text)
      if (bet) {
        const arg = bet[2] ?? ''
        if (/^\d+$/.test(arg)) return reply(await game.join(session.platform, session.userId, username, +arg))
        // 没带金额或写岔了：替玩家随机来一注可承受的
        const balance = await economy.balance(session.platform, session.userId)
        if (balance < config.minBet) {
          return reply(`⚠️ 余额不足（当前 ${balance}）。${config.welfareEnabled ? '发送「bj.低保」领取今日东山再起资金。' : ''}`)
        }
        const amount = Random.int(config.minBet, Math.min(balance, config.minBet * 10))
        const message = await game.join(session.platform, session.userId, username, amount)
        if (message.startsWith('✅')) return reply(`${message}\n💡 不合心意？发送「下注 N」即可调整。`)
        return reply(message)
      }
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

  const cmd = ctx.command('bj', '21 点纸牌游戏')
    .alias('blackjack')
    .action(() => [
      '🃏 21 点',
      '',
      '指令',
      '▸ bj.来一局 [-n]　创建对局（-n 为 PVP）',
      '▸ bj.低保　　　　每日一次东山再起资金',
      '▸ bj.强制结束　　结束当前对局并退款',
      '▸ bj.战绩　　　　查询个人战绩',
      '▸ bj.排行 [-l N]　盈亏排行榜',
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
        '请发送「下注 100」加入游戏（金额自定，不带金额则随机下注）。',
        '发送「开始」立即发牌。',
      ].join('\n')
    })

  cmd.subcommand('.低保', '领取每日一次的东山再起资金')
    .alias('bj.东山再起')
    .action(async ({ session }) => {
      if (!config.welfareEnabled) return '⚠️ 低保功能未开启。'
      const balance = await economy.balance(session.platform, session.userId)
      if (balance >= config.minBet) {
        return `💰 你的余额还有 ${balance}，先上桌拼一把，真到了山穷水尽再来找低保。`
      }
      const today = new Date().toLocaleDateString('sv')
      const [record] = await ctx.database.get('blackjack_welfare', { userId: session.userId })
      if (record?.date === today) return '⚠️ 今天已经领过低保了，明天再来吧。'
      await ctx.database.upsert('blackjack_welfare', [{ userId: session.userId, date: today }])
      await economy.payout(session.platform, session.userId, config.welfareAmount)
      return `💰 低保已到账：${config.welfareAmount}。愿你东山再起，牌运亨通。`
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
    .alias('bj.rank')
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
