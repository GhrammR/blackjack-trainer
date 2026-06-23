import type { Card, Rank, Suit } from '../types'

const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']

export function createShoe(numDecks: number): Card[] {
  const shoe: Card[] = []
  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ rank, suit })
      }
    }
  }
  return shoe
}

/** Fisher-Yates shuffle. Returns a new array; `random` is injectable for deterministic tests. */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
