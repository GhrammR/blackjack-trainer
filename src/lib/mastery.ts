import type { Category } from '../types'
import type { Stats } from './adaptiveEngine'

/** Target for the marquee perfect-streak goal. */
export const STREAK_TARGET = 150

/** +1 on a correct decision, reset to 0 on any miss. */
export function updateStreak(currentStreak: number, isCorrect: boolean): number {
  return isCorrect ? currentStreak + 1 : 0
}

export interface LifetimeAccuracy {
  attempts: number
  correct: number
  /** Fraction correct, 0 when nothing has been attempted yet. */
  accuracy: number
}

/** Aggregates accuracy across every situation that's been attempted at least once. */
export function lifetimeAccuracy(stats: Stats): LifetimeAccuracy {
  let attempts = 0
  let correct = 0
  for (const stat of Object.values(stats)) {
    attempts += stat.attempts
    correct += stat.correct
  }
  return { attempts, correct, accuracy: attempts === 0 ? 0 : correct / attempts }
}

export function categoryOfSituationKey(key: string): Category {
  if (key.startsWith('hard-')) return 'hard'
  if (key.startsWith('soft-')) return 'soft'
  return 'pairs'
}

/**
 * "Rolling accuracy over the last N attempts" is approximated here as
 * lifetime accuracy within the category, gated by a minimum attempt count —
 * the adaptive engine doesn't keep a full chronological event log, only a
 * short per-situation window, so a true last-N-across-the-category figure
 * isn't available without adding one.
 */
export const CATEGORY_MASTERY_MIN_ATTEMPTS = 20
export const CATEGORY_MASTERY_THRESHOLD = 0.95

export interface CategoryMastery {
  attempts: number
  correct: number
  accuracy: number
  isStrong: boolean
}

export function categoryMastery(stats: Stats, category: Category): CategoryMastery {
  let attempts = 0
  let correct = 0
  for (const stat of Object.values(stats)) {
    if (categoryOfSituationKey(stat.key) !== category) continue
    attempts += stat.attempts
    correct += stat.correct
  }
  const accuracy = attempts === 0 ? 0 : correct / attempts
  const isStrong = attempts >= CATEGORY_MASTERY_MIN_ATTEMPTS && accuracy >= CATEGORY_MASTERY_THRESHOLD
  return { attempts, correct, accuracy, isStrong }
}
