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

/**
 * pairs, unmodified even when `surrenderEnabled` — kept as a function (not
 * a plain re-export) for call-site symmetry with `effectiveHardTotals`.
 *
 * CORRECTNESS FIX: this used to surrender pair 8,8 vs dealer A whenever
 * surrender was on. That was wrong. Sourced via Wizard of Odds' Basic
 * Strategy Calculator (wizardofodds.com/games/blackjack/strategy/calculator/),
 * queried programmatically: at 6 decks/H17/DAS-allowed/late-surrender, that
 * cell resolves to code `Rp` — "surrender only if double-after-split is NOT
 * allowed, otherwise split." This app's rule set always has DAS on, so the
 * cell must be Split, never Surrender, at every deck size (confirmed: it
 * never appears in any of the 12 sourced late-surrender cell lists in
 * `resolvePairs` below). Pinned by a regression test in
 * strategy.chartReference.test.ts. See DECISIONS.md for the full sourcing
 * history that surfaced this.
 */
export function effectivePairs(surrenderEnabled: boolean): Record<PairRankKey, Record<DealerUpcardKey, Action>> {
  if (!surrenderEnabled) return pairs
  return { ...pairs }
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

/**
 * The full rule matrix (deck size × soft-17 rule × surrender mode), used by
 * Basic Strategy Trainer and Live Play only — the detection family,
 * evasion, table scan, and Index Plays all keep using `getAction`/
 * `getHardSoftAction`/`effectiveHardTotals`/`effectivePairs` above,
 * completely unchanged, matching `lateSurrender`'s existing documented
 * scope (CLAUDE.md §11).
 *
 * SOURCING: every table and cell list below comes from Wizard of Odds'
 * Basic Strategy Calculator (wizardofodds.com/games/blackjack/strategy/calculator/),
 * queried programmatically (Playwright: set the calculator's own
 * deck/soft17/das/surrender <select> inputs, call its own `ComputeStrategy()`,
 * read the rendered table's text) rather than transcribed from a blog or
 * read off a chart image — both of those were tried first and rejected
 * after concrete errors surfaced (see DECISIONS.md for the full history,
 * including a real bug this process found in already-shipped code — see
 * `effectivePairs` above). The pipeline's self-check: the calculator's own
 * 6-deck/H17/DAS/no-surrender output was diffed against `hardTotals`/
 * `softTotals` above and matched with 0 differences (strategy.chartReference.test.ts
 * asserts this permanently) — that's what makes every other combination
 * below trustworthy, since they were extracted the exact same way.
 *
 * Early surrender is deliberately NOT included — see DECISIONS.md for why
 * it couldn't be sourced to the same standard.
 */

export type Soft17Rule = 'H17' | 'S17'
export type SurrenderMode = 'none' | 'late'

export interface RuleConfig {
  /** 1, 2, or 6 — matches shoe.ts's SHOE_SIZE_OPTIONS. Any other value is treated as 6 (4-8 decks are cell-identical, per the existing chart-reference test). */
  numDecks: number
  soft17Rule: Soft17Rule
  surrenderMode: SurrenderMode
}

function deckBucket(numDecks: number): 1 | 2 | 6 {
  if (numDecks === 1) return 1
  if (numDecks === 2) return 2
  return 6
}

// ── 1-deck: complete, independently sourced tables (not deltas layered on
// the 6-deck base — the composition risk that broke the first sourcing
// attempt at this exact spot: 1-deck cells don't reliably compose from a
// base chart plus a generic delta). H17 and S17 pairs are NOT the same
// table: pair 9,9 vs A is Split under H17 but base Stand under S17 (the
// extraction's H17 delta list is its S17 list plus exactly that one cell)
// — pinned by a dedicated chart-test assertion so this can't regress into
// a shared/wrong table again.

export const oneDeckHardTotalsH17: Record<number, Record<DealerUpcardKey, Action>> = {
  5: row({}, 'Hit'), 6: row({}, 'Hit'), 7: row({}, 'Hit'),
  8: row({ '5': 'Double', '6': 'Double' }, 'Hit'),
  9: row({ '2': 'Double', '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  10: row({ '2': 'Double', '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double', '7': 'Double', '8': 'Double', '9': 'Double' }, 'Hit'),
  11: row({}, 'Double'),
  12: row({ '4': 'Stand', '5': 'Stand', '6': 'Stand' }, 'Hit'),
  13: row({ '2': 'Stand', '3': 'Stand', '4': 'Stand', '5': 'Stand', '6': 'Stand' }, 'Hit'),
  14: row({ '2': 'Stand', '3': 'Stand', '4': 'Stand', '5': 'Stand', '6': 'Stand' }, 'Hit'),
  15: row({ '2': 'Stand', '3': 'Stand', '4': 'Stand', '5': 'Stand', '6': 'Stand' }, 'Hit'),
  16: row({ '2': 'Stand', '3': 'Stand', '4': 'Stand', '5': 'Stand', '6': 'Stand' }, 'Hit'),
  17: row({}, 'Stand'), 18: row({}, 'Stand'), 19: row({}, 'Stand'), 20: row({}, 'Stand'), 21: row({}, 'Stand'),
}

export const oneDeckSoftTotalsH17: Record<number, Record<DealerUpcardKey, Action>> = {
  13: row({ '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  14: row({ '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  15: row({ '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  16: row({ '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  17: row({ '2': 'Double', '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  18: row({ '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double', '2': 'Stand', '7': 'Stand', '8': 'Stand' }, 'Hit'),
  19: row({ '6': 'Double' }, 'Stand'),
  20: row({}, 'Stand'), 21: row({}, 'Stand'),
}

export const oneDeckPairsH17: Record<PairRankKey, Record<DealerUpcardKey, Action>> = {
  '2': row({ '2': 'Split', '3': 'Split', '4': 'Split', '5': 'Split', '6': 'Split', '7': 'Split' }, 'Hit'),
  '3': row({ '2': 'Split', '3': 'Split', '4': 'Split', '5': 'Split', '6': 'Split', '7': 'Split', '8': 'Split' }, 'Hit'),
  '4': row({ '4': 'Split', '5': 'Split', '6': 'Split' }, 'Hit'),
  '5': row({ '2': 'Double', '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double', '7': 'Double', '8': 'Double', '9': 'Double' }, 'Hit'),
  '6': row({ '2': 'Split', '3': 'Split', '4': 'Split', '5': 'Split', '6': 'Split', '7': 'Split' }, 'Hit'),
  '7': row({ '2': 'Split', '3': 'Split', '4': 'Split', '5': 'Split', '6': 'Split', '7': 'Split', '8': 'Split' }, 'Hit'),
  '8': row({}, 'Split'),
  '9': row({ '2': 'Split', '3': 'Split', '4': 'Split', '5': 'Split', '6': 'Split', '8': 'Split', '9': 'Split', A: 'Split' }, 'Stand'),
  '10': row({}, 'Stand'),
  A: row({}, 'Split'),
}
// pair 7,7 vs 10 is Stand (not the row() fallback) — set explicitly for clarity instead of threading it through the row() overrides above.
oneDeckPairsH17['7']['10'] = 'Stand'

export const oneDeckHardTotalsS17: Record<number, Record<DealerUpcardKey, Action>> = {
  5: row({}, 'Hit'), 6: row({}, 'Hit'), 7: row({}, 'Hit'),
  8: row({ '5': 'Double', '6': 'Double' }, 'Hit'),
  9: row({ '2': 'Double', '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  10: row({ '2': 'Double', '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double', '7': 'Double', '8': 'Double', '9': 'Double' }, 'Hit'),
  11: row({}, 'Double'), // S17 reintroduces the double vs A at 1-deck — confirmed directly, not derived from the H17 table
  12: row({ '4': 'Stand', '5': 'Stand', '6': 'Stand' }, 'Hit'),
  13: row({ '2': 'Stand', '3': 'Stand', '4': 'Stand', '5': 'Stand', '6': 'Stand' }, 'Hit'),
  14: row({ '2': 'Stand', '3': 'Stand', '4': 'Stand', '5': 'Stand', '6': 'Stand' }, 'Hit'),
  15: row({ '2': 'Stand', '3': 'Stand', '4': 'Stand', '5': 'Stand', '6': 'Stand' }, 'Hit'),
  16: row({ '2': 'Stand', '3': 'Stand', '4': 'Stand', '5': 'Stand', '6': 'Stand' }, 'Hit'),
  17: row({}, 'Stand'), 18: row({}, 'Stand'), 19: row({}, 'Stand'), 20: row({}, 'Stand'), 21: row({}, 'Stand'),
}

export const oneDeckSoftTotalsS17: Record<number, Record<DealerUpcardKey, Action>> = {
  13: row({ '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  14: row({ '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  15: row({ '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  16: row({ '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  17: row({ '2': 'Double', '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  // vs A: Stand (not the H17 chart's vs-2 flip) — a different cell than the H17 table touches
  18: row({ '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double', '2': 'Stand', '7': 'Stand', '8': 'Stand', A: 'Stand' }, 'Hit'),
  19: row({ '6': 'Double' }, 'Stand'), // S17 reintroduces the double vs 6 at 1-deck
  20: row({}, 'Stand'), 21: row({}, 'Stand'),
}

export const oneDeckPairsS17: Record<PairRankKey, Record<DealerUpcardKey, Action>> = {
  '2': row({ '2': 'Split', '3': 'Split', '4': 'Split', '5': 'Split', '6': 'Split', '7': 'Split' }, 'Hit'),
  '3': row({ '2': 'Split', '3': 'Split', '4': 'Split', '5': 'Split', '6': 'Split', '7': 'Split', '8': 'Split' }, 'Hit'),
  '4': row({ '4': 'Split', '5': 'Split', '6': 'Split' }, 'Hit'),
  '5': row({ '2': 'Double', '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double', '7': 'Double', '8': 'Double', '9': 'Double' }, 'Hit'),
  '6': row({ '2': 'Split', '3': 'Split', '4': 'Split', '5': 'Split', '6': 'Split', '7': 'Split' }, 'Hit'),
  '7': row({ '2': 'Split', '3': 'Split', '4': 'Split', '5': 'Split', '6': 'Split', '7': 'Split', '8': 'Split' }, 'Hit'),
  '8': row({}, 'Split'),
  // pair 9,9 vs A stays base Stand under S17 (unlike H17's Split) — the one cell the H17/S17 pairs tables genuinely differ on
  '9': row({ '2': 'Split', '3': 'Split', '4': 'Split', '5': 'Split', '6': 'Split', '8': 'Split', '9': 'Split' }, 'Stand'),
  '10': row({}, 'Stand'),
  A: row({}, 'Split'),
}
oneDeckPairsS17['7']['10'] = 'Stand'

// ── 2-deck: small enough to express as explicit deltas on the 6-deck base
// (unlike 1-deck, composing safely here since every 2-deck cell was
// verified to match the base except these few — see DECISIONS.md).

const TWO_DECK_HARD_DELTA: Record<Soft17Rule, { total: number; dealer: DealerUpcardKey }[]> = {
  H17: [{ total: 9, dealer: '2' }],
  S17: [{ total: 9, dealer: '2' }, { total: 11, dealer: 'A' }],
}
// soft 14 vs 4 doubles at 2-deck under H17 only — confirmed absent from the S17 extraction, not assumed symmetric.
const TWO_DECK_SOFT_DELTA: Record<Soft17Rule, { total: number; dealer: DealerUpcardKey }[]> = {
  H17: [{ total: 14, dealer: '4' }],
  S17: [],
}
// Pair deltas are identical under H17 and S17 at 2-deck (confirmed, not assumed).
const TWO_DECK_PAIR_DELTA: { rank: PairRankKey; dealer: DealerUpcardKey }[] = [
  { rank: '6', dealer: '7' },
  { rank: '7', dealer: '8' },
]

// ── Late-surrender cell lists, one literal list per (deck bucket, soft17
// rule) combination — each sourced independently from the calculator, none
// derived from another combination's list.

interface SurrenderCells {
  hard: { total: number; dealer: DealerUpcardKey }[]
  pair: { rank: PairRankKey; dealer: DealerUpcardKey }[]
}

const LATE_SURRENDER_CELLS: Record<1 | 2 | 6, Record<Soft17Rule, SurrenderCells>> = {
  1: {
    H17: {
      hard: [{ total: 15, dealer: 'A' }, { total: 16, dealer: '10' }, { total: 16, dealer: 'A' }, { total: 17, dealer: 'A' }],
      pair: [{ rank: '7', dealer: '10' }, { rank: '7', dealer: 'A' }],
    },
    S17: {
      hard: [{ total: 16, dealer: '10' }, { total: 16, dealer: 'A' }],
      pair: [{ rank: '7', dealer: '10' }],
    },
  },
  2: {
    H17: {
      hard: [{ total: 15, dealer: '10' }, { total: 15, dealer: 'A' }, { total: 16, dealer: '10' }, { total: 16, dealer: 'A' }, { total: 17, dealer: 'A' }],
      pair: [],
    },
    S17: {
      hard: [{ total: 15, dealer: '10' }, { total: 16, dealer: '10' }, { total: 16, dealer: 'A' }],
      pair: [],
    },
  },
  6: {
    // Matches the existing HARD_SURRENDER_CELLS exactly (H17), minus the pair 8,8-vs-A bug fixed above.
    H17: {
      hard: [{ total: 15, dealer: '10' }, { total: 15, dealer: 'A' }, { total: 16, dealer: '9' }, { total: 16, dealer: '10' }, { total: 16, dealer: 'A' }, { total: 17, dealer: 'A' }],
      pair: [],
    },
    S17: {
      hard: [{ total: 15, dealer: '10' }, { total: 16, dealer: '9' }, { total: 16, dealer: '10' }, { total: 16, dealer: 'A' }],
      pair: [],
    },
  },
}

function applyHardDelta(
  base: Record<number, Record<DealerUpcardKey, Action>>,
  deltas: { total: number; dealer: DealerUpcardKey }[],
  action: Action,
): Record<number, Record<DealerUpcardKey, Action>> {
  if (deltas.length === 0) return base
  const result: Record<number, Record<DealerUpcardKey, Action>> = {}
  for (const [total, r] of Object.entries(base)) result[Number(total)] = { ...r }
  for (const d of deltas) result[d.total][d.dealer] = action
  return result
}

function applyPairDelta(
  base: Record<PairRankKey, Record<DealerUpcardKey, Action>>,
  deltas: { rank: PairRankKey; dealer: DealerUpcardKey }[],
  action: Action,
): Record<PairRankKey, Record<DealerUpcardKey, Action>> {
  if (deltas.length === 0) return base
  const result = { ...base }
  for (const d of deltas) result[d.rank] = { ...result[d.rank], [d.dealer]: action }
  return result
}

/** hardTotals with hard 11 vs A reverted to Hit — the one S17 delta this cell has at 2-deck/6-deck. */
function applyS17Hard(base: Record<number, Record<DealerUpcardKey, Action>>): Record<number, Record<DealerUpcardKey, Action>> {
  return applyHardDelta(base, [{ total: 11, dealer: 'A' }], 'Hit')
}

/** softTotals with soft 18 vs 2 and soft 19 vs 6 reverted — the other two S17 deltas, at 2-deck/6-deck. */
function applyS17Soft(base: Record<number, Record<DealerUpcardKey, Action>>): Record<number, Record<DealerUpcardKey, Action>> {
  const result: Record<number, Record<DealerUpcardKey, Action>> = {}
  for (const [total, r] of Object.entries(base)) result[Number(total)] = { ...r }
  result[18]['2'] = 'Stand'
  result[19]['6'] = 'Stand'
  return result
}

export function resolveHardTotals(rules: RuleConfig): Record<number, Record<DealerUpcardKey, Action>> {
  let base: Record<number, Record<DealerUpcardKey, Action>>
  if (rules.numDecks === 1) {
    base = rules.soft17Rule === 'H17' ? oneDeckHardTotalsH17 : oneDeckHardTotalsS17
  } else {
    const withSoft17 = rules.soft17Rule === 'H17' ? hardTotals : applyS17Hard(hardTotals)
    base = rules.numDecks === 2 ? applyHardDelta(withSoft17, TWO_DECK_HARD_DELTA[rules.soft17Rule], 'Double') : withSoft17
  }
  if (rules.surrenderMode === 'none') return base
  return applyHardDelta(base, LATE_SURRENDER_CELLS[deckBucket(rules.numDecks)][rules.soft17Rule].hard, 'Surrender')
}

export function resolveSoftTotals(rules: RuleConfig): Record<number, Record<DealerUpcardKey, Action>> {
  if (rules.numDecks === 1) {
    return rules.soft17Rule === 'H17' ? oneDeckSoftTotalsH17 : oneDeckSoftTotalsS17
  }
  const withSoft17 = rules.soft17Rule === 'H17' ? softTotals : applyS17Soft(softTotals)
  return rules.numDecks === 2 ? applyHardDelta(withSoft17, TWO_DECK_SOFT_DELTA[rules.soft17Rule], 'Double') : withSoft17
}

export function resolvePairs(rules: RuleConfig): Record<PairRankKey, Record<DealerUpcardKey, Action>> {
  let base: Record<PairRankKey, Record<DealerUpcardKey, Action>>
  if (rules.numDecks === 1) {
    base = rules.soft17Rule === 'H17' ? oneDeckPairsH17 : oneDeckPairsS17
  } else {
    base = rules.numDecks === 2 ? applyPairDelta(pairs, TWO_DECK_PAIR_DELTA, 'Split') : pairs
  }
  if (rules.surrenderMode === 'none') return base
  return applyPairDelta(base, LATE_SURRENDER_CELLS[deckBucket(rules.numDecks)][rules.soft17Rule].pair, 'Surrender')
}

/** getAction's RuleConfig-aware counterpart, used only by Basic Strategy Trainer and Live Play (see header comment above). */
export function getActionForRules(playerHand: Card[], dealerUpcard: Card, rules: RuleConfig): Action {
  const dKey = dealerUpcardKey(dealerUpcard)
  if (isPair(playerHand)) {
    return resolvePairs(rules)[pairRankKey(playerHand[0])][dKey]
  }
  const { total, soft } = handValue(playerHand)
  return soft ? resolveSoftTotals(rules)[total][dKey] : resolveHardTotals(rules)[total][dKey]
}

/** getHardSoftAction's RuleConfig-aware counterpart — never consults the pairs table. */
export function getHardSoftActionForRules(playerHand: Card[], dealerUpcard: Card, rules: RuleConfig): Action {
  const dKey = dealerUpcardKey(dealerUpcard)
  const { total, soft } = handValue(playerHand)
  return soft ? resolveSoftTotals(rules)[total][dKey] : resolveHardTotals(rules)[total][dKey]
}
