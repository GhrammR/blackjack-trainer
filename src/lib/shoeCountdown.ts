/**
 * Shoe countdown speed drill (v2 step 5): flip cards as fast as possible
 * while mentally tracking the running count, then submit the count at a
 * random, unpredictable stopping point. Hi-Lo is balanced per deck, so a
 * FULL shoe always nets to exactly 0 — stopping at a random fraction of
 * the shoe instead (rather than always dealing the whole thing) is what
 * makes the target count unpredictable and forces genuine counting; see
 * CLAUDE.md §11 for why "always 0" was an exploitable defect.
 *
 * Two selectable formats (see ShoeCountdownMode.tsx):
 *  - "Full countdown": the drill above. Its personal best is scored by PACE
 *    (ms per card actually dealt), not raw completion time — the random
 *    stop point above makes any single run's card count vary ~2.7x, so raw
 *    time isn't comparable even within one shoe size; pace cancels that out.
 *  - "Missing cards" (`generateMissingCardsRound` below): a real shoe with
 *    1-2 cards physically removed before dealing. The visible cards' Hi-Lo
 *    sum is exactly the negative of what's missing (not always 0), so this
 *    format deals to completion with no random stop needed — the challenge
 *    is not knowing which card(s) are gone, which is inherently un-crammable.
 */

import type { Card } from '../types'
import { createShoe, shuffle } from './shoe'
import { hiLoValue } from './counting'

/**
 * Personal-best score keyed by shoe size (number of decks). Lower is always
 * better, but the unit differs by format: "Full countdown" stores ms per
 * card (pace); "Missing cards" stores a raw completion ms (its card count
 * is ~fixed per deck size, so raw time is already valid there).
 */
export type PersonalBests = Record<number, number>

/** Records `score` (lower is better — pace or raw time, depending on format) as the new personal best for `numDecks` only if it's strictly better than any existing one. */
export function updatePersonalBest(bests: PersonalBests, numDecks: number, score: number): PersonalBests {
  const existing = bests[numDecks]
  if (existing !== undefined && existing <= score) return bests
  return { ...bests, [numDecks]: score }
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

/** 1 or 2 cards removed before dealing, plus the ready-to-deal remaining shoe and the correct answer. */
export interface MissingCardsRound {
  /** The full shoe minus `removed`, shuffled — deal every card in this, no random stop. */
  shoe: Card[]
  removed: Card[]
  /** Hi-Lo sum of the removed card(s) — the drill's correct answer. Equal to the negative of the Hi-Lo sum of every card in `shoe`, since a full shoe always nets to 0. */
  missingCount: number
}

/**
 * Builds one "Missing cards" round: takes a proper `createShoe(numDecks)`
 * composition, shuffles it, then peels 1 or 2 cards off the top as
 * "removed" and deals the rest. Shuffling first and slicing (rather than
 * picking random indices to remove via a retry loop) means there's no
 * degenerate case where a constant/repeating `random` source could loop
 * forever trying to find distinct indices.
 */
export function generateMissingCardsRound(numDecks: number, random: () => number = Math.random): MissingCardsRound {
  const shuffled = shuffle(createShoe(numDecks), random)
  const removedCount = random() < 0.5 ? 1 : 2
  const removed = shuffled.slice(0, removedCount)
  const shoe = shuffled.slice(removedCount)
  const missingCount = removed.reduce((sum, card) => sum + hiLoValue(card.rank), 0)

  return { shoe, removed, missingCount }
}
