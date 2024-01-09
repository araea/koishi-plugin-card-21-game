import { Context, Keys, Schema, sleep } from 'koishi'
import { } from 'koishi-plugin-monetary'

export const inject = {
  required: ['monetary', 'database'],
}
export const name = 'card-21-game'
export const usage = `
## 🎮 使用

- 本插件仅支持在群聊中游玩。
- 建议为指令添加指令别名，方便输入和记忆。
- 本插件依赖于 monetary 和 database 服务，需要先启动这两个服务。
- 本插件使用通用货币作为筹码，玩家需要有足够的货币才能参与游戏。

## 📝 命令

本插件提供了以下命令，可以在群聊中使用：

- blackJack: 显示本插件的帮助信息。
- blackJack.转账 [bet:number]: 给其他玩家转账，例如：blackJack.转账 @小小学 100。
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
* [WikiHow](https://zh.wikihow.com/%E7%8E%A921%E7%82%B9) - 黑杰克游戏技巧`
export interface Config {
  enableCardBetting: boolean
  enableSurrender: boolean
  dealerSpeed: number
  betMaxDuration: number
  buyInsuranceMaxDuration: number
  surrenderMaxDuration: number
  numberOfDecks: number
}

export const Config: Schema<Config> = Schema.object({
  enableCardBetting: Schema.boolean().default(false).description(`是否开启投注牌型功能，默认为值 false。`),
  enableSurrender: Schema.boolean().default(false).description(`是否开启投降功能，默认为值 false。`),
  dealerSpeed: Schema.number()
    .min(0).default(2).description(`庄家要牌的速度，默认值为 2，单位是秒。`),
  betMaxDuration: Schema.number()
    .min(0).default(30).description(`投注牌型操作的等待时长，默认值为 30，单位是秒。`),
  buyInsuranceMaxDuration: Schema.number()
    .min(0).default(10).description(`买保险操作的等待时长，默认值为 10，单位是秒。`),
  surrenderMaxDuration: Schema.number()
    .min(0).default(10).description(`投降操作的等待时长，默认值为 10，单位是秒。`),
  numberOfDecks: Schema.number()
    .min(1).max(8).default(4).description(`使用几副扑克牌，默认为 4 副（因为闲家都是明牌，所以建议使用默认值）。`),
})

declare module 'koishi' {
  interface Tables {
    blackjack_game_record: BlackJackGameRecord
    blackjack_playing_record: BlackJackPlayingRecord
    blackjack_debt_record: BlackJackDebtRecord
  }
}

export interface BlackJackGameRecord {
  id: number
  guildId: string
  deck: string[]
  bankerHand: string[]
  currentPlayerIndex: number
  currentPlayerUserId: string
  currentPlayerUserName: string
  currentPlayerHandIndex: number
  gameStatus: string
  canSurrender: boolean
  canBuyInsurance: boolean
}

