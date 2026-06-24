import { describe, expect, it } from 'vitest'
import { COUNTER_PROFILES, FLAT_PROFILE, type PlayerProfile, computeBet } from './playerProfiles'

describe('profile presets', () => {
  it('flat bettor is not counting and has no spread, no cover, no deviations', () => {
    expect(FLAT_PROFILE.isCounting).toBe(false)
    expect(FLAT_PROFILE.betSpread).toEqual([{ minTrueCount: -Infinity, units: 1 }])
    expect(FLAT_PROFILE.coverBetRate).toBe(0)
    expect(FLAT_PROFILE.deviationComplianceRate).toBe(0)
  })

  it('counter tiers escalate camouflage from beginner to expert', () => {
    expect(COUNTER_PROFILES.beginner.coverBetRate).toBe(0)
    expect(COUNTER_PROFILES.beginner.deviationComplianceRate).toBe(1)
    expect(COUNTER_PROFILES.expert.coverBetRate).toBeGreaterThan(0)
    expect(COUNTER_PROFILES.expert.coverDeviationRate).toBeGreaterThan(0)
    expect(COUNTER_PROFILES.expert.deviationComplianceRate).toBeLessThan(COUNTER_PROFILES.beginner.deviationComplianceRate)
  })

  it('every counter tier spreads less and triggers later than the obvious beginner tier, or is at least as camouflaged', () => {
    const spreadRatio = (p: PlayerProfile) => {
      const units = p.betSpread.map((s) => s.units)
      return Math.max(...units) / Math.min(...units)
    }
    expect(spreadRatio(COUNTER_PROFILES.intermediate)).toBeLessThan(spreadRatio(COUNTER_PROFILES.beginner))
    expect(spreadRatio(COUNTER_PROFILES.expert)).toBeLessThan(spreadRatio(COUNTER_PROFILES.intermediate))
  })
})

describe('computeBet', () => {
  it('returns the base unit below the spread threshold, with zero noise at the midpoint random draw', () => {
    const result = computeBet(COUNTER_PROFILES.beginner, -5, () => 0.5)
    expect(result).toEqual({ units: 1, isCoverBet: false, isElevatedBet: false })
  })

  it('jumps to the higher step once the true count meets the threshold (boundary-exact), and that jump is flagged as an elevated (real) bet', () => {
    expect(computeBet(COUNTER_PROFILES.beginner, 1, () => 0.5)).toEqual({ units: 1, isCoverBet: false, isElevatedBet: false })
    expect(computeBet(COUNTER_PROFILES.beginner, 2, () => 0.5)).toEqual({ units: 8, isCoverBet: false, isElevatedBet: true })
  })

  it('never triggers a cover bet when coverBetRate is 0, regardless of the random draw', () => {
    expect(computeBet(FLAT_PROFILE, 5, () => 0).isCoverBet).toBe(false)
    expect(computeBet(COUNTER_PROFILES.beginner, 5, () => 0).isCoverBet).toBe(false)
  })

  it('can trigger a cover bet that picks a different step than the count indicates, and a cover bet is never flagged as elevated', () => {
    const result = computeBet(COUNTER_PROFILES.expert, -5, () => 0)
    expect(result.isCoverBet).toBe(true)
    expect(result.units).not.toBe(1) // the indicated (uncamouflaged) base unit at TC -5
    expect(result.isElevatedBet).toBe(false) // camouflage is designed not to look like a tell
  })

  it('a flat (single-step) profile is never flagged as an elevated bet, at any true count', () => {
    expect(computeBet(FLAT_PROFILE, -10, () => 0.5).isElevatedBet).toBe(false)
    expect(computeBet(FLAT_PROFILE, 10, () => 0.5).isElevatedBet).toBe(false)
  })

  it('clamps the final bet at a minimum of 1 unit even under maximum negative noise', () => {
    const profile: PlayerProfile = {
      name: 'test',
      isCounting: false,
      betSpread: [{ minTrueCount: -Infinity, units: 1 }],
      betNoiseUnits: 5,
      coverBetRate: 0,
      deviationComplianceRate: 0,
      coverDeviationRate: 0,
    }
    expect(computeBet(profile, 0, () => 0).units).toBe(1)
  })
})
