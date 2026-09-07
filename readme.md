# koishi-plugin-card-21-game

21 点纸牌游戏插件。

## 安装

~~~sh
yarn add koishi-plugin-card-21-game
~~~

在 Koishi 配置中启用 koishi-plugin-card-21-game，并提供 database 服务。金币模式需要 monetary 服务。

## 使用

发送 bj.来一局 开桌；发送 bj.来一局 -n 可启用 PVP。发送 下注 100 入座，
再发送 开始 或等待倒计时。

| 操作 | 别名 | 说明 |
| --- | --- | --- |
| 要牌 | hit / h | |
| 停牌 | stand / s | |
| 加倍 | double / d | 首轮将注金翻倍 |
| 分牌 | split / p | 起手对子可用 |
| 投降 | | 开局 5 秒内可用 |
| 保险 | | 庄家明牌为 A 时可用 |

点数不超过 21 且尽量接近 21。Blackjack 赔率为 3:2，庄家点数小于 17 时必须要牌。
余额用尽时，下注可自动领取每日一次的东山再起资金。

## 许可证

可按 [Apache-2.0](LICENSE-APACHE) 或 [MIT](LICENSE-MIT) 使用。
