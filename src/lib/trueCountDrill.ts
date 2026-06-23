import type { Card } from '../types'
import { runningCount, trueCount } from './counting'

/**
 * True-count drill (v2 step 4): the user is handed a running count directly
 * (live counting is step 3/5's job, not this drill's) and must estimate
 * decks remaining from a discard-tray visual, then compute the true count
 * from their own estimate. See CLAUDE.md §10 step 4 and §11 for the
 * deliberate scope boundary vs. the "Option B" capstone mode.
 */

export const HALF_DECK = 26

/** At least this many half-decks must be dealt / must remain for a scenario to be valid. */
const MIN_HALF_DECKS_DEALT = 1
const MIN_HALF_DECKS_REMAINING = 1

/** An estimate within this many decks of the actual figure counts as "good." See CLAUDE.md §11. */
export const DECK_ESTIMATE_TOLERANCE = 0.5

export interface TrueCountScenario {
  numDecks: number
  totalCards: number
  cardsDealt: number
  /** 0-1, how far into the shoe this scenario sits — drives the tray's fill height. */
  dealtFraction: number
  runningCount: number
  actualDecksRemaining: number
}

/**
 * Builds a scenario from an already-shuffled `shoe`: picks a half-deck-
 * aligned point to slice it at (so the ground truth is always a clean X.0
 * or X.5 deck value), and computes the running count up to that point.
 */
export function generateTrueCountScenario(shoe: Card[], random: () => number = Math.random): TrueCountScenario {
  const totalCards = shoe.length
  const numDecks = totalCards / 52

  const maxHalfDecksDealt = Math.floor(totalCards / HALF_DECK) - MIN_HALF_DECKS_REMAINING
  const halfDecksDealt = MIN_HALF_DECKS_DEALT + Math.floor(random() * (maxHalfDecksDealt - MIN_HALF_DECKS_DEALT + 1))
  const cardsDealt = halfDecksDealt * HALF_DECK

  const dealtCards = shoe.slice(0, cardsDealt)

  return {
    numDecks,
    totalCards,
    cardsDealt,
    dealtFraction: cardsDealt / totalCards,
    runningCount: runningCount(dealtCards),
    actualDecksRemaining: (totalCards - cardsDealt) / 52,
  }
}

export interface EstimateGrade {
  isGood: boolean
  /** estimate - actual; positive means they overestimated decks remaining. */
  delta: number
}

export function gradeEstimate(estimate: number, actualDecksRemaining: number): EstimateGrade {
  const delta = estimate - actualDecksRemaining
  return { isGood: Math.abs(delta) <= DECK_ESTIMATE_TOLERANCE, delta }
}

export interface MathGrade {
  isCorrect: boolean
  /** What the true count should be, given the user's OWN estimate (not the actual deck count). */
  expected: number
}

/** Grades the division/rounding step against the user's own estimate, isolating it from estimation accuracy. */
export function gradeTrueCountMath(runningCountValue: number, estimate: number, submitted: number): MathGrade {
  const expected = trueCount(runningCountValue, estimate)
  return { isCorrect: submitted === expected, expected }
}
