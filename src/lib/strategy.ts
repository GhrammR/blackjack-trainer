import type { Action, Card, DealerUpcardKey, PairRankKey } from '../types'
import { handValue } from './cards'

/**
 * Basic strategy for the fixed rule set: 6 decks, dealer hits soft 17
 * (H17), double after split allowed, blackjack pays 3:2. Late surrender is
 * a separate, user-toggleable setting (default off) — see the
 * `effectiveHardTotals`/`effectivePairs` overlay below, not baked into
 * `hardTotals`/`softTotals`/`pairs`.
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

/**
 * Late-surrender overlay — the 7 cells that become Surrender instead of
 * their no-surrender action, for this app's exact rule set (6D, H17, DAS,
 * no other change). `hardTotals`/`softTotals`/`pairs` above stay completely
 * untouched (still the base, proven-correct-by-audit no-surrender chart);
 * this overlay is consulted separately, only when the surrender setting is
 * on, via `effectiveHardTotals`/`effectivePairs` below.
 *
 * SOURCE: Wizard of Odds, "Blackjack: 4 to 8 Decks" —
 * https://wizardofodds.com/games/blackjack/strategy/4-decks/, Surrender
 * section, fetched live via WebFetch:
 *   Base (S17-or-H17): "Surrender hard 16 (but not a pair of 8s) vs.
 *   dealer 9, 10, or A, and hard 15 vs. dealer 10."
 *   H17 addition: "Surrender 15, a pair of 8s, and 17 vs. dealer A."
 * Independently corroborated by two separate web searches (a
 * blackjackinfo.com forum thread specifically on 17-vs-Ace surrender EV,
 * and a second source giving the identical three-cell H17 addition list:
 * "Hard 15 against an Ace; hard 17 against an Ace and 8-8 against an
 * Ace") — all three sources agree exactly, nothing here is guessed.
 * No soft-total cell is ever a surrender cell under this rule set.
 */
const HARD_SURRENDER_CELLS: { total: number; dealer: DealerUpcardKey }[] = [
  { total: 15, dealer: '10' },
  { total: 15, dealer: 'A' }, // H17 addition
  { total: 16, dealer: '9' },
  { total: 16, dealer: '10' },
  { total: 16, dealer: 'A' },
  { total: 17, dealer: 'A' }, // H17 addition
]

/** hardTotals, with the late-surrender overlay applied if `surrenderEnabled` — otherwise the exact same object, unmodified. */
export function effectiveHardTotals(surrenderEnabled: boolean): Record<number, Record<DealerUpcardKey, Action>> {
  if (!surrenderEnabled) return hardTotals
  const result: Record<number, Record<DealerUpcardKey, Action>> = {}
  for (const [total, row] of Object.entries(hardTotals)) {
    result[Number(total)] = { ...row }
  }
  for (const cell of HARD_SURRENDER_CELLS) {
    result[cell.total][cell.dealer] = 'Surrender'
  }
  return result
}

/** pairs, with the one late-surrender override (8,8 vs A) applied if `surrenderEnabled` — otherwise the exact same object, unmodified. */
export function effectivePairs(surrenderEnabled: boolean): Record<PairRankKey, Record<DealerUpcardKey, Action>> {
  if (!surrenderEnabled) return pairs
  return { ...pairs, '8': { ...pairs['8'], A: 'Surrender' } } // H17 addition
}

/** Exported for the Live Play capstone (step 10), which needs to check pair-eligibility itself (for Split legality) independently of getAction's own routing. */
export function isPair(hand: Card[]): boolean {
  return hand.length === 2 && pairRankKey(hand[0]) === pairRankKey(hand[1])
}

/**
 * `surrenderEnabled` defaults to false, so every existing caller that
 * doesn't pass it (detection family, evasion, index plays, every existing
 * test) is byte-identical to before this parameter existed. Callers that DO
 * pass true are expected to have already confirmed Surrender is actually a
 * legal choice at this decision point (see `correctActionFor` in
 * livePlaySession.ts, which folds its own `canSurrender` legality check in
 * before ever passing true here) — this function itself doesn't know about
 * decision-point legality, only the chart.
 */
export function getAction(playerHand: Card[], dealerUpcard: Card, surrenderEnabled = false): Action {
  const dKey = dealerUpcardKey(dealerUpcard)

  if (isPair(playerHand)) {
    return effectivePairs(surrenderEnabled)[pairRankKey(playerHand[0])][dKey]
  }

  const { total, soft } = handValue(playerHand)
  return soft ? softTotals[total][dKey] : effectiveHardTotals(surrenderEnabled)[total][dKey]
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
export function getHardSoftAction(playerHand: Card[], dealerUpcard: Card, surrenderEnabled = false): Action {
  const dKey = dealerUpcardKey(dealerUpcard)
  const { total, soft } = handValue(playerHand)
  return soft ? softTotals[total][dKey] : effectiveHardTotals(surrenderEnabled)[total][dKey]
}

/** The getSituationKey counterpart to getHardSoftAction — always "hard-X-vs-Y" or "soft-X-vs-Y", never a pair key. */
export function getHardSoftSituationKey(playerHand: Card[], dealerUpcard: Card): string {
  const dKey = dealerUpcardKey(dealerUpcard)
  const { total, soft } = handValue(playerHand)
  return `${soft ? 'soft' : 'hard'}-${total}-vs-${dKey}`
}
