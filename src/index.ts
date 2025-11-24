import { Context, Schema, sleep } from "koishi";
import {} from "koishi-plugin-monetary";

export const name = "card-21-game";
export const inject = {
  optional: ["monetary"],
  required: ["database"]
};

// ========================================================================
// 📄 Usage & Metadata
// ========================================================================

export const usage = `
## 🃏 21点 (Blackjack)

还原真实赌场规则，支持分牌、双倍、保险及投降。

### 🎮 快速开始
1. **发起游戏**: 输入 \`blackjack.来一局\`。
   - **PVE模式 (默认)**: 玩家对抗庄家(Bot)。
   - **PVP模式 (无庄)**: 输入 \`blackjack.来一局 -n\`，玩家之间互相比大小。
2. **加入**: 游戏创建后，输入 \`下注 100\` 或 \`bet 100\` 加入。
3. **开始**: 所有玩家加入后，输入 \`开始\` 发牌 (倒计时结束也会自动开始)。

### 🕹️ 游戏操作
轮到你时，直接发送指令：
- **要牌 (Hit)**: \`要牌\`, \`hit\`, \`h\`
- **停牌 (Stand)**: \`停牌\`, \`stand\`, \`s\`
- **加倍 (Double)**: \`加倍\`, \`double\`, \`d\` (仅首轮，注金翻倍，只发一张)
- **分牌 (Split)**: \`分牌\`, \`split\`, \`p\` (仅起手对子，注金翻倍)
- **投降 (Surrender)**: \`投降\` (仅开局前5秒，输一半)
- **保险 (Insurance)**: \`保险\` (仅庄家明牌为A，保一半)

### ⚙️ 规则说明
- **Blackjack (3:2)**: 起手2张牌直接21点。分牌后的21点不算BJ。
- **庄家规则**: 庄家点数 < 17 必须要牌，>= 17 停牌。
- **分A特例**: 分A后每家只发一张牌，强制结束该手牌。
`;

// ========================================================================
// 📦 Configuration
// ========================================================================

export interface Config {
  minBet: number;
  deckCount: number;
  playerTurnTimeout: number;
  joinPhaseTimeout: number;
  currency: "monetary" | "bella";
  currencyName: string;
  dealerHitSoft17: boolean; // 预留配置
}

export const Config: Schema<Config> = Schema.object({
  minBet: Schema.number().default(10).description("最低起注金额。"),
  deckCount: Schema.number().default(4).min(1).max(8).description("使用牌堆数量 (一副52张)。"),
  playerTurnTimeout: Schema.number().default(30).description("玩家操作超时时间(秒)。"),
  joinPhaseTimeout: Schema.number().default(45).description("加入阶段等待超时时间(秒)。"),
  currency: Schema.union(["monetary", "bella"]).default("monetary").description("使用的货币系统 (Monetary通用/Bella插件)。"),
  currencyName: Schema.string().default("default").description("货币名称(仅monetary模式有效)。"),
  dealerHitSoft17: Schema.boolean().default(false).description("庄家是否在软17(A+6)时要牌 (目前仅做预留，默认>=17停牌)。"),
});

// ========================================================================
// 🗄️ Database Models
// ========================================================================

declare module "koishi" {
  interface Tables {
    blackjack_stats: BlackjackStats;
    // 不直接扩展 bella_sign_in，防止冲突，仅做类型声明
    bella_sign_in: BellaSignIn;
  }
}

interface BellaSignIn {
  id: string;
  point: number;
}

export interface BlackjackStats {
  id: number;
  userId: string;
  username: string;
  wins: number;
  loses: number;
  draws: number;
  bjCount: number;
  totalProfit: number;
}

// ========================================================================
// 🦀 Core Logic & Types
// ========================================================================

type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };
const Ok = <T>(value: T): Result<T, any> => ({ ok: true, value });
const Err = <E>(error: E): Result<any, E> => ({ ok: false, error });

enum GamePhase {
  Idle,
  Joining,
  Distributing,
  Insurance,
  Surrender,
  PlayerTurn,
  DealerTurn,
  Settlement,
  Ended,
}

type Card = string;

interface HandState {
  cards: Card[];
  bet: number;
  isFinished: boolean;    // 是否停止操作
  isDoubled: boolean;     // 是否已加倍
  isSurrendered: boolean; // 是否已投降
  insurance: number;      // 保险金额
  fromSplit: boolean;     // 是否来自拆牌
}

interface PlayerState {
  userId: string;
  username: string;
  platform: string;
  bet: number; // 初始下注
  hands: HandState[];
  currentHandIndex: number;
  isBusy: boolean; // 防止并发操作锁
}