export interface BlackJackPlayingRecord {
  id: number
  guildId: string
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
export interface BlackJackDebtRecord {
  id: number
  guildId: string
  userId: string
  username: string
  debt: number
}

const initialDeck = [
  '♥️A', '♥️2', '♥️3', '♥️4', '♥️5', '♥️6', '♥️7', '♥️8', '♥️9', '♥️10', '♥️J', '♥️Q', '♥️K',
  '♦️A', '♦️2', '♦️3', '♦️4', '♦️5', '♦️6', '♦️7', '♦️8', '♦️9', '♦️10', '♦️J', '♦️Q', '♦️K',
  '♣️A', '♣️2', '♣️3', '♣️4', '♣️5', '♣️6', '♣️7', '♣️8', '♣️9', '♣️10', '♣️J', '♣️Q', '♣️K',
  '♠️A', '♠️2', '♠️3', '♠️4', '♠️5', '♠️6', '♠️7', '♠️8', '♠️9', '♠️10', '♠️J', '♠️Q', '♠️K'
]

export function apply(ctx: Context, config: Config) {
  const { betMaxDuration, buyInsuranceMaxDuration, surrenderMaxDuration, numberOfDecks, dealerSpeed, enableCardBetting, enableSurrender } = config
  // 群组id 牌堆 当前进行操作的玩家 游戏状态（开始、未开始、投注时间...） 是否可以投降
  ctx.model.extend('blackjack_game_record', {
    id: 'unsigned',
    guildId: 'string',
    deck: 'list',
    bankerHand: 'list',
    currentPlayerIndex: 'integer',
    currentPlayerUserId: 'string',
    currentPlayerUserName: 'string',
    currentPlayerHandIndex: 'integer',
    gameStatus: 'string',
    canSurrender: 'boolean',
    canBuyInsurance: 'boolean',
  }, {
    primary: 'id',
    autoInc: true,
  })
  // 群组id 用户id 用户名 投注筹码数额 玩家手牌 被投注的玩家id 被投注的类型 被投注的金额
  ctx.model.extend('blackjack_playing_record', {
    id: 'unsigned',
    guildId: 'string',
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
  ctx.model.extend('blackjack_debt_record', {
    id: 'unsigned',
    guildId: 'string',
    userId: 'string',
    username: 'string',
    debt: 'double',
  }, {
    primary: 'id',
    autoInc: true,
  })

  // 仅群聊
  ctx = ctx.guild()
  // blackJack/21点帮助
  ctx.command('blackJack', 'blackJack/21点游戏帮助')
    .action(async ({ session }) => {
      await session.execute(`blackjack -h`)
    })

  // zz*
  ctx.command('blackJack.转账 [content:text]', '转账')
    .action(async ({ session }, content) => {
      const { user, platform } = session
      const userIdRegex = /<at id="([^"]+)"(?: name="([^"]+)")?\/>/;
      const match = content.match(userIdRegex);

      if (!match) {
        return '未找到符合要求的用户 ID。';
      }

      const userId = match[1];
      const username = match[2]

      let remainingContent = content.replace(match[0], '').trim();

      let amount: number;
      if (remainingContent.length > 0) {
        amount = parseFloat(remainingContent);

        if (isNaN(amount)) {
          return '转账金额必须是一个有效的数字。';
        }

        if (amount < 0) {
          return '转账金额不能为负数。';
        }
      } else {
        return '未找到有效的转账金额。';
      }

      // @ts-ignore
      const uid = user.id
      const [userMonetary] = await ctx.database.get('monetary', { uid })
      const userMoney = userMonetary.value

      if (userMoney < amount) {
        return `您当前余额不足以转账【${amount}】个货币。
您的货币余额：【${userMoney}】点。`
      }

      const newScore = userMoney - amount;

      await ctx.database.set('monetary', { uid }, { value: newScore });

      const uid2 = (await ctx.database.getUser(platform, userId)).id
      const [userMonetary2] = await ctx.database.get('monetary', { uid: uid2 })
      await ctx.database.set('monetary', { uid: uid2 }, { value: userMonetary2.value + amount });

      await session.send(`转账成功！
您已将【${amount}】个通用货币转给【${username}】，
您的通用货币余额为【${newScore}】个。`);
    });
  // j*
  // 加入游戏并投注筹码
  ctx.command('blackJack.加入游戏 [bet:number]', '加入游戏并投注筹码')
    .action(async ({ session }, bet) => {
      const { guildId, userId, username, user } = session;
      // 查询当前群组的游戏记录
      let gameRecord = await ctx.database.get('blackjack_game_record', { guildId });

      // 如果当前群组没有游戏信息，则新建一个
      if (gameRecord.length === 0) {
        await ctx.database.create('blackjack_game_record', { guildId, gameStatus: '未开始' });
        gameRecord = await ctx.database.get('blackjack_game_record', { guildId });
      }

      // 检查游戏状态
      const gameInfo = gameRecord[0];

      if (gameInfo.gameStatus !== '未开始') {
        return `游戏已经开始了哦~`;
      }
      // 判断该玩家有没有加入过游戏
      const getPlayer = await ctx.database.get('blackjack_playing_record', { guildId, userId })
      if (getPlayer.length !== 0) {
        return `你已在游戏中，无法加入游戏。`
      }
      if (!bet) {
        // @ts-ignore
        const uid = user.id;
        const [userMonetary] = await ctx.database.get('monetary', { uid });
        await session.send(`【${username}】，加入游戏，请投注！
你有 ${userMonetary.value} 通用货币，请输入投注数额：`)

        bet = Number(await session.prompt())
        if (isNaN(bet as number)) {
          // 处理无效输入的逻辑
          return '输入无效，请重新输入。'
        }
      }
      // 检查是否存在有效的投注金额
      if (typeof bet !== 'number' || bet <= 0) {
        return `请准备好投注金额，方可加入游戏。`;
      }

      // @ts-ignore
      const uid = user.id;
      const [userMonetary] = await ctx.database.get('monetary', { uid });

      if (userMonetary.value < bet) {
        return `您的余额不足，请有钱后再试。
余额：【${userMonetary.value}】点`;
      }

      await ctx.monetary.cost(uid, bet);
      // 在游玩表中创建玩家
      await ctx.database.create('blackjack_playing_record', { guildId, userId, username, bet, playerHandIndex: 1 });

      // 获取当前玩家数量
      const numberOfPlayers = (await ctx.database.get('blackjack_playing_record', { guildId })).length;

      return `【${username}】，欢迎来到游戏！
你已投注 ${bet} 筹码，
剩余 ${userMonetary.value - bet} 通用货币。
当前共有 ${numberOfPlayers} 名玩家。`;
    });
  // q*
  ctx.command('blackJack.退出游戏', '退出游戏').action(async ({ session }) => {
    const { guildId, userId, user } = session;

    // 检查游戏状态
    const gameInfo = await ctx.database.get('blackjack_game_record', { guildId });

    if (gameInfo.length === 0) {
      // 如果当前群组没有游戏信息，新建一个
      await ctx.database.create('blackjack_game_record', { guildId, gameStatus: '未开始' });
      return '你都没加入，怎么退出？';
    }

    if (gameInfo[0].gameStatus !== '未开始') {
      return '哼哼，游戏都开始了还想退出？';
    }

    // 检查玩家是否加入游戏
    const playerInfo = await ctx.database.get('blackjack_playing_record', { guildId, userId });

    if (playerInfo.length === 0) {
      return '加入了才能退出哦~';
    }

    const player = playerInfo[0]
    // @ts-ignore
    const uid = user.id
    // 把钱还给他
    await ctx.monetary.gain(uid, player.bet)
    // 从游戏中移除玩家
    await ctx.database.remove('blackjack_playing_record', { guildId, userId });

    // 获取当前玩家数量
    const numberOfPlayers = (await ctx.database.get('blackjack_playing_record', { guildId })).length;

    return `您退出了游戏，您将获得退款。
剩余玩家人数：${numberOfPlayers}。`;
  });
  // s*
  // 开始游戏
  ctx.command('blackJack.开始游戏', '开始游戏').action(async ({ session }) => {
    const { guildId, userId } = session;

    // 检查游戏状态，如果游戏状态不在未开始，则说明已经开始，无需开始
    const gameInfo = await ctx.database.get('blackjack_game_record', { guildId });

    // 没有游戏状态，说明游戏还无人加入
    if (gameInfo.length === 0) {
      // 如果当前群组没有游戏信息，新建一个
      await ctx.database.create('blackjack_game_record', { guildId, gameStatus: '未开始' });
      return '没人怎么玩呀~';
    }
    // 检测游戏状态，如果不等于 未开始，则说明游戏已经开始，不能再开始
    if (gameInfo[0].gameStatus !== '未开始') {
      return '已经开始了哦，待会儿记得来呀~';
    }
    // 那么现在检查游戏中人数是否至少有一个
    const getPlayers = await ctx.database.get('blackjack_playing_record', { guildId })
    // 获取当前玩家数量
    const numberOfPlayers = getPlayers.length
    if (numberOfPlayers === 0) {
      // 玩家如果不存在，人数不够，无法开始游戏
      return `悲~ 没人玩的说...`
    }
    // 有玩家的话基本上可以开始了，但是我们还是可以再检查一遍
    if (numberOfPlayers < 1) {
      `好像没人玩呀！` // 好像有点多余
    }
    // 切换游戏状态
    await ctx.database.set('blackjack_game_record', { guildId }, { gameStatus: '投注时间' })
    // 那么现在，能够确保人数至少够了，接下来打乱玩家顺序，并用序号一一对应，可以用序号索引到对应的userId和usrname
    // 但是，如果人数只有一个人，那就不用打乱了对吧
    // 解决报错： TypeError: Cannot read properties of undefined (reading 'push')
    let shuffledPlayersWithIndex: { index: number; player: any }[] = [];

    if (numberOfPlayers !== 1) {
      // 人数不是 1，就打乱 getPlayers 的数组顺序
      // 使用洗牌算法打乱 getPlayers 数组
      const shuffledPlayers = shuffleArray(getPlayers);

      // 为打乱后的数组分配数字序号
      await Promise.all(
        shuffledPlayers.map(async (player, index) => {
          const playerIndex = index + 1;
          await ctx.database.set('blackjack_playing_record', { userId: player.userId, guildId: player.guildId }, { playerIndex, playerHandIndex: 1 });
          shuffledPlayersWithIndex.push({
            index: playerIndex,
            player,
          });
        })
      );

      const playerOrder = shuffledPlayersWithIndex
        .map((item) => `${item.index}. 【${item.player.username ?? 'Unknown'}】`)
        .join('\n');

      const prompt = `你们有 ${betMaxDuration} 秒钟的时间进行投注。

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

      await session.send(` 游戏开始！
${(enableCardBetting) ? prompt : ''}
⚠️ 注意：该局游戏使用【${numberOfDecks}】副扑克牌。

${(!enableCardBetting || !enableSurrender) ? `为庄家发牌...\n\n请庄家亮牌！` : ''}`)

    } else if (numberOfPlayers === 1) {
      await ctx.database.set('blackjack_playing_record', { userId, guildId }, { playerIndex: 1, playerHandIndex: 1 })
      const player = getPlayers[0]
      const prompt = `你有 ${betMaxDuration} 秒的时间进行投注。
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
  其他可选操作：跳过投注
  【跳过投注】：闲家发送此操作可直接进入下一阶段。`

      // 人数为 1 的时候，新的提示词
      await session.send(`欢迎来到黑杰克的世界！
你是今天唯一的挑战者，你敢和我赌一把吗？
${(enableCardBetting) ? prompt : ''}
⚠️ 注意：该局游戏使用【${numberOfDecks}】副扑克牌。

${(!enableCardBetting || !enableSurrender) ? `为庄家发牌...\n\n请庄家亮牌！` : ''}`)
    }

    if (!enableCardBetting || !enableSurrender) {
      await sleep(dealerSpeed * 1000)
    }
    if (enableCardBetting) {
      // 现在是投注时间
      // 先把游戏状态更新成 投注时间
      await ctx.database.set('blackjack_game_record', { guildId }, { gameStatus: '投注时间' })

      // 投注时间

      async function getGameStatus(): Promise<string> {
        let gameStatus = '投注时间';
        let timeout = 0;

        while (gameStatus === '投注时间' && timeout < betMaxDuration) {
          const result = await ctx.database.get('blackjack_game_record', { guildId });
          gameStatus = result[0].gameStatus;
          timeout += 1;
          await sleep(1 * 1000);
        }

        return gameStatus;
      }

      const gameStatus = await getGameStatus();
      if (gameStatus === '投注时间') {
        await ctx.database.set('blackjack_game_record', { guildId }, { gameStatus: '投注时间结束' })
        await session.send(`投注时间已到，下一阶段开始！`)
      }
    }

    // 游戏正式开始
    // 我需要几副扑克牌并洗牌，打入牌堆
    const decks = generateDecks(numberOfDecks);
    // 使用洗牌算法多次打乱牌堆
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

    const dealtCardToBanker = await dealCards(guildId, shuffledDeck);
    const dealtCardToPunter = await dealCards(guildId, shuffledDeck);

    // 现在开始可以投降了，
    await ctx.database.set('blackjack_game_record', { guildId }, {
      deck: shuffledDeck, canSurrender: true, currentPlayerIndex: 1, currentPlayerUserId: betPlayer.userId,
      currentPlayerUserName: betPlayer.username, gameStatus: '已开始', currentPlayerHandIndex: 1
    })
    if (enableSurrender) {
      // 先为庄家发一张牌，然后给玩家选择是否投降的时间
      await session.send(`庄家亮牌【${dealtCardToBanker}】，点数为 ${calculateScore(dealtCardToBanker)}。
投降倒计时开始，所有玩家将在 ${surrenderMaxDuration} 秒内选择是否投降。
【投降】：退回半注。
【跳过投降】：直接进入下一阶段。`)

      async function getgameCanSurrender(): Promise<boolean> {
        let gameCanSurrender: boolean = true;
        let timeout = 0;

        while (gameCanSurrender === true && timeout < surrenderMaxDuration) {
          try {
            const [result] = await ctx.database.get('blackjack_game_record', { guildId });
            gameCanSurrender = result.canSurrender;
            timeout += 1;
            await sleep(1 * 1000);
          } catch (error) {
            return false
          }

        }

        return gameCanSurrender;
      }

      const gameCanSurrender = await getgameCanSurrender();
      if (gameCanSurrender === true) {
        await ctx.database.set('blackjack_game_record', { guildId }, { canSurrender: false })
        await session.send(`投降已截止，下一阶段开始！`)
      }

      // 判断游戏在投降之后是否已经结束
      const result = await ctx.database.get('blackjack_game_record', { guildId })
      if (result.length === 0) {
        return
      }
    }

    // 更新庄家的手牌
    await ctx.database.set('blackjack_game_record', { guildId }, { bankerHand: [`${dealtCardToBanker}`] })
    // 为第一位玩家更新手牌
    await ctx.database.set('blackjack_playing_record', { guildId, userId: betPlayer.userId }, { playerHand: [`${dealtCardToPunter}`], playerHandIndex: 1 })
    // 如果庄家第一张牌是 A，则可买保险
    if (calculateScore(dealtCardToBanker) === 11) {
      // 将买保险的开关打开
      await ctx.database.set('blackjack_game_record', { guildId }, { canBuyInsurance: true })

      await session.send(`庄家亮牌【${dealtCardToBanker}】
点数为【11】点！
买保险倒计时开始，所有玩家将在 ${buyInsuranceMaxDuration} 秒内选择是否买保险。
【买保险】：花费半注，若庄家21点则获得双倍赔偿，否则损失半注。
【跳过买保险】：直接进入下一阶段。`)

      // 等待 buyInsuranceDuration 秒给玩家选择的时间
      async function getGameCanBuyInsurance(): Promise<boolean> {
        let gameCanBuyInsurance = true;
        let timeout = 0;

        while (gameCanBuyInsurance === true && timeout < buyInsuranceMaxDuration) {
          const result = await ctx.database.get('blackjack_game_record', { guildId });
          gameCanBuyInsurance = result[0].canBuyInsurance;
          timeout += 1;
          await sleep(1 * 1000);
        }

        return gameCanBuyInsurance;
      }

      const gameCanBuyInsurance = await getGameCanBuyInsurance();
      if (gameCanBuyInsurance === true) {
        await ctx.database.set('blackjack_game_record', { guildId }, { canBuyInsurance: false })
        await session.send(`保险已截止，决战即刻开始！`)
      }
      const betPlayerName = betPlayer.username
      return `【${betPlayerName}】
你的第一张牌是：【${dealtCardToPunter}】
请选择：
【要牌】或【停牌】`
    }
    // 万事具备
    return `庄家亮牌：【${dealtCardToBanker}】
点数：【${calculateScore(dealtCardToBanker)}】点！

【${betPlayer.username}】
你的手牌：【${dealtCardToPunter}】
点数：【${calculateScore(dealtCardToPunter)}】点！

请选择：
【要牌】或【停牌】`
  });


  // tx*
  ctx.command('blackJack.投降', '投降').action(async ({ session }) => {
    if (!enableSurrender) {
      return `投降功能已关闭。`
    }
    const { guildId, userId, user, username } = session
    // 检查游戏信息是否存在
    const getGameInfo = await ctx.database.get('blackjack_game_record', { guildId })
    if (getGameInfo.length === 0) {
      // 顺手新建一个初始化的游戏信息
      await ctx.database.create('blackjack_game_record', { guildId, gameStatus: '未开始' });
      return `哼~ 最看不起投降的人了！`
    }
    // 游戏信息看看游戏状态
    const gameInfo = getGameInfo[0]
    if (gameInfo.gameStatus !== '已开始') {
      return `还没开始呢笨蛋，这么想投降啊？`
    }
    // 判断玩家是否在游戏中
    const getPlayer = await ctx.database.get('blackjack_playing_record', { guildId, userId })
    if (getPlayer.length === 0) {
      return `你都没来陪我一起玩就想投降？`
    }
    if (!gameInfo.canSurrender) {
      return `笨蛋，现在可不能投降！`
    }
    const player = getPlayer[0]
    // 如果已经投降了，也不能再投降
    if (player.isSurrender) {
      return `你难道想投降两次嘛！`
    }

    // 投降输一半
    // 返回一半筹码，投注牌型下的注也予返回。
    const refundAmount = (player.bet + player.betAmount) / 2
    // @ts-ignore
    const uid = user.id
    await ctx.monetary.gain(uid, refundAmount)
    const [userMonetary] = await ctx.database.get('monetary', { uid });
    await ctx.database.set('blackjack_playing_record', { guildId, userId }, { isSurrender: true })
    const theGameResult = await isGameEnded(guildId)

    // 判断玩家是否已全部投降
    if ((gameInfo.currentPlayerIndex === player.playerIndex) && theGameResult) {
      await ctx.database.remove('blackjack_playing_record', { guildId });
      await ctx.database.remove('blackjack_game_record', { guildId });
      return `游戏还未开始，你们却都投降了，我感到失望。算了，游戏就此结束，祝你们好运。`
    }

    return `【${username}】投降，
本轮损失【${refundAmount}】个通用货币，
剩余【${userMonetary.value}】个。`
  })
  // ck* r*
  ctx.command('blackJack.重新开始', '重新开始').action(async ({ session }) => {
    // 什么都不管，先重开了再说
    const { guildId, bot, platform } = session
    // 如果游戏未开始，把钱退给他们
    // 检查游戏信息是否存在
    const getGameInfo = await ctx.database.get('blackjack_game_record', { guildId })
    if (getGameInfo.length === 0) {
      // 顺手新建一个初始化的游戏信息
      await ctx.database.create('blackjack_game_record', { guildId, gameStatus: '未开始' });
      return `现在的情况根本没必要重新开始嘛！`
    }
    const gameInfo = getGameInfo[0]
    if (gameInfo.gameStatus === '未开始') {
      // 退钱
      const getPlayers = await ctx.database.get('blackjack_playing_record', { guildId })
      for (const player of getPlayers) {
        const uid = (await ctx.database.getUser(platform, player.userId)).id
        await ctx.monetary.gain(uid, player.bet)
      }
      await ctx.database.remove('blackjack_playing_record', { guildId })
      await ctx.database.remove('blackjack_game_record', { guildId })
      return `哼，既然游戏还没开始的话，只好把钱退给你们咯~`
    }
    await ctx.database.remove('blackjack_playing_record', { guildId })
    await ctx.database.remove('blackjack_game_record', { guildId })
    return `你们失败了，只能重新开始了~ 你们的钱就拜拜了~ 哈哈~`
  })

  // tz*
  // 投注 玩家序号 投注类型 投注金额
  ctx.command('blackJack.投注 [playerIndex:number] [betType:string] [betAmount:number]', '投注牌型').action(async ({ session }, playerIndex, betType, betAmount) => {
    if (!enableCardBetting) {
      return `投注牌型功能已关闭。`
    }
    // 检查参数是否都存在
    if (!playerIndex || !betType || !betAmount) {
      return `请输入投注信息，格式如下：
投注 [玩家序号] [牌型] [金额]
示例：投注 1 7 50`
    }
    const { guildId, userId, user, username } = session
    // 假如参数都存在，那么需要判断游戏状态是不是在 投注时间
    // 不需要检查是否存在游戏信息
    const getGameInfo = await ctx.database.get('blackjack_game_record', { guildId })
    if (getGameInfo.length === 0) {
      // 顺手创建
      await ctx.database.create('blackjack_game_record', { guildId, gameStatus: '未开始' });
      return `开始游戏之后才能投注呢~`
    }
    const gameInfo = getGameInfo[0]
    if (gameInfo.gameStatus !== '投注时间') {
      return `现在不在投注时间哦~`
    }
    let betPlayer: Pick<BlackJackPlayingRecord, Keys<BlackJackPlayingRecord, any>>;
    const getPlayers = await ctx.database.get('blackjack_playing_record', { guildId })
    const numberOfPlayers = getPlayers.length
    const getThisPlayer = await ctx.database.get('blackjack_playing_record', { guildId, userId })
    if (getThisPlayer.length === 0) {
      return `加入游戏才可以投注！`
    }
    const thisPlayer = getThisPlayer[0]
    // 已经投注过，需要更改吗？俗话说买定离手，对吧~
    if (thisPlayer.betAmount) {
      return `笨蛋，买定离手哦，才不给你更改投注！`
    }
    // 通过 playerIndex 获得 player 对象
    // 一个人和人数大于一个人分开思考
    if (numberOfPlayers === 1) {
      betPlayer = getPlayers[0]
    } else {
      const getBetPlayer = await ctx.database.get('blackjack_playing_record', { guildId, playerIndex })
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
        return "傻瓜，给我个有效的牌型！";
      }
    }
    // 检查是否存在有效的投注金额
    if (typeof betAmount !== 'number' || betAmount <= 0) {
      return `哼，给我爆金币！`;
    }

    // 检查投注牌型的玩家是否有足够的货币押注
    // @ts-ignore
    const uid = user.id;
    const [userMonetary] = await ctx.database.get('monetary', { uid });

    if (userMonetary.value < betAmount) {
      return `你怎么这么穷惹~ 没钱了啦！\n你当前的货币数额为：【${userMonetary.value}】个。`;
    }

    await ctx.monetary.cost(uid, betAmount);
    // 花了钱，那么，就为该玩家更新游玩信息吧
    await ctx.database.set('blackjack_playing_record', { guildId, userId }, { betPlayerUserId: betPlayer.userId, betPlayerUserName: betPlayer.username, betType, betAmount })

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

    function getCardTypeMultiplier(betType: string): number {
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

    const multiplier = getCardTypeMultiplier(betType);

    // 搞定之后，返回信息
    return `【${username}】投注【${betType}】（${multiplier}倍）牌型！
对【${betPlayer.username}】手牌投注【${betAmount}】！`
  })

  // tg*
  ctx.command('blackJack.跳过投注', '跳过投注牌型的等待时间')
    .action(async ({ session }) => {
      if (!enableCardBetting) {
        return `投注牌型功能已关闭。`
      }
      const { guildId, userId, username, user } = session;

      // 判断该玩家有没有加入过游戏
      const getPlayer = await ctx.database.get('blackjack_playing_record', { guildId, userId })
      if (getPlayer.length === 0) {
        return `不加入怎么用指令呢~`
      }
      // 查询当前群组的游戏记录
      let gameRecord = await ctx.database.get('blackjack_game_record', { guildId });

      // 如果当前群组没有游戏信息，则新建一个
      if (gameRecord.length === 0) {
        await ctx.database.create('blackjack_game_record', { guildId, gameStatus: '未开始' });
        return `笨蛋~ 还没开始呢！`
      }

      // 检查游戏状态
      const gameInfo = gameRecord[0];

      if (gameInfo.gameStatus !== '投注时间') {
        return `现在不在投注时间哦~`;
      }

      await ctx.database.set('blackjack_game_record', { guildId }, { gameStatus: '投注时间结束' })

      return `玩家【${username}】执行【跳过投注】操作，【投注】通道已关闭！`
    });
  // tgmbx*
  ctx.command('blackJack.跳过买保险', '跳过买保险的等待时间')
    .action(async ({ session }) => {
      const { guildId, userId, username, user } = session;

      // 判断该玩家有没有加入过游戏
      const getPlayer = await ctx.database.get('blackjack_playing_record', { guildId, userId })
      if (getPlayer.length === 0) {
        return `你不在游戏里的说...`
      }
      // 查询当前群组的游戏记录
      let gameRecord = await ctx.database.get('blackjack_game_record', { guildId });

      // 如果当前群组没有游戏信息，则新建一个
      if (gameRecord.length === 0) {
        await ctx.database.create('blackjack_game_record', { guildId, gameStatus: '未开始' });
        return `游戏还没开始呢！`
      }

      // 检查游戏状态
      const gameInfo = gameRecord[0];

      if (!gameInfo.canBuyInsurance) {
        return `现在可买不了保险~`;
      }

      await ctx.database.set('blackjack_game_record', { guildId }, { canBuyInsurance: false })

      return `玩家【${username}】执行【跳过买保险】操作，【买保险】通道已关闭！`
    });
  // tgtx*
  ctx.command('blackJack.跳过投降', '跳过投降的等待时间')
    .action(async ({ session }) => {
      if (!enableSurrender) {
        return `投降功能已关闭。`
      }
      const { guildId, userId, username, user } = session;

      // 判断该玩家有没有加入过游戏
      const getPlayer = await ctx.database.get('blackjack_playing_record', { guildId, userId })
      if (getPlayer.length === 0) {
        return `你还不在游戏里面哦~`
      }
      // 查询当前群组的游戏记录
      let gameRecord = await ctx.database.get('blackjack_game_record', { guildId });

      // 如果当前群组没有游戏信息，则新建一个
      if (gameRecord.length === 0) {
        await ctx.database.create('blackjack_game_record', { guildId, gameStatus: '未开始' });
        return `还没开始呢！`
      }

      // 检查游戏状态
      const gameInfo = gameRecord[0];

      if (!gameInfo.canSurrender) {
        return `还没到可以跳过的时候呢~`;
      }

      await ctx.database.set('blackjack_game_record', { guildId }, { canSurrender: false })

      return `玩家【${username}】执行【跳过投降】操作，【投降】通道已关闭！`
    });

  // bx*
  // 注册买保险的指令
  ctx.command('blackJack.买保险', '买保险').action(async ({ session }) => {
    const { guildId, userId, username } = session
    // 检查玩家信息，查看该玩家是否加入游戏
    const getPlayer = await ctx.database.get('blackjack_playing_record', { guildId, userId })
    if (getPlayer.length === 0) {
      return `想买保险？先加入游戏再说！笨蛋~`
    }
    const player = getPlayer[0]
    // 只能买一次保险
    if (player.isBuyInsurance) {
      return `买一次就够了，笨蛋！而且只能买一次好不好！`
    }
    // 检查游戏状态，如果游戏已开始，且买保险开关打开，则可以继续
    const getGameInfo = await ctx.database.get('blackjack_game_record', { guildId })
    // 是否需要检查这个群组是否存在游戏
    if (getGameInfo.length === 0) {
      // 顺手创建
      await ctx.database.create('blackjack_game_record', { guildId, gameStatus: '未开始' });
      return `游戏还没开始呢~ 买不了保险的说...`
    }
    // 检查游戏状态和买保险开关
    const gameInfo = getGameInfo[0]
    if (gameInfo.gameStatus !== '已开始') {
      return `游戏没开始呀~ 买什么保险呢！`
    }
    if (!gameInfo.canBuyInsurance) {
      return `现在买不了保险了哦~`
    }

    // 在游戏里，保险开关打开，游戏已正式开始
    await ctx.database.set('blackjack_playing_record', { guildId, userId }, { isBuyInsurance: true, bet: player.bet / 2, insurance: player.bet / 2 })
    return `玩家【${username}】成功买到保险，祝你好运，朋友！`
  })

  // yp*
  // 要牌
  ctx.command('blackJack.要牌', '要一张牌').action(async ({ session }) => {
    // 处理分牌：如果 handindex > 1 且 第一张手牌为 A，只获发一张牌
    // 处理加倍：如果状态为已加倍，更改已要牌 判断是否已要牌
    // 想要要一张牌，首先要游戏开始、在游戏中、轮到该玩家要牌、是否投降、如果投降的话直接为下一位发牌
    // 检查游戏是否开始
    const { guildId, userId, username, platform } = session
    const getGameInfo = await ctx.database.get('blackjack_game_record', { guildId })
    if (getGameInfo.length === 0) {
      await ctx.database.create('blackjack_game_record', { guildId, gameStatus: '未开始' });
      return `游戏还没开始呢！`
    }
    const gameInfo = getGameInfo[0]
    if (gameInfo.gameStatus !== '已开始') {
      return `游戏还没开始哦~`
    }
    // 检查玩家是否在游戏中
    const getPlayer = await ctx.database.get('blackjack_playing_record', { guildId, userId })
    if (getPlayer.length === 0) {
      return `笨蛋，你不在游戏里面！`
    }
    if (gameInfo.currentPlayerIndex !== getPlayer[0].playerIndex) {
      return `现在轮到的还不是你哦~`
    }
    const getPlayerInfo = await ctx.database.get('blackjack_playing_record', {
      guildId, userId, playerIndex: gameInfo.currentPlayerIndex,
      playerHandIndex: gameInfo.currentPlayerHandIndex
    })
    const player = getPlayerInfo[0]
    // 似乎检查投降并没有什么必要 下面的代码似乎无意义
    if (player.isSurrender) {
      // 下一位：找到下一位没有投降的玩家、如果又都已经投降，那么直接结束游戏，如果没有，就更新游戏信息，为下一位玩家发牌并发送信息
      if (await isGameEnded(guildId)) {
        return `你们全都放弃了，这太不可思议了，我无法理解。好吧，既然你们这么想，游戏就此终止，祝你们好运。`
      }
    }
    if (player.afterDoublingTheBet === '已要牌') {
      return `你已经不能再要牌惹！不许贪心~`
    }
    if (getPlayer.length > 1 && calculateScore(player.playerHand[0]) === 11 && player.playerHand.length === 2) {
      return `A 分牌仅可获发 1 张牌，不可再要牌！`
    }
    // 要牌要做什么：获取牌堆，发一张牌，更新牌堆、计算点数、判断是否是两张牌、两张牌是对子的话可以分牌、若两张牌点数之和是11则可以选择是否加倍
    // 判断是否爆牌或者是否为21点，如果为21点，再判断是否为黑杰克，如果爆牌就下一位

    // 关闭投降通道 已废弃
    // await ctx.database.set('blackjack_game_record', { guildId }, { canSurrender: false })

    if (player.afterDoublingTheBet === '已加倍') {
      await ctx.database.set('blackjack_playing_record', { userId, guildId, playerHandIndex: gameInfo.currentPlayerHandIndex }, { afterDoublingTheBet: '已要牌' })
    }
    const deck = gameInfo.deck;
    let playerHand: string[] = player.playerHand; // 使用解构复制来创建 playerHand 的副本

    const dealtCardToPunter: string = await dealCards(guildId, deck);
    await ctx.database.set('blackjack_game_record', { guildId }, { deck })
    playerHand.push(dealtCardToPunter); // 将 dealtCardToPunter 添加到 playerHand 中
    await ctx.database.set('blackjack_playing_record', { guildId, userId, playerHandIndex: gameInfo.currentPlayerHandIndex }, { playerHand })
    const score = calculateHandScore(playerHand)
    const isHandPair = isPair(playerHand)
    // 爆牌或21
    if (score >= 21) {
      await ctx.database.set('blackjack_playing_record', { guildId, userId, playerHandIndex: gameInfo.currentPlayerHandIndex }, { isOver: true })
      // 如果游戏结束，那么接下来就是为庄家发牌并结算
      if (await isGameEnded(guildId)) {
        await session.send(`【${username}】，
你的手牌是：【${playerHand.join('')}】，

点数为【${score}】。

${score > 21 ? '爆牌！' : ((playerHand.length === 2) ? '黑杰克！' : '21点！')}

玩家回合结束，庄家正在补牌...`)
        await sleep(dealerSpeed * 1000)
        let bankerHand: string[] = gameInfo.bankerHand;
        async function bankerPlayGame(guildId: string, deck: string[]): Promise<void> {
          const dealtCardToBanker = await dealCards(guildId, deck);
          bankerHand.push(dealtCardToBanker);
          const bankerScore = calculateHandScore(bankerHand);

          await sleep(dealerSpeed * 1000)
          await session.send(`庄家摸牌...
手牌【${bankerHand.join('')}】，
点数【${bankerScore}】。
${(bankerScore > 21) ? '爆牌！' : ''}${(bankerHand.length === 2 && bankerScore === 21) ? '黑杰克！' : ((bankerScore === 21) ? '21点！' : '')}${(bankerScore < 17) ? '\n再来！' : '\n收牌！'}`);

          if (bankerScore < 17) {
            await bankerPlayGame(guildId, deck);
          } else {
            await ctx.database.set('blackjack_game_record', { guildId }, { bankerHand })
          }
        }

        // 调用 bankerPlayGame 函数来为庄家开始游戏
        await bankerPlayGame(guildId, deck);

        await sleep(dealerSpeed * 1000)
        return `游戏结算如下：
${(await settleBlackjackGame(platform, guildId))}
感谢参与，祝好运！`

      }
      // 游戏没有结束 不需要去管 直接获取新的游戏信息即可 因为在 isendgame里面已经更新了
      // 获取更新后的游戏状态 获取新的玩家信息 根据玩家信息或游戏信息的 handindex 去安排是否提示 分牌信息

      const [newGameInfo] = await ctx.database.get('blackjack_game_record', { guildId })
      const [newThisPlayerInfo] = await ctx.database.get('blackjack_playing_record', {
        guildId,
        playerIndex: newGameInfo.currentPlayerIndex,
        playerHandIndex: newGameInfo.currentPlayerHandIndex
      })
      const dealtCardToPunter = await dealCards(guildId, deck)
      await ctx.database.set('blackjack_playing_record', { guildId, userId: newThisPlayerInfo.userId, playerHandIndex: newThisPlayerInfo.playerHandIndex }, { playerHand: [`${dealtCardToPunter}`] })
      await ctx.database.set('blackjack_game_record', { guildId }, { deck })
      const distributional = `${(newThisPlayerInfo.playerHand.length === 1) ? '但幸运的是，你还有机会！' : ''}
你的手牌是：【${newThisPlayerInfo.playerHand.join('')}】
你可以选择：
${(newThisPlayerInfo.playerHand.length === 1) ? '【要牌】🃏' : ''}${(isHandPair) ? '\n【分牌】👥' : ''}${(score === 11 && playerHand.length === 2) ? '\n【加倍】💰' : ''}
【停牌】🛑

${(isHandPair) ? `【分牌】：把一对牌分成两手，再下一注。
注意：如果是两张A，每手只能再要一张。`: ''}
${(score === 11 && playerHand.length === 2) ? `【加倍】：加倍下注，只能再要一张。` : ''}`

      const noDistributional = `有请下一位玩家【${newThisPlayerInfo.username}】！🎉
你的手牌是：【${dealtCardToPunter}】
你可以选择：
【要牌】、【停牌】${(isHandPair) ? '、【分牌】' : ''}${(score === 11 && playerHand.length === 2) ? '或【加倍】' : ''}
${(isHandPair) ? `【分牌】：分两手玩，每手下注相同。
注意：如果分了两张A，每手只能再拿一张牌。`: ''}
${(score === 11 && playerHand.length === 2) ? `【加倍】：下注翻倍，只能再拿一张牌。` : ''}`

      return `👋 【${username}】，
你要了一张牌！
你的手牌：【${playerHand.join('')}】，
点数：【${score}】！
${(score > 21) ? '😱 糟糕，你超过了 21，你爆了！' : ((playerHand.length === 2) ? '黑杰克！' : '21点！')}

${(newThisPlayerInfo.playerHandIndex > 1) ? distributional : noDistributional}`
    }
    // 未爆牌：
    return `当前玩家是：【${username}】
你要了一张牌！
你的手牌：【${playerHand.join('')}】
点数：【${score}】点！
请选择你接下来的操作：
【要牌】或【停牌】${(isHandPair) ? '或【分牌】' : ''}${(score === 11 && playerHand.length === 2) ? '或【加倍】' : ''}
${(isHandPair) ? `【分牌】：再下原注，将牌分为两手。
特殊情况：分开两张A后，每张A只能再要一张牌。`: ''}
${(score === 11 && playerHand.length === 2) ? `【加倍】：加注一倍，只能再拿一张牌。` : ''}`
  })
  // tp*
  ctx.command('blackJack.停牌', '停止要牌').action(async ({ session }) => {
    // 停牌：游戏开始、在游戏里、轮到你、没投降
    // 检查游戏是否开始
    const { guildId, userId, username, platform } = session
    const getGameInfo = await ctx.database.get('blackjack_game_record', { guildId })
    if (getGameInfo.length === 0) {
      await ctx.database.create('blackjack_game_record', { guildId, gameStatus: '未开始' });
      return `游戏还没开始呢！`
    }
    const gameInfo = getGameInfo[0]
    if (gameInfo.gameStatus !== '已开始') {
      return `游戏还没开始哦~`
    }
    // 检查玩家是否在游戏中
    const getPlayer = await ctx.database.get('blackjack_playing_record', { guildId, userId })
    if (getPlayer.length === 0) {
      return `笨蛋，你不在游戏里面！`
    }
    if (gameInfo.currentPlayerIndex !== getPlayer[0].playerIndex) {
      return `现在轮到的还不是你哦~`
    }
    const getPlayerInfo = await ctx.database.get('blackjack_playing_record', {
      guildId, userId, playerIndex: gameInfo.currentPlayerIndex,
      playerHandIndex: gameInfo.currentPlayerHandIndex
    })
    const player = getPlayerInfo[0]
    // 似乎检查投降并没有什么必要 下面的代码似乎无意义
    if (player.isSurrender) {
      // 下一位：找到下一位没有投降的玩家、如果又都已经投降，那么直接结束游戏，如果没有，就更新游戏信息，为下一位玩家发牌并发送信息
      if (await isGameEnded(guildId)) {
        return `你们全都放弃了，这太不可思议了，我无法理解。好吧，既然你们这么想，游戏就此终止，祝你们好运。`
      }
    }
    const deck = gameInfo.deck
    const { playerHand } = player
    const score = calculateHandScore(playerHand)
    // 更新牌状态 isover
    await ctx.database.set('blackjack_playing_record', { guildId, userId, playerHandIndex: gameInfo.currentPlayerHandIndex }, { isOver: true })
    // 停牌之后游戏结束则直接结算，否则下一套牌或下一个玩家
    if (await isGameEnded(guildId)) {
      await session.send(`【${username}】停牌，
手牌【${playerHand.join('')}】，
点数【${score}】！
庄家补牌中...`)
      // 为庄家发一张牌 判断 继续发牌
      await sleep(dealerSpeed * 1000)
      let bankerHand: string[] = gameInfo.bankerHand;
      async function bankerPlayGame(guildId: string, deck: string[]): Promise<void> {
        const dealtCardToBanker = await dealCards(guildId, deck);
        bankerHand.push(dealtCardToBanker);
        const bankerScore = calculateHandScore(bankerHand);
        await sleep(dealerSpeed * 1000)
        await session.send(`庄家抽了【${bankerHand.join('')}】，共【${bankerScore}】点。
${(bankerScore > 21) ? '庄家爆牌！' : (bankerHand.length === 2 && bankerScore === 21) ? '庄家黑杰克！' : (bankerScore === 21) ? '庄家21点！' : ''}${(bankerScore < 17) ? `\n不足 17 点，继续抽牌。\n` : '\n达到或超过 17 点，庄家停牌。\n'}`);

        if (bankerScore < 17) {
          await bankerPlayGame(guildId, deck);
        } else {
          await ctx.database.set('blackjack_game_record', { guildId }, { bankerHand })
        }
      }

      // 调用 bankerPlayGame 函数来为庄家开始游戏
      await bankerPlayGame(guildId, deck);
      await sleep(dealerSpeed * 1000)
      return `游戏结算如下：
${(await settleBlackjackGame(platform, guildId))}
感谢参与，祝好运！`


    }
    // 游戏没有结束 不需要去管 直接获取新的游戏信息即可 因为在 isendgame里面已经更新了
    // 获取更新后的游戏状态 获取新的玩家信息 根据玩家信息或游戏信息的 handindex 去安排是否提示 分牌信息

    const [newGameInfo] = await ctx.database.get('blackjack_game_record', { guildId })
    const [newThisPlayerInfo] = await ctx.database.get('blackjack_playing_record', {
      guildId,
      playerIndex: newGameInfo.currentPlayerIndex,
      playerHandIndex: newGameInfo.currentPlayerHandIndex
    })
    const dealtCardToPunter = await dealCards(guildId, deck)
    await ctx.database.set('blackjack_playing_record', { guildId, userId: newThisPlayerInfo.userId, playerHandIndex: newThisPlayerInfo.playerHandIndex }, { playerHand: [`${dealtCardToPunter}`] })
    await ctx.database.set('blackjack_game_record', { guildId }, { deck })
    const distributional = `${(newThisPlayerInfo.playerHand.length === 1) ? '检测到你还有牌可以要！' : ''}
你的${(newThisPlayerInfo.playerHand.length === 1) ? '下一套' : ''}手牌为：【${newThisPlayerInfo.playerHand.join('')}】
请选择你的操作：
【要牌】或【停牌】`

    const noDistributional = `接下来有请下一位玩家【${newThisPlayerInfo.username}】！
你的第一张手牌为：【${dealtCardToPunter}】
请选择你的操作：
【要牌】或【停牌】`
    // 下一套牌或下一位玩家
    return `当前玩家是：【${username}】
你停牌了！看来你对你的手牌很满意嘛~
你的手牌：【${playerHand.join('')}】
点数：【${score}】点！

${(newThisPlayerInfo.playerHandIndex > 1) ? distributional : noDistributional}`
  })
  // fp*
  ctx.command('blackJack.分牌', '将牌分为两手').action(async ({ session }) => {
    // 分牌：游戏已经开始、玩家在游戏里、当前轮到这位玩家、判断该玩家是否投降、两张牌且是对子、检查钱是否够分牌、增加牌序
    // 检查游戏是否开始
    const { guildId, userId, user, username } = session
    const getGameInfo = await ctx.database.get('blackjack_game_record', { guildId })
    if (getGameInfo.length === 0) {
      await ctx.database.create('blackjack_game_record', { guildId, gameStatus: '未开始' });
      return `游戏还没开始呢！`
    }
    const gameInfo = getGameInfo[0]
    if (gameInfo.gameStatus !== '已开始') {
      return `游戏还没开始哦~`
    }
    // 检查玩家是否在游戏中
    const getPlayer = await ctx.database.get('blackjack_playing_record', { guildId, userId, playerHandIndex: gameInfo.currentPlayerHandIndex })
    if (getPlayer.length === 0) {
      return `笨蛋，你不在游戏里面！`
    }
    const player = getPlayer[0]
    if (gameInfo.currentPlayerIndex !== player.playerIndex) {
      return `现在轮到的还不是你哦~`
    }
    if (player.isSurrender) {
      // 下一位：找到下一位没有投降的玩家、如果又都已经投降，那么直接结束游戏，如果没有，就更新游戏信息，为下一位玩家发牌并发送信息
      return // 废弃
    }
    let playerHand = player.playerHand
    if (!isPair(playerHand)) {
      return `你的牌型不能分牌呢~ 要是对子才可以！`
    }
    // @ts-ignore
    const uid = user.id;
    const [userMonetary] = await ctx.database.get('monetary', { uid });
    if (userMonetary.value < player.bet) {
      return `你的货币只剩 ${userMonetary.value} 点，
想要分牌赢大奖？🎁
可惜，分牌要花 ${player.bet} 点。
下次记得攒钱分牌哦！😉`
    }
    const newPlayerHand1 = playerHand[0];
    const newPlayerHand2 = playerHand[1];
    // 需要更新之前的玩家手牌
    await ctx.database.set('blackjack_playing_record', { guildId, userId, playerHandIndex: gameInfo.currentPlayerHandIndex }, { playerHand: [`${newPlayerHand1}`] })
    // 分牌需要创建一个新的玩家牌手牌记录
    await ctx.database.create('blackjack_playing_record', {
      guildId, userId, bet: player.bet, playerHand: [`${newPlayerHand2}`], playerIndex: player.playerIndex,
      username, playerHandIndex: player.playerHandIndex + 1
    })
    return `当前玩家是：【${username}】
你分牌如刀，投注如雷，手气如火！🔥

你的牌是：【${newPlayerHand1}】、【${newPlayerHand2}】

现在，你要对第一套牌做出选择。
【停牌】？【要牌】！

别忘了，你还有第二套牌在等你呢！😉`
  })

  // jb*
  ctx.command('blackJack.加倍', '加倍投注').action(async ({ session }) => {
    //  加倍：游戏已开始、在游戏里、没投降、牌为两张且点数为11、更新投注筹码、发送加倍提示
    // 检查游戏是否开始
    const { guildId, userId, user, username } = session
    const getGameInfo = await ctx.database.get('blackjack_game_record', { guildId })
    if (getGameInfo.length === 0) {
      await ctx.database.create('blackjack_game_record', { guildId, gameStatus: '未开始' });
      return `游戏还没开始呢！`
    }
    const gameInfo = getGameInfo[0]
    if (gameInfo.gameStatus !== '已开始') {
      return `游戏还没开始哦~`
    }
    // 检查玩家是否在游戏中
    const getPlayer = await ctx.database.get('blackjack_playing_record', { guildId, userId, playerHandIndex: gameInfo.currentPlayerHandIndex })
    if (getPlayer.length === 0) {
      return `笨蛋，你不在游戏里面！`
    }
    const player = getPlayer[0]
    if (gameInfo.currentPlayerIndex !== player.playerIndex) {
      return `现在轮到的还不是你哦~`
    }
    if (player.isSurrender) {
      `投降了还想加倍？` // 理论上应该不会出现这个
    }
    // 判断牌型
    let playerHand = player.playerHand
    if (!(playerHand.length === 2 && calculateHandScore(playerHand) === 11)) {
      return `两张牌且点数为 11 点才可以分牌哦~`
    }
    // 更新筹码前首先要看当前玩家钱够不够
    // @ts-ignore
    const uid = user.id
    const [userMonetary] = await ctx.database.get('monetary', { uid })
    if (userMonetary.value < player.bet) {
      return `你只有 ${userMonetary.value} 货币，无法支付加倍所需的【${player.bet}】货币！下次别忘存钱加倍呀！`
    }
    // 扣钱 更新记录
    await ctx.monetary.cost(uid, player.bet)
    await ctx.database.set('blackjack_playing_record', { guildId, userId, playerHandIndex: gameInfo.currentPlayerHandIndex }, { bet: player.bet * 2, afterDoublingTheBet: '已加倍' })
    return `玩家【${username}】加倍成功！
你的投注筹码已更新为：【${player.bet * 2}】个！
你剩余的通用货币为：【${userMonetary.value - player.bet}】点！

你的手牌：【${playerHand.join('')}】
点数：【${calculateHandScore(playerHand)}】点！
请选择你接下来的操作：
【要牌】或【停牌】
【要牌】：你只能再要一张牌！`
  })

  async function settleBlackjackGame(platform, guildId) {

    // 我们修复error：玩家分牌 
    // 要个der的例牌
    // 黑杰克  21 点，但是赔率不一样
    // 结算：检查庄家是否爆牌，如果爆牌，则给未爆牌的玩家相应的赔金
    // 赔金正常牌则 1 玩家黑杰克则 1.5 例牌则 3
    // 庄家没有爆牌
    // 庄家黑杰克 则 1.5 所有没有黑杰克的人算输
    // 庄家没有黑杰克 比点数 1 赔
    // 结算保险
    // 结算牌型投注
    const getGameRecords = await ctx.database.get('blackjack_game_record', { guildId });
    const bankerHand = getGameRecords[0].bankerHand;
    const bankerScore = calculateHandScore(bankerHand);
    // 庄家爆
    if (bankerScore > 21) {
      const getPlayerRecords = await ctx.database.get('blackjack_playing_record', { guildId });

      for (const record of getPlayerRecords) {
        const { playerHand } = record;
        const score = calculateHandScore(playerHand);
        const { guildId, userId, playerHandIndex, bet } = record;

        const updateData = {};

        if (score > 21) {
          updateData['win'] = 0; // 拿回自己的哥们er 才不给拿回 赌狗不许拿钱
        } else if (playerHand.length === 2 && score === 21) {
          // 赔 1.5 倍
          updateData['win'] = bet * 1.5 + bet;
        } else {
          updateData['win'] = bet + bet;
        }

        await ctx.database.set('blackjack_playing_record', { guildId, userId, playerHandIndex }, updateData);
      }
    } else {
      // 庄家不爆
      // 庄家黑杰克
      if (bankerHand.length === 2 && bankerScore === 21) {
        const getPlayerRecords = await ctx.database.get('blackjack_playing_record', { guildId });

        for (const record of getPlayerRecords) {
          const { playerHand } = record;
          const score = calculateHandScore(playerHand);
          const { guildId, userId, playerHandIndex, bet } = record;
          // 除了是黑杰克的平 其他没有黑杰克的全输

          const updateData = {};

          if (score === 21 && playerHand.length === 2) {
            updateData['win'] = 0 + bet;
          } else {
            updateData['win'] = -bet * 1.5 + bet;
          }

          await ctx.database.set('blackjack_playing_record', { guildId, userId, playerHandIndex }, updateData);
        }
      } else {
        // 庄家没有黑杰克 比大小 黑杰克1.5
        const getPlayerRecords = await ctx.database.get('blackjack_playing_record', { guildId });

        for (const record of getPlayerRecords) {
          const { playerHand } = record;
          const score = calculateHandScore(playerHand);
          const { guildId, userId, playerHandIndex, bet } = record;

          const updateData = {};

          // 闲家黑杰克
          if (score === 21 && playerHand.length === 2) {
            updateData['win'] = bet * 1.5 + bet;
          } else if (score > 21) {
            // 闲家爆牌 本金没有
            updateData['win'] = 0;
          } else if (bankerScore > score) {
            // 庄家大
            updateData['win'] = 0;
          } else if (bankerScore < score) {
            // 闲家大
            updateData['win'] = bet + bet;
          } else if (bankerScore === score) {
            // 平
            updateData['win'] = bet;
          }

          await ctx.database.set('blackjack_playing_record', { guildId, userId, playerHandIndex }, updateData);
        }
      }
    }
    // 结算保险
    // 遍历所有玩家的投注一个一个来
    const getPlayerRecords = await ctx.database.get('blackjack_playing_record', { guildId });
    for (const record of getPlayerRecords) {
      const { playerHand } = record;
      let { guildId, userId, playerHandIndex, insurance, isBuyInsurance } = record;
      // 庄家是黑杰克，获得两倍保险金 不是的话，直接没收保险金
      if (isBuyInsurance && bankerHand.length === 2 && bankerScore === 21) {
        insurance = insurance * 2
      } else if (isBuyInsurance) {
        insurance = 0
      }
      await ctx.database.set('blackjack_playing_record', { guildId, userId, playerHandIndex }, { insurance })
    }

    // 结算投注牌型
    // 遍历所有玩家的投注一个一个来
    for (const record of getPlayerRecords) {
      const { playerHand } = record;
      const score = calculateHandScore(playerHand);
      let { guildId, userId, playerHandIndex, betAmount, betPlayerUserId, betPlayerUserName, betType, betWin } = record;

      // 如果投注类型是对子
      if (betType === '对子') {
        const getBetPlayers = await ctx.database.get('blackjack_playing_record', { guildId, userId })
        for (const betPlayer of getBetPlayers) {
          const { playerHand } = betPlayer
          if (isBetPair(playerHand)) {
            betWin = betAmount * 5
            await ctx.database.set('blackjack_playing_record', { guildId, userId, playerHandIndex }, { betAmount: 0, betWin })
          }
        }
      } else if (betType === '同花对子') {
        // 如果投注类型是同花对子
        const getBetPlayers = await ctx.database.get('blackjack_playing_record', { guildId, userId })
        for (const betPlayer of getBetPlayers) {
          const { playerHand } = betPlayer
          if (isFlushPair(playerHand)) {
            betWin = betAmount * 30
            await ctx.database.set('blackjack_playing_record', { guildId, userId, playerHandIndex }, { betAmount: 0, betWin })
          }
        }
      } else if (betType === '同花') {
        const getBetPlayers = await ctx.database.get('blackjack_playing_record', { guildId, userId })
        for (const betPlayer of getBetPlayers) {
          const { playerHand } = betPlayer
          if (isSameSuitCombination(playerHand, bankerHand)) {
            betWin = betAmount * 5
            await ctx.database.set('blackjack_playing_record', { guildId, userId, playerHandIndex }, { betAmount: 0, betWin })
          }
        }
      } else if (betType === '顺') {
        const getBetPlayers = await ctx.database.get('blackjack_playing_record', { guildId, userId })
        for (const betPlayer of getBetPlayers) {
          const { playerHand } = betPlayer
          if (isStraightCombination(playerHand, bankerHand)) {
            betWin = betAmount * 10
            await ctx.database.set('blackjack_playing_record', { guildId, userId, playerHandIndex }, { betAmount: 0, betWin })
          }
        }
      } else if (betType === '三条') {
        const getBetPlayers = await ctx.database.get('blackjack_playing_record', { guildId, userId })
        for (const betPlayer of getBetPlayers) {
          const { playerHand } = betPlayer
          if (isThreeOfAKind(playerHand, bankerHand)) {
            betWin = betAmount * 25
            await ctx.database.set('blackjack_playing_record', { guildId, userId, playerHandIndex }, { betAmount: 0, betWin })
          }
        }
      } else if (betType === '同花顺') {
        const getBetPlayers = await ctx.database.get('blackjack_playing_record', { guildId, userId })
        for (const betPlayer of getBetPlayers) {
          const { playerHand } = betPlayer
          if (isStraightFlush(playerHand, bankerHand)) {
            betWin = betAmount * 25
            await ctx.database.set('blackjack_playing_record', { guildId, userId, playerHandIndex }, { betAmount: 0, betWin })
          }
        }
      } else if (betType === '同花三条') {
        const getBetPlayers = await ctx.database.get('blackjack_playing_record', { guildId, userId })
        for (const betPlayer of getBetPlayers) {
          const { playerHand } = betPlayer
          if (isFlushThreeOfAKind(playerHand, bankerHand)) {
            betWin = betAmount * 50
            await ctx.database.set('blackjack_playing_record', { guildId, userId, playerHandIndex }, { betAmount: 0, betWin })
          }
        }
      }
    }
    // 开始结算加钱 暂时不生成最终字符串
    const getThisGuildPlayers = await ctx.database.get('blackjack_playing_record', { guildId })
    for (const thisGuildPlayer of getThisGuildPlayers) {
      const { isSurrender, win, bet, insurance, betWin, userId } = thisGuildPlayer
      // 先不还钱了，允许货币是负的
      // bet 正负、win、保险、betwin
      // 如果这个人没有投降
      if (!isSurrender) {
        // 计算赢得或赔付的金额 settlement 与货币数据记录 进行加法 
        const settlement = win + insurance + betWin
        const uid = (await ctx.database.getUser(platform, userId)).id
        const [userMonetary] = await ctx.database.get('monetary', { uid })
        const value = settlement + userMonetary.value
        await ctx.database.set('monetary', { uid }, { value })
      }
    }
    function getSettlementInfo(guildId: string): string {
      const players = getThisGuildPlayers.filter(player => player.guildId === guildId);
      const mergedRecords: { [key: string]: number } = {};

      players.forEach(player => {
        const key = `${player.guildId}-${player.userId}`;
        if (!mergedRecords[key]) {
          mergedRecords[key] = 0;
        }
        mergedRecords[key] += player.win + player.insurance + player.betWin;
      });

      // 使用一个 Set 来存储不重复的用户名
      const settlementInfo = Object.keys(mergedRecords).map(key => {
        const [guildId, userId] = key.split('-');
        // 使用 [...new Set(array)] 来去除数组中的重复元素
        const usernames = [...new Set(players
          .filter(player => player.guildId === guildId && player.userId === userId)
          .map(player => player.username))];
        const settlement = mergedRecords[key];
        return usernames.map(username => `【${username}】: 【${settlement}】`);
      });

      return settlementInfo.flat().join('\n');
    }


    const settlementInfo = getSettlementInfo(guildId);
    await ctx.database.remove('blackjack_playing_record', { guildId })
    await ctx.database.remove('blackjack_game_record', { guildId })
    return settlementInfo

  }
  async function isGameEnded(guildId: string): Promise<boolean> {
    const playingRecords = await ctx.database.get('blackjack_playing_record', { guildId });

    const filteredPlayers = playingRecords.filter(player => !player.isOver);
    const sortedPlayers = filteredPlayers.sort((a, b) =>
      a.playerIndex - b.playerIndex || // 如果 playerIndex 相等，继续比较下一个属性
      a.playerHandIndex - b.playerHandIndex // 如果 playerHandIndex 也相等，返回 0
    );

    if (sortedPlayers.length === 0) {
      // 如果没有未结束的玩家，说明游戏还没开始就结束了
      return true;
    }

    const nextPlayer = sortedPlayers.find(player => !player.isSurrender);

    if (nextPlayer) {
      // 找到了下一个未投降的玩家，进行相应的逻辑处理
      await ctx.database.set('blackjack_game_record', { guildId }, { currentPlayerIndex: nextPlayer.playerIndex, currentPlayerHandIndex: nextPlayer.playerHandIndex });
      return false;
    } else {
      // 如果找不到下一个未投降的玩家，说明游戏还没开始就结束了
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
    let shuffledArray = array.slice(); // 创建原数组的副本，以免修改原数组
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
  async function dealCards(guildId, deck: string[]): Promise<string | undefined> {
    let shuffledNewDeck: string[]
    if (deck.length === 0) {
      // 使用洗牌算法多次打乱牌
      const numTimes = 3; // 指定洗牌次数
      const newDecks = generateDecks(numberOfDecks)
      shuffledNewDeck = shuffleArrayMultipleTimes(newDecks, numTimes);
      const card = shuffledNewDeck.shift(); // 移除并返回牌堆的第一张牌
      await ctx.database.set('blackjack_game_record', { guildId }, { deck: shuffledNewDeck })
      return card;
    }

    const card = deck.shift(); // 移除并返回牌堆的第一张牌
    // 在这里可以对 card 进行任何需要的处理

    return card;
  }
  // 计算点数
  // 定义一个函数，参数是一个字符串，返回值是一个数字
  function calculateScore(hand: string): number {
    // 定义一个数组，存储所有的花色
    const suits = ['♥️', '♦️', '♣️', '♠️'];
    // 定义一个对象，存储字母对应的点数
    const values = { 'A': 11, 'J': 10, 'Q': 10, 'K': 10 };
    // 定义一个变量，存储总和
    let sum = 0;
    // 定义一个变量，存储 'A' 的个数
    let aces = 0;
    // 遍历所有的花色
    for (let suit of suits) {
      // 按照花色分割字符串，得到一个数组
      let cards = hand.split(suit);
      // 遍历数组，跳过第一个空元素
      for (let i = 1; i < cards.length; i++) {
        // 取出数组中的元素，即数字或字母
        let card = cards[i];
        // 判断元素是否是数字
        if (isNaN(Number(card))) {
          // 如果是字母，根据对象查找对应的点数
          sum += values[card];
          // 如果是 'A'，增加 'A' 的个数
          if (card === 'A') {
            aces++;
          }
        } else {
          // 如果是数字，直接转换成点数
          sum += Number(card);
        }
      }
    }
    // 检查总和是否超过 21
    while (sum > 21) {
      // 如果有 'A' 存在，将 'A' 的点数从 11 改成 1，重新计算总和
      if (aces > 0) {
        sum -= 10;
        aces--;
      } else {
        // 如果没有 'A'，直接结束循环
        break;
      }
    }
    // 返回总和
    return sum;
  }
  function calculateHandScore(hand: string[]): number {
    const suits = ['♥️', '♦️', '♣️', '♠️'];
    const values = { 'A': 11, 'J': 10, 'Q': 10, 'K': 10 };
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


}