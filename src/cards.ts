import { Random } from 'koishi'

export const SUITS = ['♥️', '♦️', '♣️', '♠️'] as const
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const

export type Rank = typeof RANKS[number]
export interface Card { suit: string; rank: Rank }

export const format = (cards: Card[]) => cards.map((card) => card.suit + card.rank).join('')

/** A 先按 11 算，爆了再逐个降成 1。 */
export function score(cards: Card[]): number {
  let total = 0
  let aces = 0
  for (const { rank } of cards) {
    if (rank === 'A') { total += 11; aces++ } else { total += Math.min(RANKS.indexOf(rank) + 1, 10) }
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return total
}

/** 分牌用：只看牌面点数，J/Q/K/10 视作同点。 */
export const value = (card: Card) => card.rank === 'A' ? 11 : Math.min(RANKS.indexOf(card.rank) + 1, 10)

export function createShoe(decks: number): Card[] {
  const shoe: Card[] = []
  for (let i = 0; i < decks; i++) {
    for (const suit of SUITS) for (const rank of RANKS) shoe.push({ suit, rank })
  }
  return Random.shuffle(shoe)
}