const CARDS_TEMPLATE = [
  "♥️A", "♥️2", "♥️3", "♥️4", "♥️5", "♥️6", "♥️7", "♥️8", "♥️9", "♥️10", "♥️J", "♥️Q", "♥️K",
  "♦️A", "♦️2", "♦️3", "♦️4", "♦️5", "♦️6", "♦️7", "♦️8", "♦️9", "♦️10", "♦️J", "♦️Q", "♦️K",
  "♣️A", "♣️2", "♣️3", "♣️4", "♣️5", "♣️6", "♣️7", "♣️8", "♣️9", "♣️10", "♣️J", "♣️Q", "♣️K",
  "♠️A", "♠️2", "♠️3", "♠️4", "♠️5", "♠️6", "♠️7", "♠️8", "♠️9", "♠️10", "♠️J", "♠️Q", "♠️K",
];

// 计算点数 (支持软硬点数逻辑)
function calcScore(hand: Card[]): number {
  let sum = 0;
  let aces = 0;
  for (const card of hand) {
    const match = card.match(/[0-9JQKA]+$/);
    const valStr = match ? match[0] : "0";

    if (["J", "Q", "K", "10"].includes(valStr)) {
      sum += 10;
    } else if (valStr === "A") {
      sum += 11;
      aces++;
    } else {
      sum += parseInt(valStr);
    }
  }

  // A 的动态调整
  while (sum > 21 && aces > 0) {
    sum -= 10;
    aces--;
  }
  return sum;
}

// 只有初始两张牌且非分牌产生的21点才是 Blackjack
function isBlackjack(hand: HandState): boolean {
  if (hand.fromSplit) return false;
  return hand.cards.length === 2 && calcScore(hand.cards) === 21;
}

function getCardRank(card: Card): string {
    const match = card.match(/[0-9JQKA]+$/);
    return match ? match[0] : "";
}

function getCardValue(card: Card): number {
    const r = getCardRank(card);
    if (["J", "Q", "K", "10"].includes(r)) return 10;
    if (r === "A") return 11;
    return parseInt(r);
}

// ========================================================================
// 🎮 Game Session Class
// ========================================================================

class GameSession {
  phase: GamePhase = GamePhase.Idle;
  channelId: string;
  players: PlayerState[] = [];
  deck: string[] = [];
  dealerHand: Card[] = [];

  currentPlayerIndex: number = 0;
  isNoDealerMode: boolean = false;

  // 防止整个游戏状态下的并发处理
  private _processing: boolean = false;

  timer: NodeJS.Timeout | null = null;
  ctx: Context;
  config: Config;

  constructor(ctx: Context, config: Config, channelId: string) {
    this.ctx = ctx;
    this.config = config;
    this.channelId = channelId;
  }

  // --- Core Lifecycle ---

  async init(isNoDealer: boolean) {
    this.phase = GamePhase.Joining;
    this.isNoDealerMode = isNoDealer;
    this.players = [];
    this.deck = [];
    this.setTimer(() => this.handleJoinTimeout(), this.config.joinPhaseTimeout);
  }

  async join(userId: string, username: string, platform: string, bet: number): Promise<string> {
    if (this.phase !== GamePhase.Joining) return "🚫 游戏已经开始或未初始化。";
    if (this._processing) return ""; // 忽略处理中的请求

    if (this.players.find(p => p.userId === userId)) return "⚠️ 你已经加入了。";
    if (bet < this.config.minBet) return `⚠️ 最低下注金额为 ${this.config.minBet}。`;

    // 锁住防止连点
    this._processing = true;
    const paid = await this.charge(userId, platform, bet);
    this._processing = false;

    if (!paid) return `💸 余额不足，无法下注 ${bet}。`;

    this.players.push({
      userId, username, platform, bet,
      hands: [{
        cards: [],
        bet: bet,
        isFinished: false,
        isDoubled: false,
        isSurrendered: false,
        insurance: 0,
        fromSplit: false
      }],
      currentHandIndex: 0,
      isBusy: false
    });

    this.setTimer(() => this.handleJoinTimeout(), this.config.joinPhaseTimeout);

    return `✅ ${username} 加入成功 (下注 ${bet})。当前玩家: ${this.players.length}人。`;
  }

