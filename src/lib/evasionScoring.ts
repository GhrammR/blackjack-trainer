import { isEvidenceRound } from './evidenceGrading'
import { COUNTER_PROFILES, baseBetUnits } from './playerProfiles'
import type { EvasionRoundRecord } from './evasionSession'

/**
 * Scoring for the evasion drill (v2 step 8 slice 4) — two separate axes,
 * not one blended grade, mirroring slice 3's precision/recall split. The
 * real tension in advantage play is exactly this trade-off: betting more
 * to capture edge is usually what creates heat in the first place.
 *
 * Heat: how many of the session's rounds would read as evidence to the
 * exact same classifier slice 3 uses (`isEvidenceRound`, unchanged). Since
 * there's no `PlayerProfile` here to define a "base" bet step, the user's
 * own lowest bet of the session stands in as their personal baseline —
 * any round bet above it is treated as elevated, the same way a real
 * observer has no way to know a player's "intended" baseline either.
 *
 * Edge captured: a bet-size x true-count proxy (not a real payout
 * simulation — deliberately simple per the user's confirmed scope),
 * benchmarked against what a flat bettor (always 1 unit) and an
 * aggressive, uncamouflaged counter (the beginner tier's bet-spread step
 * function, applied with no noise/cover) would have captured across the
 * exact same true-count trajectory this session actually produced.
 */

export function finalizeRounds(rounds: Omit<EvasionRoundRecord, 'isElevatedBet'>[]): EvasionRoundRecord[] {
  if (rounds.length === 0) return []
  const minBet = Math.min(...rounds.map((r) => r.bet))
  return rounds.map((r) => ({ ...r, isElevatedBet: r.bet > minBet }))
}

export interface EvasionScorecard {
  heat: number
  totalRounds: number
  rawEdgeScore: number
  flatEdgeScore: number
  aggressiveEdgeScore: number
  /** 0% = no better than flat betting, 100% = matched the aggressive uncamouflaged baseline. null when that baseline is degenerate (e.g. the count never moved). Can fall outside [0, 100]. */
  edgeCapturedPct: number | null
}

export function scoreSession(rounds: EvasionRoundRecord[]): EvasionScorecard {
  const heat = rounds.filter(isEvidenceRound).length

  const rawEdgeScore = rounds.reduce((sum, r) => sum + r.bet * r.trueCountAtBet, 0)
  const flatEdgeScore = rounds.reduce((sum, r) => sum + 1 * r.trueCountAtBet, 0)
  const aggressiveSpread = COUNTER_PROFILES.beginner.betSpread
  const aggressiveEdgeScore = rounds.reduce((sum, r) => sum + baseBetUnits(aggressiveSpread, r.trueCountAtBet) * r.trueCountAtBet, 0)

  const denom = aggressiveEdgeScore - flatEdgeScore
  const edgeCapturedPct = denom === 0 ? null : ((rawEdgeScore - flatEdgeScore) / denom) * 100

  return { heat, totalRounds: rounds.length, rawEdgeScore, flatEdgeScore, aggressiveEdgeScore, edgeCapturedPct }
}
