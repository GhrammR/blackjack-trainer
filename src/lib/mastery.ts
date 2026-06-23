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
