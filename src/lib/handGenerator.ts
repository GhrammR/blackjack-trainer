import type { Card, DealerUpcardKey, PairRankKey, Rank } from '../types'

/**
 * Turns a situation key (as produced by getSituationKey) back into a
 * concrete player hand + dealer upcard that reproduces that situation.
 */

export const DEALER_KEYS: DealerUpcardKey[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']
export const PAIR_RANKS: PairRankKey[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']
// 20 is deliberately excluded: the only way to reach a hard 20 with two
// cards is two ten-value cards, which this app's rank-bucketed pair check
// (pairRankKey buckets 10/J/Q/K together) always reads as pair-10 — a
// 2-card "hard-20" hand can't physically be dealt/generated.
export const HARD_TOTALS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
export const SOFT_TOTALS = [13, 14, 15, 16, 17, 18, 19, 20]

/** Every situation key that generateHand can reproduce. */
export const ALL_SITUATION_KEYS: string[] = DEALER_KEYS.flatMap((d) => [
  ...HARD_TOTALS.map((t) => `hard-${t}-vs-${d}`),
  ...SOFT_TOTALS.map((t) => `soft-${t}-vs-${d}`),
  ...PAIR_RANKS.map((p) => `pair-${p}-vs-${d}`),
])

const TEN_BUCKET_RANKS: Rank[] = ['10', 'J', 'Q', 'K']

function randomTenRank(): Rank {
  return TEN_BUCKET_RANKS[Math.floor(Math.random() * TEN_BUCKET_RANKS.length)]
}

/** Resolves a value-rank placeholder ('10' means "any ten-value card") to a concrete rank. */
function concreteRank(rank: Rank): Rank {
  return rank === '10' ? randomTenRank() : rank
}

function dealerCardForKey(key: DealerUpcardKey): Card {
  return { rank: concreteRank(key as Rank) }
}

// Two non-ace cards summing to each hard total, expressed as value-rank
// placeholders. 20 has no entry — see the HARD_TOTALS comment above.
const HARD_TOTAL_CARDS: Record<number, Rank[]> = {
  5: ['2', '3'],
  6: ['2', '4'],
  7: ['2', '5'],
  8: ['2', '6'],
  9: ['2', '7'],
  10: ['2', '8'],
  11: ['2', '9'],
  12: ['2', '10'],
  13: ['3', '10'],
  14: ['4', '10'],
  15: ['5', '10'],
  16: ['6', '10'],
  17: ['7', '10'],
  18: ['8', '10'],
  19: ['9', '10'],
}

function parseSituationKey(key: string): { category: 'hard' | 'soft' | 'pair'; value: string; dealerKey: DealerUpcardKey } {
  const [left, dealerPart] = key.split('-vs-')
  const [category, value] = left.split('-')
  if (!left || !dealerPart || (category !== 'hard' && category !== 'soft' && category !== 'pair')) {
    throw new Error(`Malformed situation key: ${key}`)
  }
  return { category, value, dealerKey: dealerPart as DealerUpcardKey }
}

export function generateHand(situationKey: string): { playerHand: Card[]; dealerUpcard: Card } {
  const { category, value, dealerKey } = parseSituationKey(situationKey)
  const dealerUpcard = dealerCardForKey(dealerKey)

  if (category === 'pair') {
    const pairRank = value as Rank
    return {
      playerHand: [{ rank: concreteRank(pairRank) }, { rank: concreteRank(pairRank) }],
      dealerUpcard,
    }
  }

  if (category === 'soft') {
    const total = Number(value)
    const otherValue = total - 11
    if (otherValue < 2 || otherValue > 9) {
      throw new Error(`No soft-total card combo defined for total ${total}`)
    }
    const otherRank = String(otherValue) as Rank
    return { playerHand: [{ rank: 'A' }, { rank: otherRank }], dealerUpcard }
  }

  const total = Number(value)
  const ranks = HARD_TOTAL_CARDS[total]
  if (!ranks) {
    throw new Error(`No hard-total card combo defined for total ${total}`)
  }
  return { playerHand: ranks.map((rank) => ({ rank: concreteRank(rank) })), dealerUpcard }
}
