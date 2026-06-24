/**
 * Simulated player profiles for the counter-detection drill (v2 step 8).
 * Two real tells drive everything here: bet sizing that tracks the true
 * count, and strategy deviations that only show up at high counts. A flat
 * recreational player and a counter differ only in these tunable dials —
 * same engine, different parameters.
 */

export type DetectionDifficulty = 'beginner' | 'intermediate' | 'expert'

export interface BetSpreadStep {
  /** This bet size applies once the true count is at or above this. */
  minTrueCount: number
  units: number
}

export interface PlayerProfile {
  name: string
  isCounting: boolean
  /** Sorted ascending by minTrueCount; the first entry's minTrueCount should be -Infinity (the base bet). */
  betSpread: BetSpreadStep[]
  /** +/- random jitter added to every bet, win or lose — even flat bettors aren't perfectly robotic. */
  betNoiseUnits: number
  /** Probability a round's bet ignores the step function and uses a different step instead, as camouflage. */
  coverBetRate: number
  /** Probability of actually taking an indicated index play when the count calls for one. */
  deviationComplianceRate: number
  /** Probability of taking a Hit<->Stand deviation when NONE is indicated, as camouflage. */
  coverDeviationRate: number
}

export const FLAT_PROFILE: PlayerProfile = {
  name: 'Flat bettor',
  isCounting: false,
  betSpread: [{ minTrueCount: -Infinity, units: 1 }],
  betNoiseUnits: 0.5,
  coverBetRate: 0,
  deviationComplianceRate: 0,
  coverDeviationRate: 0,
}

export const COUNTER_PROFILES: Record<DetectionDifficulty, PlayerProfile> = {
  // Big, obvious step: 1 unit until the count turns positive, then straight to 8.
  beginner: {
    name: 'Obvious counter',
    isCounting: true,
    betSpread: [
      { minTrueCount: -Infinity, units: 1 },
      { minTrueCount: 2, units: 8 },
    ],
    betNoiseUnits: 0.5,
    coverBetRate: 0,
    deviationComplianceRate: 1,
    coverDeviationRate: 0,
  },
  // Smaller spread, higher trigger, less consistent compliance, more noise.
  intermediate: {
    name: 'Subtle counter',
    isCounting: true,
    betSpread: [
      { minTrueCount: -Infinity, units: 1 },
      { minTrueCount: 3, units: 4 },
    ],
    betNoiseUnits: 1,
    coverBetRate: 0,
    deviationComplianceRate: 0.7,
    coverDeviationRate: 0,
  },
  // Small spread, high trigger, real camouflage: cover bets, cover deviations, more noise.
  expert: {
    name: 'Camouflaged counter',
    isCounting: true,
    betSpread: [
      { minTrueCount: -Infinity, units: 1 },
      { minTrueCount: 4, units: 3 },
    ],
    betNoiseUnits: 1.5,
    coverBetRate: 0.15,
    deviationComplianceRate: 0.5,
    coverDeviationRate: 0.15,
  },
}

/** Exported for the evasion drill's baseline scoring (step 8 slice 4), which needs the same step-function logic to compute a reference bet for a given true count without going through a full PlayerProfile. */
export function baseBetUnits(betSpread: BetSpreadStep[], trueCountAtBet: number): number {
  let units = betSpread[0].units
  for (const step of betSpread) {
    if (trueCountAtBet >= step.minTrueCount) units = step.units
  }
  return units
}

export interface ComputedBet {
  units: number
  /** True when this round's bet deliberately ignored the step function as camouflage. */
  isCoverBet: boolean
  /**
   * True when the count-indicated step (before any cover-bet override) was above the
   * profile's base step — i.e. a real, uncamouflaged bet-size tell. Used by the
   * evidence-flagging drill (step 8 slice 3) as part of its ground truth for "this round
   * is evidence": a cover bet deliberately picks a *different* step than indicated, so it
   * is never elevated by this definition even if that different step happens to be higher
   * than base — camouflage is designed to not look like a tell.
   */
  isElevatedBet: boolean
}

/** Computes a round's bet from the profile and the true count as of the start of the round (before this round's cards are dealt). */
export function computeBet(profile: PlayerProfile, trueCountAtBet: number, random: () => number = Math.random): ComputedBet {
  const indicated = baseBetUnits(profile.betSpread, trueCountAtBet)
  const isElevatedBet = indicated > profile.betSpread[0].units

  let units = indicated
  let isCoverBet = false
  if (random() < profile.coverBetRate) {
    const alternatives = profile.betSpread.map((step) => step.units).filter((u) => u !== indicated)
    if (alternatives.length > 0) {
      units = alternatives[Math.floor(random() * alternatives.length)]
      isCoverBet = true
    }
  }

  const noise = (random() * 2 - 1) * profile.betNoiseUnits
  units = Math.max(1, Math.round(units + noise))

  return { units, isCoverBet, isElevatedBet: isElevatedBet && !isCoverBet }
}
