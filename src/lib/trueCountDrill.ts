import type { Card } from '../types'
import { runningCount, trueCount } from './counting'

/**
 * True-count drill (v2 step 4): the user is handed a running count directly
 * (live counting is step 3/5's job, not this drill's). The discard tray
 * shows decks PLAYED, so that's the estimated quantity; decks remaining is
 * always derived from it via decksRemainingFromPlayedEstimate, never asked
 * for directly. See CLAUDE.md §10 step 4 and §11 (including the
 * played-vs-remaining bug fix and the "Option B" capstone scope boundary).
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
  actualDecksPlayed: number
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
    actualDecksPlayed: cardsDealt / 52,
  }
}

/** The subtraction step, named and tested on its own so it's a visible, teachable part of the chain. */
export function decksRemainingFromPlayedEstimate(numDecks: number, playedEstimate: number): number {
  return numDecks - playedEstimate
}

export interface EstimateGrade {
  isGood: boolean
  /** estimate - actual; positive means they overestimated decks played. */
  delta: number
}

/** Generic delta/tolerance check — doesn't care whether the figures are "played" or "remaining." */
export function gradeEstimate(estimate: number, actual: number): EstimateGrade {
  const delta = estimate - actual
  return { isGood: Math.abs(delta) <= DECK_ESTIMATE_TOLERANCE, delta }
}

export interface MathGrade {
  isCorrect: boolean
  /** What the true count should be, given the decks-remaining figure passed in. */
  expected: number
}

/** Grades the division/rounding step against whatever decks-remaining figure the caller supplies. */
export function gradeTrueCountMath(runningCountValue: number, decksRemaining: number, submitted: number): MathGrade {
  const expected = trueCount(runningCountValue, decksRemaining)
  return { isCorrect: submitted === expected, expected }
}

export type DifficultyLevel = 'beginner' | 'intermediate' | 'expert'
export const DIFFICULTY_LEVELS: DifficultyLevel[] = ['beginner', 'intermediate', 'expert']

export interface TickMark {
  /** 0-1, position from the bottom (0 decks played) to the top (the full shoe played). */
  fraction: number
  label?: string
}

/**
 * Calibration tick marks for the discard tray, by difficulty tier:
 * beginner = labeled whole-deck ticks + unlabeled half-deck ticks,
 * intermediate = labeled whole-deck ticks only, expert = none.
 * See CLAUDE.md §11 for why this exact 3-tier split was chosen.
 *
 * Whole-deck labels run through numDecks itself (the top of the tray),
 * not just the interior boundaries — a 1-deck shoe has no interior
 * boundary at all (the old `wholeDeck < numDecks` loop produced ZERO
 * labeled ticks for numDecks=1), leaving the user with no numeric
 * reference point beyond the settings text. Labeling the full point
 * (e.g. "1" at the top of a 1-deck tray) gives every deck-size setting
 * at least one anchor to calibrate a decks-played estimate against.
 */
export function tickMarks(numDecks: number, difficulty: DifficultyLevel): TickMark[] {
  if (difficulty === 'expert') return []

  const ticks: TickMark[] = []
  for (let wholeDeck = 1; wholeDeck <= numDecks; wholeDeck++) {
    ticks.push({ fraction: wholeDeck / numDecks, label: String(wholeDeck) })
  }

  if (difficulty === 'beginner') {
    for (let halfDeck = 1; halfDeck < numDecks * 2; halfDeck += 2) {
      ticks.push({ fraction: halfDeck / (numDecks * 2) })
    }
  }

  return ticks.sort((a, b) => a.fraction - b.fraction)
}
