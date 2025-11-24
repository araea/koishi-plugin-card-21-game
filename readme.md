koishi-plugin-bull-card
========================

[<img alt="github" src="https://img.shields.io/badge/github-araea/bull_card-8da0cb?style=for-the-badge&labelColor=555555&logo=github" height="20">](https://github.com/araea/koishi-plugin-bull-card)
[<img alt="npm" src="https://img.shields.io/npm/v/koishi-plugin-bull-card.svg?style=for-the-badge&color=fc8d62&logo=npm" height="20">](https://www.npmjs.com/package/koishi-plugin-bull-card)

Koishi 的 21 点（黑杰克）纸牌游戏插件。完整赌场规则。

## 快速开始

启动 `monetary` 和 `database` 服务

**发起游戏**
`blackjack.来一局`

    PVE 模式（默认）    玩家对抗庄家
    PVP 模式（无庄）    `blackjack.来一局 -n`

**加入游戏**
`下注 100` 或 `bet 100`

**开始游戏**
`开始`（或等待倒计时自动开始）


## 游戏操作

轮到你时发送：

    要牌        hit     h
    停牌        stand   s
    加倍        double  d    首轮可用，注金翻倍，只发一张
    分牌        split   p    起手对子可用，注金翻倍
    投降                     开局5秒内，输一半
    保险                     庄家明牌为A时，保一半


## 规则说明

**目标**
手牌点数接近 21 点但不超过

**Blackjack**
起手 2 张牌即 21 点，赔率 3:2
分牌后的 21 点不算 Blackjack

**庄家**
点数 < 17 必须要牌
点数 ≥ 17 必须停牌

**分 A 特例**
分 A 后每家只发一张牌

## 致谢

- [Koishi](https://koishi.chat/)
- [shangxueink](https://github.com/araea/koishi-plugin-message-counter/pull/11) - 上学大人
- [Wikipedia](https://zh.wikipedia.org/wiki/%E4%BA%8C%E5%8D%81%E4%B8%80%E9%BB%9E) - 游戏规则
- [WikiHow](https://zh.wikihow.com/%E7%8E%A921%E7%82%B9) - 游戏规则

## QQ 群

- 956758505

<br>

#### License

<sup>
Licensed under either of <a href="../ds-r-c/LICENSE-APACHE">Apache License, Version
2.0</a> or <a href="../ds-r-c/LICENSE-MIT">MIT license</a> at your option.
</sup>

<br>

<sub>
Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this crate by you, as defined in the Apache-2.0 license, shall
be dual licensed as above, without any additional terms or conditions.
</sub>
