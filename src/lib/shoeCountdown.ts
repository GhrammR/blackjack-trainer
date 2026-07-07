/**
 * Shoe countdown speed drill (v2 step 5): flip cards as fast as possible
 * while mentally tracking the running count. Hi-Lo is balanced per deck, so
 * a FULL shoe (or a fixed-size deal that happens to BE the whole shoe, e.g.
 * a 52-card deal at the 1-deck setting) always nets to exactly 0 — an
 * exploitable defect if the drill could ever land there, since the correct
 * answer would then be a guessable constant. See CLAUDE.md §11 history.
 *
 * Two selectable formats (see ShoeCountdownMode.tsx):
 *  - "Full countdown": deals a FIXED number of cards per deck-size setting
 *    (`FULL_COUNTDOWN_CONFIG` below — genuinely scaled, not just relabeled:
 *    1-deck is a short deal, 6-deck a long one, since counting more cards at
 *    speed is the actual skill test at bigger shoe sizes) off a shuffled,
 *    larger internal shoe than the deal itself, at every deck size. Dealing
 *    a partial, unbalanced slice of a bigger shoe is what makes the
 *    resulting count non-zero with real spread — `generateFullCountdownRound`
 *    below shuffles-and-checks (re-shuffling only on the rare invalid draw)
 *    until the slice's actual Hi-Lo sum lands in range and is non-zero. The
 *    card count is fixed per deck size, so personal-best pace and time stay
 *    comparable within a size (naturally different lengths across sizes).
 *  - "Missing cards" (`generateMissingCardsRound` below): a real shoe with
 *    1-2 cards physically removed before dealing. The visible cards' Hi-Lo
 *    sum is exactly the negative of what's missing (not always 0), so this
 *    format deals to completion with no random stop needed — the challenge
 *    is not knowing which card(s) are gone, which is inherently un-crammable.
 */

import type { Card } from '../types'
import { createShoe, shuffle } from './shoe'
import { hiLoValue } from './counting'

/** One personal-best record: raw completion ms alongside the exact card count it corresponds to (card counts vary run to run in "Missing cards"; fixed per deck size but still recorded explicitly for "Full countdown"). */
export interface PersonalBestEntry {
  ms: number
  cards: number
}

/** Personal-best record keyed by shoe size (number of decks) — both formats' card counts vary by deck size, so both key their personal bests the same way. */
export type PersonalBests = Record<number, PersonalBestEntry>

/** Records a `{ ms, cards }` result as the new personal best for `key` only if its pace (ms/card — lower is better) is strictly better than any existing entry's. */
export function updatePersonalBest(bests: PersonalBests, key: number, ms: number, cards: number): PersonalBests {
  const existing = bests[key]
  if (existing !== undefined && existing.ms / existing.cards <= ms / cards) return bests
  return { ...bests, [key]: { ms, cards } }
}

/**
 * Per-deck-size Full Countdown tuning: `dealSize` cards are dealt off a
 * freshly shuffled `shoeDecks`-deck internal shoe (always strictly larger
 * than `dealSize`, so the slice is a genuine partial/unbalanced fraction —
 * never the whole shoe, never balanced to 0), and the real Hi-Lo sum must
 * land in [-maxAbsCount, maxAbsCount] and be non-zero. `dealSize` matches the
 * FULL card complement of the deck-size setting (real bragging rights: "a
 * full 6-deck shoe in X seconds"), while the internal shoe is a separate,
 * comfortably bigger pool so the deal is still a genuine partial slice, not
 * the whole thing. `maxAbsCount` scales up with `dealSize` (~40% of it)
 * since a longer deal naturally has more spread — a wider valid range there
 * is expected, not a bug.
 *   - 1 deck  -> 52 cards from a 4-deck (208-card) shoe   -> ratio 25%, range ±21
 *   - 2 decks -> 104 cards from a 6-deck (312-card) shoe  -> ratio 33%, range ±42
 *   - 6 decks -> 312 cards from a 10-deck (520-card) shoe -> ratio 60%, range ±125 (the real skill test)
 * Falls back to a proportional formula (relative to the 1-deck tuning) for
 * any deck-size setting not explicitly listed, so an unusual `numDecks`
 * still produces a sensible, scaled drill rather than crashing.
 */
const FULL_COUNTDOWN_CONFIG: Record<number, { dealSize: number; shoeDecks: number; maxAbsCount: number }> = {
  1: { dealSize: 52, shoeDecks: 4, maxAbsCount: 21 },
  2: { dealSize: 104, shoeDecks: 6, maxAbsCount: 42 },
  6: { dealSize: 312, shoeDecks: 10, maxAbsCount: 125 },
}

function getFullCountdownConfig(numDecks: number): { dealSize: number; shoeDecks: number; maxAbsCount: number } {
  const known = FULL_COUNTDOWN_CONFIG[numDecks]
  if (known) return known
  const dealSize = Math.round(numDecks * 52)
  return { dealSize, shoeDecks: Math.max(numDecks, Math.ceil(dealSize / 52) + 2), maxAbsCount: Math.round(dealSize * 0.4) }
}

const FULL_COUNTDOWN_MAX_SHUFFLE_ATTEMPTS = 1000

export interface FullCountdownRound {
  cards: Card[]
  /** The real Hi-Lo sum of `cards` — guaranteed non-zero and within [-maxAbsCount, maxAbsCount] for this deck size. */
  count: number
}

/**
 * Shuffles a fresh internal shoe (sized per `getFullCountdownConfig(numDecks)`)
 * and takes the first `dealSize` cards as the dealt slice, computing its real
 * Hi-Lo sum. If that sum is 0 or outside the allowed range, re-shuffles and
 * checks again — cheap (each attempt is one shuffle + a linear sum over the
 * slice) and virtually always resolves in 1-2 attempts, since a random
 * partial slice of a bigger shoe lands in-range and non-zero the large
 * majority of the time. A generous attempt cap prevents any theoretical
 * infinite loop; hitting it would require ~1000 consecutive invalid draws,
 * astronomically unlikely.
 */
export function generateFullCountdownRound(numDecks: number, random: () => number = Math.random): FullCountdownRound {
  const { dealSize, shoeDecks, maxAbsCount } = getFullCountdownConfig(numDecks)
  let cards: Card[] = []
  let count = 0
  for (let attempt = 0; attempt < FULL_COUNTDOWN_MAX_SHUFFLE_ATTEMPTS; attempt++) {
    const shuffled = shuffle(createShoe(shoeDecks), random)
    cards = shuffled.slice(0, dealSize)
    count = cards.reduce((sum, card) => sum + hiLoValue(card.rank), 0)
    if (count !== 0 && Math.abs(count) <= maxAbsCount) {
      return { cards, count }
    }
  }
  // Fallback after exhausting the attempt cap (should not happen in practice) — return the last draw.
  return { cards, count }
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