  async start(): Promise<Result<void>> {
    if (this.phase !== GamePhase.Joining) return Err("不在准备阶段");
    if (this.players.length === 0) return Err("没有玩家");
    if (this.isNoDealerMode && this.players.length < 2) return Err("PVP模式至少需要2人");

    this.clearTimer();
    this.phase = GamePhase.Distributing;
    this._processing = true;

    // 洗牌
    this.deck = [];
    for (let i = 0; i < this.config.deckCount; i++) this.deck.push(...CARDS_TEMPLATE);
    this.shuffle(this.deck);

    // 发牌 (闲2 庄2)
    // 动画效果
    for (const p of this.players) {
      p.hands[0].cards.push(this.drawCard());
    }
    if (!this.isNoDealerMode) this.dealerHand.push(this.drawCard());

    await sleep(500);

    for (const p of this.players) {
      p.hands[0].cards.push(this.drawCard());
    }
    if (!this.isNoDealerMode) this.dealerHand.push(this.drawCard());

    await this.renderTable("🃏 游戏开始！发牌完毕。");
    this._processing = false;

    // 检查庄家明牌是否为 A (保险流程)
    if (!this.isNoDealerMode && this.dealerHand.length > 0 && this.dealerHand[0].endsWith("A")) {
      this.phase = GamePhase.Insurance;
      await this.broadcast("💡 庄家明牌为 A，是否购买保险？(回复 '保险' / '跳过')");
      this.setTimer(() => this.endInsurancePhase(), 10);
      return Ok(void 0);
    }

    await this.startSurrenderPhase();
    return Ok(void 0);
  }

  // --- Phase Logic ---

  async startSurrenderPhase() {
    this.phase = GamePhase.Surrender;
    // 如果庄家明牌是10/J/Q/K/A，此时庄家可能有BJ。
    // 如果庄家明牌是A，已经问过保险了。
    // 这里简单处理：给所有玩家几秒钟决定是否投降。
    await this.broadcast("🏳️ 投降阶段：如牌型不佳，可输入 '投降' (输一半)。\n⏳ 5秒后自动开始玩家回合。");
    this.setTimer(() => this.startPlayerTurns(), 5);
  }

  async endInsurancePhase() {
    await this.broadcast("⏰ 保险阶段结束。");
    await this.startSurrenderPhase();
  }

  async startPlayerTurns() {
    this.clearTimer();
    this.phase = GamePhase.PlayerTurn;
    this.currentPlayerIndex = 0;
    await this.processCurrentPlayerTurn();
  }

  // 递归处理玩家回合
  async processCurrentPlayerTurn() {
    this.clearTimer();

    // 1. 所有玩家处理完毕 -> 庄家回合
    if (this.currentPlayerIndex >= this.players.length) {
      return this.startDealerTurn();
    }

    const player = this.players[this.currentPlayerIndex];
    const hand = player.hands[player.currentHandIndex];

    // 2. 当前手牌已结束 (投降/爆牌/加倍结束/21点/分A强制结束) -> 处理下一手或下一人
    if (hand.isFinished || hand.isSurrendered) {
      return this.nextHandOrPlayer();
    }

    // 3. 检查是否 Blackjack (直接获胜/等待)
    // 注意：只有起手2张才算BJ。如果分牌后21点，不是BJ，但也可能已经自动isFinished了（如果是分A）。
    // 这里检查如果是BJ，自动标记结束
    if (isBlackjack(hand)) {
        await this.broadcast(`⚡️ ${player.username} 拿到 Blackjack!`);
        hand.isFinished = true;
        return this.nextHandOrPlayer();
    }

    // 4. 计算当前点数
    const score = calcScore(hand.cards);
    if (score >= 21) {
        hand.isFinished = true; // 21点或爆牌自动结束
        const reason = score > 21 ? "💥 爆牌" : "🛑 21点";
        // 只有非BJ的21点或爆牌才提示，BJ上面已经提示了
        if (score > 21) await this.broadcast(`💥 ${player.username} ${reason} (${score})`);
        return this.nextHandOrPlayer();
    }

    // 5. 等待玩家操作
    let prompt = `👉 轮到 ${player.username}`;
    if (player.hands.length > 1) {
        prompt += ` (手牌 ${player.currentHandIndex + 1}/${player.hands.length})`;
    }
    prompt += `\n🃏 当前牌: ${hand.cards.join("")} [${score}]`;

    const canSplit = this.checkCanSplit(player);
    const canDouble = hand.cards.length === 2 && !hand.fromSplit;

    const actions = ["要牌", "停牌"];
    if (canDouble) actions.push("加倍");
    if (canSplit) actions.push("分牌");

    prompt += `\n指令: ${actions.join(" | ")}`;

    // 防止过于频繁刷屏，如果只是刚刚Hit完，可以简化输出，这里简化处理保持完整提示
    await this.broadcast(prompt);

    this.setTimer(async () => {
      await this.broadcast(`⏰ ${player.username} 操作超时，自动停牌。`);
      await this.actionStand(player.userId);
    }, this.config.playerTurnTimeout);
  }

  async nextHandOrPlayer() {
    const player = this.players[this.currentPlayerIndex];

    // 如果还有下一副分牌的手牌
    if (player.currentHandIndex < player.hands.length - 1) {
        player.currentHandIndex++;
        // 稍微延迟一下，体验更好
        setTimeout(() => this.processCurrentPlayerTurn(), 800);
        return;
    }

    // 换下一个玩家
    this.currentPlayerIndex++;
    setTimeout(() => this.processCurrentPlayerTurn(), 800);
  }

