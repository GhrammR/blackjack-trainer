import { describe, expect, it } from 'vitest'
import { INDEX_PLAYS, indicatedDeviation } from './indexPlays'

describe('indicatedDeviation — positive-correlation entries (deviate once the count is high enough)', () => {
  it('indicates standing on hard 16 vs 10 at true count 0 or above', () => {
    expect(indicatedDeviation('hard-16-vs-10', 0)?.deviateTo).toBe('Stand')
    expect(indicatedDeviation('hard-16-vs-10', 3)?.deviateTo).toBe('Stand')
    expect(indicatedDeviation('hard-16-vs-10', -1)).toBeNull()
  })

  it('indicates standing on hard 15 vs 10 at true count +4 or above', () => {
    expect(indicatedDeviation('hard-15-vs-10', 3)).toBeNull()
    expect(indicatedDeviation('hard-15-vs-10', 4)?.deviateTo).toBe('Stand')
  })

  it('indicates doubling on hard 10 vs 10 at true count +4 or above', () => {
    expect(indicatedDeviation('hard-10-vs-10', 3)).toBeNull()
    expect(indicatedDeviation('hard-10-vs-10', 4)?.deviateTo).toBe('Double')
  })

  it('indicates standing on hard 12 vs 3 at true count +2 or above', () => {
    expect(indicatedDeviation('hard-12-vs-3', 1)).toBeNull()
    expect(indicatedDeviation('hard-12-vs-3', 2)?.deviateTo).toBe('Stand')
  })

  it('indicates standing on hard 12 vs 2 at true count +3 or above', () => {
    expect(indicatedDeviation('hard-12-vs-2', 2)).toBeNull()
    expect(indicatedDeviation('hard-12-vs-2', 3)?.deviateTo).toBe('Stand')
  })

  it('indicates doubling on hard 9 vs 2 at true count +1 or above', () => {
    expect(indicatedDeviation('hard-9-vs-2', 0)).toBeNull()
    expect(indicatedDeviation('hard-9-vs-2', 1)?.deviateTo).toBe('Double')
  })

  it('indicates doubling on hard 10 vs A at true count +4 or above', () => {
    expect(indicatedDeviation('hard-10-vs-A', 3)).toBeNull()
    expect(indicatedDeviation('hard-10-vs-A', 4)?.deviateTo).toBe('Double')
  })

  it('indicates doubling on hard 9 vs 7 at true count +3 or above', () => {
    expect(indicatedDeviation('hard-9-vs-7', 2)).toBeNull()
    expect(indicatedDeviation('hard-9-vs-7', 3)?.deviateTo).toBe('Double')
  })

  it('indicates standing on hard 16 vs 9 at true count +5 or above', () => {
    expect(indicatedDeviation('hard-16-vs-9', 4)).toBeNull()
    expect(indicatedDeviation('hard-16-vs-9', 5)?.deviateTo).toBe('Stand')
  })
})

describe('indicatedDeviation — negative-correlation entries (basic strategy is Stand; deviate to Hit once the count drops too low)', () => {
  it('indicates hitting on hard 13 vs 2 below true count -1 (not at exactly -1)', () => {
    expect(indicatedDeviation('hard-13-vs-2', -1)).toBeNull()
    expect(indicatedDeviation('hard-13-vs-2', -2)?.deviateTo).toBe('Hit')
  })

  it('indicates hitting on hard 12 vs 4 below true count 0', () => {
    expect(indicatedDeviation('hard-12-vs-4', 0)).toBeNull()
    expect(indicatedDeviation('hard-12-vs-4', -1)?.deviateTo).toBe('Hit')
  })

  it('indicates hitting on hard 12 vs 5 below true count -2', () => {
    expect(indicatedDeviation('hard-12-vs-5', -2)).toBeNull()
    expect(indicatedDeviation('hard-12-vs-5', -3)?.deviateTo).toBe('Hit')
  })

  it('indicates hitting on hard 12 vs 6 below true count -1', () => {
    expect(indicatedDeviation('hard-12-vs-6', -1)).toBeNull()
    expect(indicatedDeviation('hard-12-vs-6', -2)?.deviateTo).toBe('Hit')
  })

  it('indicates hitting on hard 13 vs 3 below true count -2', () => {
    expect(indicatedDeviation('hard-13-vs-3', -2)).toBeNull()
    expect(indicatedDeviation('hard-13-vs-3', -3)?.deviateTo).toBe('Hit')
  })
})

describe('indicatedDeviation — no defined index play', () => {
  it('returns null for situations with no defined index play', () => {
    expect(indicatedDeviation('hard-14-vs-9', 10)).toBeNull()
    expect(indicatedDeviation('soft-18-vs-9', 10)).toBeNull()
    expect(indicatedDeviation('pair-8-vs-10', 10)).toBeNull()
  })

  it('never returns a Split-valued entry (the two real Split deviations are deliberately excluded from this shared dataset)', () => {
    expect(INDEX_PLAYS.some((play) => play.deviateTo === 'Split')).toBe(false)
  })

  it('does not include a hard-11-vs-A entry (a no-op given this app\'s always-double-11 basic strategy)', () => {
    expect(INDEX_PLAYS.some((play) => play.situationKey === 'hard-11-vs-A')).toBe(false)
  })
})
