import type { Action } from '../types'

/**
 * A small, representative set of true-count-dependent strategy deviations
 * (real Illustrious-18 entries) used by the counter-detection drill (v2
 * step 8) to model the "count-dependent strategy deviation" tell. This is
 * NOT the full Illustrious 18 — that's v2 step 9. All four entries land on
 * Hit/Stand/Double only, so none require a new Action type (insurance is a
 * real count-sensitive tell too but is deliberately excluded for this
 * reason — see CLAUDE.md §11).
 */

export interface IndexPlay {
  situationKey: string
  /** Deviate to `deviateTo` once the true count is at or above this. */
  minTrueCount: number
  deviateTo: Action
}

export const INDEX_PLAYS: IndexPlay[] = [
  { situationKey: 'hard-16-vs-10', minTrueCount: 0, deviateTo: 'Stand' },
  { situationKey: 'hard-12-vs-3', minTrueCount: 2, deviateTo: 'Stand' },
  { situationKey: 'hard-15-vs-10', minTrueCount: 4, deviateTo: 'Stand' },
  { situationKey: 'hard-10-vs-10', minTrueCount: 4, deviateTo: 'Double' },
]

/** The index play indicated for `situationKey` at `trueCount`, if any. */
export function indicatedDeviation(situationKey: string, trueCount: number): IndexPlay | null {
  return INDEX_PLAYS.find((play) => play.situationKey === situationKey && trueCount >= play.minTrueCount) ?? null
}
