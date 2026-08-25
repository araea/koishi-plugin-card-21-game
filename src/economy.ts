import { Context } from 'koishi'
import {} from 'koishi-plugin-monetary'
import { Config } from './config'

declare module 'koishi' {
  interface Tables {
    /** bella-sign-in 插件的表，这里只做类型声明，不参与建表。 */
    bella_sign_in: BellaSignIn
  }
}

export interface BellaSignIn {
  id: string
  point: number
}

/** 钱一律取整，避免 2.5 倍赔付把余额搞成小数。 */
const round = (amount: number) => Math.round(amount)

export function createEconomy(ctx: Context, config: Config) {
  const logger = ctx.logger('card-21-game')

  async function uidOf(platform: string, userId: string) {
    const user = await ctx.database.getUser(platform, userId)
    return user?.id ?? (await ctx.database.createUser(platform, userId, { authority: 1 })).id
  }

  async function balance(platform: string, userId: string): Promise<number> {
    if (config.currency === 'bella') {
      const [row] = await ctx.database.get('bella_sign_in', { id: userId })
      return row?.point ?? 0
    }
    const uid = await uidOf(platform, userId)
    const [row] = await ctx.database.get('monetary', { uid, currency: config.currencyName })
    return row?.value ?? 0
  }

  /** 扣款；余额不足直接拒绝，不会把余额扣成负数。 */
  async function charge(platform: string, userId: string, amount: number): Promise<boolean> {
    const cost = round(amount)
    if (cost <= 0) return true
    try {
      if (config.currency === 'bella') {
        const [row] = await ctx.database.get('bella_sign_in', { id: userId })
        if (!row || row.point < cost) return false
        await ctx.database.set('bella_sign_in', { id: userId }, { point: row.point - cost })
        return true
      }
      const uid = await uidOf(platform, userId)
      const [row] = await ctx.database.get('monetary', { uid, currency: config.currencyName })
      // monetary.cost 不会校验余额，必须自己先查——否则可以负债下注
      if ((row?.value ?? 0) < cost) return false
      await ctx.monetary.cost(uid, cost, config.currencyName)
      return true
    } catch (error) {
      logger.warn('扣款失败（%s）：%s', userId, error.message)
      return false
    }
  }

  async function payout(platform: string, userId: string, amount: number) {
    const gain = round(amount)
    if (gain <= 0) return
    try {
      if (config.currency === 'bella') {
        const [row] = await ctx.database.get('bella_sign_in', { id: userId })
        if (row) await ctx.database.set('bella_sign_in', { id: userId }, { point: row.point + gain })
        return
      }
      await ctx.monetary.gain(await uidOf(platform, userId), gain, config.currencyName)
    } catch (error) {
      logger.warn('赔付失败（%s）：%s', userId, error.message)
    }
  }

  return { balance, charge, payout }
}
