import type { Action, Card, DealerUpcardKey, PairRankKey } from '../types'
import { handValue } from './cards'

/**
 * Basic strategy for the fixed v1 rule set: 6 decks, dealer stands on soft
 * 17, double after split allowed, no surrender, blackjack pays 3:2.
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
  5: row({}, 'Hit'),
  6: row({}, 'Hit'),
  7: row({}, 'Hit'),
  8: row({}, 'Hit'),
  9: row({ '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  10: row(
    { '2': 'Double', '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double', '7': 'Double', '8': 'Double', '9': 'Double' },
    'Hit',
  ),
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
  13: row({ '5': 'Double', '6': 'Double' }, 'Hit'),
  14: row({ '5': 'Double', '6': 'Double' }, 'Hit'),
  15: row({ '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  16: row({ '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  17: row({ '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  18: row({ '2': 'Stand', '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double', '7': 'Stand', '8': 'Stand' }, 'Hit'),
  19: row({}, 'Stand'),
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

function isPair(hand: Card[]): boolean {
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