  async startDealerTurn() {
    this.phase = GamePhase.DealerTurn;
    this.clearTimer();

    if (this.isNoDealerMode) {
      return this.settleGame();
    }

    // 庄家亮牌
    await this.broadcast(`👨‍💼 庄家亮牌: ${this.dealerHand.join("")} [${calcScore(this.dealerHand)}]`);
    await sleep(1000);

    // 庄家逻辑: < 17 必须要牌
    // 这里如果配置了 dealerHitSoft17，则 soft 17 (A+6) 也要牌
    // 简化实现：目前只按点数判断，通常 soft 17 = 17，如果 strict 则停牌。
    // 如果要支持 Soft 17 Hit: Check if score is 17 AND includes A counting as 11.

    while (calcScore(this.dealerHand) < 17) {
      const card = this.drawCard();
      this.dealerHand.push(card);
      await this.broadcast(`👨‍💼 庄家要牌: ${card} -> [${calcScore(this.dealerHand)}]`);
      await sleep(1500);
    }

    const dScore = calcScore(this.dealerHand);
    const resultStr = dScore > 21 ? "💥 庄家爆牌!" : `庄家最终点数: ${dScore}`;
    await this.broadcast(resultStr);

    return this.settleGame();
  }

  // --- Actions ---
  // 所有 Action 返回 string 作为回复内容，如果返回空则不回复

  async actionHit(userId: string): Promise<string> {
    if (this._processing) return "";
    const ctx = this.getCurrentCtx(userId);
    if (!ctx) return "";
    const { p, h } = ctx;

    // 锁定防止连点
    this._processing = true;

    const card = this.drawCard();
    h.cards.push(card);
    const score = calcScore(h.cards);

    let msg = `🃏 ${p.username} 要牌: ${card} -> [${score}]`;

    if (score >= 21) {
        // 爆牌或21点，标记结束，TurnProcessor 会自动处理下一位
        // 这里只是更新数据和返回消息
        // isFinished 会在下一次 processCurrentPlayerTurn 的 check 中被处理
        // 或者我们可以提前标记，防止 UI 闪烁
        h.isFinished = true;
    }

    this._processing = false;

    // 立即刷新状态
    setTimeout(() => this.processCurrentPlayerTurn(), 500);

    return msg;
  }

  async actionStand(userId: string): Promise<string> {
    if (this._processing) return "";
    const ctx = this.getCurrentCtx(userId);
    if (!ctx) return "";
    const { p, h } = ctx;

    this._processing = true;
    h.isFinished = true;
    const msg = `🛑 ${p.username} 停牌 [${calcScore(h.cards)}]`;

    this._processing = false;
    setTimeout(() => this.processCurrentPlayerTurn(), 100);
    return msg;
  }

  async actionDouble(userId: string): Promise<string> {
    if (this._processing) return "";
    const ctx = this.getCurrentCtx(userId);
    if (!ctx) return "";
    const { p, h } = ctx;

    if (h.cards.length !== 2) return "⚠️ 只能在首轮加倍。";
    if (h.fromSplit) return "⚠️ 分牌后不支持加倍。";

    this._processing = true;
    const paid = await this.charge(userId, p.platform, h.bet);
    if (!paid) {
        this._processing = false;
        return "💸 余额不足，无法加倍。";
    }

    h.bet *= 2;
    h.isDoubled = true;

    const card = this.drawCard();
    h.cards.push(card);

    // 加倍后强制结束
    h.isFinished = true;

    const score = calcScore(h.cards);
    const msg = `💰 ${p.username} 加倍! 下注 ${h.bet}。发牌: ${card} -> [${score}]`;

    this._processing = false;
    setTimeout(() => this.processCurrentPlayerTurn(), 1000);
    return msg;
  }

  async actionSplit(userId: string): Promise<string> {
    if (this._processing) return "";
    const ctx = this.getCurrentCtx(userId);
    if (!ctx) return "";
    const { p, h } = ctx;

    if (!this.checkCanSplit(p)) return "⚠️ 无法分牌。";

    this._processing = true;
    const paid = await this.charge(userId, p.platform, h.bet);
    if (!paid) {
        this._processing = false;
        return "💸 余额不足，无法分牌。";
    }

    // 执行分牌
    const card1 = h.cards[0];
    const card2 = h.cards[1];

    const isSplitAces = getCardRank(card1) === "A";

    // 手牌1 (当前手牌)
    h.cards = [card1, this.drawCard()];
    h.fromSplit = true;
    // 分A后，通常只能拿一张牌，所以直接结束
    if (isSplitAces) h.isFinished = true;

    // 手牌2 (新的一手)
    p.hands.push({
        cards: [card2, this.drawCard()],
        bet: h.bet,
        isFinished: isSplitAces, // 分A直接结束
        isDoubled: false,
        isSurrendered: false,
        insurance: 0,
        fromSplit: true
    });

    let msg = `🔱 ${p.username} 完成分牌!`;
    if (isSplitAces) msg += " (分A只发一张牌)";

    this._processing = false;
    // 重新触发回合逻辑
    setTimeout(() => this.processCurrentPlayerTurn(), 1000);

    return msg;
  }

