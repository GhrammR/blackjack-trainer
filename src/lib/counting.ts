import type { Card, Rank } from '../types'

/** Hi-Lo card-counting values: 2-6 = +1, 7-9 = 0, 10/J/Q/K/A = -1. */
export function hiLoValue(rank: Rank): number {
  if (rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K' || rank === 'A') return -1
  if (rank === '7' || rank === '8' || rank === '9') return 0
  return 1
}

/** Running count after seeing `cards`, starting from `startingCount` (default 0). */
export function runningCount(cards: Card[], startingCount = 0): number {
  return cards.reduce((count, card) => count + hiLoValue(card.rank), startingCount)
}

/**
 * Below roughly half a deck remaining, true count swings wildly and isn't
 * meaningfully estimable — clamp the denominator so a near-empty shoe
 * doesn't produce an absurd spike.
 */
export const MIN_DECKS_REMAINING = 0.5

/** True count = running count / decks remaining, rounded to the nearest integer. */
export function trueCount(runningCountValue: number, decksRemaining: number): number {
  const clampedDecks = Math.max(MIN_DECKS_REMAINING, decksRemaining)
  return Math.round(runningCountValue / clampedDecks)
}
