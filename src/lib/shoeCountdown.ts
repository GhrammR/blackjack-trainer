/**
 * Shoe countdown speed drill (v2 step 5): flip every card in a shuffled
 * shoe as fast as possible while mentally tracking the running count.
 * Hi-Lo is balanced per deck (+20 from 2-6, -20 from 10/J/Q/K/A, 0 from
 * 7-9), so any whole-deck shoe always nets to exactly 0 — that's the
 * "did you count correctly" check.
 */

/** Personal-best completion time in ms, keyed by shoe size (number of decks). */
export type PersonalBests = Record<number, number>

/** Records `timeMs` as the new personal best for `numDecks` only if it's strictly faster than any existing one. */
export function updatePersonalBest(bests: PersonalBests, numDecks: number, timeMs: number): PersonalBests {
  const existing = bests[numDecks]
  if (existing !== undefined && existing <= timeMs) return bests
  return { ...bests, [numDecks]: timeMs }
}