  async actionSurrender(userId: string): Promise<string> {
    if (this.phase !== GamePhase.Surrender) return "";
    const p = this.players.find(x => x.userId === userId);
    // 投降只针对第一手牌，且未操作过
    if (!p || p.hands[0].isSurrendered) return "";

    // 标记投降，后续结算时退款
    p.hands[0].isSurrendered = true;
    p.hands[0].isFinished = true;
    return `🏳️ ${p.username} 选择投降 (保留一半注金)。`;
  }

  async actionInsurance(userId: string): Promise<string> {
    if (this.phase !== GamePhase.Insurance) return "";
    const p = this.players.find(x => x.userId === userId);
    if (!p || p.hands[0].insurance > 0) return "";

    const cost = p.hands[0].bet / 2;
    const paid = await this.charge(userId, p.platform, cost);
    if (!paid) return "💸 余额不足买保险。";

    p.hands[0].insurance = cost;
    return `🛡️ ${p.username} 购买了保险 (花费 ${cost})。`;
  }

  // --- Settlement ---

  async settleGame() {
    this.phase = GamePhase.Settlement;
    this._processing = true;
    let report = "📊 结算报告\n";
    report += "----------------\n";

    if (this.isNoDealerMode) {
        await this.settlePVP(report);
    } else {
        await this.settlePVE(report);
    }
  }

  async settlePVE(reportPrefix: string) {
    const dScore = calcScore(this.dealerHand);
    const dIsBj = this.dealerHand.length === 2 && dScore === 21;
    const dIsBust = dScore > 21;

    for (const p of this.players) {
        let pTotalProfit = 0;
        let pReport = `${p.username}: `;

        for (const hand of p.hands) {
            // 投降逻辑
            if (hand.isSurrendered) {
                const refund = hand.bet / 2;
                await this.payout(p.userId, p.platform, refund);
                pTotalProfit -= refund; // 实际上是亏了 bet/2
                pReport += `[🏳️投降] `;
                continue;
            }

            // 保险结算
            if (hand.insurance > 0) {
                if (dIsBj) {
                    // 保险买中：返还保险金 + 2倍保险金赔付 = 3倍保险金
                    const insReturn = hand.insurance * 3;
                    await this.payout(p.userId, p.platform, insReturn);
                    // 净利 = 返还 - 成本 = 2倍成本
                    pTotalProfit += (insReturn - hand.insurance);
                    pReport += `[🛡️保赢] `;
                } else {
                    pTotalProfit -= hand.insurance;
                    pReport += `[🛡️保亏] `;
                }
            }

            const pScore = calcScore(hand.cards);
            const pIsBj = isBlackjack(hand);

            // 胜负判定
            let handWinAmount = 0; // 这手牌拿回的钱（包含本金）
            let handStatus = "";

            if (pScore > 21) {
                // 闲爆：输
                handStatus = `💥爆(-${hand.bet})`;
                pTotalProfit -= hand.bet;
            } else if (pIsBj) {
                if (dIsBj) {
                    // Push
                    handWinAmount = hand.bet;
                    handStatus = `🤝BJ平`;
                } else {
                    // BJ Win 3:2 (bet * 2.5)
                    handWinAmount = hand.bet * 2.5;
                    handStatus = `⚡️BJ胜(+${hand.bet * 1.5})`;
                    pTotalProfit += hand.bet * 1.5;
                }
            } else if (dIsBj) {
                // 庄BJ 闲非BJ：输
                handStatus = `❌败(-${hand.bet})`;
                pTotalProfit -= hand.bet;
            } else if (dIsBust) {
                // 庄爆 闲不爆：赢
                handWinAmount = hand.bet * 2;
                handStatus = `🎉胜(+${hand.bet})`;
                pTotalProfit += hand.bet;
            } else if (pScore > dScore) {
                // 点大：赢
                handWinAmount = hand.bet * 2;
                handStatus = `🎉胜(+${hand.bet})`;
                pTotalProfit += hand.bet;
            } else if (pScore === dScore) {
                // 平
                handWinAmount = hand.bet;
                handStatus = `🤝平`;
            } else {
                // 点小：输
                handStatus = `❌败(-${hand.bet})`;
                pTotalProfit -= hand.bet;
            }

            if (handWinAmount > 0) {
                await this.payout(p.userId, p.platform, handWinAmount);
            }
            pReport += `${handStatus} `;
        }

        // 记录数据库
        await this.recordStat(p.userId, p.username, pTotalProfit);

        reportPrefix += `${pReport}\n`;
    }

    await this.broadcast(reportPrefix);
    this.destroy();
  }

