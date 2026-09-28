# 21 点

Koishi 插件：21 点，支持玩家对战、庄家模式与货币下注

[![GitHub](https://img.shields.io/badge/GitHub-仓库-181717)](https://github.com/araea/koishi-plugin-card-21-game)
[![npm](https://img.shields.io/badge/npm-包-cc3534)](https://www.npmjs.com/package/koishi-plugin-card-21-game)

## 安装

```sh
yarn add koishi-plugin-card-21-game
```

启用插件，并安装 `database` 服务。货币模式还需安装 `monetary` 服务。

## 快速使用

发送 `bj.来一局` 开桌，加 `-n` 开启玩家对战。发送 `bj.下注` 入座，下注金额按余额随机确定。之后发送 `bj.开始`，或等待倒计时自动开始。指令前缀 `bj` 可写作 `blackjack`。

对局中使用以下指令：

| 指令 | 裸词 | 说明 |
| --- | --- | --- |
| `bj.下注` | `下注` | 入座 |
| `bj.开始` | `开始` | 发牌并进入下一阶段 |
| `bj.要牌` | `要牌` / `h` | 要牌 |
| `bj.停牌` | `停牌` / `s` | 停牌 |
| `bj.加倍` | `加倍` / `d` | 首轮加倍 |
| `bj.分牌` | `分牌` / `p` | 起手对子时分牌 |
| `bj.投降` | `投降` | 仅投降阶段可用，只输一半注金 |
| `bj.跳过` | `跳过` | 不买保险或不投降；全员表态后立即进入下一阶段 |
| `bj.保险` | `保险` | 庄家明牌为 A 时购买保险 |
| `bj.战绩 [@某人]` | — | 查询战绩 |
| `bj.排行榜` | — | 查看盈亏排行 |
| `bj.结束` | — | 结束当前牌局 |

目标是在不超过 21 点的前提下尽量接近 21。Blackjack 赔率为 3:2，庄家点数低于 17 时必须要牌。余额不足时，玩家每天可领取一次救济资金。

## 配置

| 配置项 | 默认值 | 类型 | 说明 |
| --- | --- | --- | --- |
| `minBet` | `10` | number | 最低起注金额 |
| `deckCount` | `4` | number | 牌靴里的副数（一副 52 张），范围 1–8 |
| `playerTurnTimeout` | `30` | number | 玩家操作超时（秒），超时自动停牌，范围 5+ |
| `decisionTimeout` | `10` | number | 保险与投降阶段等待时间（秒），范围 3+ |
| `joinPhaseTimeout` | `45` | number | 加入阶段等待时间（秒），范围 5+ |
| `dealerHitSoft17` | `false` | boolean | 庄家在软 17（含被当作 11 的 A）时继续要牌 |
| `enableDirectInput` | `true` | boolean | 对局中直接发送「下注」「要牌」等动作即可，无需指令前缀 |
| `quickMode` | `false` | boolean | 快速模式：庄家的牌一次说完，不逐张揭示 |
| `welfareEnabled` | `true` | boolean | 余额见底时自动发放每日低保 |
| `welfareAmount` | `200` | number | 每日低保金额，下注时余额不足最低下注额则自动发放 |
| `currency` | `'monetary'` | `'monetary'` / `'bella'` | 使用的货币系统。monetary 为 Koishi 通用货币，bella 为 bella-sign-in 插件积分 |
| `currencyName` | `'default'` | string | monetary 的货币名称 |

## 限制 / 风险

货币模式必须安装 `monetary` 服务，否则无法下注。

出现入账待核对提示时，管理员用 `bj.待核对` 查阅记录，`bj.确认入账 编号` 标记。标记不会执行转账，请勿在入账状态不明时重复补发。

## 必要链接

- 仓库：https://github.com/araea/koishi-plugin-card-21-game
- 设计系统：DESIGN_SYSTEM.md
