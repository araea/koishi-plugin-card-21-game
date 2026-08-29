koishi-plugin-card-21-game
==========================

[<img alt="github" src="https://img.shields.io/badge/github-araea/card_21_game-8da0cb?style=for-the-badge&labelColor=555555&logo=github" height="20">](https://github.com/araea/koishi-plugin-card-21-game)
[<img alt="npm" src="https://img.shields.io/npm/v/koishi-plugin-card-21-game.svg?style=for-the-badge&color=fc8d62&logo=npm" height="20">](https://www.npmjs.com/package/koishi-plugin-card-21-game)

Koishi 的 21 点（黑杰克）纸牌游戏插件。完整赌场规则。

## 使用

1. 启用 `database`。用 monetary 货币时再启用 `monetary`（也可在配置里改用 bella 积分）。
2. `blackjack.来一局` 开桌。PVP（无庄）加 `-n`。
3. `下注 100` 或 `bet 100` 入座。
4. `开始`，或等倒计时。

## 操作

轮到你时发送：

| 指令 | 别名 | 说明 |
| --- | --- | --- |
| 要牌 | `hit` / `h` | |
| 停牌 | `stand` / `s` | |
| 加倍 | `double` / `d` | 首轮可用，注金翻倍，只发一张。PVP 不支持 |
| 分牌 | `split` / `p` | 起手对子可用，注金翻倍。PVP 不支持 |
| 投降 | | 开局 5 秒内，输一半 |
| 保险 | | 庄家明牌为 A 时，保一半 |

PVP 按第一手牌比大小，因此不开放会追加注金的加倍与分牌。

## 规则

目标是手牌接近 21 点但不超过。

- **Blackjack**：起手两张即 21 点，赔率 3:2。分牌后的 21 点不算。
- **庄家**：小于 17 必须要牌，大于等于 17 必须停牌。
- **分 A**：分完每家只发一张。

## 致谢

- [Koishi](https://koishi.chat/)
- [shangxueink](https://github.com/araea/koishi-plugin-message-counter/pull/11)
- [Wikipedia](https://zh.wikipedia.org/wiki/%E4%BA%8C%E5%8D%81%E4%B8%80%E9%BB%9E)
- [WikiHow](https://zh.wikihow.com/%E7%8E%A921%E7%82%B9)

## QQ 群

- 956758505

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
