import type { Action } from '../types'

/**
 * The real Illustrious 18 (Don Schlesinger, "Blackjack Attack"), minus
 * Insurance, for this app's fixed rule set (6 decks, S17, DAS, no
 * surrender) — v2 step 9. Insurance is excluded for the same reason step 8
 * excluded it: it's a side bet, not a Hit/Stand/Double/Split decision, and
 * would need a genuinely new decision-point type threaded through the
 * whole engine — confirmed with the user as still out of scope.
 *
 * Verified by cross-referencing three independent sources (blackjack3000.com,
 * gamblingcalc.com, and a Schlesinger-attributed summary) rather than
 * trusting a single page — the positive-correlation entries (1-13 below)
 * agreed across every source checked, but the five negative-correlation
 * entries (14-18) did NOT: a fourth source (casinonewsdaily.com) gave
 * different thresholds for 12-vs-5 (-1 instead of -2) and 13-vs-2 (0
 * instead of -1). The values below are the ones three independent sources
 * agreed on; the fourth's figures were treated as a transcription error.
 * This kind of disagreement between "reputable-looking" secondary sources
 * is exactly why this got verified before encoding, not just recalled.
 *
 * Two real entries from the actual 18 are NOT representable here and are
 * deliberately omitted from this dataset entirely:
 *  - 10,10 vs 5 (Split, TC>=+5) and 10,10 vs 6 (Split, TC>=+4): this
 *    dataset is shared with v2's simulated-counter engine
 *    (detectionSession/multiPlayerSession/evidenceGrading/evasionSession),
 *    which deliberately never models player-side Split (see CLAUDE.md
 *    §11, step 8). Adding Split-valued entries here would silently never
 *    fire for that engine anyway (it always queries via
 *    getHardSoftSituationKey, which never produces a "pair-..." key) but
 *    leaving them out entirely is more honest than encoding dead data.
 *    The new step 9 "Index Plays" drill (`indexPlayDrill.ts`), which DOES
 *    support real pairs/Split via v1's full `getAction`/`getSituationKey`,
 *    is the one place these two plays could have mattered — they're
 *    skipped there too for consistency, since this is the single shared
 *    dataset. Revisit only if a future pass wants a second, pair-aware
 *    dataset just for that drill.
 *  - 11 vs A (Double, TC>=+1): a genuine no-op in this codebase, not an
 *    omission. v1's `hardTotals[11]` always returns Double regardless of
 *    dealer upcard (see CLAUDE.md §11's existing hard-11-vs-Ace TODO) —
 *    the real Illustrious 18 entry assumes a rule variant where basic
 *    strategy is Hit vs Ace, with the index play being "deviate to Double
 *    at TC>=+1." Since this app's chart already always doubles 11
 *    regardless of count, there's nothing to deviate from or to here.
 *    Revisit only if/when that TODO's "make hard-11-vs-Ace configurable"
 *    is ever actioned.
 *
 * Positive-correlation entries (deviate once the count is high ENOUGH —
 * `direction: 'aboveOrEqual'`) and negative-correlation entries (basic
 * strategy is already the count-favorable play; deviate once the count
 * drops too LOW — `direction: 'below'`) use strict comparisons in opposite
 * directions: an `aboveOrEqual` play triggers at `trueCount >= threshold`;
 * a `below` play triggers at `trueCount < threshold` (note: NOT `<=` — at
 * the threshold itself, basic strategy is still correct).
 */

export interface IndexPlay {
  situationKey: string
  threshold: number
  direction: 'aboveOrEqual' | 'below'
  deviateTo: Action
}

export const INDEX_PLAYS: IndexPlay[] = [
  // Positive-correlation: deviate once the count is high enough.
  { situationKey: 'hard-16-vs-10', threshold: 0, direction: 'aboveOrEqual', deviateTo: 'Stand' },
  { situationKey: 'hard-15-vs-10', threshold: 4, direction: 'aboveOrEqual', deviateTo: 'Stand' },
  { situationKey: 'hard-10-vs-10', threshold: 4, direction: 'aboveOrEqual', deviateTo: 'Double' },
  { situationKey: 'hard-12-vs-3', threshold: 2, direction: 'aboveOrEqual', deviateTo: 'Stand' },
  { situationKey: 'hard-12-vs-2', threshold: 3, direction: 'aboveOrEqual', deviateTo: 'Stand' },
  { situationKey: 'hard-9-vs-2', threshold: 1, direction: 'aboveOrEqual', deviateTo: 'Double' },
  { situationKey: 'hard-10-vs-A', threshold: 4, direction: 'aboveOrEqual', deviateTo: 'Double' },
  { situationKey: 'hard-9-vs-7', threshold: 3, direction: 'aboveOrEqual', deviateTo: 'Double' },
  { situationKey: 'hard-16-vs-9', threshold: 5, direction: 'aboveOrEqual', deviateTo: 'Stand' },
  // Negative-correlation: basic strategy is Stand; deviate to Hit once the count drops too low.
  { situationKey: 'hard-13-vs-2', threshold: -1, direction: 'below', deviateTo: 'Hit' },
  { situationKey: 'hard-12-vs-4', threshold: 0, direction: 'below', deviateTo: 'Hit' },
  { situationKey: 'hard-12-vs-5', threshold: -2, direction: 'below', deviateTo: 'Hit' },
  { situationKey: 'hard-12-vs-6', threshold: -1, direction: 'below', deviateTo: 'Hit' },
  { situationKey: 'hard-13-vs-3', threshold: -2, direction: 'below', deviateTo: 'Hit' },
]

/** The index play indicated for `situationKey` at `trueCount`, if any. */
export function indicatedDeviation(situationKey: string, trueCount: number): IndexPlay | null {
  return (
    INDEX_PLAYS.find((play) => {
      if (play.situationKey !== situationKey) return false
      return play.direction === 'aboveOrEqual' ? trueCount >= play.threshold : trueCount < play.threshold
    }) ?? null
  )
}
