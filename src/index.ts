import {Context, h, Keys, Schema, sleep} from 'koishi'
import {} from 'koishi-plugin-monetary'
import {} from 'koishi-plugin-markdown-to-image-service'

export const inject = {
  required: ['monetary', 'database'],
  optional: ['markdownToImage'],
}
export const name = 'card-21-game'
export const usage = `
## 🎮 使用

- 建议为指令添加指令别名，方便输入和记忆。
- 本插件依赖于 \`monetary\` 和 \`database\` 服务，需要先启动这两个服务。
- 本插件使用通用货币作为筹码，玩家需要有足够的货币才能参与游戏（默认开启零投注功能，0货币也能玩，但无法赚钱）。
  - 通用货币可以通过 \`签到插件\` 或者 \`其他游戏插件\`（例如钓鱼、赛马等） 获取。
- 如果担心因组织活动而被冻结，可以启用 \`isTextToImageConversionEnabled\`（文字转图片）功能，但更建议使用 \`imagify\` 插件（在插件市场搜索），视觉效果更佳，渲染速度更快（可能）。

## 📝 命令

### 基本操作

- \`blackJack\`：显示本插件的帮助信息。
- \`blackJack.加入游戏 [bet:number]\`：加入游戏并投注筹码，若不指定投注额，系统将提示输入。
- \`blackJack.退出游戏\`：退出游戏并返还已投注的筹码，仅限游戏未开始时使用。

### 游戏流程

- \`blackJack.开始游戏\`：开始游戏，只有游戏中的玩家才能使用，游戏开始后不能再加入或退出。
  - \`-n\` 选项：无庄家模式，玩家之间进行游戏。

### 投注操作

- \`blackJack.转账 [bet:number]\`：向其他玩家转账，例如：blackJack.转账 @小小学 100。
- \`blackJack.投注 [playerIndex:number] [betType:string] [betAmount:number]\`：在游戏开始前，对其他玩家的手牌进行牌型投注，需要指定玩家序号、牌型和金额。

### 游戏阶段控制

- \`blackJack.跳过投注\`：在游戏开始前，跳过牌型投注的等待时间，直接进入下一阶段。
- \`blackJack.买保险\`：在游戏开始后，如果庄家的第一张牌是 A，则可以花费一半筹码押注庄家是否达到 21 点，若是则获得双倍保险金，否则损失保险金。
- \`blackJack.跳过买保险\`：在游戏开始后，如果庄家的第一张牌是 A，则可以跳过购买保险的等待时间，直接进入下一阶段。
- \`blackJack.投降\`：在游戏开始后，未要牌前可投降，返还半注（投注筹码与牌型投注的一半）。
- \`blackJack.跳过投降\`：在游戏开始后，跳过投降的等待时间，直接进入下一阶段。

### 游戏进行中操作

- \`blackJack.要牌\`：在游戏进行中，要一张牌，若点数超过 21 点，则爆牌，输掉本轮游戏。
- \`blackJack.停牌\`：在游戏进行中，停止要牌，等待庄家和其他玩家的操作。
- \`blackJack.加倍\`：在游戏进行中，若手牌只有两张，则可以加倍投注，但只能再要一张牌，然后停牌。
- \`blackJack.分牌\`：在游戏进行中，若手牌只有两张且点数相同，则可以分成两副手牌，分别进行操作，若分出的是 A，则只能再要一张牌。

### 结束与查询

- \`blackJack.改名\`：QQ 官方机器人使用，用于修改昵称。
- \`blackJack.重新开始\`：在游戏结束后，重新开始游戏，清空所有记录，不返还筹码。
- \`blackJack.排行榜 [number:number]\`：查看排行榜相关指令，可选 \`胜场\`，\`输场\`，\`平局场次\`，\`21点次数\`，\`黑杰克次数\`，\`损益\`。
- \`blackJack.查询玩家记录 [targetUser:text]\`：查询玩家游戏记录信息，可选参数为目标玩家的 at 信息，若没有参数则默认为指令发送者。

## 🐱 QQ 群

- 956758505`

// pz* pzx*
export interface Config {
  allowZeroBetJoin: boolean
  retractDelay: number
  imageType: "png" | "jpeg" | "webp"
  isTextToImageConversionEnabled: boolean
  enableCardBetting: boolean
  enableSurrender: boolean
  defaultMaxLeaderboardEntries: number
  dealerSpeed: number
  betMaxDuration: number
  buyInsuranceMaxDuration: number
  surrenderMaxDuration: number
  joinGameProcedureWaitTimeInSeconds: number
  numberOfDecks: number
  transferFeeRate: number
  isEnableQQOfficialRobotMarkdownTemplate: boolean
  customTemplateId: string
  key: string
  numberOfMessageButtonsPerRow: number
  isBellaPluginPointsEnabledForCurrency: boolean
  minimumRequiredCurrencyForGameEntry: number
  // key2: string
  // key3: string
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    allowZeroBetJoin: Schema.boolean().default(true).description(`是否开启零投注也能加入游戏的功能。`),
    enableCardBetting: Schema.boolean().default(false).description(`是否开启投注牌型功能。`),
    enableSurrender: Schema.boolean().default(false).description(`是否开启投降功能。`),
  }).description('一般设置'),

  Schema.object({
    retractDelay: Schema.number().min(0).default(0).description(`自动撤回等待的时间，单位是秒。值为 0 时不启用自动撤回功能。`),
    imageType: Schema.union(['png', 'jpeg', 'webp']).default('png').description(`发送的图片类型。`),
    isTextToImageConversionEnabled: Schema.boolean().default(false).description(`（QQ 官方机器人必须开启，防违规检测）是否开启将文本转为图片的功能（可选），如需启用，需要启用 \`markdownToImage\` 服务。`),
    isEnableQQOfficialRobotMarkdownTemplate: Schema.boolean().default(false).description(`（QQ 官方机器人必须开启文本转图片功能，用于防违规检测）是否启用 QQ 官方机器人的 Markdown 模板，带消息按钮。`),
  }).description('消息处理设置'),
  Schema.union([
    Schema.object({
      isEnableQQOfficialRobotMarkdownTemplate: Schema.const(true).required(),
      customTemplateId: Schema.string().default('').description(`自定义模板 ID。`),
      key: Schema.string().default('').description(`文本内容中特定插值的 key。如果你的插值为 {{.info}}，那么请在这里填 info。`),
      // key2: Schema.string().default('').description(`发送图片信息的特定插值的 key，用于存放图片的宽高。与下面的 key3 联动，Markdown 源码中形如：{{.key2}}{{.key3}}，那么该配置项就填 key2，下面的就填 key3。`),
      // key3: Schema.string().default('').description(`发送图片URL的特定插值的 key，用于存放图片的URL。`),
      numberOfMessageButtonsPerRow: Schema.number().min(1).max(5).default(2).description(`每行消息按钮的数量。`),
    }),
    Schema.object({}),
  ]),

  Schema.object({
    defaultMaxLeaderboardEntries: Schema.number().min(0).default(10).description(`显示排行榜时默认的最大人数。`),
  }).description('排行榜设置'),

  Schema.object({
    minimumRequiredCurrencyForGameEntry: Schema.number().min(0).default(0).description(`加入游戏所需的最低货币数量。`),
    dealerSpeed: Schema.number()
      .min(0).default(2).description(`庄家要牌的速度，单位是秒。`),
    betMaxDuration: Schema.number()
      .min(0).default(30).description(`投注牌型操作的等待时长，单位是秒。`),
    buyInsuranceMaxDuration: Schema.number()
      .min(0).default(10).description(`买保险操作的等待时长，单位是秒。`),
    surrenderMaxDuration: Schema.number()
      .min(0).default(10).description(`投降操作的等待时长，单位是秒。`),
    joinGameProcedureWaitTimeInSeconds: Schema.number()
      .min(0).default(2).description(`办理加入游戏手续等待时间，单位是秒。`),
  }).description('游戏操作设置'),

  Schema.object({
    numberOfDecks: Schema.number()
      .min(1).max(8).default(4).description(`使用几副扑克牌，默认为 4 副（因为闲家都是明牌，所以建议使用默认值）。`),
  }).description('扑克牌设置'),

  Schema.object({
    transferFeeRate: Schema.number()
      .default(0.1).description(`转账收取的手续费比例。`),
    isBellaPluginPointsEnabledForCurrency: Schema.boolean().default(false).description(`是否启用 Bella 签到插件的积分作为货币。`),
  }).description('费用设置'),
]) as any

// smb*
declare module 'koishi' {
  interface Tables {
    blackjack_game_record: BlackJackGameRecord
    blackjack_playing_record: BlackJackPlayingRecord
    blackjack_player_record: BlackJackPlayerRecord
    monetary: Monetary
    bella_sign_in: BellaSignIn
  }
}

// jk*
interface Monetary {
  uid: number
  currency: string
  value: number
}

export interface BellaSignIn {
  id: string
  time: string
  point: number
  count: number
  current_point: number
  working: boolean
  stime: number
  wpoint: number
  wktimecard: number
  wktimespeed: boolean
}

export interface BlackJackGameRecord {
  id: number
  channelId: string
  deck: string[]
  bankerHand: string[]
  currentPlayerIndex: number
  currentPlayerUserId: string
  currentPlayerUserName: string
  currentPlayerHandIndex: number
  gameStatus: string
  canSurrender: boolean
  canBuyInsurance: boolean
  isNoDealerMode: boolean
}

export interface BlackJackPlayingRecord {
  id: number
  channelId: string
  userId: string
  username: string
  bet: number
  playerHand: string[]
  playerHandIndex: number
  playerIndex: number
  betPlayerUserId: string
  betPlayerUserName: string
  betType: string
  betAmount: number
  isBuyInsurance: boolean
  insurance: number
  isSurrender: boolean
  isOver: boolean
  win: number
  betWin: number
  afterDoublingTheBet: string
}

export interface BlackJackPlayerRecord {
  id: number
  userId: string
  username: string
  win: number
  lose: number
  moneyChange: number
  numberOf21: number
  numberOfBlackJack: number
  draw: number
}

const initialDeck = [
  '♥️A', '♥️2', '♥️3', '♥️4', '♥️5', '♥️6', '♥️7', '♥️8', '♥️9', '♥️10', '♥️J', '♥️Q', '♥️K',
  '♦️A', '♦️2', '♦️3', '♦️4', '♦️5', '♦️6', '♦️7', '♦️8', '♦️9', '♦️10', '♦️J', '♦️Q', '♦️K',
  '♣️A', '♣️2', '♣️3', '♣️4', '♣️5', '♣️6', '♣️7', '♣️8', '♣️9', '♣️10', '♣️J', '♣️Q', '♣️K',
  '♠️A', '♠️2', '♠️3', '♠️4', '♠️5', '♠️6', '♠️7', '♠️8', '♠️9', '♠️10', '♠️J', '♠️Q', '♠️K'
]

