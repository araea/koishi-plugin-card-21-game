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

- 建议为指令添加指令别名，方便输入和记忆。
- 本插件依赖于 `monetary` 和 `database` 服务，需要先启动这两个服务。
- 本插件使用通用货币作为筹码，玩家需要有足够的货币才能参与游戏（默认开启零投注功能，0货币也能玩，但无法赚钱）。
  - 通用货币可以通过 `签到插件` 或者 `其他游戏插件`（例如钓鱼、赛马等） 获取。
- 如果担心因组织活动而被冻结，可以启用 `isTextToImageConversionEnabled`（文字转图片）功能，但更建议使用 `imagify`
  插件（在插件市场搜索），视觉效果更佳，渲染速度更快（可能）。

## ⚙️ 配置项

本插件提供了以下配置项，可以在启动插件前进行设置：

### 一般设置

- `allowZeroBetJoin`：是否开启零投注也能加入游戏的功能，默认值为 true。
- `enableCardBetting`：是否开启投注牌型功能，默认值为 false。
- `enableSurrender`：是否开启投降功能，默认值为 false。

### 消息处理设置

- `retractDelay`：自动撤回等待的时间，默认值为 0，单位是秒。值为 0 时不启用自动撤回功能。
- `imageType`：发送的图片类型，默认值为 `png`。
- `isTextToImageConversionEnabled`：是否开启将文本转为图片的功能（可选），如需启用，需要启用 `markdownToImage` 服务。
- `isEnableQQOfficialRobotMarkdownTemplate`：是否启用 QQ 官方机器人的 Markdown 模板，带消息按钮。
  - `customTemplateId`：自定义模板 ID。
  - `key`：文本内容中特定插值的 key。
  - `numberOfMessageButtonsPerRow`：每行消息按钮的数量。

### 排行榜设置

- `defaultMaxLeaderboardEntries`：显示排行榜时默认的最大人数，默认为 10。

### 游戏操作设置

- `dealerSpeed`：庄家要牌的速度，默认值为 2，单位是秒。
- `betMaxDuration`：投注牌型操作的等待时长，默认值为 30，单位是秒。
- `buyInsuranceMaxDuration`：买保险操作的等待时长，默认值为 10，单位是秒。
- `surrenderMaxDuration`：投降操作的等待时长，默认值为 10，单位是秒。
- `joinGameProcedureWaitTimeInSeconds`：办理加入游戏手续等待时间，默认值为 2，单位是秒。

### 扑克牌设置

- `numberOfDecks`：使用几副扑克牌，默认为 4 副（因为闲家都是明牌，所以建议使用默认值）。

### 费用设置

- `transferFeeRate`：转账收取的手续费比例，默认值为 0.1。

## 📝 命令

### 基本操作

- `blackJack`：显示本插件的帮助信息。
- `blackJack.加入游戏 [bet:number]`：加入游戏并投注筹码，若不指定投注额，系统将提示输入。
- `blackJack.退出游戏`：退出游戏并返还已投注的筹码，仅限游戏未开始时使用。

### 游戏流程

- `blackJack.开始游戏`：开始游戏，只有游戏中的玩家才能使用，游戏开始后不能再加入或退出。
  - `-n` 选项：无庄家模式，玩家之间进行游戏。

### 投注操作

- `blackJack.转账 [bet:number]`：向其他玩家转账，例如：blackJack.转账 @小小学 100。
- `blackJack.投注 [playerIndex:number] [betType:string] [betAmount:number]`：在游戏开始前，对其他玩家的手牌进行牌型投注，需要指定玩家序号、牌型和金额。

### 游戏阶段控制

- `blackJack.跳过投注`：在游戏开始前，跳过牌型投注的等待时间，直接进入下一阶段。
- `blackJack.买保险`：在游戏开始后，如果庄家的第一张牌是 A，则可以花费一半筹码押注庄家是否达到 21 点，若是则获得双倍保险金，否则损失保险金。
- `blackJack.跳过买保险`：在游戏开始后，如果庄家的第一张牌是 A，则可以跳过购买保险的等待时间，直接进入下一阶段。
- `blackJack.投降`：在游戏开始后，未要牌前可投降，返还半注（投注筹码与牌型投注的一半）。
- `blackJack.跳过投降`：在游戏开始后，跳过投降的等待时间，直接进入下一阶段。

### 游戏进行中操作

- `blackJack.要牌`：在游戏进行中，要一张牌，若点数超过 21 点，则爆牌，输掉本轮游戏。
- `blackJack.停牌`：在游戏进行中，停止要牌，等待庄家和其他玩家的操作。
- `blackJack.加倍`：在游戏进行中，若手牌只有两张，则可以加倍投注，但只能再要一张牌，然后停牌。
- `blackJack.分牌`：在游戏进行中，若手牌只有两张且点数相同，则可以分成两副手牌，分别进行操作，若分出的是 A，则只能再要一张牌。

### 结束与查询

- `blackJack.改名`：QQ 官方机器人使用，用于修改昵称。
- `blackJack.重新开始`：在游戏结束后，重新开始游戏，清空所有记录，不返还筹码。
- `blackJack.排行榜 [number:number]`：查看排行榜相关指令，可选 `胜场`，`输场`，`平局场次`，`21点次数`，`黑杰克次数`，`损益`。
- `blackJack.查询玩家记录 [targetUser:text]`：查询玩家游戏记录信息，可选参数为目标玩家的 at 信息，若没有参数则默认为指令发送者。

## 🙏 致谢

* [Koishi](https://koishi.chat/) - 机器人框架
* [Wikipedia](https://zh.wikipedia.org/wiki/%E4%BA%8C%E5%8D%81%E4%B8%80%E9%BB%9E) - 黑杰克游戏规则
* [WikiHow](https://zh.wikihow.com/%E7%8E%A921%E7%82%B9) - 黑杰克游戏技巧

## 📄 License

MIT License © 2023
