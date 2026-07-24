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
  twoBets: AchievementTiers
  /** Tier-1 and tier-2 earned in all four Counting Fundamentals modes. */
  fundamentalsComplete: boolean
  /** Tier-3 earned in all eleven modes — the pinnacle achievement. */
  doubleDown: boolean
}

// Shoe Countdown's "Full countdown" format scores by PACE (ms per card
// actually dealt), not raw completion time — see shoeCountdown.ts for why.
// Pace is deck-size-independent by construction, so unlike the old
// per-deck-count ms tables this replaced, a single flat cutoff applies at
// every shoe size: ~2 cards/sec is proficient, ~2.86 cards/sec (350ms/card)
// is the "blazing" ceiling.
const SHOE_FAST_PACE_MS = 500
const SHOE_BLAZING_PACE_MS = 350

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
  // Tiers are based on the "Full countdown" format's best pace only —
  // "Missing cards" tracks its own attempts/correct/personal-best but
  // doesn't feed these tiers yet (deliberately deferred to a later pass).
  // Full Countdown's deal length (and therefore its personal best) is keyed by deck size — see
  // shoeCountdown.ts — so achievements are evaluated against the current deck-size setting's record.
  const bestEntry = p.shoeCountdown.fullCountdown.personalBests[numDecks]
  const bestPace = bestEntry !== undefined ? bestEntry.ms / bestEntry.cards : null
  const shoeCountdown: AchievementTiers = {
    tier1: bestPace !== null,
    tier2: bestPace !== null && bestPace < SHOE_FAST_PACE_MS,
    tier3: bestPace !== null && bestPace < SHOE_BLAZING_PACE_MS,
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

  // ── Two Bets in a Circle ──────────────────────────────────────────────────────
  const tb = p.twoBets
  const twoBets: AchievementTiers = {
    tier1: tb.attempts >= 1,
    tier2: tb.attempts >= 25 && rate(tb.correct, tb.attempts) >= 0.80,
    tier3: tb.attempts >= 75 && rate(tb.correct, tb.attempts) >= 0.90,
  }

  // ── Curriculum ────────────────────────────────────────────────────────────────
  const countingModes = [runningCount, trueCount, shoeCountdown, indexPlays]
  const fundamentalsComplete = countingModes.every((m) => m.tier1 && m.tier2)

  const allModes = [
    strategy, runningCount, trueCount, shoeCountdown, indexPlays,
    counterDetection, tableScan, evidenceFlagging, evasion, livePlay, twoBets,
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
    twoBets,
    fundamentalsComplete,
    doubleDown,
  }
}