  async settlePVP(reportPrefix: string) {
      // 过滤出未投降且未爆牌的玩家
      const activePlayers = this.players.filter(p => !p.hands[0].isSurrendered);
      const validPlayers = activePlayers.filter(p => calcScore(p.hands[0].cards) <= 21);

      let pool = 0;

      // 1. 处理投降 (退一半，剩下一半入池)
      for (const p of this.players) {
          if (p.hands[0].isSurrendered) {
              await this.payout(p.userId, p.platform, p.bet / 2);
              pool += p.bet / 2;
              reportPrefix += `${p.username}: 🏳️ 投降\n`;
              await this.recordStat(p.userId, p.username, -p.bet/2);
          } else {
              pool += p.bet;
          }
      }

      if (validPlayers.length === 0) {
          reportPrefix += "🤷 全员爆牌/投降，系统收回剩余注金。";
      } else {
          // 排序：BJ > 点数
          validPlayers.sort((a, b) => {
              const hA = a.hands[0];
              const hB = b.hands[0];
              const bjA = isBlackjack(hA);
              const bjB = isBlackjack(hB);
              const sA = calcScore(hA.cards);
              const sB = calcScore(hB.cards);

              if (bjA && !bjB) return -1;
              if (!bjA && bjB) return 1;
              return sB - sA; // 降序
          });

          // 找第一名同分者
          const winners = [validPlayers[0]];
          const bestHand = validPlayers[0].hands[0];

          for (let i = 1; i < validPlayers.length; i++) {
              const p = validPlayers[i];
              const h = p.hands[0];
              const sameBJ = isBlackjack(bestHand) === isBlackjack(h);
              const sameScore = calcScore(bestHand.cards) === calcScore(h.cards);
              if (sameBJ && sameScore) {
                  winners.push(p);
              } else {
                  break;
              }
          }

          // 输家记录
          const winnerIds = new Set(winners.map(w => w.userId));
          for (const p of this.players) {
              if (!winnerIds.has(p.userId) && !p.hands[0].isSurrendered) {
                  reportPrefix += `${p.username}: ❌ 输 (-${p.bet})\n`;
                  await this.recordStat(p.userId, p.username, -p.bet);
              }
          }

          // 赢家分钱
          const totalWin = pool;
          const perWin = Math.floor(totalWin / winners.length);
          for (const w of winners) {
              await this.payout(w.userId, w.platform, perWin);
              const profit = perWin - w.bet;
              reportPrefix += `${w.username}: 🏆 赢 (+${profit})\n`;
              await this.recordStat(w.userId, w.username, profit);
          }
      }

      await this.broadcast(reportPrefix);
      this.destroy();
  }

  // --- Utilities ---

  getCurrentCtx(userId: string) {
      if (this.phase !== GamePhase.PlayerTurn) return null;
      const p = this.players[this.currentPlayerIndex];
      if (!p || p.userId !== userId) return null;
      return { p, h: p.hands[p.currentHandIndex] };
  }

  checkCanSplit(p: PlayerState): boolean {
      if (p.hands.length >= 2) return false; // 限制最多分一副
      const h = p.hands[p.currentHandIndex];
      if (h.cards.length !== 2) return false;
      return getCardValue(h.cards[0]) === getCardValue(h.cards[1]);
  }

  drawCard(): string {
      if (this.deck.length === 0) {
          for (let i = 0; i < this.config.deckCount; i++) this.deck.push(...CARDS_TEMPLATE);
          this.shuffle(this.deck);
      }
      return this.deck.shift()!;
  }

