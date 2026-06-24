import { describe, expect, it } from 'vitest'
import { indicatedDeviation } from './indexPlays'

describe('indicatedDeviation', () => {
  it('indicates standing on hard 16 vs 10 at true count 0 or above', () => {
    expect(indicatedDeviation('hard-16-vs-10', 0)?.deviateTo).toBe('Stand')
    expect(indicatedDeviation('hard-16-vs-10', 3)?.deviateTo).toBe('Stand')
    expect(indicatedDeviation('hard-16-vs-10', -1)).toBeNull()
  })

  it('indicates standing on hard 12 vs 3 at true count +2 or above', () => {
    expect(indicatedDeviation('hard-12-vs-3', 1)).toBeNull()
    expect(indicatedDeviation('hard-12-vs-3', 2)?.deviateTo).toBe('Stand')
  })

  it('indicates standing on hard 15 vs 10 at true count +4 or above', () => {
    expect(indicatedDeviation('hard-15-vs-10', 3)).toBeNull()
    expect(indicatedDeviation('hard-15-vs-10', 4)?.deviateTo).toBe('Stand')
  })

  it('indicates doubling on hard 10 vs 10 at true count +4 or above', () => {
    expect(indicatedDeviation('hard-10-vs-10', 3)).toBeNull()
    expect(indicatedDeviation('hard-10-vs-10', 4)?.deviateTo).toBe('Double')
  })

  it('returns null for situations with no defined index play', () => {
    expect(indicatedDeviation('hard-16-vs-9', 10)).toBeNull()
    expect(indicatedDeviation('soft-18-vs-9', 10)).toBeNull()
    expect(indicatedDeviation('pair-8-vs-10', 10)).toBeNull()
  })
})
