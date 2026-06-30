import type { CountingProgress } from './persistence'

export interface AchievementTiers {
  tier1: boolean
  tier2: boolean
  tier3: boolean
}

export interface Achievements {
  strategy: AchievementTiers
  runningCount: AchievementTiers
  trueCount: AchievementTiers
  shoeCountdown: AchievementTiers
  indexPlays: AchievementTiers
  counterDetection: AchievementTiers
  tableScan: AchievementTiers
  evidenceFlagging: AchievementTiers
  evasion: AchievementTiers
  livePlay: AchievementTiers
  /** Tier-1 and tier-2 earned in all four Counting Fundamentals modes. */
  fundamentalsComplete: boolean
  /** Tier-3 earned in all ten modes — the pinnacle achievement. */
  doubleDown: boolean
}

// Shoe Countdown speed thresholds (milliseconds), anchored to published
// counter-training benchmarks: ~30s single-deck = proficient, <90s 6-deck = ideal.
const SHOE_FAST_MS: Record<number, number> = {
  1: 30_000,
  2: 60_000,
  4: 100_000,
  6: 150_000,
  8: 200_000,
}

const SHOE_BLAZING_MS: Record<number, number> = {
  1: 20_000,
  2: 40_000,
  4: 75_000,
  6: 90_000,
  8: 130_000,
}

function rate(correct: number, total: number): number {
  return total === 0 ? 0 : correct / total
}

export function computeAchievements(
  strategySnapshot: { handsPlayed: number; currentStreak: number; lifetimeAccuracy: number },
  p: CountingProgress,
  numDecks: number,
): Achievements {
  // ── Strategy Trainer ─────────────────────────────────────────────────────────
  const strategy: AchievementTiers = {
    tier1: strategySnapshot.handsPlayed >= 1,
    tier2: strategySnapshot.handsPlayed >= 50 && strategySnapshot.lifetimeAccuracy >= 0.90,
    tier3: strategySnapshot.currentStreak >= 150,
  }

  // ── Running Count ─────────────────────────────────────────────────────────────
  const rc = p.runningCount
  const runningCount: AchievementTiers = {
    tier1: rc.roundsPlayed >= 1,
    tier2: rc.roundsPlayed >= 50 && rate(rc.roundsCorrect, rc.roundsPlayed) >= 0.85,
    tier3: rc.roundsPlayed >= 100 && rate(rc.roundsCorrect, rc.roundsPlayed) >= 0.95,
  }

  // ── True Count ────────────────────────────────────────────────────────────────
  const tc = p.trueCount
  const trueCount: AchievementTiers = {
    tier1: tc.roundsPlayed >= 1,
    tier2: tc.roundsPlayed >= 30 && rate(tc.goodEstimates, tc.roundsPlayed) >= 0.85,
    tier3:
      tc.roundsPlayed >= 75 &&
      rate(tc.goodEstimates, tc.roundsPlayed) >= 0.90 &&
      rate(tc.correctMath, tc.roundsPlayed) >= 0.90,
  }

  // ── Shoe Countdown ────────────────────────────────────────────────────────────
  const fastMs = SHOE_FAST_MS[numDecks] ?? SHOE_FAST_MS[6]
  const blazingMs = SHOE_BLAZING_MS[numDecks] ?? SHOE_BLAZING_MS[6]
  const best = p.shoeCountdown.personalBests[numDecks] ?? null
  const shoeCountdown: AchievementTiers = {
    tier1: best !== null,
    tier2: best !== null && best < fastMs,
    tier3: best !== null && best < blazingMs,
  }

  // ── Index Plays ───────────────────────────────────────────────────────────────
  const ip = p.indexPlays
  const indexPlays: AchievementTiers = {
    tier1: ip.attempts >= 1,
    tier2: ip.attempts >= 25 && rate(ip.correct, ip.attempts) >= 0.80,
    tier3: ip.attempts >= 75 && rate(ip.correct, ip.attempts) >= 0.90,
  }

  // ── Counter Detection ─────────────────────────────────────────────────────────
  const dt = p.detection
  const counterDetection: AchievementTiers = {
    tier1: dt.sessionsPlayed >= 1,
    tier2: dt.sessionsPlayed >= 10 && rate(dt.sessionsCorrect, dt.sessionsPlayed) >= 0.75,
    tier3: dt.sessionsPlayed >= 20 && rate(dt.sessionsCorrect, dt.sessionsPlayed) >= 0.90,
  }

  // ── Table Scan ────────────────────────────────────────────────────────────────
  const ts = p.tableScan
  const tableScan: AchievementTiers = {
    tier1: ts.sessionsPlayed >= 1,
    tier2: ts.sessionsPlayed >= 10 && rate(ts.sessionsCorrect, ts.sessionsPlayed) >= 0.75,
    tier3: ts.sessionsPlayed >= 20 && rate(ts.sessionsCorrect, ts.sessionsPlayed) >= 0.90,
  }

  // ── Evidence Flagging ─────────────────────────────────────────────────────────
  const ev = p.evidence
  const evidenceFlagging: AchievementTiers = {
    tier1: ev.sessionsPlayed >= 1,
    tier2: ev.sessionsPlayed >= 10 && rate(ev.sessionsCorrect, ev.sessionsPlayed) >= 0.75,
    tier3: ev.sessionsPlayed >= 20 && rate(ev.sessionsCorrect, ev.sessionsPlayed) >= 0.90,
  }

  // ── Evasion ───────────────────────────────────────────────────────────────────
  const ea = p.evasion
  const evasion: AchievementTiers = {
    tier1: ea.sessionsPlayed >= 1,
    tier2: ea.bestEdgeCapturedPct !== null && ea.bestEdgeCapturedPct >= 50,
    tier3:
      ea.bestEdgeCapturedPct !== null &&
      ea.bestEdgeCapturedPct >= 70 &&
      ea.lowestHeat !== null &&
      ea.lowestHeat <= 2,
  }

  // ── Live Play ─────────────────────────────────────────────────────────────────
  const lp = p.livePlay
  const livePlay: AchievementTiers = {
    tier1: lp.playAttempts >= 1,
    tier2:
      lp.playAttempts >= 50 &&
      rate(lp.playCorrect, lp.playAttempts) >= 0.80 &&
      rate(lp.countCorrect, lp.countAttempts) >= 0.80,
    tier3:
      lp.playAttempts >= 100 &&
      rate(lp.playCorrect, lp.playAttempts) >= 0.80 &&
      rate(lp.countCorrect, lp.countAttempts) >= 0.80 &&
      rate(lp.trueCountCorrect, lp.trueCountAttempts) >= 0.80 &&
      rate(lp.betCorrect, lp.betAttempts) >= 0.80,
  }

  // ── Curriculum ────────────────────────────────────────────────────────────────
  const countingModes = [runningCount, trueCount, shoeCountdown, indexPlays]
  const fundamentalsComplete = countingModes.every((m) => m.tier1 && m.tier2)

  const allModes = [
    strategy, runningCount, trueCount, shoeCountdown, indexPlays,
    counterDetection, tableScan, evidenceFlagging, evasion, livePlay,
  ]
  const doubleDown = allModes.every((m) => m.tier3)

  return {
    strategy,
    runningCount,
    trueCount,
    shoeCountdown,
    indexPlays,
    counterDetection,
    tableScan,
    evidenceFlagging,
    evasion,
    livePlay,
    fundamentalsComplete,
    doubleDown,
  }
}