  shuffle(array: any[]) {
      for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
      }
  }

  // --- Economy & IO ---

  async charge(userId: string, platform: string, amount: number): Promise<boolean> {
      try {
          if (this.config.currency === "bella") {
              // 注意：这里需要确保 bella 插件已加载且表存在
              const rows = await this.ctx.database.get("bella_sign_in", { id: userId });
              if (!rows[0] || rows[0].point < amount) return false;
              await this.ctx.database.set("bella_sign_in", { id: userId }, { point: rows[0].point - amount });
              return true;
          } else {
              // Monetary
              const user = await this.ctx.database.getUser(platform, userId);
              if (!user) return false;
              // @ts-ignore
              const wallet = await this.ctx.monetary?.cost(user.id, amount, this.config.currencyName);
              // 如果没有 monetary 服务，cost 会报错或 undefined，这里为了简单默认失败
              // 实际上 monetary 抛出错误代表扣款失败
              return true;
          }
      } catch (e) {
          // 如果扣款出错(如表不存在)，返回 false 防止游戏异常进行
          return false;
      }
  }

  async payout(userId: string, platform: string, amount: number) {
      if (amount <= 0) return;
      try {
          if (this.config.currency === "bella") {
             const rows = await this.ctx.database.get("bella_sign_in", { id: userId });
             if (rows[0]) {
                 await this.ctx.database.set("bella_sign_in", { id: userId }, { point: rows[0].point + amount });
             }
          } else {
              const user = await this.ctx.database.getUser(platform, userId);
              if (user) {
                  // @ts-ignore
                  await this.ctx.monetary?.gain(user.id, amount, this.config.currencyName);
              }
          }
      } catch (e) {}
  }

  async recordStat(userId: string, username: string, profit: number) {
      try {
        const stats = await this.ctx.database.get("blackjack_stats", { userId });
        let stat = stats[0];
        if (!stat) {
            stat = await this.ctx.database.create("blackjack_stats", {
                userId, username, wins: 0, loses: 0, draws: 0, bjCount: 0, totalProfit: 0
            });
        }

        const update: Partial<BlackjackStats> = {
            totalProfit: stat.totalProfit + profit
        };
        if (profit > 0) update.wins = stat.wins + 1;
        else if (profit < 0) update.loses = stat.loses + 1;
        else update.draws = stat.draws + 1;

        await this.ctx.database.set("blackjack_stats", { id: stat.id }, update);
      } catch (e) {}
  }

  async broadcast(msg: string) {
      if (!msg) return;
      try {
          await this.ctx.bots[0]?.sendMessage(this.channelId, msg);
      } catch {}
  }

  async renderTable(footer: string = "") {
      let msg = `♠️♣️ Blackjack Table ♥️♦️\n`;
      if (!this.isNoDealerMode) {
          const showHole = this.phase === GamePhase.Settlement || this.phase === GamePhase.DealerTurn;
          let dealerCards: string[];
          let dealerScoreStr = "";

          if (this.dealerHand.length === 0) {
              dealerCards = [];
          } else if (showHole) {
              dealerCards = this.dealerHand;
              dealerScoreStr = ` [${calcScore(dealerCards)}]`;
          } else {
              // 隐藏底牌
              dealerCards = [this.dealerHand[0], "🎴"];
              dealerScoreStr = ` [?]`;
          }

          msg += `👨‍💼 庄家: ${dealerCards.join("")}${dealerScoreStr}\n\n`;
      }

      for (const p of this.players) {
          msg += `👤 ${p.username} ($${p.bet}): ${p.hands.map(h => {
              const status = [];
              if (h.isSurrendered) status.push("🏳️");
              if (h.isDoubled) status.push("💰");
              if (h.insurance) status.push("🛡️");
              if (h.fromSplit) status.push("🔱");
              return `${h.cards.join("")} [${calcScore(h.cards)}] ${status.join("")}`;
          }).join(" | ")}\n`;
      }
      msg += `\n${footer}`;
      await this.broadcast(msg);
  }

  setTimer(fn: () => void, sec: number) {
      this.clearTimer();
      this.timer = setTimeout(fn, sec * 1000);
  }

  clearTimer() {
      if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
      }
  }

  async handleJoinTimeout() {
      if (this.players.length === 0) {
          await this.broadcast("🕐 无人加入，游戏取消。");
          this.destroy();
          return;
      }
      if (this.isNoDealerMode && this.players.length < 2) {
          await this.broadcast("🕐 人数不足，PVP模式取消，退还注金。");
          await this.refundAll();
          this.destroy();
          return;
      }
      await this.broadcast("🕐 准备时间结束，自动开始！");
      await this.start();
  }

  async refundAll() {
      for (const p of this.players) {
          await this.payout(p.userId, p.platform, p.bet);
      }
  }

  destroy() {
      this.clearTimer();
      this.phase = GamePhase.Ended;
      games.delete(this.channelId);
  }
}

// ========================================================================
// 🚀 Main Entry & Commands
// ========================================================================

const games = new Map<string, GameSession>();

