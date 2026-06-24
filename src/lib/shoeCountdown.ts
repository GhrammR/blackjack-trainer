/**
 * Shoe countdown speed drill (v2 step 5): flip cards as fast as possible
 * while mentally tracking the running count, then submit the count at a
 * random, unpredictable stopping point. Hi-Lo is balanced per deck, so a
 * FULL shoe always nets to exactly 0 — stopping at a random fraction of
 * the shoe instead (rather than always dealing the whole thing) is what
 * makes the target count unpredictable and forces genuine counting; see
 * CLAUDE.md §11 for why "always 0" was an exploitable defect.
 */

/** Personal-best completion time in ms, keyed by shoe size (number of decks). */
export type PersonalBests = Record<number, number>

/** Records `timeMs` as the new personal best for `numDecks` only if it's strictly faster than any existing one. */
export function updatePersonalBest(bests: PersonalBests, numDecks: number, timeMs: number): PersonalBests {
  const existing = bests[numDecks]
  if (existing !== undefined && existing <= timeMs) return bests
  return { ...bests, [numDecks]: timeMs }
}

/** Lower bound on how much of the shoe must be dealt before stopping, as a fraction of shoe length. */
export const MIN_STOP_FRACTION = 1 / 3
/** Upper bound on how much of the shoe may be dealt before stopping, as a fraction of shoe length. */
export const MAX_STOP_FRACTION = 0.9

/**
 * Picks how many cards to deal before stopping and asking for the running
 * count, drawn uniformly from [MIN_STOP_FRACTION, MAX_STOP_FRACTION] of the
 * shoe. `random` is injectable so tests can pin specific draws instead of
 * relying on statistical sampling.
 */
export function pickStopIndex(shoeLength: number, random: () => number = Math.random): number {
  const min = Math.ceil(shoeLength * MIN_STOP_FRACTION)
  const max = Math.floor(shoeLength * MAX_STOP_FRACTION)
  return min + Math.floor(random() * (max - min + 1))
}
