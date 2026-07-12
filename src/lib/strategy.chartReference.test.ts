import { describe, expect, it } from 'vitest'
import {
  effectiveHardTotals,
  effectivePairs,
  getHardSoftActionForRules,
  hardTotals,
  oneDeckHardTotalsH17,
  oneDeckHardTotalsS17,
  oneDeckPairsH17,
  oneDeckPairsS17,
  oneDeckSoftTotalsH17,
  oneDeckSoftTotalsS17,
  pairs,
  resolveHardTotals,
  resolvePairs,
  resolveSoftTotals,
  softTotals,
  type RuleConfig,
} from './strategy'
import type { Action, DealerUpcardKey, PairRankKey } from '../types'

/**
 * Full-coverage correctness check for the basic-strategy chart in
 * strategy.ts, against an INDEPENDENTLY sourced reference — every hard
 * total, soft total, and pair cell, not just the hand-picked spot checks in
 * strategy.test.ts.
 *
 * SOURCE: Wizard of Odds, "Blackjack: 4 to 8 Decks" —
 * https://wizardofodds.com/games/blackjack/strategy/4-decks/
 * Fetched live via WebFetch during this session (not transcribed from
 * memory). Two sections of that page were used, quoted/paraphrased below
 * next to each reference row so the derivation is auditable:
 *   1. The page's base "text form" strategy, which it states is for
 *      4-8 decks, dealer STANDS on soft 17 (S17), double-after-split (DAS)
 *      discussed conditionally, and surrender ALLOWED.
 *   2. A separate section on that same page: "for you perfectionists out
 *      there, here are the modifications to make if the dealer hits a soft
 *      17" — listing the H17 deltas explicitly: "Double 11 vs. dealer A.
 *      Double soft 18 vs. dealer 2. Double soft 19 vs. dealer 6." (plus
 *      surrender-only deltas not applicable here — see below).
 *
 * WHY A 4-DECK SOURCE VALIDLY CHECKS THIS APP'S 6-DECK CHART: basic
 * strategy is cell-identical across the entire 4-8 deck range at the
 * chart level (this is exactly the range the cited page itself covers as
 * one chart) — deck count only shifts true-count deviation thresholds
 * (the Illustrious 18, handled separately in indexPlays.ts), not the
 * basic-strategy chart cells themselves. So a 4-deck H17 chart and a
 * 6-deck H17 chart are the same chart.
 *
 * RULE-SET DIFFERENCES FROM THE SOURCE, AND HOW THEY'RE HANDLED:
 *   - Surrender: HARD_REFERENCE/PAIR_REFERENCE below (the "chart vs. sourced
 *     reference" describe block) are the surrender-OFF reference — the
 *     cells surrender would otherwise touch (hard 15 vs 10, hard 16 vs
 *     9/10/A) instead use the source's own BASE Hit-or-Stand rule for those
 *     totals ("Stand on hard 13-16 against a dealer 2-6, otherwise hit") —
 *     confirmed from the source's own text that H17 does not change this
 *     hit/stand boundary independent of surrender; surrender is presented
 *     as an ADDITIONAL option layered on top of the base chart, not a
 *     change to it. A separate describe block below
 *     ("effectiveHardTotals/effectivePairs — late surrender ON") covers the
 *     surrender-ON state, sourced from the same page's Surrender section —
 *     see that block's own comment for citations. Nothing here is guessed.
 *   - Double after split (DAS): this app always has DAS on, so the
 *     source's conditional splits ("split 2s against a 2 or 3 IF DAS is
 *     allowed") collapse to unconditional Splits across that cell's full
 *     stated range.
 *
 * NOT SOURCED — APP-SPECIFIC FALLBACK CELLS: hardTotals[4] and
 * softTotals[12] are not real basic-strategy chart entries (a real hard 4
 * or soft 12 — i.e. dealt 2-2 or A-A — is always evaluated as a pair and
 * Split, never reaches the hard/soft-total tables in real play; see
 * strategy.ts's own comments on both cells). They only exist as this app's
 * internal fallback for getHardSoftAction's split-avoidance path, so there
 * is no published chart value to check them against — they're asserted
 * directly below instead of pulled into the sourced-reference comparison.
 *
 * If any cell below disagrees with strategy.ts, this test FAILS and
 * reports exactly which cell — it does not "fix" strategy.ts to match, and
 * strategy.ts is not adjusted to make this test pass.
 */

