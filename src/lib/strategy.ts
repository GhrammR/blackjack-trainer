import type { Action, Card, DealerUpcardKey, PairRankKey } from '../types'
import { handValue } from './cards'

/**
 * Basic strategy for the fixed rule set: 6 decks, dealer hits soft 17
 * (H17), double after split allowed, no surrender, blackjack pays 3:2.
 */

const DEALER_KEYS: DealerUpcardKey[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']

function dealerUpcardKey(card: Card): DealerUpcardKey {
  if (card.rank === 'A') return 'A'
  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K' || card.rank === '10') return '10'
  return card.rank
}

function pairRankKey(card: Card): PairRankKey {
  return dealerUpcardKey(card)
}

/** Builds a full ten-cell dealer-upcard row from a default plus overrides. */
function row(overrides: Partial<Record<DealerUpcardKey, Action>>, fallback: Action): Record<DealerUpcardKey, Action> {
  const result = {} as Record<DealerUpcardKey, Action>
  for (const key of DEALER_KEYS) {
    result[key] = overrides[key] ?? fallback
  }
  return result
}

export const hardTotals: Record<number, Record<DealerUpcardKey, Action>> = {
  // Only reachable via getHardSoftAction/getHardSoftSituationKey on a dealt
  // 2-2 (the only 2-card combo totaling less than 5) — getAction() always
  // routes actual pairs through the pairs table first, so this entry is
  // never consulted there. Always Hit, matching the 5-8 band's pattern.
  4: row({}, 'Hit'),
  5: row({}, 'Hit'),
  6: row({}, 'Hit'),
  7: row({}, 'Hit'),
  8: row({}, 'Hit'),
  9: row({ '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  10: row(
    { '2': 'Double', '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double', '7': 'Double', '8': 'Double', '9': 'Double' },
    'Hit',
  ),
  // vs A: Double is correct under this app's H17 rule set (S17 charts say
  // Hit vs Ace instead) — the third of the three well-known "H17 adds a
  // double" cells, and the reason this app always Doubles 11 regardless of
  // dealer upcard, not a simplification. See CLAUDE.md's now-resolved TODO.
  11: row({}, 'Double'),
  12: row({ '4': 'Stand', '5': 'Stand', '6': 'Stand' }, 'Hit'),
  13: row({ '2': 'Stand', '3': 'Stand', '4': 'Stand', '5': 'Stand', '6': 'Stand' }, 'Hit'),
  14: row({ '2': 'Stand', '3': 'Stand', '4': 'Stand', '5': 'Stand', '6': 'Stand' }, 'Hit'),
  15: row({ '2': 'Stand', '3': 'Stand', '4': 'Stand', '5': 'Stand', '6': 'Stand' }, 'Hit'),
  16: row({ '2': 'Stand', '3': 'Stand', '4': 'Stand', '5': 'Stand', '6': 'Stand' }, 'Hit'),
  17: row({}, 'Stand'),
  18: row({}, 'Stand'),
  19: row({}, 'Stand'),
  20: row({}, 'Stand'),
  21: row({}, 'Stand'),
}

export const softTotals: Record<number, Record<DealerUpcardKey, Action>> = {
  // Only reachable via getHardSoftAction/getHardSoftSituationKey on a dealt
  // A-A (one ace as 11, one as 1) — getAction() always routes actual pairs
  // through the pairs table first (which always splits aces), so this entry
  // is never consulted there. Always Hit, the simple/safe default for a
  // never-split-aces edge case basic strategy doesn't otherwise define.
  12: row({}, 'Hit'),
  13: row({ '5': 'Double', '6': 'Double' }, 'Hit'),
  14: row({ '5': 'Double', '6': 'Double' }, 'Hit'),
  15: row({ '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  16: row({ '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  17: row({ '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  // vs 2: Double under this app's H17 rule set (Stand under S17) — one of
  // the three well-known "H17 adds a double" cells.
  18: row({ '2': 'Double', '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double', '7': 'Stand', '8': 'Stand' }, 'Hit'),
  // vs 6: Double under H17 (Stand under S17) — the second of the three.
  19: row({ '6': 'Double' }, 'Stand'),
  20: row({}, 'Stand'),
  21: row({}, 'Stand'),
}

export const pairs: Record<PairRankKey, Record<DealerUpcardKey, Action>> = {
  '2': row({ '2': 'Split', '3': 'Split', '4': 'Split', '5': 'Split', '6': 'Split', '7': 'Split' }, 'Hit'),
  '3': row({ '2': 'Split', '3': 'Split', '4': 'Split', '5': 'Split', '6': 'Split', '7': 'Split' }, 'Hit'),
  '4': row({ '5': 'Split', '6': 'Split' }, 'Hit'),
  '5': row(
    { '2': 'Double', '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double', '7': 'Double', '8': 'Double', '9': 'Double' },
    'Hit',
  ),
  '6': row({ '2': 'Split', '3': 'Split', '4': 'Split', '5': 'Split', '6': 'Split' }, 'Hit'),
  '7': row({ '2': 'Split', '3': 'Split', '4': 'Split', '5': 'Split', '6': 'Split', '7': 'Split' }, 'Hit'),
  '8': row({}, 'Split'),
  '9': row({ '2': 'Split', '3': 'Split', '4': 'Split', '5': 'Split', '6': 'Split', '8': 'Split', '9': 'Split' }, 'Stand'),
  '10': row({}, 'Stand'),
  A: row({}, 'Split'),
}

/** Exported for the Live Play capstone (step 10), which needs to check pair-eligibility itself (for Split legality) independently of getAction's own routing. */
export function isPair(hand: Card[]): boolean {
  return hand.length === 2 && pairRankKey(hand[0]) === pairRankKey(hand[1])
}

export function getAction(playerHand: Card[], dealerUpcard: Card): Action {
  const dKey = dealerUpcardKey(dealerUpcard)

  if (isPair(playerHand)) {
    return pairs[pairRankKey(playerHand[0])][dKey]
  }

  const { total, soft } = handValue(playerHand)
  return soft ? softTotals[total][dKey] : hardTotals[total][dKey]
}

/** Stable key identifying a decision point, e.g. "hard-16-vs-10", "soft-18-vs-9", "pair-8-vs-10". */
export function getSituationKey(playerHand: Card[], dealerUpcard: Card): string {
  const dKey = dealerUpcardKey(dealerUpcard)

  if (isPair(playerHand)) {
    return `pair-${pairRankKey(playerHand[0])}-vs-${dKey}`
  }

  const { total, soft } = handValue(playerHand)
  return `${soft ? 'soft' : 'hard'}-${total}-vs-${dKey}`
}

/**
 * Like getAction, but always resolves via the hard/soft total tables even
 * when the hand is a pair (i.e. never consults the pairs table / never
 * returns Split). Used by simulations that don't model player-side
 * splitting (v2 step 8's counter-detection drill) so a dealt pair is played
 * — and graded against — its hard/soft total consistently, rather than
 * spuriously looking like a deviation just because it didn't split.
 */
export function getHardSoftAction(playerHand: Card[], dealerUpcard: Card): Action {
  const dKey = dealerUpcardKey(dealerUpcard)
  const { total, soft } = handValue(playerHand)
  return soft ? softTotals[total][dKey] : hardTotals[total][dKey]
}

/** The getSituationKey counterpart to getHardSoftAction — always "hard-X-vs-Y" or "soft-X-vs-Y", never a pair key. */
export function getHardSoftSituationKey(playerHand: Card[], dealerUpcard: Card): string {
  const dKey = dealerUpcardKey(dealerUpcard)
  const { total, soft } = handValue(playerHand)
  return `${soft ? 'soft' : 'hard'}-${total}-vs-${dKey}`
}