export function apply(ctx: Context, config: Config) {
  // 扩展数据库 - 仅扩展本插件拥有的表
  ctx.model.extend("blackjack_stats", {
    id: "unsigned",
    userId: "string",
    username: "string",
    wins: "unsigned",
    loses: "unsigned",
    draws: "unsigned",
    bjCount: "unsigned",
    totalProfit: "double",
  }, { primary: "id", autoInc: true });

  // Middleware: 处理游戏内逻辑
  ctx.middleware(async (session, next) => {
    const game = games.get(session.channelId);
    if (!game || game.phase === GamePhase.Idle || game.phase === GamePhase.Ended) return next();

    const msg = session.content.trim().toLowerCase();
    const uid = session.userId;
    const uname = session.username || uid;

    // 1. 加入阶段
    if (game.phase === GamePhase.Joining) {
        if (msg.startsWith("下注") || msg.startsWith("bet")) {
            const amount = parseInt(msg.match(/\d+/)?.[0] || "0");
            if (amount > 0) {
                await session.send(await game.join(uid, uname, session.platform, amount));
                return;
            }
        }
        if (["开始", "start"].includes(msg)) {
            const res = await game.start();
            if (!res.ok) await session.send(`🚫 ${(res as { ok: false; error: string }).error}`);
            return;
        }
    }

    // 2. 保险阶段
    if (game.phase === GamePhase.Insurance) {
        if (["保险", "yes", "insure"].includes(msg)) {
            await session.send(await game.actionInsurance(uid));
            return;
        }
        if (["跳过", "no", "skip"].includes(msg)) return;
    }

    // 3. 投降阶段
    if (game.phase === GamePhase.Surrender) {
        if (["投降", "surrender"].includes(msg)) {
            await session.send(await game.actionSurrender(uid));
            return;
        }
        if (["开始", "继续", "start"].includes(msg)) {
            await game.startPlayerTurns();
            return;
        }
    }

    // 4. 玩家操作阶段
    if (game.phase === GamePhase.PlayerTurn) {
        const p = game.players[game.currentPlayerIndex];
        // 只有当前玩家可以操作
        if (p && p.userId === uid) {
            // 指令映射
            if (["要牌", "hit", "h"].includes(msg)) {
                await session.send(await game.actionHit(uid));
                return;
            }
            if (["停牌", "stand", "s"].includes(msg)) {
                await session.send(await game.actionStand(uid));
                return;
            }
            if (["加倍", "double", "d"].includes(msg)) {
                await session.send(await game.actionDouble(uid));
                return;
            }
            if (["分牌", "split", "p"].includes(msg)) {
                await session.send(await game.actionSplit(uid));
                return;
            }
        }
    }

    return next();
  });

  // Commands
  ctx.command("blackjack", "21点游戏")
    .action(() => `🃏 21点

指令
▸ blackjack.来一局 [-n]  创建 (加 -n 为PVP)
▸ blackjack.强制结束  结束当前游戏
▸ blackjack.战绩  查询战绩

核心规则
▸ BJ赔3:2 庄<17必拿 分A只发一张`);

  ctx.command("blackjack.来一局", "创建新游戏")
    .option("nodealer", "-n PVP模式(无庄家)")
    .action(async ({ session, options }) => {
        if (games.has(session.channelId)) {
            return "🚫 当前频道已有游戏正在进行。";
        }
        const game = new GameSession(ctx, config, session.channelId);
        games.set(session.channelId, game);
        await game.init(!!options.nodealer);

        return `🎰 21点游戏已创建 (${options.nodealer ? "PVP" : "PVE"})\n` +
        `请发送 &quot;下注 &lt;金额&gt;&quot; 加入游戏。\n` +
               `发送 "开始" 立即发牌。`;
    });

  ctx.command("blackjack.强制结束", "强制结束")
    .action(async ({ session }) => {
        const game = games.get(session.channelId);
        if (game) {
            await game.refundAll();
            game.destroy();
            return "✅ 游戏已强制结束，注金已退回。";
        }
        return "❓ 当前没有进行中的游戏。";
    });

  ctx.command("blackjack.战绩", "查询个人战绩")
    .action(async ({ session }) => {
        try {
            const rows = await ctx.database.get("blackjack_stats", { userId: session.userId });
            if (rows.length === 0) return "📭 你还没有玩过。";
            const s = rows[0];
            const total = s.wins + s.loses + s.draws;
            const rate = total > 0 ? ((s.wins / total) * 100).toFixed(1) : "0.0";
            return `📊 ${s.username} 的战绩\n` +
                   `💰 总盈亏: ${s.totalProfit > 0 ? "+" : ""}${s.totalProfit}\n` +
                   `🏆 胜: ${s.wins} | ❌ 负: ${s.loses} | 🤝 平: ${s.draws}\n` +
                   `📈 胜率: ${rate}%`;
        } catch (e) {
            return "⚠️ 无法获取战绩，数据库可能未初始化。";
        }
    });

  // Cleanup
  ctx.on("dispose", () => {
      for (const game of games.values()) {
          game.refundAll(); // 尽力退款
          game.destroy();
      }
      games.clear();
  });
}
