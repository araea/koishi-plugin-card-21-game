# koishi-plugin-card-21-game 🃏

[![npm](https://img.shields.io/npm/v/koishi-plugin-card-21-game?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-card-21-game)

## 🎈 介绍

这是一个基于 [Koishi](https://koishi.chat/) 框架的插件，用于在群聊中玩黑杰克（21点）游戏。🎲

黑杰克是一种流行的赌博游戏，目标是通过要牌或停牌，使自己的手牌点数尽可能接近21点，但不能超过。同时，还要比庄家的手牌点数高。👑

本插件支持多人同时游戏，可以对其他玩家的手牌进行各种牌型的投注，还可以买保险、投降、加倍等操作。😎

本插件还提供了丰富的配置项，可以自定义游戏的规则和难度。🔧

## 📦 安装

前往 Koishi 插件市场添加该插件即可，或者使用以下命令：

```
npm install koishi-plugin-card-21-game
```

## 🎮 使用

- 本插件仅支持在群聊中游玩。
- 建议为指令添加指令别名，方便输入和记忆。
- 本插件依赖于 monetary 和 database 服务，需要先启动这两个服务。
- 本插件使用通用货币作为筹码，玩家需要有足够的货币才能参与游戏。

## ⚙️ 配置项

本插件提供了以下配置项，可以在启动插件前进行设置：

- dealerSpeed: 庄家要牌的速度，默认值为 2，单位是秒。
- betMaxDuration: 投注牌型操作的等待时长，默认值为 30，单位是秒。
- buyInsuranceMaxDuration: 买保险操作的等待时长，默认值为 10，单位是秒。
- surrenderMaxDuration: 投降操作的等待时长，默认值为 10，单位是秒。
- numberOfDecks: 使用几副扑克牌，默认为 4 副（因为闲家都是明牌，所以建议使用默认值）。

## 📝 命令

本插件提供了以下命令，可以在群聊中使用：

- blackJack: 显示本插件的帮助信息。
- blackJack.加入游戏 [bet:number]: 加入游戏并投注筹码，如果不指定 bet，则会提示输入。
- blackJack.退出游戏: 退出游戏，退回已投注的筹码，只能在游戏未开始时使用。
- blackJack.开始游戏: 开始游戏，只有游戏中的玩家才能使用，游戏开始后不能再加入或退出。
- blackJack.投注 [playerIndex:number] [betType:string] [betAmount:number]: 在游戏开始前，对其他玩家的手牌进行牌型投注，需要指定玩家序号、牌型和金额。
- blackJack.跳过投注: 在游戏开始前，跳过牌型投注的等待时间，直接进入下一阶段。
- blackJack.买保险: 在游戏开始后，如果庄家的第一张牌是 A，则可以花费一半筹码押注庄家是否 21 点，若是则获得 2 倍保险金，若否则损失保险金。
- blackJack.跳过买保险: 在游戏开始后，如果庄家的第一张牌是 A，则可以跳过买保险的等待时间，直接进入下一阶段。
- blackJack.投降: 在游戏开始后，未要牌前可投降，退回半注（投注筹码与牌型投注的一半）。
- blackJack.跳过投降: 在游戏开始后，跳过投降的等待时间，直接进入下一阶段。
- blackJack.要牌: 在游戏进行中，要一张牌，如果点数超过 21 点，则爆牌，输掉本轮游戏。
- blackJack.停牌: 在游戏进行中，停止要牌，等待庄家和其他玩家的操作。
- blackJack.加倍: 在游戏进行中，如果手牌只有两张，则可以加倍投注，但只能再要一张牌，然后停牌。
- blackJack.分牌: 在游戏进行中，如果手牌只有两张且点数相同，则可以分成两副手牌，分别进行操作，如果分出的是 A，则只能再要一张牌。
- blackJack.重新开始: 在游戏结束后，重新开始游戏，清空所有记录，不退还筹码。

## 🙏 致谢

* [Koishi](https://koishi.chat/) - 机器人框架
* [Wikipedia](https://zh.wikipedia.org/wiki/%E4%BA%8C%E5%8D%81%E4%B8%80%E9%BB%9E) - 黑杰克游戏规则
* [WikiHow](https://zh.wikihow.com/%E7%8E%A921%E7%82%B9) - 黑杰克游戏技巧

## 📄 License

MIT License © 2023