koishi-plugin-card-21-game
==========================

[<img alt="github" src="https://img.shields.io/badge/github-araea/koishi__plugin__card__21__game-8da0cb?style=for-the-badge&labelColor=555555&logo=github" height="20">](https://github.com/araea/koishi-plugin-card-21-game)
[<img alt="npm" src="https://img.shields.io/npm/v/koishi-plugin-card-21-game.svg?style=for-the-badge&color=fc8d62&logo=npm" height="20">](https://www.npmjs.com/package/koishi-plugin-card-21-game)

Koishi 的 21 点纸牌游戏插件。

## 使用

`bj.来一局` 开桌，PVP 加 `-n`。`下注 100` 入座（不带金额则随机下注，不合心意可重新 `下注 N` 调整），`开始` 或等倒计时。余额见底时发送 `bj.低保`，每日可领一次东山再起资金。

## 操作

| 指令 | 别名 | 说明 |
| --- | --- | --- |
| 要牌 | `hit` / `h` | |
| 停牌 | `stand` / `s` | |
| 加倍 | `double` / `d` | 首轮，注金翻倍 |
| 分牌 | `split` / `p` | 起手对子 |
| 投降 | | 开局 5 秒内 |
| 保险 | | 庄家明牌为 A |

## 规则

接近 21 点但不超过。Blackjack 赔率 3:2。庄家小于 17 必须要牌。

## QQ 群

956758505

<br>

#### License

<sup>
Licensed under either of <a href="LICENSE-APACHE">Apache License, Version
2.0</a> or <a href="LICENSE-MIT">MIT license</a> at your option.
</sup>

<br>

<sub>
Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this crate by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
</sub>
