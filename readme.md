# koishi-plugin-card-21-game

[![npm](https://img.shields.io/npm/v/koishi-plugin-card-21-game?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-card-21-game)

## 介绍

Koishi 的 21 点（黑杰克）纸牌游戏插件。完整赌场规则。

## 使用

1. 启动 `monetary` 和 `database` 服务。
2. 设置指令别名。
3. 投注：`blackjack.加入游戏 [投注]`。
4. 开始：
   - 有庄家模式：`blackjack.开始游戏`。
   - 无庄家模式：`blackjack.开始游戏 -n`。

- 筹码为通用货币，通过其他插件（签到、钓鱼、赛马等）获得。
- 文本转图片：推荐 `imagify` 插件，视觉效果更佳。

## 规则

- 无庄家模式：玩家之间进行游戏。
- 有庄家模式：庄家与玩家对战，庄家为机器人。
- 游戏目标：使手牌点数尽量接近 21 点，但不超过 21 点。

## 术语

- 投降：玩家未要牌前可投降，返还半注。
- 黑杰克：手牌点数 21 点，且只有两张手牌。赔率为 1.5。
- 加倍：玩家持两张手牌且点数为 11 时，可加倍投注，只能再要一张牌。
- 保险：庄家的第一张牌是 A 时，玩家可将筹码分半，购买保险。庄家手牌 21 点时，获双倍保险金。
- 分牌：玩家手牌为对子时，可分两副手牌，分别进行操作，若分出的是 A，只能再要一张牌。

## 致谢

* [Koishi](https://koishi.chat/)
* [Wikipedia](https://zh.wikipedia.org/wiki/%E4%BA%8C%E5%8D%81%E4%B8%80%E9%BB%9E) - 游戏规则
* [WikiHow](https://zh.wikihow.com/%E7%8E%A921%E7%82%B9) - 游戏规则

## QQ 群

- 956758505

## License

MIT License © 2024
