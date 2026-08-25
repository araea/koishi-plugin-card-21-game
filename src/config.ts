import { Schema } from 'koishi'

export interface Config {
  minBet: number
  deckCount: number
  playerTurnTimeout: number
  joinPhaseTimeout: number
  currency: 'monetary' | 'bella'
  currencyName?: string
  dealerHitSoft17: boolean
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    minBet: Schema.natural().min(1).default(10).description('最低起注金额。'),
    deckCount: Schema.natural().min(1).max(8).default(4).description('牌靴里的副数（一副 52 张）。'),
    playerTurnTimeout: Schema.natural().min(5).default(30).description('玩家操作超时（秒），超时自动停牌。'),
    joinPhaseTimeout: Schema.natural().min(5).default(45).description('加入阶段的等待时间（秒）。'),
    dealerHitSoft17: Schema.boolean().default(false).description('庄家在软 17（含被当作 11 的 A）时是否继续要牌。'),
  }).description('游戏设置'),

  Schema.intersect([
    Schema.object({
      currency: Schema.union([
        Schema.const('monetary').description('monetary（Koishi 通用货币）'),
        Schema.const('bella').description('bella（bella-sign-in 插件的积分）'),
      ]).default('monetary').description('使用的货币系统。'),
    }),
    Schema.union([
      Schema.object({
        currency: Schema.const('monetary'),
        currencyName: Schema.string().default('default').description('monetary 的货币名称。'),
      }),
      Schema.object({}),
    ]),
  ]).description('货币设置'),
]) as Schema<Config>
