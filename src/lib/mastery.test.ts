import { describe, expect, it } from 'vitest'
import { STREAK_TARGET, lifetimeAccuracy, updateStreak } from './mastery'
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
