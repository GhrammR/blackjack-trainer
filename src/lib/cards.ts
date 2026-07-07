import type { Card, HandValue, Rank } from '../types'

export function rankValue(rank: Rank): number {
  if (rank === 'A') return 11
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10
  return Number(rank)
}

/**
 * Computes a hand's total, demoting aces from 11 to 1 as needed to avoid
 * busting. `soft` is true when at least one ace is still counted as 11.
 */
export function handValue(cards: Card[]): HandValue {
  let total = 0
  let acesAsEleven = 0

  for (const card of cards) {
    total += rankValue(card.rank)
    if (card.rank === 'A') acesAsEleven += 1
  }

  while (total > 21 && acesAsEleven > 0) {
    total -= 10
    acesAsEleven -= 1
  }

  return { total, soft: acesAsEleven > 0 }
}

export function isBust(cards: Card[]): boolean {
  return handValue(cards).total > 21
}

/** A natural blackjack: a 2-card starting hand totaling 21 (Ace + a ten-value card). */
export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21
}
