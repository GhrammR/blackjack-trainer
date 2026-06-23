import { describe, expect, it } from 'vitest'
import {
  CATEGORY_MASTERY_MIN_ATTEMPTS,
  STREAK_TARGET,
  categoryMastery,
  categoryOfSituationKey,
  lifetimeAccuracy,
  updateStreak,
} from './mastery'
import { recordResult } from './adaptiveEngine'

describe('updateStreak', () => {
  it('increments on a correct decision', () => {
    expect(updateStreak(4, true)).toBe(5)
  })

  it('resets to 0 on a miss', () => {
    expect(updateStreak(149, false)).toBe(0)
  })

  it('can reach the streak target', () => {
    let streak = 0
    for (let i = 0; i < STREAK_TARGET; i++) streak = updateStreak(streak, true)
    expect(streak).toBe(STREAK_TARGET)
  })
})

describe('lifetimeAccuracy', () => {
  it('returns zeroes for no attempts', () => {
    expect(lifetimeAccuracy({})).toEqual({ attempts: 0, correct: 0, accuracy: 0 })
  })

  it('sums attempts and correct counts across every situation', () => {
    let stats = recordResult({}, 'hard-16-vs-10', true, 0)
    stats = recordResult(stats, 'hard-16-vs-10', false, 1)
    stats = recordResult(stats, 'pair-8-vs-10', true, 2)
    expect(lifetimeAccuracy(stats)).toEqual({ attempts: 3, correct: 2, accuracy: 2 / 3 })
  })
})

describe('categoryOfSituationKey', () => {
  it('classifies each key prefix', () => {
    expect(categoryOfSituationKey('hard-16-vs-10')).toBe('hard')
    expect(categoryOfSituationKey('soft-18-vs-9')).toBe('soft')
    expect(categoryOfSituationKey('pair-8-vs-10')).toBe('pairs')
  })
})

describe('categoryMastery', () => {
  it('is not strong with no attempts', () => {
    expect(categoryMastery({}, 'hard')).toEqual({ attempts: 0, correct: 0, accuracy: 0, isStrong: false })
  })

  it('only counts situations belonging to the requested category', () => {
    let stats = recordResult({}, 'hard-16-vs-10', true, 0)
    stats = recordResult(stats, 'soft-18-vs-9', false, 1)
    const hard = categoryMastery(stats, 'hard')
    expect(hard.attempts).toBe(1)
    expect(hard.correct).toBe(1)
  })

  it('is not strong below the minimum attempt count even at perfect accuracy', () => {
    let stats = {}
    for (let i = 0; i < CATEGORY_MASTERY_MIN_ATTEMPTS - 1; i++) {
      stats = recordResult(stats, 'hard-16-vs-10', true, i)
    }
    expect(categoryMastery(stats, 'hard').isStrong).toBe(false)
  })

  it('is not strong below the accuracy threshold even with enough volume', () => {
    let stats = {}
    for (let i = 0; i < CATEGORY_MASTERY_MIN_ATTEMPTS; i++) {
      stats = recordResult(stats, 'hard-16-vs-10', i > 1, i) // 18/20 = 90%, under the 95% bar
    }
    expect(categoryMastery(stats, 'hard').isStrong).toBe(false)
  })

  it('is strong once both the volume and accuracy thresholds are met', () => {
    let stats = {}
    for (let i = 0; i < CATEGORY_MASTERY_MIN_ATTEMPTS; i++) {
      stats = recordResult(stats, 'hard-16-vs-10', true, i)
    }
    expect(categoryMastery(stats, 'hard').isStrong).toBe(true)
  })
})