const DEALER_KEYS: DealerUpcardKey[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']

/** Builds a full ten-cell reference row — independent re-implementation, not imported from strategy.ts. */
function row(overrides: Partial<Record<DealerUpcardKey, Action>>, fallback: Action): Record<DealerUpcardKey, Action> {
  const result = {} as Record<DealerUpcardKey, Action>
  for (const key of DEALER_KEYS) {
    result[key] = overrides[key] ?? fallback
  }
  return result
}

// ── Hard totals ──────────────────────────────────────────────────────────────
// Source: "Always hit hard 11 or less" / "Double hard 9 vs. dealer 3-6" /
// "Double hard 10 except against a dealer 10 or A" / "Double hard 11 except
// against a dealer A" (H17 modification removes this exception: "Double 11
// vs. dealer A") / "Stand on hard 12 against a dealer 4-6, otherwise hit" /
// "Stand on hard 13-16 against a dealer 2-6, otherwise hit" / "Always stand
// on hard 17 or more".
const HARD_REFERENCE: Record<number, Record<DealerUpcardKey, Action>> = {
  5: row({}, 'Hit'),
  6: row({}, 'Hit'),
  7: row({}, 'Hit'),
  8: row({}, 'Hit'),
  9: row({ '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  10: row(
    { '2': 'Double', '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double', '7': 'Double', '8': 'Double', '9': 'Double' },
    'Hit',
  ),
  11: row({}, 'Double'), // H17: Double vs. every upcard, including A
  12: row({ '4': 'Stand', '5': 'Stand', '6': 'Stand' }, 'Hit'),
  13: row({ '2': 'Stand', '3': 'Stand', '4': 'Stand', '5': 'Stand', '6': 'Stand' }, 'Hit'),
  14: row({ '2': 'Stand', '3': 'Stand', '4': 'Stand', '5': 'Stand', '6': 'Stand' }, 'Hit'),
  15: row({ '2': 'Stand', '3': 'Stand', '4': 'Stand', '5': 'Stand', '6': 'Stand' }, 'Hit'), // vs 10 would be Surrender if offered; falls back to base Hit
  16: row({ '2': 'Stand', '3': 'Stand', '4': 'Stand', '5': 'Stand', '6': 'Stand' }, 'Hit'), // vs 9/10/A would be Surrender if offered; falls back to base Hit
  17: row({}, 'Stand'),
  18: row({}, 'Stand'),
  19: row({}, 'Stand'),
  20: row({}, 'Stand'),
  21: row({}, 'Stand'),
}

// ── Soft totals ──────────────────────────────────────────────────────────────
// Source: "Double soft 13 or 14 vs. dealer 5-6" / "Double soft 15 or 16 vs.
// dealer 4-6" / "Double soft 17 or 18 vs. dealer 3-6" / "Always hit soft 17
// or less" / "Stand on soft 18 except hit against a dealer 9, 10, or A" /
// "Always stand on soft 19 or more". H17 modifications: "Double soft 18 vs.
// dealer 2. Double soft 19 vs. dealer 6."
const SOFT_REFERENCE: Record<number, Record<DealerUpcardKey, Action>> = {
  13: row({ '5': 'Double', '6': 'Double' }, 'Hit'),
  14: row({ '5': 'Double', '6': 'Double' }, 'Hit'),
  15: row({ '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  16: row({ '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  17: row({ '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double' }, 'Hit'),
  18: row(
    { '2': 'Double', '3': 'Double', '4': 'Double', '5': 'Double', '6': 'Double', '7': 'Stand', '8': 'Stand' },
    'Hit', // covers 9, 10, A
  ),
  19: row({ '6': 'Double' }, 'Stand'),
  20: row({}, 'Stand'),
  21: row({}, 'Stand'),
}

// ── Pairs ────────────────────────────────────────────────────────────────────
// Source: "Always split aces and 8s. Never split 5s and 10s. Split 2s and 3s
// against a dealer 4-7, and against a 2 or 3 if DAS is allowed [always here,
// so 2-7 unconditionally]. Split 4s only if DAS is allowed [always here] and
// the dealer shows a 5 or 6. Split 6s against a dealer 3-6, and against a 2
// if DAS is allowed [always here, so 2-6 unconditionally]. Split 7s against
// a dealer 2-7. Split 9s against a dealer 2-6 or 8-9." 5s and 10s, per "never
// split," fall back to their equivalent hard-total treatment (hard 10 and
// hard 20 respectively) from the Hard Totals source quotes above; 9s outside
// the split range (7, 10, A) fall back to hard 18's "always stand".
const PAIR_REFERENCE: Record<PairRankKey, Record<DealerUpcardKey, Action>> = {
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

describe('strategy.ts chart vs. sourced reference (Wizard of Odds, 4-8 decks, H17)', () => {
  it.each(Object.keys(HARD_REFERENCE).map(Number))('hard %i matches the sourced reference for every dealer upcard', (total) => {
    for (const dealer of DEALER_KEYS) {
      expect(hardTotals[total][dealer], `hard ${total} vs ${dealer}`).toBe(HARD_REFERENCE[total][dealer])
    }
  })

  it.each(Object.keys(SOFT_REFERENCE).map(Number))('soft %i matches the sourced reference for every dealer upcard', (total) => {
    for (const dealer of DEALER_KEYS) {
      expect(softTotals[total][dealer], `soft ${total} vs ${dealer}`).toBe(SOFT_REFERENCE[total][dealer])
    }
  })

  it.each(Object.keys(PAIR_REFERENCE) as PairRankKey[])('pair %s,%s matches the sourced reference for every dealer upcard', (rank) => {
    for (const dealer of DEALER_KEYS) {
      expect(pairs[rank][dealer], `pair ${rank},${rank} vs ${dealer}`).toBe(PAIR_REFERENCE[rank][dealer])
    }
  })
})

describe('app-specific fallback cells (not real basic-strategy chart entries — see header comment)', () => {
  it('hardTotals[4] (only reachable via getHardSoftAction on a dealt 2-2) is always Hit', () => {
    for (const dealer of DEALER_KEYS) {
      expect(hardTotals[4][dealer]).toBe('Hit')
    }
  })

  it('softTotals[12] (only reachable via getHardSoftAction on a dealt A-A) is always Hit', () => {
    for (const dealer of DEALER_KEYS) {
      expect(softTotals[12][dealer]).toBe('Hit')
    }
  })
})

// ── Late surrender (ON state) ───────────────────────────────────────────────
//
// SOURCE: the same Wizard of Odds page, Surrender section, fetched live via
// WebFetch (quoted verbatim, confirmed identical across two separately-
// worded fetches):
//   Base rule: "Surrender hard 16 (but not a pair of 8s) vs. dealer 9, 10,
//   or A, and hard 15 vs. dealer 10."
//   H17 addition: "Surrender 15, a pair of 8s, and 17 vs. dealer A."
// Independently corroborated by two separate web searches: a
// blackjackinfo.com forum thread specifically computing 17-vs-Ace surrender
// EV under H17, and a second source giving the identical three-cell H17
// addition list verbatim ("Hard 15 against an Ace; hard 17 against an Ace
// and 8-8 against an Ace"). All three sources agree exactly — nothing here
// is guessed, and nothing was flagged as uncertain.
//
// CORRECTNESS FIX (found while sourcing the full rule matrix, see
// DECISIONS.md): the "pair of 8s vs A" cell above is only correct when
// double-after-split is NOT allowed. Wizard of Odds' Basic Strategy
// Calculator, queried directly, resolves that exact cell (6 decks, H17,
// DAS allowed, late surrender) as code `Rp` — "surrender only if DAS is
// NOT allowed, otherwise split." This app's rule set always has DAS on, so
// pair 8,8 vs A must be Split, never Surrender — the prose quote above was
// read too literally and this app shipped the wrong cell as a result. Fixed
// in effectivePairs; SURRENDER_PAIR_REFERENCE below now has no override at
// all (pair 8,8 vs A stays 'Split', same as every other dealer upcard).
//
// Built by cloning HARD_REFERENCE/PAIR_REFERENCE (the already-proven
// surrender-OFF reference above) and applying ONLY these 6 cells, so this
// block proves both (a) the 6 sourced cells become Surrender, AND (b) every
// other cell — including pair 8,8 vs A — is untouched by the overlay, not
// just spot-checked.
const SURRENDER_HARD_REFERENCE: Record<number, Record<DealerUpcardKey, Action>> = Object.fromEntries(
  Object.entries(HARD_REFERENCE).map(([total, r]) => [Number(total), { ...r }]),
)
SURRENDER_HARD_REFERENCE[15]['10'] = 'Surrender'
SURRENDER_HARD_REFERENCE[15].A = 'Surrender' // H17 addition
SURRENDER_HARD_REFERENCE[16]['9'] = 'Surrender'
SURRENDER_HARD_REFERENCE[16]['10'] = 'Surrender'
SURRENDER_HARD_REFERENCE[16].A = 'Surrender'
SURRENDER_HARD_REFERENCE[17].A = 'Surrender' // H17 addition

// No pair override — see the correctness-fix comment above.
const SURRENDER_PAIR_REFERENCE: Record<PairRankKey, Record<DealerUpcardKey, Action>> = PAIR_REFERENCE

describe('effectiveHardTotals/effectivePairs — late surrender ON', () => {
  it.each(Object.keys(SURRENDER_HARD_REFERENCE).map(Number))(
    'hard %i matches the sourced surrender-ON reference for every dealer upcard',
    (total) => {
      const effective = effectiveHardTotals(true)
      for (const dealer of DEALER_KEYS) {
        expect(effective[total][dealer], `hard ${total} vs ${dealer} (surrender ON)`).toBe(SURRENDER_HARD_REFERENCE[total][dealer])
      }
    },
  )

  it.each(Object.keys(SURRENDER_PAIR_REFERENCE) as PairRankKey[])(
    'pair %s,%s matches the sourced surrender-ON reference for every dealer upcard',
    (rank) => {
      const effective = effectivePairs(true)
      for (const dealer of DEALER_KEYS) {
        expect(effective[rank][dealer], `pair ${rank},${rank} vs ${dealer} (surrender ON)`).toBe(SURRENDER_PAIR_REFERENCE[rank][dealer])
      }
    },
  )

  it('soft totals have no surrender cells under this rule set — softTotals is untouched by the toggle', () => {
    // softTotals has no effective-table variant at all (getAction/getHardSoftAction
    // never apply the overlay to it) — this just re-confirms the sourced reference
    // agrees no soft cell is ever Surrender.
    for (const row of Object.values(SOFT_REFERENCE)) {
      for (const dealer of DEALER_KEYS) {
        expect(row[dealer]).not.toBe('Surrender')
      }
    }
  })
})

describe('effectiveHardTotals/effectivePairs — late surrender OFF is byte-identical to the base tables', () => {
  it('returns the exact same hardTotals/pairs objects (not a copy) when surrenderEnabled is false', () => {
    // Reference equality, not deep equality — proves the OFF path never rebuilds
    // or risks the already-proven-correct base tables, exactly per the plan.
    expect(effectiveHardTotals(false)).toBe(hardTotals)
    expect(effectivePairs(false)).toBe(pairs)
  })
})

describe('correctness fix: pair 8,8 vs A late surrender', () => {
  it('is Split, never Surrender, at 6 decks — pinned so the shipped bug cannot regress', () => {
    expect(effectivePairs(true)['8'].A).toBe('Split')
  })
})

/**
 * ═══════════════════════════════════════════════════════════════════════
 * Full rule matrix (deck size × soft-17 rule × surrender mode) — Pass 1.
 *
 * SOURCE FOR EVERYTHING BELOW: Wizard of Odds' Basic Strategy Calculator
 * (wizardofodds.com/games/blackjack/strategy/calculator/), queried
 * programmatically via Playwright — the calculator's own deck/soft17/das/
 * surrender <select> inputs were set, its own ComputeStrategy() was
 * invoked, and the rendered #strategy table's text was parsed. This
 * replaced two earlier, REJECTED sourcing attempts (a blog transcription
 * that turned out to read the wrong DAS branch on several cells, and a
 * manual pixel-read of WoO's own chart images that had a proven
 * column-alignment error) — see DECISIONS.md for the full history.
 *
 * SELF-CHECK (the thing that makes all of this trustworthy): the
 * calculator's own 6-deck/H17/DAS-allowed/no-surrender output, extracted
 * the exact same way, matched hardTotals/softTotals above with ZERO
 * differences, and its late-surrender output matched HARD_SURRENDER_CELLS
 * exactly except the one pair 8,8-vs-A cell that turned out to be a real
 * bug (see the correctness-fix block above). That's asserted permanently
 * below, not just claimed in a comment.
 * ═══════════════════════════════════════════════════════════════════════
 */

describe('resolveHardTotals/resolveSoftTotals/resolvePairs — calculator self-check', () => {
  it('at the default RuleConfig (6 decks, H17, no surrender), resolves to the literal base tables by reference', () => {
    const rules: RuleConfig = { numDecks: 6, soft17Rule: 'H17', surrenderMode: 'none' }
    expect(resolveHardTotals(rules)).toBe(hardTotals)
    expect(resolveSoftTotals(rules)).toBe(softTotals)
    expect(resolvePairs(rules)).toBe(pairs)
  })

  it('at 6 decks/H17/late surrender, matches the already-proven SURRENDER_HARD_REFERENCE/SURRENDER_PAIR_REFERENCE exactly', () => {
    const rules: RuleConfig = { numDecks: 6, soft17Rule: 'H17', surrenderMode: 'late' }
    const resolvedHard = resolveHardTotals(rules)
    const resolvedPairs = resolvePairs(rules)
    for (const total of Object.keys(SURRENDER_HARD_REFERENCE).map(Number)) {
      for (const dealer of DEALER_KEYS) {
        expect(resolvedHard[total][dealer], `hard ${total} vs ${dealer}`).toBe(SURRENDER_HARD_REFERENCE[total][dealer])
      }
    }
    for (const rank of Object.keys(SURRENDER_PAIR_REFERENCE) as PairRankKey[]) {
      for (const dealer of DEALER_KEYS) {
        expect(resolvedPairs[rank][dealer], `pair ${rank},${rank} vs ${dealer}`).toBe(SURRENDER_PAIR_REFERENCE[rank][dealer])
      }
    }
  })
})

// ── S17 reference (6-deck and 2-deck share this) — reverts the 3 known
// H17-only cells on the existing H17 reference tables above.
const S17_HARD_REFERENCE: Record<number, Record<DealerUpcardKey, Action>> = Object.fromEntries(
  Object.entries(HARD_REFERENCE).map(([total, r]) => [Number(total), { ...r }]),
)
S17_HARD_REFERENCE[11].A = 'Hit'
const S17_SOFT_REFERENCE: Record<number, Record<DealerUpcardKey, Action>> = Object.fromEntries(
  Object.entries(SOFT_REFERENCE).map(([total, r]) => [Number(total), { ...r }]),
)
S17_SOFT_REFERENCE[18]['2'] = 'Stand'
S17_SOFT_REFERENCE[19]['6'] = 'Stand'

describe('resolveHardTotals/resolveSoftTotals — S17 (6-deck and 2-deck share the base chart)', () => {
  it('at 6 decks/S17/no-surrender, reverts exactly the 3 known H17 cells (11 vs A, soft 18 vs 2, soft 19 vs 6)', () => {
    const rules: RuleConfig = { numDecks: 6, soft17Rule: 'S17', surrenderMode: 'none' }
    for (const dealer of DEALER_KEYS) expect(resolveHardTotals(rules)[11][dealer], `hard 11 vs ${dealer}`).toBe(S17_HARD_REFERENCE[11][dealer])
    for (const dealer of DEALER_KEYS) expect(resolveSoftTotals(rules)[18][dealer], `soft 18 vs ${dealer}`).toBe(S17_SOFT_REFERENCE[18][dealer])
    for (const dealer of DEALER_KEYS) expect(resolveSoftTotals(rules)[19][dealer], `soft 19 vs ${dealer}`).toBe(S17_SOFT_REFERENCE[19][dealer])
  })

  it('at 2 decks/S17/no-surrender, soft 18/19 revert the same way, but hard 11 vs A does NOT stay Hit — the 2-deck-specific delta re-adds Double on top (see the 2-deck describe block below)', () => {
    const rules: RuleConfig = { numDecks: 2, soft17Rule: 'S17', surrenderMode: 'none' }
    for (const dealer of DEALER_KEYS) expect(resolveSoftTotals(rules)[18][dealer], `soft 18 vs ${dealer}`).toBe(S17_SOFT_REFERENCE[18][dealer])
    for (const dealer of DEALER_KEYS) expect(resolveSoftTotals(rules)[19][dealer], `soft 19 vs ${dealer}`).toBe(S17_SOFT_REFERENCE[19][dealer])
    expect(resolveHardTotals(rules)[11].A).toBe('Double')
  })
})

// ── 1-deck: independently sourced complete tables (not deltas — see
// strategy.ts's own header comment on why). H17 and S17 pairs are
// DIFFERENT tables (pair 9,9 vs A is Split under H17, base Stand under
// S17) — this is the exact confusion a rejected draft of this plan
// almost shipped by sharing one pairs table between the two rules.
describe('1-deck tables — H17 vs S17 divergence, pinned explicitly', () => {
  it('pair 9,9 vs A is Split under H17 but Stand under S17 — the one cell the two 1-deck pairs tables genuinely differ on', () => {
    expect(oneDeckPairsH17['9'].A).toBe('Split')
    expect(oneDeckPairsS17['9'].A).toBe('Stand')
  })

  it('every other 1-deck pair cell is identical between H17 and S17', () => {
    for (const rank of Object.keys(oneDeckPairsH17) as PairRankKey[]) {
      for (const dealer of DEALER_KEYS) {
        if (rank === '9' && dealer === 'A') continue
        expect(oneDeckPairsS17[rank][dealer], `pair ${rank} vs ${dealer}`).toBe(oneDeckPairsH17[rank][dealer])
      }
    }
  })

  it('resolveHardTotals/resolveSoftTotals/resolvePairs at 1 deck return the standalone oneDeck* tables directly, not a derived copy', () => {
    expect(resolveHardTotals({ numDecks: 1, soft17Rule: 'H17', surrenderMode: 'none' })).toBe(oneDeckHardTotalsH17)
    expect(resolveSoftTotals({ numDecks: 1, soft17Rule: 'H17', surrenderMode: 'none' })).toBe(oneDeckSoftTotalsH17)
    expect(resolvePairs({ numDecks: 1, soft17Rule: 'H17', surrenderMode: 'none' })).toBe(oneDeckPairsH17)
    expect(resolveHardTotals({ numDecks: 1, soft17Rule: 'S17', surrenderMode: 'none' })).toBe(oneDeckHardTotalsS17)
    expect(resolveSoftTotals({ numDecks: 1, soft17Rule: 'S17', surrenderMode: 'none' })).toBe(oneDeckSoftTotalsS17)
    expect(resolvePairs({ numDecks: 1, soft17Rule: 'S17', surrenderMode: 'none' })).toBe(oneDeckPairsS17)
  })
})

/**
 * Machine-extracted delta lists (calculator vs. the 6-deck base), cited in
 * strategy.ts's own header comment for the source. Each `it` below asserts
 * every listed cell AND — via the full-table comparison in the "no other
 * cells changed" tests further down — that nothing else moved.
 */
type Delta = { total: number; dealer: DealerUpcardKey }
type PairDelta = { rank: PairRankKey; dealer: DealerUpcardKey }

function withHardDeltas(base: Record<number, Record<DealerUpcardKey, Action>>, deltas: Delta[], action: Action) {
  const out: Record<number, Record<DealerUpcardKey, Action>> = Object.fromEntries(
    Object.entries(base).map(([t, r]) => [Number(t), { ...r }]),
  )
  for (const d of deltas) out[d.total][d.dealer] = action
  return out
}
function withPairDeltas(base: Record<PairRankKey, Record<DealerUpcardKey, Action>>, deltas: PairDelta[], action: Action) {
  const out = { ...base } as Record<PairRankKey, Record<DealerUpcardKey, Action>>
  for (const d of deltas) out[d.rank] = { ...out[d.rank], [d.dealer]: action }
  return out
}

function expectHardMatches(actual: Record<number, Record<DealerUpcardKey, Action>>, expected: Record<number, Record<DealerUpcardKey, Action>>, label: string) {
  for (const total of Object.keys(expected).map(Number)) {
    for (const dealer of DEALER_KEYS) {
      expect(actual[total][dealer], `${label} hard ${total} vs ${dealer}`).toBe(expected[total][dealer])
    }
  }
}
function expectPairMatches(actual: Record<PairRankKey, Record<DealerUpcardKey, Action>>, expected: Record<PairRankKey, Record<DealerUpcardKey, Action>>, label: string) {
  for (const rank of Object.keys(expected) as PairRankKey[]) {
    for (const dealer of DEALER_KEYS) {
      expect(actual[rank][dealer], `${label} pair ${rank},${rank} vs ${dealer}`).toBe(expected[rank][dealer])
    }
  }
}

// 2-deck hard/soft deltas vs the 6-deck base — cited in strategy.ts's TWO_DECK_HARD_DELTA/TWO_DECK_SOFT_DELTA.
const TWO_DECK_HARD_H17: Delta[] = [{ total: 9, dealer: '2' }]
const TWO_DECK_HARD_S17: Delta[] = [{ total: 9, dealer: '2' }, { total: 11, dealer: 'A' }]
const TWO_DECK_SOFT_H17: Delta[] = [{ total: 14, dealer: '4' }]
const TWO_DECK_PAIR: PairDelta[] = [{ rank: '6', dealer: '7' }, { rank: '7', dealer: '8' }]

describe('2-deck — machine-extracted deltas vs the 6-deck base (no-surrender)', () => {
  it('H17: hard 9 vs 2 doubles; soft 14 vs 4 doubles; pair 6,6 vs 7 and 7,7 vs 8 split', () => {
    const rules: RuleConfig = { numDecks: 2, soft17Rule: 'H17', surrenderMode: 'none' }
    expectHardMatches(resolveHardTotals(rules), withHardDeltas(hardTotals, TWO_DECK_HARD_H17, 'Double'), '2D H17')
    expectHardMatches(resolveSoftTotals(rules), withHardDeltas(softTotals, TWO_DECK_SOFT_H17, 'Double'), '2D H17 soft')
    expectPairMatches(resolvePairs(rules), withPairDeltas(pairs, TWO_DECK_PAIR, 'Split'), '2D H17')
  })

  it('S17: hard 9 vs 2 AND hard 11 vs A double; soft has NO delta (unlike H17); pairs match H17', () => {
    const rules: RuleConfig = { numDecks: 2, soft17Rule: 'S17', surrenderMode: 'none' }
    expectHardMatches(resolveHardTotals(rules), withHardDeltas(S17_HARD_REFERENCE as Record<number, Record<DealerUpcardKey, Action>>, TWO_DECK_HARD_S17, 'Double'), '2D S17')
    expectHardMatches(resolveSoftTotals(rules), S17_SOFT_REFERENCE, '2D S17 soft (no delta)')
    expectPairMatches(resolvePairs(rules), withPairDeltas(pairs, TWO_DECK_PAIR, 'Split'), '2D S17')
  })
})

// Late-surrender cell lists — one literal list per (deck, rule) combination, none derived from another.
const LATE_SURRENDER: Record<'1' | '2' | '6', Record<'H17' | 'S17', { hard: Delta[]; pair: PairDelta[] }>> = {
  '1': {
    H17: { hard: [{ total: 15, dealer: 'A' }, { total: 16, dealer: '10' }, { total: 16, dealer: 'A' }, { total: 17, dealer: 'A' }], pair: [{ rank: '7', dealer: '10' }, { rank: '7', dealer: 'A' }] },
    S17: { hard: [{ total: 16, dealer: '10' }, { total: 16, dealer: 'A' }], pair: [{ rank: '7', dealer: '10' }] },
  },
  '2': {
    H17: { hard: [{ total: 15, dealer: '10' }, { total: 15, dealer: 'A' }, { total: 16, dealer: '10' }, { total: 16, dealer: 'A' }, { total: 17, dealer: 'A' }], pair: [] },
    S17: { hard: [{ total: 15, dealer: '10' }, { total: 16, dealer: '10' }, { total: 16, dealer: 'A' }], pair: [] },
  },
  '6': {
    H17: { hard: [{ total: 15, dealer: '10' }, { total: 15, dealer: 'A' }, { total: 16, dealer: '9' }, { total: 16, dealer: '10' }, { total: 16, dealer: 'A' }, { total: 17, dealer: 'A' }], pair: [] },
    S17: { hard: [{ total: 15, dealer: '10' }, { total: 16, dealer: '9' }, { total: 16, dealer: '10' }, { total: 16, dealer: 'A' }], pair: [] },
  },
}

describe('late surrender — machine-extracted cell lists for every (deck, rule) combination', () => {
  const cases: { numDecks: 1 | 2 | 6; rule: 'H17' | 'S17' }[] = [
    { numDecks: 1, rule: 'H17' }, { numDecks: 1, rule: 'S17' },
    { numDecks: 2, rule: 'H17' }, { numDecks: 2, rule: 'S17' },
    { numDecks: 6, rule: 'H17' }, { numDecks: 6, rule: 'S17' },
  ]

  it.each(cases)('$numDecks deck(s)/$rule: exactly the cited cells become Surrender, nothing else', ({ numDecks, rule }) => {
    const cells = LATE_SURRENDER[String(numDecks) as '1' | '2' | '6'][rule]
    const rules: RuleConfig = { numDecks, soft17Rule: rule, surrenderMode: 'late' }
    const noSurrenderRules: RuleConfig = { ...rules, surrenderMode: 'none' }

    const resolvedHard = resolveHardTotals(rules)
    const baseHard = resolveHardTotals(noSurrenderRules)
    const expectedHard = withHardDeltas(baseHard, cells.hard, 'Surrender')
    expectHardMatches(resolvedHard, expectedHard, `${numDecks}D ${rule} surrender`)

    const resolvedPairs = resolvePairs(rules)
    const basePairs = resolvePairs(noSurrenderRules)
    const expectedPairs = withPairDeltas(basePairs, cells.pair, 'Surrender')
    expectPairMatches(resolvedPairs, expectedPairs, `${numDecks}D ${rule} surrender`)

    // pair 8,8 vs A is never a late-surrender cell at any deck size under our always-DAS-on rule set (the bug fix generalizes).
    expect(resolvedPairs['8'].A).toBe('Split')
  })

  it('no soft-total cell is ever a surrender cell, at any deck size or rule', () => {
    for (const { numDecks, rule } of cases) {
      const soft = resolveSoftTotals({ numDecks, soft17Rule: rule, surrenderMode: 'late' })
      for (const row of Object.values(soft)) {
        for (const dealer of DEALER_KEYS) expect(row[dealer]).not.toBe('Surrender')
      }
    }
  })
})

describe('getHardSoftActionForRules', () => {
  it('never returns Split, even for a dealt pair, at any rule config', () => {
    const rules: RuleConfig = { numDecks: 1, soft17Rule: 'H17', surrenderMode: 'none' }
    // 8,8 read as a hard 16 (never routed through the pairs table)
    const eight = { rank: '8' as const }
    const dealerTen = { rank: '10' as const }
    expect(getHardSoftActionForRules([eight, eight], dealerTen, rules)).not.toBe('Split')
  })
})