// zhs*
export function apply(ctx: Context, config: Config) {
  const {
    allowZeroBetJoin,
    isTextToImageConversionEnabled,
    betMaxDuration,
    buyInsuranceMaxDuration,
    surrenderMaxDuration,
    numberOfDecks,
    defaultMaxLeaderboardEntries,
    dealerSpeed,
    enableCardBetting,
    enableSurrender,
    joinGameProcedureWaitTimeInSeconds,
    transferFeeRate
  } = config
  // 群组id 牌堆 当前进行操作的玩家 游戏状态（开始、未开始、投注时间...） 是否可以投降
  ctx.model.extend('blackjack_game_record', {
    id: 'unsigned',
    channelId: 'string',
    deck: 'list',
    bankerHand: 'list',
    currentPlayerIndex: 'integer',
    currentPlayerUserId: 'string',
    currentPlayerUserName: 'string',
    currentPlayerHandIndex: 'integer',
    gameStatus: 'string',
    canSurrender: 'boolean',
    canBuyInsurance: 'boolean',
    isNoDealerMode: 'boolean',
  }, {
    primary: 'id',
    autoInc: true,
  })
  // 群组id 用户id 用户名 投注筹码数额 玩家手牌 被投注的玩家id 被投注的类型 被投注的金额
  ctx.model.extend('blackjack_playing_record', {
    id: 'unsigned',
    channelId: 'string',
    userId: 'string',
    username: 'string',
    bet: 'double',
    playerHand: 'list',
    playerHandIndex: 'integer',
    playerIndex: 'integer',
    betPlayerUserId: 'string',
    betPlayerUserName: 'string',
    betType: 'string',
    betAmount: 'double',
    isBuyInsurance: 'boolean',
    insurance: 'double',
    isSurrender: 'boolean',
    isOver: 'boolean',
    win: 'double',
    betWin: 'double',
    afterDoublingTheBet: 'string'
  }, {
    primary: 'id',
    autoInc: true,
  })
  ctx.model.extend('blackjack_player_record', {
    id: 'unsigned',
    userId: 'string',
    username: 'string',
    win: 'unsigned',
    moneyChange: 'double',
    lose: 'unsigned',
    numberOf21: 'unsigned',
    numberOfBlackJack: 'unsigned',
    draw: 'unsigned',
  }, {
    primary: 'id',
    autoInc: true,
  })

  // zl*
  // blackJack/21点帮助 bz* h*
  ctx.command('blackJack', 'blackJack/21点游戏帮助')
    .action(async ({session}) => {
      if (config.isEnableQQOfficialRobotMarkdownTemplate && session.platform === 'qq' && config.key !== '' && config.customTemplateId !== '' || session.platform === 'qq') {
        return await sendMessage(session, `🎉 欢迎来到 BlackJack/21 点游戏！
😆 希望你能玩的开心！
`, `查询玩家记录 改名 转账 加入游戏 排行榜`)
      }
      await session.execute(`blackjack -h`)
    })
  // zz*
  ctx.command('blackJack.转账 [content:text]', '转账')
    .action(async ({session}, content) => {
      const sessionUserName = await getSessionUserName(session);

      if (!content) {
        let message = ``
        if (config.isEnableQQOfficialRobotMarkdownTemplate && session.platform === 'qq' && config.key !== '' && config.customTemplateId !== '') {
          message = `【@${sessionUserName}】
欢迎使用转账功能！
检测到缺少【被转账对象】
请输入：【被转账对象的ID或其修改后的名字】或【取消】
输入示例：
> 圣斗士星矢
注意：名字不是 QQ 名或 QQ 号，而是其改名后的名字或其专属ID）
`
        } else {
          message = `【@${sessionUserName}】
检测到缺少【被转账对象】！
请选择您的操作：【@被转账对象】或【取消】
【被转账对象】：@被转账人。
输入示例：
> @小小学`
        }
        await sendMessage(session, message, `转账`);
        const userInput = await session.prompt();
        if (!userInput) return await sendMessage(session, `【@${sessionUserName}】\n输入超时。`, `转账`);
        if (userInput === '取消') return await sendMessage(session, `【@${sessionUserName}】\n转账操作已取消。`, `转账`);
        content = userInput;
      }

      content = await replaceAtTags(session, content)

      const {user, platform} = session;
      // @ts-ignore
      const uid = user.id;

      let userId = '';
      let username = '';
      let remainingContent;
      if (config.isEnableQQOfficialRobotMarkdownTemplate && session.platform === 'qq' && config.key !== '' && config.customTemplateId !== '') {
        // 分割 content
        const contentArray = content.split(' ');
        userId = contentArray[0]
        username = contentArray[0]
        let targetPlayerRecord: BlackJackPlayerRecord[] = []
        targetPlayerRecord = await ctx.database.get('blackjack_player_record', {userId});
        if (targetPlayerRecord.length === 0) {
          targetPlayerRecord = await ctx.database.get('blackjack_player_record', {username});
          if (targetPlayerRecord.length === 0) {
            return await sendMessage(session, `【@${sessionUserName}】\n未找到符合要求的用户 ID。`, `转账`);
          }
        }
        userId = targetPlayerRecord[0].userId
        username = targetPlayerRecord[0].username
        remainingContent = contentArray[1]
      } else {
        const userIdRegex = /<at id="(?<userId>[^"]+)"(?: name="(?<username>[^"]+)")?\/>/;
        const match = content && content.match(userIdRegex);

        if (!match) {
          const contentArray = content.split(' ');
          userId = contentArray[0]
          const targetPlayerRecord: BlackJackPlayerRecord[] = await ctx.database.get('blackjack_player_record', {userId});
          if (targetPlayerRecord.length === 0) {
            return await sendMessage(session, `【@${sessionUserName}】\n未找到符合要求的用户 ID。`, `转账`);
          } else {
            userId = targetPlayerRecord[0].userId
            username = targetPlayerRecord[0].username
            remainingContent = contentArray[1]
          }

        } else {
          userId = match.groups.userId
          username = match.groups.username
          remainingContent = content.replace(match[0], '').trim();
        }

      }

      let amount: number;
      if (remainingContent.length > 0) {
        amount = parseFloat(remainingContent);

        if (Number.isNaN(amount)) {
          return await sendMessage(session, `【@${sessionUserName}】\n转账金额必须是一个有效的数字。`, `转账`);
        }

        if (amount < 0) {
          return await sendMessage(session, `【@${sessionUserName}】\n转账金额不能为负数！`, `转账`);
        }
      } else {
        return await sendMessage(session, `【@${sessionUserName}】\n未找到有效的转账金额。`, `转账`);
      }

      let userMoney = 0
      if (config.isBellaPluginPointsEnabledForCurrency) {
        const bellaSignIn: BellaSignIn[] = await ctx.database.get('bella_sign_in', {id: session.userId});
        if (bellaSignIn.length === 0) {
          return await sendMessage(session, `【@${sessionUserName}】\n转账失败！\n您当没有货币记录哦，快去签到吧！`, `转账`);
        }
        userMoney = bellaSignIn[0].point;
      } else {
        const getUserMonetary = await ctx.database.get('monetary', {uid});
        if (getUserMonetary.length === 0) {
          await ctx.database.create('monetary', {uid, value: 0, currency: 'default'});
          return await sendMessage(session, `【@${sessionUserName}】
您还没有货币记录呢~
无法进行转账操作哦！
不过别担心！
已经为您办理货币登记了呢~`, `转账`);
        }
        const userMonetary = getUserMonetary[0];
        userMoney = userMonetary.value;
      }

      if (userMoney < amount) {
        return await sendMessage(session, `【@${sessionUserName}】
检测到您当前的余额不足！
转账金额为：【${amount}】
但您剩余的货币为：【${userMoney}】`, `转账`);
      }

      const transferFee = amount * transferFeeRate
      if (userMoney < amount + transferFee) {
        return await sendMessage(session, `【@${sessionUserName}】
抱歉，转账失败！
余额不足以支付转账所需手续费！
所需手续费为：【${transferFee}】
而转账后您仅剩：【${userMoney - amount - transferFee}】`, `转账`);
      }
      const newScore = userMoney - amount - transferFee;

      if (config.isBellaPluginPointsEnabledForCurrency) {
        const targetUser = await ctx.database.get('bella_sign_in', {id: userId});
        if (targetUser.length === 0) {
          return await sendMessage(session, `【@${sessionUserName}】\n转账失败！\n哎呀，我根本不认识他的说...\n或者说...他还没签到过呢！`, `转账`)
        }
        await ctx.database.set('bella_sign_in', {id: session.userId}, {point: newScore});
        const targetUserPoint = targetUser[0].point
        await ctx.database.set('bella_sign_in', {id: userId}, {point: targetUserPoint + amount});
      } else {
        const targetUser = await ctx.database.getUser(platform, userId);
        if (!targetUser) {
          return await sendMessage(session, `【@${sessionUserName}】\n转账失败！\n哎呀，我根本不认识他的说...`, `转账`)
        }

        await ctx.database.set('monetary', {uid}, {value: newScore});

        const uid2 = targetUser.id;
        const getUserMonetary2 = await ctx.database.get('monetary', {uid: uid2});

        if (getUserMonetary2.length === 0) {
          await ctx.database.create('monetary', {uid: uid2, value: amount, currency: 'default'});
        } else {
          const userMonetary2 = getUserMonetary2[0];
          await ctx.database.set('monetary', {uid: uid2}, {value: userMonetary2.value + amount});
        }
      }

      await sendMessage(session, `【@${sessionUserName}】
转账成功！
被转账人为：【${username}】
转账金额：【${amount}】
收取手续费：【${transferFee}】
您的余额为：【${newScore}】`, `查询玩家记录 转账 加入游戏`);
    });

  // j* jr*
  // 加入游戏并投注筹码
  ctx.command('blackJack.加入游戏 [bet:number]', '加入游戏并投注筹码')
    .action(async ({session}, bet) => {
      let {channelId, userId, username, user} = session;
      // @ts-ignore
      const uid = user.id;
      if (!channelId) {

        channelId = `privateChat_${userId}`;
      }
      username = await getSessionUserName(session);
      // 玩家记录表操作
      const userRecord = await ctx.database.get('blackjack_player_record', {userId});
      if (userRecord.length === 0) {
        await ctx.database.create('blackjack_player_record', {
          userId,
          username,
          win: 0,
          lose: 0,
          moneyChange: 0,
          numberOfBlackJack: 0,
          numberOf21: 0,
          draw: 0,
        });
      } else if (username !== userRecord[0].username) {
        await ctx.database.set('blackjack_player_record', {userId}, {username});
      }
      // 查询当前群组的游戏记录
      let gameRecord = await ctx.database.get('blackjack_game_record', {channelId});

      // 如果当前群组没有游戏信息，则新建一个
      if (gameRecord.length === 0) {
        await ctx.database.create('blackjack_game_record', {channelId, gameStatus: '未开始'});
        gameRecord = await ctx.database.get('blackjack_game_record', {channelId});
      }

      // 检查游戏状态
      const gameInfo = gameRecord[0];

      if (gameInfo.gameStatus !== '未开始') {
        return await sendMessage(session, `【@${username}】\n游戏已经开始了哦~`, `改名 要牌 停牌`);
      }
      // 判断该玩家有没有加入过游戏
      const getPlayer = await ctx.database.get('blackjack_playing_record', {channelId, userId})
      if (getPlayer.length !== 0) {
        await sendMessage(session, `【@${username}】
您已在游戏中！
您的投注金额为：【${getPlayer[0].bet}】
买定离手，无法再更改投注！`, `改名 无庄模式 开始游戏 退出游戏 加入游戏 转账`);
        return
      }
      if (!bet) {
        let userMoney = 0
        if (config.isBellaPluginPointsEnabledForCurrency) {
          const bellaSignIn = await ctx.database.get('bella_sign_in', {id: session.userId});
          if (bellaSignIn.length === 0) {
            if (!allowZeroBetJoin) {
              return await sendMessage(session, `【@${username}】\n您还没有货币记录哦，快去签到吧！`, `改名 无庄模式 开始游戏 退出游戏 加入游戏 转账`);
            }
          } else {
            userMoney = bellaSignIn[0].point;
          }
        } else {
          let getUserMonetary = await ctx.database.get('monetary', {uid});
          if (getUserMonetary.length === 0) {
            await ctx.database.create('monetary', {uid, value: 0, currency: 'default'});
            getUserMonetary = await ctx.database.get('monetary', {uid});
            if (!allowZeroBetJoin) {
              return await sendMessage(session, `【@${username}】
您还没有货币记录呢~
没办法投注的说...
不过别担心！
已经为您办理货币登记了呢~`, `改名 无庄模式 开始游戏 退出游戏 加入游戏 转账`)
            }
          }
          const userMonetary = getUserMonetary[0]
          userMoney = userMonetary.value
        }

        const isBalanceSufficient = allowZeroBetJoin ? userMoney < 0 : userMoney <= 0
        if (isBalanceSufficient) {
          return await sendMessage(session, `【@${username}】
抱歉~
您没钱啦！
您当前的货币为：【${userMoney}】

赶快去赚些钱吧~
加入游戏的大门随时为您敞开！`, `改名 无庄模式 开始游戏 退出游戏 加入游戏 转账`);
        }
        await sendMessage(session, `【@${username}】
🎉 欢迎加入 BlackJack/21 点游戏！
希望你能玩的开心！

游玩需要投注哦 ~
您的货币余额为：【${userMoney}】
${allowZeroBetJoin && userMoney === 0 ? '检测到允许零投注！\n正在为您办理加入游戏手续中...' : '请输入您的【投注金额】：'}`, `${allowZeroBetJoin && userMoney === 0 ? '' : `输入投注金额`}`);
        if (allowZeroBetJoin && userMoney === 0) {
          await sleep(joinGameProcedureWaitTimeInSeconds * 1000)
        }
        bet = allowZeroBetJoin && userMoney === 0 ? 0 : Number(await session.prompt())
        if (isNaN(bet as number)) {
          // 处理无效输入的逻辑
          return await sendMessage(session, `【@${username}】\n输入无效，重新来一次吧~`, `改名 无庄模式 开始游戏 退出游戏 加入游戏 转账`)
        }
        // if (!bet)
      }
      // 最少所需投注
      if (config.minimumRequiredCurrencyForGameEntry > 0 && bet < config.minimumRequiredCurrencyForGameEntry) {
        return await sendMessage(session, `【@${username}】\n您的投注不够呢！\n最少所需投注为：【${config.minimumRequiredCurrencyForGameEntry}】`, `改名 无庄模式 开始游戏 退出游戏 加入游戏 转账`);
      }
      // 检查是否存在有效的投注金额
      if (typeof bet !== 'number' || (allowZeroBetJoin ? bet < 0 : bet <= 0)) {
        return await sendMessage(session, `【@${username}】\n准备好投注金额，才可以加入游戏哦~`, `改名 无庄模式 开始游戏 退出游戏 加入游戏 转账`);
      }

      let userMoney = 0
      let isBalanceSufficient = true
      if (config.isBellaPluginPointsEnabledForCurrency) {
        const bellaSignIn = await ctx.database.get('bella_sign_in', {id: session.userId});
        if (bellaSignIn.length === 0) {
          if (!allowZeroBetJoin) {
            return await sendMessage(session, `【@${username}】\n您还没有货币记录哦，快去签到吧！`, `改名 无庄模式 开始游戏 退出游戏 加入游戏 转账`);
          }
        } else {
          userMoney = bellaSignIn[0].point;
        }
      } else {

        let getUserMonetary = await ctx.database.get('monetary', {uid});
        if (getUserMonetary.length === 0) {
          await ctx.database.create('monetary', {uid, value: 0, currency: 'default'});
          getUserMonetary = await ctx.database.get('monetary', {uid});
          if (!allowZeroBetJoin) {
            return await sendMessage(session, `【@${username}】
您还没有货币记录呢~
没办法投注的说...
不过别担心！
已经为您办理货币登记了呢~`, `改名 无庄模式 开始游戏 退出游戏 加入游戏 转账`)
          }
        }
        const userMonetary = getUserMonetary[0]
        userMoney = userMonetary.value
      }

      if (userMoney < bet) {
        isBalanceSufficient = false
        bet = userMoney
      }

      if (bet === 0 && !allowZeroBetJoin) {
        return await sendMessage(session, `【@${username}】
不允许零投注哦~`, `改名 无庄模式 开始游戏 退出游戏 加入游戏 转账`)
      }

      const [playerRecord] = await ctx.database.get('blackjack_player_record', {userId});
      await ctx.database.set('blackjack_player_record', {userId}, {moneyChange: playerRecord.moneyChange - bet});

      if (config.isBellaPluginPointsEnabledForCurrency) {
        await ctx.database.set('bella_sign_in', {id: session.userId}, {point: userMoney - bet});
      } else {
        await ctx.monetary.cost(uid, bet);
      }

      // 在游玩表中创建玩家
      await ctx.database.create('blackjack_playing_record', {channelId, userId, username, bet, playerHandIndex: 1});

      // 获取当前玩家数量
      const numberOfPlayers = (await ctx.database.get('blackjack_playing_record', {channelId})).length;

      return await sendMessage(session, `【@${username}】
${!isBalanceSufficient ? '检测到余额不足！\n已自动向下合并！\n\n' : ''}${bet === 0 && allowZeroBetJoin && userMoney !== 0 ? '检测到允许零投注！\n\n' : ''}投注成功！
您正式加入游戏了！
投注筹码数额为：【${bet}】
剩余通用货币为：【${userMoney - bet}】
当前玩家人数：${numberOfPlayers} 名！`, `改名 无庄模式 开始游戏 退出游戏 加入游戏 转账`);
    });
  // q*
  ctx.command('blackJack.退出游戏', '退出游戏').action(async ({session}) => {
    let {channelId, userId, user, username} = session;
    if (!channelId) {

      channelId = `privateChat_${userId}`;
    }
    username = await getSessionUserName(session);
    // 检查游戏状态
    const gameInfo = await ctx.database.get('blackjack_game_record', {channelId});

    if (gameInfo.length === 0) {
      // 如果当前群组没有游戏信息，新建一个
      await ctx.database.create('blackjack_game_record', {channelId, gameStatus: '未开始'});
      return await sendMessage(session, `【@${username}】\n你都没加入呢，怎么退出？`, `退出游戏 加入游戏`);
    }

    if (gameInfo[0].gameStatus !== '未开始') {
      return await sendMessage(session, '哼哼，游戏都开始了还想退出？', ``);
    }

    // 检查玩家是否加入游戏
    const playerInfo = await ctx.database.get('blackjack_playing_record', {channelId, userId});

    if (playerInfo.length === 0) {
      return await sendMessage(session, `【@${username}】\n加入了才能退出哦~`, `退出游戏 加入游戏`);
    }

    const player = playerInfo[0]
    if (config.isBellaPluginPointsEnabledForCurrency) {
      const bellaSignIn = await ctx.database.get('bella_sign_in', {id: player.userId});
      if (bellaSignIn.length !== 0) {
        await ctx.database.set('bella_sign_in', {id: player.userId}, {point: bellaSignIn[0].point + player.bet});
      }
    } else {
      // @ts-ignore
      const uid = user.id
      // 把钱还给他
      await ctx.monetary.gain(uid, player.bet)
    }

    // 从游戏中移除玩家
    await ctx.database.remove('blackjack_playing_record', {channelId, userId});

    // 获取当前玩家数量
    const numberOfPlayers = (await ctx.database.get('blackjack_playing_record', {channelId})).length;

    return await sendMessage(session, `【@${username}】\n退出游戏成功！
钱已经退给你啦~
剩余玩家人数：${numberOfPlayers} 名！`, `无庄模式 开始游戏 退出游戏 加入游戏`);
  });
  // s* ks*
  // 开始游戏
  ctx.command('blackJack.开始游戏', '开始游戏')
    .option('noDealerMode', '-n 无庄模式', {fallback: false})
    .action(async ({session, options}) => {
      let {channelId, userId, platform} = session;
      if (!channelId) {
        channelId = `privateChat_${userId}`;
      }
      const sessionUserName = await getSessionUserName(session);
      const gameInfo = await ctx.database.get('blackjack_game_record', {channelId});

      if (gameInfo.length === 0) {
        await ctx.database.create('blackjack_game_record', {channelId, gameStatus: '未开始'});
        return await sendMessage(session, `【@${sessionUserName}】\n没人怎么玩呀~`, `加入游戏`);
      }
      if (gameInfo[0].gameStatus !== '未开始') {
        return await sendMessage(session, `【@${sessionUserName}】\n已经开始了哦，待会儿记得来呀~`, ``);
      }
      const getPlayers: BlackJackPlayingRecord[] = await ctx.database.get('blackjack_playing_record', {channelId})
      const numberOfPlayers = getPlayers.length
      if (options.noDealerMode && numberOfPlayers < 2) {
        return await sendMessage(session, `【@${sessionUserName}】\n无庄家模式至少需要两名玩家才能开始游戏哦~`, `加入游戏`);
      }
      if (numberOfPlayers < 1) {
        return await sendMessage(session, `【@${sessionUserName}】\n悲~ 没人玩的说...`, `加入游戏`);
      }

      await ctx.database.set('blackjack_game_record', {channelId}, {gameStatus: '投注时间'})

      let shuffledPlayersWithIndex: { index: number; player: any }[] = [];

      if (numberOfPlayers !== 1) {
        const shuffledPlayers = shuffleArray(getPlayers);

        await Promise.all(
          shuffledPlayers.map(async (player, index) => {
            const playerIndex = index + 1;
            await ctx.database.set('blackjack_playing_record', {
              userId: player.userId,
              channelId: player.channelId
            }, {playerIndex, playerHandIndex: 1});
            shuffledPlayersWithIndex.push({
              index: playerIndex,
              player,
            });
          })
        );

        if (options.noDealerMode) {
          const minBet = Math.min(...getPlayers.map(player => player.bet));

          for (const player of getPlayers) {
            if (player.bet > minBet) {
              const refundAmount = player.bet - minBet;
              if (config.isBellaPluginPointsEnabledForCurrency) {
                const bellaSignIn = await ctx.database.get('bella_sign_in', {id: player.userId});
                if (bellaSignIn.length !== 0) {
                  await ctx.database.set('bella_sign_in', {id: player.userId}, {point: bellaSignIn[0].point + refundAmount});
                }
              } else {
                const uid = (await ctx.database.getUser(platform, player.userId)).id
                await ctx.monetary.gain(uid, refundAmount);
              }

              await ctx.database.set('blackjack_playing_record', {channelId, userId: player.userId}, {bet: minBet});
            }
          }

          const decks = generateDecks(numberOfDecks);
          const numTimes = 3; // 指定洗牌次数
          const shuffledDeck = shuffleArrayMultipleTimes(decks, numTimes);
          let playerWithIndexOne: { player: Pick<BlackJackPlayingRecord, Keys<BlackJackPlayingRecord, any>> }
          let betPlayer: Pick<BlackJackPlayingRecord, Keys<BlackJackPlayingRecord, any>>
          playerWithIndexOne = shuffledPlayersWithIndex.length > 0 ? shuffledPlayersWithIndex.find(item => item.index === 1) : null;
          betPlayer = playerWithIndexOne.player;
          const dealtCardToPunter = await dealCards(channelId, shuffledDeck);

          await ctx.database.set('blackjack_playing_record', {
            channelId,
            userId: betPlayer.userId
          }, {playerHand: [`${dealtCardToPunter}`], playerHandIndex: 1})
          await sendMessage(session, `
🎉 21 点游戏（无庄模式）开始！
检测到玩家最低投注金额为：【${minBet}】
所有玩家的投注已更改为：【${minBet}】
该局游戏的扑克牌副数为：【${numberOfDecks}】

第一位玩家是：【@${betPlayer.username}】
您的第一张手牌为：【${dealtCardToPunter}】
您当前的点数为：【${calculateScore(dealtCardToPunter)}】
🤔 你还想要再拿一张牌吗？记住哦，如果超过21点就会爆掉哦~
请选择您的操作：
【要牌】或【停牌】`, `要牌 停牌`);

          await ctx.database.set('blackjack_game_record', {channelId}, {
            deck: shuffledDeck, currentPlayerIndex: 1, currentPlayerUserId: betPlayer.userId,
            currentPlayerUserName: betPlayer.username, gameStatus: '已开始', currentPlayerHandIndex: 1,
            isNoDealerMode: true,
          })

          return
        }

        const playerOrder = shuffledPlayersWithIndex
          .map((item) => `${item.index}. 【${item.player.username ?? 'Unknown'}】`)
          .join('\n');

        const prompt = `当前阶段为：【投注牌型】

⌚️ 投注时间为：【${betMaxDuration}】秒！

🎲 玩家序号：
${playerOrder}

🃏 投注类型：

1. 对子：闲家首两张牌相同点数，倍数为 5。
2. 同花对子：闲家首两张牌相同点数和花色，倍数为 30。
3. 同花：庄家第一张牌与闲家前两张牌同花色，倍数为 5。
4. 顺：庄家第一张牌与闲家前两张牌连号，倍数为 10。
5. 三条：庄家第一张牌与闲家前两张牌同点数，倍数为 25。
6. 同花顺：庄家第一张牌与闲家前两张牌同花色且连号，倍数为 25。
7. 同花三条：庄家第一张牌与闲家前两张牌同花色和点数，倍数为 50。

投注示例：投注 1 7 50

投注格式：投注 [玩家序号] [类型] [金额]

其他可选操作：【跳过投注】

【跳过投注】：闲家发送此操作可直接进入下一阶段。`

        await sendMessage(session, ` 游戏开始！
${(enableCardBetting) ? prompt : ''}
⚠️ 注意：该局游戏使用【${numberOfDecks}】副扑克牌

${(!enableCardBetting || !enableSurrender) ? `正在为庄家发牌...\n\n请庄家亮牌！` : ''}`, `${enableCardBetting ? `跳过投注 投注牌型` : ''}`)

      } else if (numberOfPlayers === 1) {
        const player = getPlayers[0]
        await ctx.database.set('blackjack_playing_record', {userId: player.userId, channelId}, {
          playerIndex: 1,
          playerHandIndex: 1
        })
        const prompt = `当前阶段为：【投注牌型】

⌚️ 投注时间为：【${betMaxDuration}】秒！

🎲 玩家序号：
1. 【${player.username}】

🃏 投注类型：
1. 对子：闲家首两张牌相同点数，倍数为 5。
2. 同花对子：闲家首两张牌相同点数和花色，倍数为 30。
3. 同花：庄家第一张牌与闲家前两张牌同花色，倍数为 5。
4. 顺：庄家第一张牌与闲家前两张牌连号，倍数为 10。
5. 三条：庄家第一张牌与闲家前两张牌同点数，倍数为 25。
6. 同花顺：庄家第一张牌与闲家前两张牌同花色且连号，倍数为 25。
7. 同花三条：庄家第一张牌与闲家前两张牌同花色和点数，倍数为 50。

投注示例：投注 1 7 50

投注格式：投注 [玩家序号] [类型] [金额]

其他可选操作：【跳过投注】

【跳过投注】：闲家发送此操作可直接进入下一阶段。`

        // 人数为 1 的时候，新的提示词
        await sendMessage(session, `【@${player.username}】
欢迎来到黑杰克的世界！
你是今天唯一的挑战者，你敢和我赌一把吗？
${(enableCardBetting) ? prompt : ''}
⚠️ 注意：该局游戏使用【${numberOfDecks}】副扑克牌

${(!enableCardBetting || !enableSurrender) ? `正在为庄家发牌...\n\n请庄家亮牌！` : ''}`, `${enableCardBetting ? `跳过投注 投注牌型` : ''}`)
      }

      if (!enableCardBetting || !enableSurrender) {
        await sleep(dealerSpeed * 1000)
      }

      if (enableCardBetting) {
        await ctx.database.set('blackjack_game_record', {channelId}, {gameStatus: '投注时间'})

        const gameStatus = await getGameStatus(channelId);
        if (gameStatus === '投注时间') {
          await ctx.database.set('blackjack_game_record', {channelId}, {gameStatus: '投注时间结束'})
          await sendMessage(session, `投注时间已到，下一阶段开始！`, ``)
        }
      }

      const decks = generateDecks(numberOfDecks);
      const numTimes = 3; // 指定洗牌次数
      const shuffledDeck = shuffleArrayMultipleTimes(decks, numTimes);
      let playerWithIndexOne: { player: Pick<BlackJackPlayingRecord, Keys<BlackJackPlayingRecord, any>> }
      let betPlayer: Pick<BlackJackPlayingRecord, Keys<BlackJackPlayingRecord, any>>
      if (numberOfPlayers !== 1) {
        playerWithIndexOne = shuffledPlayersWithIndex.length > 0 ? shuffledPlayersWithIndex.find(item => item.index === 1) : null;
        betPlayer = playerWithIndexOne.player;
      } else {
        betPlayer = getPlayers[0]
      }

      const dealtCardToBanker = await dealCards(channelId, shuffledDeck);
      const dealtCardToPunter = await dealCards(channelId, shuffledDeck);

      // 投降阶段
      await ctx.database.set('blackjack_game_record', {channelId}, {
        deck: shuffledDeck, canSurrender: true, currentPlayerIndex: 1, currentPlayerUserId: betPlayer.userId,
        currentPlayerUserName: betPlayer.username, gameStatus: '已开始', currentPlayerHandIndex: 1
      })
      if (enableSurrender) {
        // 先为庄家发一张牌，然后给玩家选择是否投降的时间
        await sendMessage(session, `庄家亮牌：【${dealtCardToBanker}】
点数为：【${calculateScore(dealtCardToBanker)}】

当前阶段为：【投降】
⌚️ 持续时间为：【${surrenderMaxDuration}】秒！

投降倒计时开始！
玩家可以在【${surrenderMaxDuration}】秒内选择是否投降！
【投降】：退回半注。
【跳过投降】：直接进入下一阶段。`, `跳过投降 投降`)

        const gameCanSurrender = await getGameCanSurrender(channelId);
        if (gameCanSurrender === true) {
          await ctx.database.set('blackjack_game_record', {channelId}, {canSurrender: false})
          await sendMessage(session, `投降已截止，下一阶段开始！`, ``)
        }

        // 判断游戏在投降之后是否已经结束
        const result = await ctx.database.get('blackjack_game_record', {channelId})
        if (result.length === 0) {
          return
        }
      }

      // 更新庄家的手牌
      await ctx.database.set('blackjack_game_record', {channelId}, {bankerHand: [`${dealtCardToBanker}`]})
      // 为第一位玩家更新手牌
      await ctx.database.set('blackjack_playing_record', {
        channelId,
        userId: betPlayer.userId
      }, {playerHand: [`${dealtCardToPunter}`], playerHandIndex: 1})
      // 如果庄家第一张牌是 A，则可买保险
      if (calculateScore(dealtCardToBanker) === 11) {
        // 将买保险的开关打开
        await ctx.database.set('blackjack_game_record', {channelId}, {canBuyInsurance: true})

        await sendMessage(session, `庄家亮牌：【${dealtCardToBanker}】
点数为：【11】点！

当前阶段为：【买保险】
⌚️ 持续时间为：【${buyInsuranceMaxDuration}】秒！

买保险倒计时开始！
玩家可以在【${buyInsuranceMaxDuration}】秒内选择是否买保险！
【买保险】：花费半注，若庄家黑杰克则获得双倍赔偿，否则损失半注。
【跳过买保险】：直接进入下一阶段。`, `跳过买保险 买保险`)

        const gameCanBuyInsurance = await getGameCanBuyInsurance(channelId);
        if (gameCanBuyInsurance === true) {
          await ctx.database.set('blackjack_game_record', {channelId}, {canBuyInsurance: false})
          await sendMessage(session, `买保险已截止，游戏正式开始！`, ``)
        }
        const betPlayerName = betPlayer.username
        return await sendMessage(session, `第一位玩家是：【@${betPlayerName}】
您的第一张牌为：【${dealtCardToPunter}】
您当前的点数为：【${calculateScore(dealtCardToPunter)}】
🤔 你还想要再拿一张牌吗？记住哦，如果超过21点就会爆掉哦~
请选择您的操作：
【要牌】或【停牌】`, `要牌 停牌`)
      }
      // 万事具备
      return await sendMessage(session, `庄家亮牌：【${dealtCardToBanker}】
点数为：【${calculateScore(dealtCardToBanker)}】

第一位玩家是：【@${betPlayer.username}】
您的第一张手牌为：【${dealtCardToPunter}】
您当前的点数为：【${calculateScore(dealtCardToPunter)}】
🤔 你还想要再拿一张牌吗？记住哦，如果超过21点就会爆掉哦~
请选择您的操作：
【要牌】或【停牌】`, `要牌 停牌`)
    });

  // tx*
  ctx.command('blackJack.投降', '投降').action(async ({session}) => {
    const sessionUserName = await getSessionUserName(session);
    if (!enableSurrender) {
      return await sendMessage(session, `【@${sessionUserName}】\n投降功能已关闭。`, ``)
    }
    let {channelId, userId, user, username} = session
    // @ts-ignore
    const uid = user.id
    if (!channelId) {
      channelId = `privateChat_${userId}`;
    }
    // 检查游戏信息是否存在
    const getGameInfo = await ctx.database.get('blackjack_game_record', {channelId})
    if (getGameInfo.length === 0) {
      await ctx.database.create('blackjack_game_record', {channelId, gameStatus: '未开始'});
      return await sendMessage(session, `【@${sessionUserName}】\n哼~ 最看不起投降的人了！`, `投降`)
    }
    // 游戏信息看看游戏状态
    const gameInfo = getGameInfo[0]
    if (gameInfo.gameStatus !== '已开始') {
      return await sendMessage(session, `【@${sessionUserName}】\n还没开始呢笨蛋，这么想投降啊？`, `无庄模式 开始游戏 退出游戏 加入游戏`)
    }
    // 判断玩家是否在游戏中
    const getPlayer = await ctx.database.get('blackjack_playing_record', {channelId, userId})
    if (getPlayer.length === 0) {
      return await sendMessage(session, `【@${sessionUserName}】\n你都没来陪我一起玩就想投降？`, ``)
    }
    if (!gameInfo.canSurrender) {
      return await sendMessage(session, `【@${sessionUserName}】\n笨蛋，现在可不能投降！`, ``)
    }
    const player = getPlayer[0]
    // 如果已经投降了，也不能再投降
    if (player.isSurrender) {
      return await sendMessage(session, `【@${sessionUserName}】\n你难道想投降两次嘛！`, ``)
    }

    // 投降输一半
    const refundAmount = (player.bet + player.betAmount) / 2
    if (config.isBellaPluginPointsEnabledForCurrency) {
      const bellaSignIn = await ctx.database.get('bella_sign_in', {id: userId});
      if (bellaSignIn.length !== 0) {
        await ctx.database.set('bella_sign_in', {id: userId}, {point: bellaSignIn[0].point + refundAmount});
      }
    } else {

      await ctx.monetary.gain(uid, refundAmount)
    }

    const [playerRecord] = await ctx.database.get('blackjack_player_record', {userId});
    await ctx.database.set('blackjack_player_record', {userId}, {
      moneyChange: playerRecord.moneyChange + refundAmount,
      lose: playerRecord.lose + 1,
    });
    const [userMonetary] = await ctx.database.get('monetary', {uid});
    await ctx.database.set('blackjack_playing_record', {channelId, userId}, {isSurrender: true})
    const theGameResult = await isGameEnded(channelId)

    // 是否全部投降
    if ((gameInfo.currentPlayerIndex === player.playerIndex) && theGameResult) {
      await ctx.database.remove('blackjack_playing_record', {channelId});
      await ctx.database.remove('blackjack_game_record', {channelId});
      return await sendMessage(session, `【@${sessionUserName}】\n游戏还未开始，你们却都投降了，我感到失望。算了，游戏就此结束，祝你们好运。`, `查询玩家记录 排行榜 加入游戏`)
    }

    return await sendMessage(session, `【@${username}】
您投降惹~
损失货币：【${refundAmount}】
您当前的余额为：【${userMonetary.value}】`, `投降`)
  })
  // ck* r*
  ctx.command('blackJack.重新开始', '重新开始').action(async ({session}) => {
    let {channelId, bot, platform, userId} = session
    if (!channelId) {
      channelId = `privateChat_${userId}`;
    }
    const sessionUserName = await getSessionUserName(session);
    const getGameInfo = await ctx.database.get('blackjack_game_record', {channelId})
    if (getGameInfo.length === 0) {
      await ctx.database.create('blackjack_game_record', {channelId, gameStatus: '未开始'});
      return await sendMessage(session, `【@${sessionUserName}】\n现在的情况根本没必要重新开始嘛！`, `查询玩家记录 排行榜 加入游戏`)
    }
    const gameInfo = getGameInfo[0]
    if (gameInfo.gameStatus === '未开始') {
      // 退钱
      const getPlayers = await ctx.database.get('blackjack_playing_record', {channelId})
      for (const player of getPlayers) {
        const uid = (await ctx.database.getUser(platform, player.userId)).id
        await ctx.monetary.gain(uid, player.bet)
      }
      await ctx.database.remove('blackjack_playing_record', {channelId})
      await ctx.database.remove('blackjack_game_record', {channelId})
      return await sendMessage(session, `【@${sessionUserName}】\n哼，既然游戏还没开始的话，只好把钱退给你们咯~`, `查询玩家记录 排行榜 加入游戏`)
    }
    // 记录玩家输
    const getPlayers = await ctx.database.get('blackjack_playing_record', {channelId})
    for (const player of getPlayers) {
      const [playerRecord] = await ctx.database.get('blackjack_player_record', {userId: player.userId});
      await ctx.database.set('blackjack_player_record', {userId: player.userId}, {lose: playerRecord.lose + 1});
    }
    // 结束游戏
    await removeRecordsByChannelId(channelId)
    return await sendMessage(session, `【${sessionUserName}】\n你们失败了，只能重新开始了~ 你们的钱就拜拜了~ 哈哈~`, `查询玩家记录 排行榜 加入游戏`)
  })

  // tz*
  // 投注 玩家序号 投注类型 投注金额
  ctx.command('blackJack.投注 [playerIndex:number] [betType:string] [betAmount:number]', '投注牌型')
    .action(async ({session}, playerIndex, betType, betAmount) => {
      const sessionUserName = await getSessionUserName(session);
      if (!enableCardBetting) {
        return await sendMessage(session, `【@${sessionUserName}】\n投注牌型功能已关闭。`, ``)
      }
      // 检查参数是否都存在
      if (!playerIndex || !betType || !betAmount) {
        return await sendMessage(session, `【@${sessionUserName}】
请输入投注信息，格式如下：
投注 [玩家序号] [牌型] [金额]
示例：投注 1 7 50`, `投注牌型`)
      }
      let {channelId, userId, user, username} = session
      // @ts-ignore
      const uid = user.id;
      if (!channelId) {
        channelId = `privateChat_${userId}`;
      }
      // 假如参数都存在，那么需要判断游戏状态是不是在 投注时间
      // 不需要检查是否存在游戏信息
      const getGameInfo = await ctx.database.get('blackjack_game_record', {channelId})
      if (getGameInfo.length === 0) {
        await ctx.database.create('blackjack_game_record', {channelId, gameStatus: '未开始'});
        return await sendMessage(session, `【@${sessionUserName}】\n开始游戏之后才能投注呢~`, `无庄模式 开始游戏 退出游戏 加入游戏`)
      }
      const gameInfo = getGameInfo[0]
      if (gameInfo.gameStatus !== '投注时间') {
        return await sendMessage(session, `【@${sessionUserName}】\n现在不在投注时间哦~`, ``)
      }
      let betPlayer: Pick<BlackJackPlayingRecord, Keys<BlackJackPlayingRecord, any>>;
      const getPlayers = await ctx.database.get('blackjack_playing_record', {channelId})
      const numberOfPlayers = getPlayers.length
      const getThisPlayer = await ctx.database.get('blackjack_playing_record', {channelId, userId})
      if (getThisPlayer.length === 0) {
        return await sendMessage(session, `【@${sessionUserName}】\n加入游戏才可以投注！`, ``)
      }
      const thisPlayer = getThisPlayer[0]
      // 已经投注过，需要更改吗？俗话说买定离手，对吧~
      if (thisPlayer.betAmount) {
        return await sendMessage(session, `【@${sessionUserName}】\n笨蛋，买定离手哦，才不给你更改投注！`, `投注牌型`)
      }
      // 通过 playerIndex 获得 player 对象
      // 一个人和人数大于一个人分开思考
      if (numberOfPlayers === 1) {
        betPlayer = getPlayers[0]
      } else {
        const getBetPlayer = await ctx.database.get('blackjack_playing_record', {channelId, playerIndex})
        betPlayer = getBetPlayer[0]
      }
      const cardTypes: { [key: number]: string } = {
        1: "对子",
        2: "同花对子",
        3: "同花",
        4: "顺",
        5: "三条",
        6: "同花顺",
        7: "同花三条",
      };

      function getCardType(number: number): string {
        return cardTypes[number] || "未知牌型";
      }

      const betTypeNumber = Number(betType);
      if (!isNaN(betTypeNumber) && betTypeNumber >= 1 && betTypeNumber <= 8) {
        betType = getCardType(betTypeNumber)
      } else {
        if (!(betType in cardTypes)) {
          return await sendMessage(session, `【@${sessionUserName}】\n傻瓜，给我个有效的牌型！`, `投注牌型`);
        }
      }
      // 检查是否存在有效的投注金额
      if (typeof betAmount !== 'number' || betAmount <= 0) {
        return await sendMessage(session, `【@${sessionUserName}】\n哼，给我爆金币！`, `投注牌型`);
      }

      // 检查投注牌型的玩家是否有足够的货币押注
      let userMoney = 0;
      if (config.isBellaPluginPointsEnabledForCurrency) {
        const bellaSignIn = await ctx.database.get('bella_sign_in', {id: userId});
        if (bellaSignIn.length !== 0) {
          userMoney = bellaSignIn[0].point
        }
      } else {

        const [userMonetary] = await ctx.database.get('monetary', {uid});
        userMoney = userMonetary.value
      }

      if (userMoney < betAmount) {
        return await sendMessage(session, `【@${sessionUserName}】\n你怎么这么穷惹~ 没钱了啦！\n你当前的货币数额为：【${userMoney}】个。`, `投注牌型`);
      }

      const [playerRecord] = await ctx.database.get('blackjack_player_record', {userId});
      await ctx.database.set('blackjack_player_record', {userId}, {
        moneyChange: playerRecord.moneyChange - betAmount,
      });
      if (config.isBellaPluginPointsEnabledForCurrency) {
        const bellaSignIn = await ctx.database.get('bella_sign_in', {id: userId});
        if (bellaSignIn.length !== 0) {
          await ctx.database.set('bella_sign_in', {id: userId}, {point: bellaSignIn[0].point - betAmount});
        }
      } else {
        await ctx.monetary.cost(uid, betAmount);
      }

      // 花了钱，那么，就为该玩家更新游玩信息吧
      await ctx.database.set('blackjack_playing_record', {channelId, userId}, {
        betPlayerUserId: betPlayer.userId,
        betPlayerUserName: betPlayer.username,
        betType,
        betAmount
      })

      const multiplier = getCardTypeMultiplier(betType);

      // 搞定之后，返回信息
      return await sendMessage(session, `【@${username}】
投注成功！
您投注了【${betType}】（${multiplier}倍）牌型！
投注对象为：【@${betPlayer.username}】
投注金额：【${betAmount}】`, `投注牌型`)
    })

  // tg*
  ctx.command('blackJack.跳过投注', '跳过投注牌型的等待时间')
    .action(async ({session}) => {
      const sessionUserName = await getSessionUserName(session);
      if (!enableCardBetting) {
        return await sendMessage(session, `【@${sessionUserName}】\n投注牌型功能已关闭。`, ``)
      }
      let {channelId, userId, username, user} = session;
      username = sessionUserName
      if (!channelId) {
        channelId = `privateChat_${userId}`;
      }

      // 判断该玩家有没有加入过游戏
      const getPlayer = await ctx.database.get('blackjack_playing_record', {channelId, userId})
      if (getPlayer.length === 0) {
        return await sendMessage(session, `【@${sessionUserName}】\n不加入怎么用指令呢~`, `加入游戏`)
      }
      // 查询当前群组的游戏记录
      let gameRecord = await ctx.database.get('blackjack_game_record', {channelId});

      // 如果当前群组没有游戏信息，则新建一个
      if (gameRecord.length === 0) {
        await ctx.database.create('blackjack_game_record', {channelId, gameStatus: '未开始'});
        return await sendMessage(session, `【@${sessionUserName}】\n笨蛋~ 还没开始呢！`, `无庄模式 开始游戏 退出游戏 加入游戏`)
      }

      // 检查游戏状态
      const gameInfo = gameRecord[0];

      if (gameInfo.gameStatus !== '投注时间') {
        return await sendMessage(session, `【@${sessionUserName}】\n现在不在投注时间哦~`, ``);
      }

      await ctx.database.set('blackjack_game_record', {channelId}, {gameStatus: '投注时间结束'})

      return await sendMessage(session, `玩家【@${username}】执行【跳过投注】操作，【投注】通道已关闭！`, ``)
    });
  // tgmbx*
  ctx.command('blackJack.跳过买保险', '跳过买保险的等待时间')
    .action(async ({session}) => {
      const sessionUserName = await getSessionUserName(session);
      let {channelId, userId, username, user} = session;
      username = sessionUserName
      if (!channelId) {
        channelId = `privateChat_${userId}`;
      }

      // 判断该玩家有没有加入过游戏
      const getPlayer = await ctx.database.get('blackjack_playing_record', {channelId, userId})
      if (getPlayer.length === 0) {
        return await sendMessage(session, `【@${sessionUserName}】\n你不在游戏里的说...`, `加入游戏`)
      }
      // 查询当前群组的游戏记录
      let gameRecord = await ctx.database.get('blackjack_game_record', {channelId});

      // 如果当前群组没有游戏信息，则新建一个
      if (gameRecord.length === 0) {
        await ctx.database.create('blackjack_game_record', {channelId, gameStatus: '未开始'});
        return await sendMessage(session, `【@${sessionUserName}】\n游戏还没开始呢！`, `无庄模式 开始游戏 退出游戏 加入游戏`)
      }

      // 检查游戏状态
      const gameInfo = gameRecord[0];

      if (!gameInfo.canBuyInsurance) {
        return await sendMessage(session, `【@${sessionUserName}】\n现在可买不了保险~`, ``)
      }

      await ctx.database.set('blackjack_game_record', {channelId}, {canBuyInsurance: false})

      return await sendMessage(session, `【@${username}】
您执行了【跳过买保险】操作！
【买保险】通道已关闭！`, ``)
    });
  // tgtx*
  ctx.command('blackJack.跳过投降', '跳过投降的等待时间')
    .action(async ({session}) => {
      const sessionUserName = await getSessionUserName(session);
      if (!enableSurrender) {
        return await sendMessage(session, `【@${sessionUserName}】\n投降功能已关闭。`, ``)
      }
      let {channelId, userId, username, user} = session;
      username = sessionUserName
      if (!channelId) {

        channelId = `privateChat_${userId}`;
      }
      // 判断该玩家有没有加入过游戏
      const getPlayer = await ctx.database.get('blackjack_playing_record', {channelId, userId})
      if (getPlayer.length === 0) {
        return await sendMessage(session, `【@${sessionUserName}】\n你还不在游戏里面哦~`, `加入游戏`)
      }
      // 查询当前群组的游戏记录
      let gameRecord = await ctx.database.get('blackjack_game_record', {channelId});

      // 如果当前群组没有游戏信息，则新建一个
      if (gameRecord.length === 0) {
        await ctx.database.create('blackjack_game_record', {channelId, gameStatus: '未开始'});
        return await sendMessage(session, `【@${sessionUserName}】\n还没开始呢！`, `无庄模式 开始游戏 退出游戏 加入游戏`)
      }

      // 检查游戏状态
      const gameInfo = gameRecord[0];

      if (!gameInfo.canSurrender) {
        return await sendMessage(session, `【@${sessionUserName}】\n还没到可以跳过的时候呢~`, ``);
      }

      await ctx.database.set('blackjack_game_record', {channelId}, {canSurrender: false})

      return await sendMessage(session, `【@${username}】
您执行了【跳过投降】操作！
【投降】通道已关闭！`
        , `投降`)
    });

  // bx*
  // 注册买保险的指令
  ctx.command('blackJack.买保险', '买保险').action(async ({session}) => {
    let {channelId, userId, username} = session
    const sessionUserName = await getSessionUserName(session);
    username = sessionUserName
    if (!channelId) {

      channelId = `privateChat_${userId}`;
    }
    // 检查玩家信息，查看该玩家是否加入游戏
    const getPlayer = await ctx.database.get('blackjack_playing_record', {channelId, userId})
    if (getPlayer.length === 0) {
      return await sendMessage(session, `【@${sessionUserName}】\n想买保险？先加入游戏再说！笨蛋~`, `加入游戏`
      )
    }
    const player = getPlayer[0]
    // 只能买一次保险
    if (player.isBuyInsurance) {
      return await sendMessage(session, `【@${sessionUserName}】\n买一次就够了，笨蛋！而且只能买一次好不好！`, `买保险`
      )
    }
    // 检查游戏状态，如果游戏已开始，且买保险开关打开，则可以继续
    const getGameInfo = await ctx.database.get('blackjack_game_record', {channelId})
    // 是否需要检查这个群组是否存在游戏
    if (getGameInfo.length === 0) {
      await ctx.database.create('blackjack_game_record', {channelId, gameStatus: '未开始'});
      return await sendMessage(session, `【@${sessionUserName}】\n游戏还没开始呢~ 买不了保险的说...`, `无庄模式 开始游戏 退出游戏 加入游戏`
      )
    }
    // 检查游戏状态和买保险开关
    const gameInfo = getGameInfo[0]
    if (gameInfo.gameStatus !== '已开始') {
      return await sendMessage(session, `【@${sessionUserName}】\n游戏没开始呀~ 买什么保险呢！`, `无庄模式 开始游戏 退出游戏 加入游戏`
      )
    }
    if (!gameInfo.canBuyInsurance) {
      return await sendMessage(session, `【@${sessionUserName}】\n现在买不了保险了哦~`, ``
      )
    }

    // 在游戏里，保险开关打开，游戏已正式开始
    await ctx.database.set('blackjack_playing_record', {channelId, userId}, {
      isBuyInsurance: true,
      bet: player.bet / 2,
      insurance: player.bet / 2
    })
    return await sendMessage(session, `【@${username}】
成功买到保险！
祝你好运，朋友！`, `买保险`
    )
  })

  // yp*
  // 要牌
  ctx.command('blackJack.要牌', '要一张牌').action(async ({session}) => {
    // 处理分牌：如果 handIndex > 1 且 第一张手牌为 A，只获发一张牌
    // 处理加倍：如果状态为已加倍，更改已要牌 判断是否已要牌
    // 想要要一张牌，首先要游戏开始、在游戏中、轮到该玩家要牌、是否投降、如果投降的话直接为下一位发牌
    const sessionUserName = await getSessionUserName(session);
    let {channelId, userId, username, platform} = session
    username = sessionUserName
    if (!channelId) {
      channelId = `privateChat_${userId}`;
    }
    const getGameInfo = await ctx.database.get('blackjack_game_record', {channelId})
    if (getGameInfo.length === 0) {
      await ctx.database.create('blackjack_game_record', {channelId, gameStatus: '未开始'});
      return await sendMessage(session, `【@${sessionUserName}】\n游戏还没开始呢！`, `无庄模式 开始游戏 退出游戏 加入游戏`
      )
    }
    const gameInfo = getGameInfo[0]
    if (gameInfo.gameStatus !== '已开始') {
      return await sendMessage(session, `【@${sessionUserName}】\n游戏还没开始哦~`, `无庄模式 开始游戏 退出游戏 加入游戏`
      )
    }
    // 检查玩家是否在游戏中
    const getPlayer = await ctx.database.get('blackjack_playing_record', {channelId, userId})
    if (getPlayer.length === 0) {
      return await sendMessage(session, `【@${sessionUserName}】\n笨蛋，你不在游戏里面！`, `加入游戏`
      )
    }
    if (gameInfo.currentPlayerIndex !== getPlayer[0].playerIndex) {
      return await sendMessage(session, `【@${sessionUserName}】\n现在轮到的还不是你哦~`, ``
      )
    }
    const getPlayerInfo = await ctx.database.get('blackjack_playing_record', {
      channelId, userId, playerIndex: gameInfo.currentPlayerIndex,
      playerHandIndex: gameInfo.currentPlayerHandIndex
    })
    const player = getPlayerInfo[0]
    if (player.isOver) {
      return await sendMessage(session, `【@${sessionUserName}】\n你的回合已经结束了哦~`, ``
      )
    }
    // 似乎检查投降并没有什么必要
    if (player.isSurrender) {
      // 下一位：找到下一位没有投降的玩家、如果又都已经投降，那么直接结束游戏，如果没有，就更新游戏信息，为下一位玩家发牌并发送信息
      if (await isGameEnded(channelId)) {
        return await sendMessage(session, `【@${sessionUserName}】\n你们全都放弃了，这太不可思议了，我无法理解。好吧，既然你们这么想，游戏就此终止，祝你们好运。`, `查询玩家记录 排行榜 加入游戏`
        )
      }
    }
    if (player.afterDoublingTheBet === '已要牌') {
      return await sendMessage(session, `【@${sessionUserName}】\n你已经不能再要牌惹！不许贪心~`, `停牌`
      )
    }
    if (getPlayer.length > 1 && calculateScore(player.playerHand[0]) === 11 && player.playerHand.length === 2) {
      return await sendMessage(session, `【@${sessionUserName}】\nA 分牌仅可获发 1 张牌，不可以再要牌了哦！`, `停牌`
      )
    }
    // 获取牌堆，发一张牌，更新牌堆、计算点数、判断是否是两张牌、两张牌是对子的话可以分牌、若两张牌点数之和是11则可以选择是否加倍
    // 判断是否爆牌或者是否为21点，如果为21点，再判断是否为黑杰克，如果爆牌就下一位


    if (player.afterDoublingTheBet === '已加倍') {
      await ctx.database.set('blackjack_playing_record', {
        userId,
        channelId,
        playerHandIndex: gameInfo.currentPlayerHandIndex
      }, {afterDoublingTheBet: '已要牌'})
    }
    const deck = gameInfo.deck;
    let playerHand: string[] = player.playerHand; // 使用解构复制来创建 playerHand 的副本

    const dealtCardToPunter: string = await dealCards(channelId, deck);
    await ctx.database.set('blackjack_game_record', {channelId}, {deck})
    playerHand.push(dealtCardToPunter); // 将 dealtCardToPunter 添加到 playerHand 中
    await ctx.database.set('blackjack_playing_record', {
      channelId,
      userId,
      playerHandIndex: gameInfo.currentPlayerHandIndex
    }, {playerHand})
    const score = calculateHandScore(playerHand)
    const isHandPair = isPair(playerHand)

    // 爆牌或21
    if (score >= 21) {
      await ctx.database.set('blackjack_playing_record', {
        channelId,
        userId,
        playerHandIndex: gameInfo.currentPlayerHandIndex
      }, {isOver: true})
      // 如果游戏结束，那么接下来就是为庄家发牌并结算
      if (await isGameEnded(channelId)) {
        if (gameInfo.isNoDealerMode) {
          return await sendMessage(session, `当前玩家是：【@${username}】
您的手牌为：【${playerHand.join('')}】
您当前的点数为：【${score}】

${score > 21 ? '💥 爆掉了！很遗憾，你输了！下次要小心点哦~' : ((playerHand.length === 2) ? '🎴 黑杰克！赢！运气爆棚了呢~' : '✌️ 21点！恭喜你，距离胜利只差一步之遥了呢~')}

游戏结束！
本局游戏结算结果如下：
${(await settleBlackjackGameInNoDealerMode(platform, channelId))}
祝你们好运！`, `查询玩家记录 排行榜 加入游戏`)
        }


        await sendMessage(session, `当前玩家是：【@${username}】
您的手牌为：【${playerHand.join('')}】
您当前的点数为：【${score}】

${score > 21 ? '💥 爆掉了！很遗憾，你输了！下次要小心点哦~' : ((playerHand.length === 2) ? '🎴 黑杰克！赢！运气爆棚了呢~' : '✌️ 21点！恭喜你，距离胜利只差一步之遥了呢~')}

玩家回合结束！
庄家正在补牌...`, ``)
        await sleep(dealerSpeed * 1000)
        let bankerHand: string[] = gameInfo.bankerHand;

        // 将游戏状态设置为未开始
        await ctx.database.set('blackjack_game_record', {channelId}, {gameStatus: '未开始'})
        // 调用 bankerPlayGame 函数来为庄家开始游戏
        await bankerPlayGame(session, channelId, deck, bankerHand);

        await sleep(dealerSpeed * 1000)
        return await sendMessage(session, `游戏结束！
本局游戏结算中：
${(await settleBlackjackGame(platform, channelId))}
祝你们好运！`, `查询玩家记录 排行榜 加入游戏`)
      }
      // 游戏没有结束 不需要去管 直接获取新的游戏信息即可 因为在 isEndGame 里面已经更新了
      // 获取更新后的游戏状态 获取新的玩家信息 根据玩家信息或游戏信息的 handIndex 去安排是否提示 分牌信息

      const [newGameInfo] = await ctx.database.get('blackjack_game_record', {channelId})
      const [newThisPlayerInfo] = await ctx.database.get('blackjack_playing_record', {
        channelId,
        playerIndex: newGameInfo.currentPlayerIndex,
        playerHandIndex: newGameInfo.currentPlayerHandIndex
      })
      const dealtCardToPunter = await dealCards(channelId, deck)
      await ctx.database.set('blackjack_playing_record', {
        channelId,
        userId: newThisPlayerInfo.userId,
        playerHandIndex: newThisPlayerInfo.playerHandIndex
      }, {playerHand: [`${dealtCardToPunter}`]})
      await ctx.database.set('blackjack_game_record', {channelId}, {deck})
      const distributional = `${(newThisPlayerInfo.playerHand.length === 1) ? '但幸运的是，您还有机会！' : ''}
您的手牌为：【${newThisPlayerInfo.playerHand.join('')}】
请选择您的操作：
${(newThisPlayerInfo.playerHand.length === 1) ? '【要牌】🃏' : ''}${(isHandPair && !gameInfo.isNoDealerMode) ? '\n【分牌】👥' : ''}${(score === 11 && playerHand.length === 2 && !gameInfo.isNoDealerMode) ? '\n【加倍】💰' : ''}
【停牌】🛑

${(isHandPair && !gameInfo.isNoDealerMode) ? `【分牌】：把一对牌分成两手，再下一注。
注意：如果是两张A，每手只能再要一张。` : ''}
${(score === 11 && playerHand.length === 2 && !gameInfo.isNoDealerMode) ? `【加倍】：加倍下注，只能再要一张。` : ''}`

      const noDistributional = `有请下一位玩家：【@${newThisPlayerInfo.username}】
您的手牌为：【${dealtCardToPunter}】
点数为：【${calculateScore(dealtCardToPunter)}】
请选择您的操作：
【要牌】或【停牌】${(isHandPair && !gameInfo.isNoDealerMode) ? '或【分牌】' : ''}${(score === 11 && playerHand.length === 2 && !gameInfo.isNoDealerMode) ? '或【加倍】' : ''}
${(isHandPair && !gameInfo.isNoDealerMode) ? `【分牌】：分两手玩，每手下注相同。
注意：如果分了两张A，每手只能再拿一张牌。` : ''}
${(score === 11 && playerHand.length === 2 && !gameInfo.isNoDealerMode) ? `【加倍】：下注翻倍，只能再拿一张牌。` : ''}`

      const message = `【@${username}】
👋 您要了一张牌！
您的手牌为：【${playerHand.join('')}】
您当前的点数为：【${score}】
${(score > 21) ? '😱 糟糕，你超过了 21，你爆了！' : ((playerHand.length === 2) ? '🎴 黑杰克！' : '✌️ 21点！')}

${(newThisPlayerInfo.playerHandIndex > 1) ? distributional : noDistributional}`
      return await sendMessage(session, message, `${message.includes('加倍') ? `加倍 ` : ``}${message.includes('分牌') ? `分牌 ` : ``}要牌 停牌`
      )
    }
    // 未爆牌：
    const message = `当前玩家是：【@${username}】
您要了一张牌！
您的手牌为：【${playerHand.join('')}】
您当前的点数为：【${score}】点
🤔 你还想要再拿一张牌吗？记住哦，如果超过21点就会爆掉哦~
请选择您的操作：
【要牌】或【停牌】${(isHandPair && !gameInfo.isNoDealerMode) ? '或【分牌】' : ''}${(score === 11 && playerHand.length === 2 && !gameInfo.isNoDealerMode) ? '或【加倍】' : ''}
${(isHandPair && !gameInfo.isNoDealerMode) ? `【分牌】：再下原注，将牌分为两手。
特殊情况：分开两张A后，每张A只能再要一张牌。` : ''}
${(score === 11 && playerHand.length === 2 && !gameInfo.isNoDealerMode) ? `【加倍】：加注一倍，只能再拿一张牌。` : ''}`
    return await sendMessage(session, message, `${message.includes('加倍') ? `加倍 ` : ``}${message.includes('分牌') ? `分牌 ` : ``}要牌 停牌`
    )
  })
  // tp*
  ctx.command('blackJack.停牌', '停止要牌').action(async ({session}) => {
    // 停牌：游戏开始、在游戏里、轮到你、没投降
    // 检查游戏是否开始
    let {channelId, userId, username, platform} = session
    const sessionUserName = await getSessionUserName(session);
    username = sessionUserName
    if (!channelId) {

      channelId = `privateChat_${userId}`;
    }
    const getGameInfo = await ctx.database.get('blackjack_game_record', {channelId})
    if (getGameInfo.length === 0) {
      await ctx.database.create('blackjack_game_record', {channelId, gameStatus: '未开始'});
      return await sendMessage(session, `【@${sessionUserName}】\n游戏还没开始呢！`, `无庄模式 开始游戏 退出游戏 加入游戏`
      )
    }
    const gameInfo = getGameInfo[0]
    if (gameInfo.gameStatus !== '已开始') {
      return await sendMessage(session, `【@${sessionUserName}】\n游戏还没开始哦~`, `无庄模式 开始游戏 退出游戏 加入游戏`
      )
    }
    // 检查玩家是否在游戏中
    const getPlayer = await ctx.database.get('blackjack_playing_record', {channelId, userId})
    if (getPlayer.length === 0) {
      return await sendMessage(session, `【@${sessionUserName}】\n笨蛋，你不在游戏里面！`, `加入游戏`
      )
    }
    if (gameInfo.currentPlayerIndex !== getPlayer[0].playerIndex) {
      return await sendMessage(session, `【@${sessionUserName}】\n现在轮到的还不是你哦~`, ``
      )
    }
    const getPlayerInfo = await ctx.database.get('blackjack_playing_record', {
      channelId, userId, playerIndex: gameInfo.currentPlayerIndex,
      playerHandIndex: gameInfo.currentPlayerHandIndex
    })
    const player = getPlayerInfo[0]
    // 该玩家是否已经结束
    if (player.isOver) {
      return await sendMessage(session, `【@${sessionUserName}】\n你的回合已经结束了哦~`, ``
      )
    }
    if (player.isSurrender) {
      // 下一位：找到下一位没有投降的玩家、如果又都已经投降，那么直接结束游戏，如果没有，就更新游戏信息，为下一位玩家发牌并发送信息
      if (await isGameEnded(channelId)) {
        return await sendMessage(session, `【@${sessionUserName}】\n你们全都放弃了，这太不可思议了，我无法理解。好吧，既然你们这么想，游戏就此终止，祝你们好运！`, `查询玩家记录 排行榜 加入游戏`
        )
      }
    }
    const deck = gameInfo.deck
    const {playerHand} = player
    const score = calculateHandScore(playerHand)
    // 更新牌状态 isOver
    await ctx.database.set('blackjack_playing_record', {
      channelId,
      userId,
      playerHandIndex: gameInfo.currentPlayerHandIndex
    }, {isOver: true})

    if (await isGameEnded(channelId)) {
      if (gameInfo.isNoDealerMode) {
        return await sendMessage(session, `👌 停牌咯！看来你对自己的手牌很满意呢！

当前玩家是：【@${username}】
您的手牌为：【${playerHand.join('')}】
您当前的点数为：【${score}】

游戏结束！
本局游戏结算结果如下：
${(await settleBlackjackGameInNoDealerMode(platform, channelId))}
祝你们好运！`, `查询玩家记录 排行榜 加入游戏`)
      }
      await sendMessage(session, `👌 停牌咯！看来你对自己的手牌很满意呢！

当前玩家是：【@${username}】
您的手牌为：【${playerHand.join('')}】
您当前的点数为：【${score}】

玩家回合结束！
庄家正在补牌中...`, ``)
      await sleep(dealerSpeed * 1000)
      let bankerHand: string[] = gameInfo.bankerHand;

      // 将游戏状态设置为未开始
      await ctx.database.set('blackjack_game_record', {channelId}, {gameStatus: '未开始'})
      // 调用 bankerPlayGame 函数来为庄家开始游戏
      await bankerPlayGame(session, channelId, deck, bankerHand);
      await sleep(dealerSpeed * 1000)
      return await sendMessage(session, `游戏结束！
本局游戏结算中：
${(await settleBlackjackGame(platform, channelId))}
祝你们好运！`, `查询玩家记录 排行榜 加入游戏`
      )
    }

    const [newGameInfo] = await ctx.database.get('blackjack_game_record', {channelId})
    const [newThisPlayerInfo] = await ctx.database.get('blackjack_playing_record', {
      channelId,
      playerIndex: newGameInfo.currentPlayerIndex,
      playerHandIndex: newGameInfo.currentPlayerHandIndex
    })
    const dealtCardToPunter = await dealCards(channelId, deck)
    await ctx.database.set('blackjack_playing_record', {
      channelId,
      userId: newThisPlayerInfo.userId,
      playerHandIndex: newThisPlayerInfo.playerHandIndex
    }, {playerHand: [`${dealtCardToPunter}`]})
    await ctx.database.set('blackjack_game_record', {channelId}, {deck})
    const distributional = `${(newThisPlayerInfo.playerHand.length === 1) ? '检测到你还有牌可以要！' : ''}
您的${(newThisPlayerInfo.playerHand.length === 1) ? '下一套' : ''}手牌为：【${newThisPlayerInfo.playerHand.join('')}】
请选择您的操作：
【要牌】或【停牌】`

    const noDistributional = `接下来有请下一位玩家：
【@${newThisPlayerInfo.username}】
您的第一张手牌为：【${dealtCardToPunter}】
您的点数为：【${calculateScore(dealtCardToPunter)}】
请选择您的操作：
【要牌】或【停牌】`
    // 下一套牌或下一位玩家
    const message = `当前玩家是：【@${username}】
👌 停牌咯！看来你对你的手牌很满意嘛~

您的手牌为：【${playerHand.join('')}】
您当前的点数为：【${score}】点

${(newThisPlayerInfo.playerHandIndex > 1) ? distributional : noDistributional}`
    return await sendMessage(session, message, `${message.includes('加倍') ? `加倍 ` : ``}${message.includes('分牌') ? `分牌 ` : ``}要牌 停牌`
    )
  })
  // fp*
  ctx.command('blackJack.分牌', '将牌分为两手').action(async ({session}) => {
    // 分牌：游戏已经开始、玩家在游戏里、当前轮到这位玩家、判断该玩家是否投降、两张牌且是对子、检查钱是否够分牌、为分牌消耗余额、增加牌序
    let {channelId, userId, user, username} = session
    if (!channelId) {
      channelId = `privateChat_${userId}`;
    }
    username = await getSessionUserName(session)
    const getGameInfo = await ctx.database.get('blackjack_game_record', {channelId})
    if (getGameInfo.length === 0) {
      await ctx.database.create('blackjack_game_record', {channelId, gameStatus: '未开始'});
      return await sendMessage(session, `【@${username}】\n游戏还没开始呢！`, `无庄模式 开始游戏 退出游戏 加入游戏`
      )
    }
    const gameInfo = getGameInfo[0]
    if (gameInfo.gameStatus !== '已开始') {
      return await sendMessage(session, `【@${username}】\n游戏还没开始哦~`, `无庄模式 开始游戏 退出游戏 加入游戏`
      )
    }
    if (gameInfo.isNoDealerMode) {
      return await sendMessage(session, `【@${username}】\n这是无庄模式，不支持分牌。`, `要牌 停牌`)
    }
    // 检查玩家是否在游戏中
    const getPlayer = await ctx.database.get('blackjack_playing_record', {
      channelId,
      userId,
      playerHandIndex: gameInfo.currentPlayerHandIndex
    })
    if (getPlayer.length === 0) {
      return await sendMessage(session, `【@${username}】\n笨蛋，你不在游戏里面！`, `加入游戏`
      )
    }
    const player = getPlayer[0]
    if (gameInfo.currentPlayerIndex !== player.playerIndex) {
      return await sendMessage(session, `【@${username}】\n现在轮到的还不是你哦~`, ``
      )
    }
    // if (player.isSurrender) {
    //   return
    // }
    let playerHand = player.playerHand
    if (!isPair(playerHand)) {
      return await sendMessage(session, `【@${username}】\n你的牌型不能分牌呢~ 要是对子才可以！`, ``
      )
    }
    let userMoney = 0;
    if (config.isBellaPluginPointsEnabledForCurrency) {
      const bellaSignIn: BellaSignIn[] = await ctx.database.get('bella_sign_in', {id: userId});
      if (bellaSignIn.length !== 0) {
        userMoney = bellaSignIn[0].point;
      }
    } else {
      // @ts-ignore
      const uid = user.id;
      const [userMonetary] = await ctx.database.get('monetary', {uid});
      userMoney = userMonetary.value;
    }

    if (userMoney < player.bet) {
      return await sendMessage(session, `【@${username}】
您的剩余货币为：【${userMoney}】
想要分牌赢大奖？🎁
可惜！
分牌要花费货币：【${player.bet}】
下次记得留钱分牌哦！😉`, `要牌 停牌`
      )
    }

    if (config.isBellaPluginPointsEnabledForCurrency) {
      const bellaSignIn = await ctx.database.get('bella_sign_in', {id: userId});
      if (bellaSignIn.length !== 0) {
        await ctx.database.set('bella_sign_in', {id: userId}, {point: userMoney - player.bet});
      }
    } else {
      // @ts-ignore
      const uid = user.id;
      await ctx.monetary.cost(uid, player.bet);
    }
    const newPlayerHand1 = playerHand[0];
    const newPlayerHand2 = playerHand[1];
    // 需要更新之前的玩家手牌
    await ctx.database.set('blackjack_playing_record', {
      channelId,
      userId,
      playerHandIndex: gameInfo.currentPlayerHandIndex
    }, {playerHand: [`${newPlayerHand1}`]})
    // 分牌需要创建一个新的玩家牌手牌记录
    await ctx.database.create('blackjack_playing_record', {
      channelId, userId, bet: player.bet, playerHand: [`${newPlayerHand2}`], playerIndex: player.playerIndex,
      username, playerHandIndex: player.playerHandIndex + 1
    })
    return await sendMessage(session, `当前玩家是：【@${username}】
你分牌如刀，投注如雷，手气如火！🔥

您的手牌为：
【${newPlayerHand1}】
【${newPlayerHand2}】

现在，请选择您对第一套牌的操作：
【要牌】或【停牌】

别忘了，你还有第二套牌在等你呢！😉`, `要牌 停牌`
    )
  })

  // jb*
  ctx.command('blackJack.加倍', '加倍投注').action(async ({session}) => {
    //  加倍：游戏已开始、在游戏里、没投降、牌为两张且点数为11、更新投注筹码、发送加倍提示
    // 检查游戏是否开始
    let {channelId, userId, user, username} = session
    if (!channelId) {
      channelId = `privateChat_${userId}`;
    }
    username = await getSessionUserName(session)
    const getGameInfo = await ctx.database.get('blackjack_game_record', {channelId})
    if (getGameInfo.length === 0) {
      await ctx.database.create('blackjack_game_record', {channelId, gameStatus: '未开始'});
      return await sendMessage(session, `【@${username}】\n游戏还没开始呢！`, `无庄模式 开始游戏 退出游戏 加入游戏`
      )
    }
    const gameInfo = getGameInfo[0]
    if (gameInfo.gameStatus !== '已开始') {
      return await sendMessage(session, `【@${username}】\n游戏还没开始哦~`, `无庄模式 开始游戏 退出游戏 加入游戏`
      )
    }
    if (gameInfo.isNoDealerMode) {
      return await sendMessage(session, `【@${username}】\n这是无庄模式，不支持加倍投注。`, `要牌 停牌`)
    }
    // 检查玩家是否在游戏中
    const getPlayer = await ctx.database.get('blackjack_playing_record', {
      channelId,
      userId,
      playerHandIndex: gameInfo.currentPlayerHandIndex
    })
    if (getPlayer.length === 0) {
      return await sendMessage(session, `【@${username}】\n笨蛋，你不在游戏里面！`, `加入游戏`
      )
    }
    const player = getPlayer[0]
    if (gameInfo.currentPlayerIndex !== player.playerIndex) {
      return await sendMessage(session, `【@${username}】\n现在轮到的还不是你哦~`, ``
      )
    }
    // if (player.isSurrender) {
    //   `投降了还想加倍？` // 理论上应该不会出现这个
    // }
    // 判断牌型
    let playerHand = player.playerHand
    if (!(playerHand.length === 2 && calculateHandScore(playerHand) === 11)) {
      return await sendMessage(session, `【@${username}】\n两张牌且点数为 11 点才可以加倍哦~`, ``
      )
    }
    // 更新筹码前首先要看当前玩家钱够不够
    let userMoney = 0;
    if (config.isBellaPluginPointsEnabledForCurrency) {
      const bellaSignIn: BellaSignIn[] = await ctx.database.get('bella_sign_in', {id: userId});
      if (bellaSignIn.length !== 0) {
        userMoney = bellaSignIn[0].point;
      }
    } else {
      // @ts-ignore
      const uid = user.id
      const [userMonetary] = await ctx.database.get('monetary', {uid})
      userMoney = userMonetary.value
    }

    if (userMoney < player.bet) {
      return await sendMessage(session, `【@${username}】
加倍失败了呢~
您的余额为：【${userMoney}】
无法支付加倍所需货币：【${player.bet}】
下次别忘存钱加倍呀！`, `要牌 停牌`
      )
    }
    // 扣钱 更新记录
    const [playerRecord] = await ctx.database.get('blackjack_player_record', {userId});
    await ctx.database.set('blackjack_player_record', {userId}, {
      moneyChange: playerRecord.moneyChange - player.bet,
    });

    if (config.isBellaPluginPointsEnabledForCurrency) {
      const bellaSignIn = await ctx.database.get('bella_sign_in', {id: userId});
      if (bellaSignIn.length !== 0) {
        await ctx.database.set('bella_sign_in', {id: userId}, {point: userMoney - player.bet});
      }
    } else {
      // @ts-ignore
      const uid = user.id
      await ctx.monetary.cost(uid, player.bet)
    }
    await ctx.database.set('blackjack_playing_record', {
      channelId,
      userId,
      playerHandIndex: gameInfo.currentPlayerHandIndex
    }, {bet: player.bet * 2, afterDoublingTheBet: '已加倍'})
    return await sendMessage(session, `【@${username}】
加倍成功！
您的筹码已更新为：【${player.bet * 2}】
您的余额为：【${userMoney - player.bet}】

您的手牌为：【${playerHand.join('')}】
您当前的点数为：【${calculateHandScore(playerHand)}】
请选择您的操作：
【要牌】或【停牌】
【要牌】：加倍后只能再要一张牌哦~`, `要牌 停牌`
    )
  })

  // r* phb*
  ctx.command('blackJack.排行榜 [number:number]', '查看排行榜相关指令')
    .action(async ({session}, number = defaultMaxLeaderboardEntries) => {
      if (typeof number !== 'number' || isNaN(number) || number < 0) {
        return await sendMessage(session, `请输入大于等于 0 的数字作为排行榜的参数。`, `排行榜`);
      }
      const leaderboards = {
        "1": `blackJack.排行榜.胜场 ${number}`,
        "2": `blackJack.排行榜.输场 ${number}`,
        "3": `blackJack.排行榜.损益 ${number}`,
        "4": `blackJack.排行榜.平局场次 ${number}`,
        "5": `blackJack.排行榜.21点次数 ${number}`,
        "6": `blackJack.排行榜.黑杰克次数 ${number}`,
        "胜场排行榜": `blackJack.排行榜.胜场 ${number}`,
        "输场排行榜": `blackJack.排行榜.输场 ${number}`,
        "损益排行榜": `blackJack.排行榜.损益 ${number}`,
        "平局场次排行榜": `blackJack.排行榜.平局场次 ${number}`,
        "21点次数排行榜": `blackJack.排行榜.21点次数 ${number}`,
        "黑杰克次数排行榜": `blackJack.排行榜.黑杰克次数 ${number}`,
      };

      await sendMessage(session, `当前可查看排行榜如下：
1. 胜场排行榜
2. 输场排行榜
3. 损益排行榜
4. 平局场次排行榜
5. 21点次数排行榜
6. 黑杰克次数排行榜
请输入想要查看的【排行榜名】或【序号】：`, `胜场 输场 损益 平局场次 21点次数 黑杰克次数`);

      const userInput = await session.prompt();
      if (!userInput) return sendMessage(session, `输入超时。`, `排行榜`);

      const selectedLeaderboard = leaderboards[userInput];
      if (selectedLeaderboard) {
        await session.execute(selectedLeaderboard);
      } else {
        return sendMessage(session, `无效的输入。`, `排行榜`);
      }
    });

  ctx.command('blackJack.排行榜.胜场 [number:number]', '查看玩家胜场排行榜')
    .action(async ({session}, number = defaultMaxLeaderboardEntries) => {
      if (typeof number !== 'number' || isNaN(number) || number < 0) {
        return await sendMessage(session, `请输入大于等于 0 的数字作为排行榜的参数。`, `排行榜`);
      }
      return await getLeaderboard(session, 'win', 'win', '玩家胜场排行榜', number);
    });

  ctx.command('blackJack.排行榜.输场 [number:number]', '查看玩家输场排行榜')
    .action(async ({session}, number = defaultMaxLeaderboardEntries) => {
      if (typeof number !== 'number' || isNaN(number) || number < 0) {
        return await sendMessage(session, `请输入大于等于 0 的数字作为排行榜的参数。`, `排行榜`);
      }
      return await getLeaderboard(session, 'lose', 'lose', '玩家输场排行榜', number);
    });

  ctx.command('blackJack.排行榜.损益 [number:number]', '查看玩家损益排行榜')
    .action(async ({session}, number = defaultMaxLeaderboardEntries) => {
      if (typeof number !== 'number' || isNaN(number) || number < 0) {
        return await sendMessage(session, `请输入大于等于 0 的数字作为排行榜的参数。`, `排行榜`);
      }
      return await getLeaderboard(session, 'moneyChange', 'moneyChange', '玩家损益排行榜', number);
    });
  ctx.command('blackJack.排行榜.平局场次 [number:number]', '查看玩家平局场次排行榜')
    .action(async ({session}, number = defaultMaxLeaderboardEntries) => {
      if (typeof number !== 'number' || isNaN(number) || number < 0) {
        return await sendMessage(session, `请输入大于等于 0 的数字作为排行榜的参数。`, `排行榜`);
      }
      return await getLeaderboard(session, 'draw', 'draw', '玩家平局场次排行榜', number);
    });
  ctx.command('blackJack.排行榜.21点次数 [number:number]', '查看玩家21点次数排行榜')
    .action(async ({session}, number = defaultMaxLeaderboardEntries) => {
      if (typeof number !== 'number' || isNaN(number) || number < 0) {
        return await sendMessage(session, `请输入大于等于 0 的数字作为排行榜的参数。`, `排行榜`);
      }
      return await getLeaderboard(session, 'numberOf21', 'numberOf21', '玩家21点次数排行榜', number);
    });
  ctx.command('blackJack.排行榜.黑杰克次数 [number:number]', '查看玩家黑杰克次数排行榜')
    .action(async ({session}, number = defaultMaxLeaderboardEntries) => {
      if (typeof number !== 'number' || isNaN(number) || number < 0) {
        return await sendMessage(session, `请输入大于等于 0 的数字作为排行榜的参数。`, `排行榜`);
      }
      return await getLeaderboard(session, 'numberOfBlackJack', 'numberOfBlackJack', '玩家黑杰克次数排行榜', number);
    });
  // cx*
  ctx.command('blackJack.查询玩家记录 [targetUser:text]', '查询玩家记录')
    .action(async ({session}, targetUser) => {
      let {channelId, userId, username} = session
      const originalUserId = userId
      const sessionUserName = await getSessionUserName(session);

      let targetUserRecord: BlackJackPlayerRecord[] = []
      if (!targetUser) {
        targetUserRecord = await ctx.database.get('blackjack_player_record', {userId})
      } else {
        targetUser = await replaceAtTags(session, targetUser)
        if (config.isEnableQQOfficialRobotMarkdownTemplate && session.platform === 'qq' && config.key !== '' && config.customTemplateId !== '') {
          targetUserRecord = await ctx.database.get('blackjack_player_record', {username: targetUser})
          if (targetUserRecord.length === 0) {
            targetUserRecord = await ctx.database.get('blackjack_player_record', {userId: targetUser})
          }
        } else {
          const userIdRegex = /<at id="([^"]+)"(?: name="([^"]+)")?\/>/;
          const match = targetUser.match(userIdRegex);
          userId = match?.[1] ?? userId;
          username = match?.[2] ?? username;
          if (originalUserId === userId) {
            targetUserRecord = await ctx.database.get('blackjack_player_record', {userId: targetUser})
          } else {
            targetUserRecord = await ctx.database.get('blackjack_player_record', {userId})
          }
        }
      }

      if (targetUserRecord.length === 0) {
        return sendMessage(session, `【@${sessionUserName}】\n被查询对象无任何游戏记录。`, `查询玩家记录 加入游戏`)
      }
      const {win, lose, moneyChange, numberOf21, numberOfBlackJack, draw} = targetUserRecord[0]
      return sendMessage(session, `【@${sessionUserName}】\n查询对象：${targetUserRecord[0].username}
胜场次数为：${win} 次
输场次数为：${lose} 次
平局次数为：${draw} 次
获得21点的次数为：${numberOf21} 次
获得黑杰克的次数为：${numberOfBlackJack} 次
损益为：${moneyChange} 点
`, `查询玩家记录 加入游戏`)
    });

  // gm*
  ctx.command('blackJack.改名 [newPlayerName:text]', '更改玩家名字')
    .action(async ({session}, newPlayerName) => {
      let {channelId, userId, username} = session
      username = await getSessionUserName(session)
      // 修剪玩家名字
      newPlayerName = newPlayerName?.trim();
      if (!newPlayerName) {
        return await sendMessage(session, `【@${username}】\n请输入新的玩家名字。`, `改名`)
      }
      if (!(config.isEnableQQOfficialRobotMarkdownTemplate && session.platform === 'qq' && config.key !== '' && config.customTemplateId !== '')) {
        return await sendMessage(session, `【@${username}】\n不是 QQ 官方机器人的话，不用改名哦~`, `改名`)
      }
      // 判断新的玩家名字是否过长
      if (newPlayerName.length > 20) {
        return await sendMessage(session, `【@${username}】\n新的玩家名字过长，请重新输入。`, `改名`)
      }
      const players = await ctx.database.get('blackjack_player_record', {});
      // 判断新的玩家名字是否已经存在
      for (const player of players) {
        if (player.username === newPlayerName) {
          return await sendMessage(session, `【@${username}】\n新的玩家名字已经存在，请重新输入。`, `改名`)
        }
      }
      if (newPlayerName.includes("@everyone")) {
        return await sendMessage(session, `【@${username}】\n新的玩家名字不合法，请重新输入。`, `改名`)
      }
      // 玩家记录表操作
      const userRecord = await ctx.database.get('blackjack_player_record', {userId});
      if (userRecord.length === 0) {
        await ctx.database.create('blackjack_player_record', {
          userId,
          username: newPlayerName,
          win: 0,
          lose: 0,
          moneyChange: 0,
          numberOfBlackJack: 0,
          numberOf21: 0,
          draw: 0,
        });
      } else {
        await ctx.database.set('blackjack_player_record', {userId}, {username: newPlayerName});
      }
      // 返回
      return await sendMessage(session, `【@${username}】\n玩家名字已更改为：【${newPlayerName}】`, `查询玩家记录 加入游戏 改名`);
    });

  // hs*
  function getCardTypeMultiplier(betType: string): number {
    // 根据 betType 获取倍率信息
    enum CardType {
      Pair = 1,
      FlushPair = 30,
      Flush = 5,
      Straight = 10,
      ThreeOfAKind = 25,
      StraightFlush = 25,
      FlushThreeOfAKind = 50,
      SixDragonsBlackjack = 100
    }

    switch (betType) {
      case "对子":
        return CardType.Pair;
      case "同花对子":
        return CardType.FlushPair;
      case "同花":
        return CardType.Flush;
      case "顺":
        return CardType.Straight;
      case "三条":
        return CardType.ThreeOfAKind;
      case "同花顺":
        return CardType.StraightFlush;
      case "同花三条":
        return CardType.FlushThreeOfAKind;
      default:
        throw new Error("未知牌型");
    }
  }

  async function replaceAtTags(session, content: string): Promise<string> {
    // 正则表达式用于匹配 at 标签
    const atRegex = /<at id="(\d+)"(?: name="([^"]*)")?\/>/g;

    // 匹配所有 at 标签
    let match;
    while ((match = atRegex.exec(content)) !== null) {
      const userId = match[1];
      const name = match[2];

      // 如果 name 不存在，根据 userId 获取相应的 name
      if (!name) {
        let guildMember;
        try {
          guildMember = await session.bot.getGuildMember(session.guildId, userId);
        } catch (error) {
          guildMember = {
            user: {
              name: '未知用户',
            },
          };
        }

        // 替换原始的 at 标签
        const newAtTag = `<at id="${userId}" name="${guildMember.user.name}"/>`;
        content = content.replace(match[0], newAtTag);
      }
    }

    return content;
  }

  async function getSessionUserName(session: any): Promise<string> {
    let sessionUserName = session.username;

    if (config.isEnableQQOfficialRobotMarkdownTemplate && session.platform === 'qq' && config.key !== '' && config.customTemplateId !== '') {
      let userRecord = await ctx.database.get('blackjack_player_record', {userId: session.userId});

      if (userRecord.length === 0) {
        await ctx.database.create('blackjack_player_record', {
          userId: session.userId,
          username: sessionUserName,
          win: 0,
          lose: 0,
          moneyChange: 0,
          numberOfBlackJack: 0,
          numberOf21: 0,
          draw: 0,
        });

        userRecord = await ctx.database.get('blackjack_player_record', {userId: session.userId});
      }
      sessionUserName = userRecord[0].username;
    }

    return sessionUserName;
  }

  interface Button {
    render_data: {
      label: string;
      visited_label: string;
      style: number;
    };
    action: {
      type: number;
      permission: { type: number };
      data: string;
      enter: boolean;
    };
  }

  function parseMarkdownCommands(markdownCommands: string): string[] {
    return markdownCommands.split(' ').filter(command => command.trim() !== '');
  }

  function createButtons(markdownCommands: string): Button[] {
    const commands = parseMarkdownCommands(markdownCommands);

    return commands.map(command => {
      let dataValue = command;
      switch (command) {
        case '投注牌型':
          dataValue = 'blackjack.投注';
          break;
        case '无庄模式':
          dataValue = 'blackjack.开始游戏 -n';
          break;
        case '胜场':
          dataValue = '胜场排行榜';
          break;
        case '输场':
          dataValue = '输场排行榜';
          break;
        case '损益':
          dataValue = '损益排行榜';
          break;
        case '平局场次':
          dataValue = '平局场次排行榜';
          break;
        case '21点次数':
          dataValue = '21点次数排行榜';
          break;
        case '黑杰克次数':
          dataValue = '黑杰克次数排行榜';
          break;
        case '输入投注金额':
          dataValue = '';
          break;
        default:
          dataValue = `blackjack.${command}`;
          break;
      }

      return {
        render_data: {
          label: command,
          visited_label: command,
          style: 1,
        },
        action: {
          type: 2,
          permission: {type: 2},
          data: `${dataValue}`,
          enter: !['转账', '投注牌型', '查询玩家记录', '改名', '加入游戏', '输入投注金额'].includes(command),
        },
      };
    });
  }

  async function removeRecordsByChannelId(channelId: string) {
    await ctx.database.remove('blackjack_playing_record', {channelId});
    await ctx.database.remove('blackjack_game_record', {channelId});
  }

  async function bankerPlayGame(session, channelId: string, deck: string[], bankerHand): Promise<void> {
    const dealtCardToBanker = await dealCards(channelId, deck);
    bankerHand.push(dealtCardToBanker);
    const bankerScore = calculateHandScore(bankerHand);
    await sleep(dealerSpeed * 1000)
    await sendMessage(session, `庄家摸牌！
庄家的手牌为：【${bankerHand.join('')}】
庄家当前的点数为【${bankerScore}】点
${(bankerScore > 21) ? '💥 庄家爆掉了！' : ''}${(bankerHand.length === 2 && bankerScore === 21) ? '🎴 庄家黑杰克！' : ((bankerScore === 21) ? '🎊 庄家21点！' : '')}${(bankerScore < 17) ? '\n嘿嘿，再来一张牌吧~！' : (bankerScore < 21) ? '\n见好就收咯！' : ''}`, ``);

    if (bankerScore < 17) {
      await bankerPlayGame(session, channelId, deck, bankerHand);
    } else {
      await ctx.database.set('blackjack_game_record', {channelId}, {bankerHand})
    }
  }

  async function getGameCanBuyInsurance(channelId): Promise<boolean> {
    let gameCanBuyInsurance = true;
    let timeout = 0;

    while (gameCanBuyInsurance === true && timeout < buyInsuranceMaxDuration) {
      const result = await ctx.database.get('blackjack_game_record', {channelId});
      gameCanBuyInsurance = result[0].canBuyInsurance;
      timeout += 1;
      await sleep(1 * 1000);
    }

    return gameCanBuyInsurance;
  }

  async function getGameStatus(channelId): Promise<string> {
    let gameStatus = '投注时间';
    let timeout = 0;

    while (gameStatus === '投注时间' && timeout < betMaxDuration) {
      const result = await ctx.database.get('blackjack_game_record', {channelId});
      gameStatus = result[0].gameStatus;
      timeout += 1;
      await sleep(1000);
    }

    return gameStatus;
  }

  async function getGameCanSurrender(channelId): Promise<boolean> {
    let gameCanSurrender: boolean = true;
    let timeout = 0;

    while (gameCanSurrender === true && timeout < surrenderMaxDuration) {
      try {
        const [result] = await ctx.database.get('blackjack_game_record', {channelId});
        gameCanSurrender = result.canSurrender;
        timeout += 1;
        await sleep(1 * 1000);
      } catch (error) {
        return false
      }

    }

    return gameCanSurrender;
  }

  async function getLeaderboard(session: any, type: string, sortField: string, title: string, maxLeaderboardEntries: number) {
    const getPlayers: BlackJackPlayerRecord[] = await ctx.database.get('blackjack_player_record', {})
    const sortedPlayers = getPlayers.sort((a, b) => b[sortField] - a[sortField])
    const topPlayers = sortedPlayers.slice(0, maxLeaderboardEntries)

    let result = `${title}：\n`;
    topPlayers.forEach((player, index) => {
      result += `${index + 1}. ${player.username}：${player[sortField]} ${(type === 'moneyChange') ? '点' : '次'}\n`
    })
    return await sendMessage(session, result, `查询玩家记录 加入游戏 排行榜`);
  }

  async function settleBlackjackGameInNoDealerMode(platform, channelId) {
    const getPlayerRecords: BlackJackPlayingRecord[] = await ctx.database.get('blackjack_playing_record', {channelId});

    let winners: BlackJackPlayingRecord[] = [];
    let hasBlackjackWinner = false;

    for (const record of getPlayerRecords) {
      const {playerHand, userId, bet} = record;
      const score = calculateHandScore(playerHand);

      if (score === 21) {
        if (playerHand.length === 2) {
          if (!hasBlackjackWinner) {
            winners = [record];
            hasBlackjackWinner = true;
          } else {
            winners.push(record);
          }
        } else {
          if (!hasBlackjackWinner && winners.length === 0 || !hasBlackjackWinner && score > calculateHandScore(winners[0].playerHand)) {
            winners = [record];
          } else if (!hasBlackjackWinner && score === calculateHandScore(winners[0].playerHand)) {
            winners.push(record);
          }
        }
      } else if (score < 21) {
        if (winners.length === 0 || score > calculateHandScore(winners[0].playerHand)) {
          winners = [record];
        } else if (score === calculateHandScore(winners[0].playerHand)) {
          winners.push(record);
        }
      }
    }


    let settlementString = "";

    for (const record of winners) {
      const totalWinners = winners.length;
      const {playerHand, userId, bet} = record;
      const score = calculateHandScore(playerHand);
      const [playerRecord] = await ctx.database.get('blackjack_player_record', {userId});
      const reward = (getPlayerRecords.length * record.bet) / totalWinners;
      settlementString += `【${record.username}】：【+${reward}】\n`;
      if (config.isBellaPluginPointsEnabledForCurrency) {
        const bellaSignIn = await ctx.database.get('bella_sign_in', {id: userId});
        if (bellaSignIn.length !== 0) {
          await ctx.database.set('bella_sign_in', {id: userId}, {point: bellaSignIn[0].point + reward});
        }
      } else {
        const uid = (await ctx.database.getUser(platform, userId)).id
        await ctx.monetary.gain(uid, reward)
      }

      // 游戏记录
      await ctx.database.set('blackjack_player_record', {userId}, {moneyChange: playerRecord.moneyChange + reward});
      if (score === 21 && playerHand.length === 2) {
        await ctx.database.set('blackjack_player_record', {userId}, {
          win: playerRecord.win + 1,
          numberOfBlackJack: playerRecord.numberOfBlackJack + 1,
          numberOf21: playerRecord.numberOf21 + 1,
        });
      } else if (score === 21) {
        await ctx.database.set('blackjack_player_record', {userId}, {
          win: playerRecord.win + 1,
          numberOf21: playerRecord.numberOf21 + 1,
        });
      } else {
        await ctx.database.set('blackjack_player_record', {userId}, {
          win: playerRecord.win + 1,
        });
      }

    }

    const getLosingPlayers = (allPlayers: BlackJackPlayingRecord[], winningPlayers: BlackJackPlayingRecord[]): BlackJackPlayingRecord[] => {
      return allPlayers.filter(player => !winningPlayers.some(winner => winner.userId === player.userId));
    };

    const losingPlayers = getLosingPlayers(getPlayerRecords, winners);
    for (const record of losingPlayers) {
      const {playerHand, userId, bet} = record;
      const score = calculateHandScore(playerHand);
      const [playerRecord] = await ctx.database.get('blackjack_player_record', {userId});
      if (score > 21) {
        await ctx.database.set('blackjack_player_record', {userId}, {
          lose: playerRecord.lose + 1,
        });
      } else if (score === 21) {
        await ctx.database.set('blackjack_player_record', {userId}, {
          lose: playerRecord.lose + 1,
          numberOf21: playerRecord.numberOf21 + 1,
        });
      }
    }

    await removeRecordsByChannelId(channelId);


    if (winners.length === 0) {
      return '本局游戏无人获胜。\n';
    }
    return settlementString;
  }

  async function settleBlackjackGame(platform, channelId) {
    const getGameRecords = await ctx.database.get('blackjack_game_record', {channelId});
    const bankerHand = getGameRecords[0].bankerHand;
    const bankerScore = calculateHandScore(bankerHand);
    // 庄家爆
    if (bankerScore > 21) {
      const getPlayerRecords = await ctx.database.get('blackjack_playing_record', {channelId});

      for (const record of getPlayerRecords) {
        const {playerHand} = record;
        const score = calculateHandScore(playerHand);
        const {channelId, userId, playerHandIndex, bet} = record;

        const updateData = {};
        const [playerRecord] = await ctx.database.get('blackjack_player_record', {userId});
        if (score > 21) {
          updateData['win'] = 0; // 拿回自己的哥们er 才不给拿回 赌狗不许拿钱
          await ctx.database.set('blackjack_player_record', {userId}, {
            lose: playerRecord.lose + 1,
          });
        } else if (playerHand.length === 2 && score === 21) {
          // 赔 1.5 倍
          updateData['win'] = bet * 1.5 + bet;
          await ctx.database.set('blackjack_player_record', {userId}, {
            win: playerRecord.win + 1,
            numberOfBlackJack: playerRecord.numberOfBlackJack + 1,
            numberOf21: playerRecord.numberOf21 + 1,
          });
        } else {
          if (score === 21) {
            await ctx.database.set('blackjack_player_record', {userId}, {
              win: playerRecord.win + 1,
              numberOf21: playerRecord.numberOf21 + 1,
            });
          } else {
            await ctx.database.set('blackjack_player_record', {userId}, {
              win: playerRecord.win + 1,
            });
          }
          updateData['win'] = bet + bet;

        }

        await ctx.database.set('blackjack_playing_record', {channelId, userId, playerHandIndex}, updateData);
      }
    } else {
      // 庄家不爆
      // 庄家黑杰克
      if (bankerHand.length === 2 && bankerScore === 21) {
        const getPlayerRecords = await ctx.database.get('blackjack_playing_record', {channelId});

        for (const record of getPlayerRecords) {
          const {playerHand} = record;
          const score = calculateHandScore(playerHand);
          const {channelId, userId, playerHandIndex, bet} = record;
          const [playerRecord] = await ctx.database.get('blackjack_player_record', {userId});
          // 除了是黑杰克的平 其他没有黑杰克的全输

          const updateData = {};

          if (score === 21 && playerHand.length === 2) {
            updateData['win'] = 0 + bet;
            await ctx.database.set('blackjack_player_record', {userId}, {
              draw: playerRecord.draw + 1,
            });
          } else if (score === 21) {
            updateData['win'] = -bet * 1.5 + bet;
            await ctx.database.set('blackjack_player_record', {userId}, {
              lose: playerRecord.lose + 1,
              numberOf21: playerRecord.numberOf21 + 1,
            });
          } else {
            updateData['win'] = -bet * 1.5 + bet;
            await ctx.database.set('blackjack_player_record', {userId}, {
              lose: playerRecord.lose + 1,
            });
          }

          await ctx.database.set('blackjack_playing_record', {channelId, userId, playerHandIndex}, updateData);
        }
      } else {
        // 庄家没有黑杰克 比大小 黑杰克1.5
        const getPlayerRecords = await ctx.database.get('blackjack_playing_record', {channelId});

        for (const record of getPlayerRecords) {
          const {playerHand} = record;
          const score = calculateHandScore(playerHand);
          const {channelId, userId, playerHandIndex, bet} = record;
          const [playerRecord] = await ctx.database.get('blackjack_player_record', {userId});
          const updateData = {};

          // 闲家黑杰克
          if (score === 21 && playerHand.length === 2) {
            updateData['win'] = bet * 1.5 + bet;
            await ctx.database.set('blackjack_player_record', {userId}, {
              win: playerRecord.win + 1,
              numberOfBlackJack: playerRecord.numberOfBlackJack + 1,
              numberOf21: playerRecord.numberOf21 + 1,
            });
          } else if (score > 21) {
            // 闲家爆牌 本金没有
            updateData['win'] = 0;
            await ctx.database.set('blackjack_player_record', {userId}, {
              lose: playerRecord.lose + 1,
            });
          } else if (bankerScore > score) {
            // 庄家大
            updateData['win'] = 0;
            await ctx.database.set('blackjack_player_record', {userId}, {
              lose: playerRecord.lose + 1,
            });
          } else if (bankerScore < score) {
            // 闲家大
            updateData['win'] = bet + bet;
            if (score === 21) {
              await ctx.database.set('blackjack_player_record', {userId}, {
                win: playerRecord.win + 1,
                numberOf21: playerRecord.numberOf21 + 1,
              });
            } else {
              await ctx.database.set('blackjack_player_record', {userId}, {
                win: playerRecord.win + 1,
              });
            }

          } else if (bankerScore === score) {
            // 平
            updateData['win'] = bet;
            await ctx.database.set('blackjack_player_record', {userId}, {
              draw: playerRecord.draw + 1,
            });
          }

          await ctx.database.set('blackjack_playing_record', {channelId, userId, playerHandIndex}, updateData);
        }
      }
    }

    const getPlayerRecords = await ctx.database.get('blackjack_playing_record', {channelId});

    // 买保险
    for (const record of getPlayerRecords) {
      const {playerHand} = record;
      let {channelId, userId, playerHandIndex, insurance, isBuyInsurance} = record;
      if (isBuyInsurance && bankerHand.length === 2 && bankerScore === 21) {
        insurance = insurance * 2
      } else if (isBuyInsurance) {
        insurance = 0
      }
      await ctx.database.set('blackjack_playing_record', {channelId, userId, playerHandIndex}, {insurance})
    }

    // 牌型
    for (const record of getPlayerRecords) {
      const {playerHand} = record;
      const score = calculateHandScore(playerHand);
      let {channelId, userId, playerHandIndex, betAmount, betPlayerUserId, betPlayerUserName, betType, betWin} = record;

      // 如果投注类型是对子
      if (betType === '对子') {
        const getBetPlayers = await ctx.database.get('blackjack_playing_record', {channelId, userId})
        for (const betPlayer of getBetPlayers) {
          const {playerHand} = betPlayer
          if (isBetPair(playerHand)) {
            betWin = betAmount * 5
            await ctx.database.set('blackjack_playing_record', {channelId, userId, playerHandIndex}, {
              betAmount: 0,
              betWin
            })
          }
        }
      } else if (betType === '同花对子') {
        // 如果投注类型是同花对子
        const getBetPlayers = await ctx.database.get('blackjack_playing_record', {channelId, userId})
        for (const betPlayer of getBetPlayers) {
          const {playerHand} = betPlayer
          if (isFlushPair(playerHand)) {
            betWin = betAmount * 30
            await ctx.database.set('blackjack_playing_record', {channelId, userId, playerHandIndex}, {
              betAmount: 0,
              betWin
            })
          }
        }
      } else if (betType === '同花') {
        const getBetPlayers = await ctx.database.get('blackjack_playing_record', {channelId, userId})
        for (const betPlayer of getBetPlayers) {
          const {playerHand} = betPlayer
          if (isSameSuitCombination(playerHand, bankerHand)) {
            betWin = betAmount * 5
            await ctx.database.set('blackjack_playing_record', {channelId, userId, playerHandIndex}, {
              betAmount: 0,
              betWin
            })
          }
        }
      } else if (betType === '顺') {
        const getBetPlayers = await ctx.database.get('blackjack_playing_record', {channelId, userId})
        for (const betPlayer of getBetPlayers) {
          const {playerHand} = betPlayer
          if (isStraightCombination(playerHand, bankerHand)) {
            betWin = betAmount * 10
            await ctx.database.set('blackjack_playing_record', {channelId, userId, playerHandIndex}, {
              betAmount: 0,
              betWin
            })
          }
        }
      } else if (betType === '三条') {
        const getBetPlayers = await ctx.database.get('blackjack_playing_record', {channelId, userId})
        for (const betPlayer of getBetPlayers) {
          const {playerHand} = betPlayer
          if (isThreeOfAKind(playerHand, bankerHand)) {
            betWin = betAmount * 25
            await ctx.database.set('blackjack_playing_record', {channelId, userId, playerHandIndex}, {
              betAmount: 0,
              betWin
            })
          }
        }
      } else if (betType === '同花顺') {
        const getBetPlayers = await ctx.database.get('blackjack_playing_record', {channelId, userId})
        for (const betPlayer of getBetPlayers) {
          const {playerHand} = betPlayer
          if (isStraightFlush(playerHand, bankerHand)) {
            betWin = betAmount * 25
            await ctx.database.set('blackjack_playing_record', {channelId, userId, playerHandIndex}, {
              betAmount: 0,
              betWin
            })
          }
        }
      } else if (betType === '同花三条') {
        const getBetPlayers = await ctx.database.get('blackjack_playing_record', {channelId, userId})
        for (const betPlayer of getBetPlayers) {
          const {playerHand} = betPlayer
          if (isFlushThreeOfAKind(playerHand, bankerHand)) {
            betWin = betAmount * 50
            await ctx.database.set('blackjack_playing_record', {channelId, userId, playerHandIndex}, {
              betAmount: 0,
              betWin
            })
          }
        }
      }
    }

    // 开始结算加钱 暂时不生成最终字符串
    const getThisGuildPlayers = await ctx.database.get('blackjack_playing_record', {channelId})
    for (const thisGuildPlayer of getThisGuildPlayers) {
      const {isSurrender, win, bet, insurance, betWin, userId} = thisGuildPlayer
      if (!isSurrender) {
        const settlement = win + insurance + betWin
        if (config.isBellaPluginPointsEnabledForCurrency) {
          const bellaSignIn = await ctx.database.get('bella_sign_in', {id: userId});
          if (bellaSignIn.length !== 0) {
            const result = bellaSignIn[0].point + settlement
            if (result < 0) {
              await ctx.database.set('bella_sign_in', {id: userId}, {point: 0});
            } else {
              await ctx.database.set('bella_sign_in', {id: userId}, {point: result});
            }
          }
        } else {
          const uid = (await ctx.database.getUser(platform, userId)).id
          const [userMonetary] = await ctx.database.get('monetary', {uid})
          const userMoney = userMonetary.value
          const value = settlement + userMoney
          await ctx.database.set('monetary', {uid}, {value})
        }
      }
    }

    async function getSettlementInfo(channelId: string) {
      const players = getThisGuildPlayers.filter(player => player.channelId === channelId);
      const mergedRecords: { [key: string]: number } = {};

      players.forEach(player => {
        const key = `${player.channelId}-${player.userId}`;
        if (!mergedRecords[key]) {
          mergedRecords[key] = 0;
        }
        mergedRecords[key] += player.win + player.insurance + player.betWin;
      });

      const settlementInfoPromises = Object.keys(mergedRecords).map(async (key) => {
        const [channelId, userId] = key.split('-');
        const usernames = [...new Set(players
          .filter(player => player.channelId === channelId && player.userId === userId)
          .map(player => player.username))];
        const settlement = mergedRecords[key];
        const [playerRecord] = await ctx.database.get('blackjack_player_record', {userId});
        await ctx.database.set('blackjack_player_record', {userId}, {moneyChange: playerRecord.moneyChange + settlement});
        return usernames.map(username => `【${username}】: 【${settlement}】`);
      });

      const settlementInfo = await Promise.all(settlementInfoPromises);

      return settlementInfo.flat().join('\n');
    }


    const settlementInfo = await getSettlementInfo(channelId);
    await removeRecordsByChannelId(channelId);
    return settlementInfo

  }

  async function isGameEnded(channelId: string): Promise<boolean> {
    const playingRecords = await ctx.database.get('blackjack_playing_record', {channelId});

    const filteredPlayers = playingRecords.filter(player => !player.isOver);
    const sortedPlayers = filteredPlayers.sort((a, b) =>
      a.playerIndex - b.playerIndex ||
      a.playerHandIndex - b.playerHandIndex
    );

    if (sortedPlayers.length === 0) {
      return true;
    }

    const nextPlayer = sortedPlayers.find(player => !player.isSurrender);

    if (nextPlayer) {
      await ctx.database.set('blackjack_game_record', {channelId}, {
        currentPlayerIndex: nextPlayer.playerIndex,
        currentPlayerHandIndex: nextPlayer.playerHandIndex
      });
      return false;
    } else {
      return true;
    }
  }

  // Fisher-Yates 洗牌算法
  function shuffleArray<T>(array: T[]): T[] {
    const length = array.length;
    for (let i = length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // 多次洗牌函数
  function shuffleArrayMultipleTimes<T>(array: T[], numTimes: number): T[] {
    let shuffledArray = array.slice();
    for (let i = 0; i < numTimes; i++) {
      shuffledArray = shuffleArray(shuffledArray);
    }
    return shuffledArray;
  }

  // 生成不同大小的牌堆
  function generateDecks(numberOfDecks: number): string[] {
    const decks: string[] = [];

    for (let i = 0; i < numberOfDecks; i++) {
      decks.push(...initialDeck);
    }

    return decks;
  }

  // 发牌
  async function dealCards(channelId, deck: string[]): Promise<string | undefined> {
    let shuffledNewDeck: string[]
    if (deck.length === 0) {
      const numTimes = 3;
      const newDecks = generateDecks(numberOfDecks)
      shuffledNewDeck = shuffleArrayMultipleTimes(newDecks, numTimes);
      const card = shuffledNewDeck.shift();
      await ctx.database.set('blackjack_game_record', {channelId}, {deck: shuffledNewDeck})
      return card;
    }

    const card = deck.shift();
    return card;
  }

  // 计算点数
  // 定义一个函数，参数是一个字符串，返回值是一个数字
  function calculateScore(hand: string): number {
    const suits = ['♥️', '♦️', '♣️', '♠️'];
    const values = {'A': 11, 'J': 10, 'Q': 10, 'K': 10};
    let sum = 0;
    let aces = 0;
    for (let suit of suits) {
      let cards = hand.split(suit);
      for (let i = 1; i < cards.length; i++) {
        let card = cards[i];
        if (isNaN(Number(card))) {
          sum += values[card];
          if (card === 'A') {
            aces++;
          }
        } else {
          sum += Number(card);
        }
      }
    }
    while (sum > 21) {
      if (aces > 0) {
        sum -= 10;
        aces--;
      } else {
        break;
      }
    }
    return sum;
  }

  function calculateHandScore(hand: string[]): number {
    const suits = ['♥️', '♦️', '♣️', '♠️'];
    const values = {'A': 11, 'J': 10, 'Q': 10, 'K': 10};
    let sum = 0;
    let aces = 0;

    for (let card of hand) {
      let suit = suits.find(suit => card.includes(suit));
      if (!suit) {
        continue;
      }
      let value = card.replace(suit, '');
      if (isNaN(Number(value))) {
        sum += values[value];
        if (value === 'A') {
          aces++;
        }
      } else {
        sum += Number(value);
      }
    }

    while (sum > 21 && aces > 0) {
      sum -= 10;
      aces--;
    }

    return sum;
  }

  function isPair(playerHand: string[]): boolean {
    return playerHand.length === 2 && playerHand[0].slice(1) === playerHand[1].slice(1);
  }

  // 投注规则之内的对子
  function isBetPair(playerHand: string[]): boolean {
    if (playerHand.length >= 2) {
      const firstCard = playerHand[0];
      const secondCard = playerHand[1];
      return getCardValue(firstCard) === getCardValue(secondCard);
    }
    return false;
  }

  function getCardValue(card: string): string {
    return card.slice(1); // 假设牌的点数位于字符串的第二个位置
  }

  function isFlushPair(playerHand: string[]): boolean {
    if (playerHand.length >= 2) {
      const firstCard = playerHand[0];
      const secondCard = playerHand[1];
      return hasSameValue(firstCard, secondCard) && hasSameSuit(firstCard, secondCard);
    }
    return false;
  }

  function hasSameValue(card1: string, card2: string): boolean {
    return getCardValue(card1) === getCardValue(card2);
  }

  function hasSameSuit(card1: string, card2: string): boolean {
    return getCardSuit(card1) === getCardSuit(card2);
  }

  function getCardSuit(card: string): string {
    return card.slice(0, 1); // 假设花色位于字符串的第一个位置
  }

  function isSameSuitCombination(playerHand: string[], bankerHand: string[]): boolean {
    if (bankerHand.length >= 1 && playerHand.length >= 2) {
      const firstBankerCard = bankerHand[0];
      const firstPlayerCard = playerHand[0];
      const secondPlayerCard = playerHand[1];

      return hasSameSuit(firstBankerCard, firstPlayerCard) && hasSameSuit(firstBankerCard, secondPlayerCard);
    }
    return false;
  }

  function isStraightCombination(playerHand: string[], bankerHand: string[]): boolean {
    if (bankerHand.length >= 1 && playerHand.length >= 2) {
      const firstBankerCard = bankerHand[0];
      const firstPlayerCard = playerHand[0];
      const secondPlayerCard = playerHand[1];

      return isSequential(firstBankerCard, firstPlayerCard, secondPlayerCard);
    }
    return false;
  }

  function isSequential(card1: string, card2: string, card3: string): boolean {
    const cardValues = [getCardValue2(card1), getCardValue2(card2), getCardValue2(card3)];
    const sortedValues = cardValues.sort((a, b) => a - b);
    return sortedValues[0] === sortedValues[1] - 1 && sortedValues[1] === sortedValues[2] - 1;
  }

  function getCardValue2(card: string): number {
    const value = card.slice(1); // 假设牌的点数位于字符串的第二个位置
    if (value === 'A') {
      return 1; // A 的点数为 1
    } else if (value === 'J') {
      return 11; // J 的点数为 11
    } else if (value === 'Q') {
      return 12; // Q 的点数为 12
    } else if (value === 'K') {
      return 13; // K 的点数为 13
    } else {
      return parseInt(value, 10); // 将其他点数转换为数值
    }
  }

  function isThreeOfAKind(playerHand: string[], bankerHand: string[]): boolean {
    if (bankerHand.length >= 1 && playerHand.length >= 2) {
      const firstBankerCard = getCardValue(bankerHand[0]);
      const firstPlayerCard = getCardValue(playerHand[0]);
      const secondPlayerCard = getCardValue(playerHand[1]);

      return firstBankerCard === firstPlayerCard && firstBankerCard === secondPlayerCard;
    }
    return false;
  }

  function isStraightFlush(playerHand: string[], bankerHand: string[]): boolean {
    if (bankerHand.length >= 1 && playerHand.length >= 2) {
      const firstBankerCard = bankerHand[0];
      const firstPlayerCard = playerHand[0];
      const secondPlayerCard = playerHand[1];

      return hasStraightFlush(firstBankerCard, firstPlayerCard, secondPlayerCard);
    }
    return false;
  }

  function hasStraightFlush(card1: string, card2: string, card3: string): boolean {
    const suit1 = getCardSuit(card1);
    const suit2 = getCardSuit(card2);
    const suit3 = getCardSuit(card3);

    return suit1 === suit2 && suit2 === suit3 && isSequential(card1, card2, card3);
  }

  function isFlushThreeOfAKind(playerHand: string[], bankerHand: string[]): boolean {
    if (bankerHand.length >= 1 && playerHand.length >= 2) {
      const firstBankerCard = bankerHand[0];
      const firstPlayerCard = playerHand[0];
      const secondPlayerCard = playerHand[1];

      return hasFlushThreeOfAKind(firstBankerCard, firstPlayerCard, secondPlayerCard);
    }
    return false;
  }

  function hasFlushThreeOfAKind(card1: string, card2: string, card3: string): boolean {
    const suit1 = getCardSuit(card1);
    const suit2 = getCardSuit(card2);
    const suit3 = getCardSuit(card3);
    const value1 = getCardValue(card1);
    const value2 = getCardValue(card2);
    const value3 = getCardValue(card3);

    return suit1 === suit2 && suit2 === suit3 && value1 === value2 && value2 === value3;
  }

  let sentMessages = [];
  const msgSeqMap: { [msgId: string]: number } = {};

  async function sendMessage(session: any, message: any, markdownCommands: string, isButton?: boolean): Promise<void> {
    isButton = isButton || false;
    const {bot, channelId} = session;
    let messageId;
    let isPushMessageId = false;
    if (config.isEnableQQOfficialRobotMarkdownTemplate && session.platform === 'qq' && config.key !== '' && config.customTemplateId !== '') {
      const msgSeq = msgSeqMap[session.messageId] || 10;
      msgSeqMap[session.messageId] = msgSeq + 100;
      const buttons = createButtons(markdownCommands);

      const rows = [];
      let row = {buttons: []};
      buttons.forEach((button, index) => {
        row.buttons.push(button);
        if (row.buttons.length === 5 || index === buttons.length - 1 || row.buttons.length === config.numberOfMessageButtonsPerRow) {
          rows.push(row);
          row = {buttons: []};
        }
      });

      if (!isButton && config.isTextToImageConversionEnabled) {
        const lines = message.toString().split('\n');
        const isOnlyImgTag = lines.length === 1 && lines[0].trim().startsWith('<img');
        if (isOnlyImgTag) {
          [messageId] = await session.send(message);
        } else {
          const modifiedMessage = lines
            .map((line) => {
              if (line.trim() !== '' && !line.includes('<img')) {
                return `# ${line}`;
              } else {
                return line + '\n';
              }
            })
            .join('\n');
          const imageBuffer = await ctx.markdownToImage.convertToImage(modifiedMessage);
          [messageId] = await session.send(h.image(imageBuffer, `image/${config.imageType}`));
        }
        if (config.retractDelay !== 0) {
          isPushMessageId = true;
          sentMessages.push(messageId);
        }

        if (config.isTextToImageConversionEnabled && markdownCommands !== '') {
          await sendMessage(session, '', markdownCommands, true)
        }
      } else if (isButton && config.isTextToImageConversionEnabled) {
        const result = await session.qq.sendMessage(session.channelId, {
          msg_type: 2,
          msg_id: session.messageId,
          msg_seq: msgSeq,
          content: '',
          markdown: {
            custom_template_id: config.customTemplateId,
            params: [
              {
                key: config.key,
                values: [`<@${session.userId}>`],
              },
            ],
          },
          keyboard: {
            content: {
              rows: rows.slice(0, 5),
            },
          },
        });
        messageId = result.id;
      } else {
        if (message.attrs?.src || message.includes('<img')) {
          [messageId] = await session.send(message);
        } else {
          // message = message.replace(/\n/g, '\r').replace(/\*/g, "？");
          // message = replaceSymbols(message);
          message = message.replace(/\n/g, '\r');

          const result = await session.qq.sendMessage(session.channelId, {
            msg_type: 2,
            msg_id: session.messageId,
            msg_seq: msgSeq,
            content: '111',
            markdown: {
              custom_template_id: config.customTemplateId,
              params: [
                {
                  key: config.key,
                  values: [`${message}`],
                },
              ],
            },
            keyboard: {
              content: {
                rows: rows.slice(0, 5),
              },
            },
          });

          messageId = result.id;
        }
      }

    } else {
      if (config.isTextToImageConversionEnabled) {
        const lines = message.split('\n');
        const isOnlyImgTag = lines.length === 1 && lines[0].trim().startsWith('<img');
        if (isOnlyImgTag) {
          [messageId] = await session.send(message);
        } else {
          const modifiedMessage = lines
            .map((line) => {
              if (line.trim() !== '' && !line.includes('<img')) {
                return `# ${line}`;
              } else {
                return line + '\n';
              }
            })
            .join('\n');
          const imageBuffer = await ctx.markdownToImage.convertToImage(modifiedMessage);
          [messageId] = await session.send(h.image(imageBuffer, `image/${config.imageType}`));
        }
      } else {
        [messageId] = await session.send(message);
      }
    }

    if (config.retractDelay === 0) return;
    if (!isPushMessageId) {
      sentMessages.push(messageId);
    }

    if (sentMessages.length > 1) {
      const oldestMessageId = sentMessages.shift();
      setTimeout(async () => {
        await bot.deleteMessage(channelId, oldestMessageId);
      }, config.retractDelay * 1000);
    }
  }

}
