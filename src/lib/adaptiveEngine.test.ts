import { describe, expect, it } from 'vitest'
import {
  BASE_EXPLORATION,
  RECENCY_BOOST,
  WINDOW_SIZE,
  getStat,
  recentAccuracy,
  recordResult,
  selectNextSituation,
  weaknessScore,
} from './adaptiveEngine'

describe('getStat', () => {
  it('returns a zeroed-out record for an unseen situation', () => {
    expect(getStat({}, 'hard-16-vs-10')).toEqual({
      key: 'hard-16-vs-10',
      attempts: 0,
      correct: 0,
      lastSeen: -1,
      recentResults: [],
    })
  })
})

describe('recordResult', () => {
  it('does not mutate the input stats object', () => {
    const stats = {}
    recordResult(stats, 'hard-16-vs-10', true, 0)
    expect(stats).toEqual({})
  })

  it('accumulates attempts and correct counts', () => {
    let stats = recordResult({}, 'hard-16-vs-10', true, 0)
    stats = recordResult(stats, 'hard-16-vs-10', false, 1)
    const stat = getStat(stats, 'hard-16-vs-10')
    expect(stat.attempts).toBe(2)
    expect(stat.correct).toBe(1)
    expect(stat.lastSeen).toBe(1)
    expect(stat.recentResults).toEqual([true, false])
  })

  it('caps the rolling window at WINDOW_SIZE, dropping the oldest result', () => {
    let stats = {}
    for (let i = 0; i < WINDOW_SIZE + 2; i++) {
      stats = recordResult(stats, 'hard-16-vs-10', i % 2 === 0, i)
    }
    const stat = getStat(stats, 'hard-16-vs-10')
    expect(stat.recentResults).toHaveLength(WINDOW_SIZE)
    expect(stat.attempts).toBe(WINDOW_SIZE + 2)
  })

  it('tracks separate situations independently', () => {
    let stats = recordResult({}, 'hard-16-vs-10', false, 0)
    stats = recordResult(stats, 'pair-8-vs-10', true, 1)
    expect(getStat(stats, 'hard-16-vs-10').correct).toBe(0)
    expect(getStat(stats, 'pair-8-vs-10').correct).toBe(1)
  })
})

describe('recentAccuracy', () => {
  it('treats an unseen situation as 0 accuracy', () => {
    expect(recentAccuracy(getStat({}, 'hard-16-vs-10'))).toBe(0)
  })

  it('divides by the fixed window size, not the number of attempts so far', () => {
    const stats = recordResult({}, 'hard-16-vs-10', true, 0)
    expect(recentAccuracy(getStat(stats, 'hard-16-vs-10'))).toBe(1 / WINDOW_SIZE)
  })

  it('reaches 1 once the full window is correct', () => {
    let stats = {}
    for (let i = 0; i < WINDOW_SIZE; i++) {
      stats = recordResult(stats, 'hard-16-vs-10', true, i)
    }
    expect(recentAccuracy(getStat(stats, 'hard-16-vs-10'))).toBe(1)
  })
})

describe('weaknessScore', () => {
  it('is highest for an unseen situation (full penalty + baseline)', () => {
    expect(weaknessScore(getStat({}, 'hard-16-vs-10'))).toBe(RECENCY_BOOST + BASE_EXPLORATION)
  })

  it('drops to the baseline exploration floor once fully mastered', () => {
    let stats = {}
    for (let i = 0; i < WINDOW_SIZE; i++) {
      stats = recordResult(stats, 'hard-16-vs-10', true, i)
    }
    expect(weaknessScore(getStat(stats, 'hard-16-vs-10'))).toBe(BASE_EXPLORATION)
  })

  it('never reaches zero, so mastered situations can still be sampled', () => {
    let stats = {}
    for (let i = 0; i < 20; i++) {
      stats = recordResult(stats, 'hard-16-vs-10', true, i)
    }
    expect(weaknessScore(getStat(stats, 'hard-16-vs-10'))).toBeGreaterThan(0)
  })

  it('is higher for a worse-performing situation than a mastered one', () => {
    let weakStats = {}
    let strongStats = {}
    for (let i = 0; i < WINDOW_SIZE; i++) {
      weakStats = recordResult(weakStats, 'weak', false, i)
      strongStats = recordResult(strongStats, 'strong', true, i)
    }
    expect(weaknessScore(getStat(weakStats, 'weak'))).toBeGreaterThan(weaknessScore(getStat(strongStats, 'strong')))
  })
})

describe('selectNextSituation', () => {
  const keys = ['a', 'b', 'c']

  it('throws if given no candidate keys', () => {
    expect(() => selectNextSituation({}, [])).toThrow()
  })

  it('uses the uniform-random floor when the draw lands above the weighted ratio', () => {
    // First call (>= ratio) takes the uniform branch; second call picks index 1 of 3.
    const calls = [0.99, 0.5]
    const random = () => calls.shift()!
    expect(selectNextSituation({}, keys, random)).toBe('b')
  })

  it('weights toward the weakest situation in the weighted branch', () => {
    let stats = {}
    for (let i = 0; i < WINDOW_SIZE; i++) {
      stats = recordResult(stats, 'a', true, i) // mastered: low weight
      stats = recordResult(stats, 'b', false, i) // weak: high weight
    }
    // 'c' is unseen: weight = RECENCY_BOOST + BASE_EXPLORATION
    // 'a' is mastered: weight = BASE_EXPLORATION
    // 'b' is weak: weight = RECENCY_BOOST + BASE_EXPLORATION
    const weightA = BASE_EXPLORATION
    const weightB = RECENCY_BOOST + BASE_EXPLORATION
    const total = weightA + weightB + weightB

    // First call (< ratio) takes the weighted branch; second call's draw lands
    // just past 'a' and 'b's combined weight, landing in 'c'.
    const justPastAandB = (weightA + weightB + 0.001) / total
    const calls = [0, justPastAandB]
    const random = () => calls.shift()!
    expect(selectNextSituation(stats, ['a', 'b', 'c'], random)).toBe('c')
  })
})
