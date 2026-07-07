import type { CountingProgress, CountingState, PersistedState } from './persistence'
import type { PersonalBests } from './shoeCountdown'
import { lifetimeAccuracy } from './mastery'
import { formatPace, formatSeconds } from './format'

/**
 * Copy/paste plain-text training-log export (for pasting into an external
 * log like iTrak). Every number here comes from data the app already
 * tracks (`PersistedState`/`CountingProgress`) — no new drill logic, no
 * restructuring of existing persisted shapes.
 *
 * The app is lifetime-cumulative only; there's no built-in notion of "this
 * session." `SessionBaseline` is a snapshot of the lifetime counters taken
 * when the user clicks "Start New Session" (`GlobalSettingsModal.tsx`), and
 * `buildTrainingLogText` reports the delta between the current lifetime
 * numbers and that snapshot. If no baseline has been captured, deltas fall
 * back to the full lifetime totals — the header text always says which one
 * you're looking at, so it's never ambiguous which numbers you're pasting.
 *
 * Personal bests (Shoe Countdown pace/time, Evasion's edge/heat) are always
 * shown as the current lifetime record, since "best" is inherently a
 * lifetime concept — the export doesn't flag whether a record was newly set
 * this session (deliberately dropped; the pasted-in log is stripped of that
 * kind of session framing anyway).
 */

const SESSION_BASELINE_KEY = 'double-down:sessionBaseline:v1'

export interface SessionBaseline {
  strategy: { attempts: number; correct: number }
  counting: CountingProgress
}

export function captureSessionBaseline(v1: PersistedState, counting: CountingState): SessionBaseline {
  const { attempts, correct } = lifetimeAccuracy(v1.stats)
  return { strategy: { attempts, correct }, counting: counting.progress }
}

export function saveSessionBaseline(baseline: SessionBaseline): void {
  try {
    localStorage.setItem(SESSION_BASELINE_KEY, JSON.stringify(baseline))
  } catch {
    // Quota exceeded or storage unavailable — session tracking just won't persist this time.
  }
}

export function loadSessionBaseline(): SessionBaseline | null {
  try {
    const raw = localStorage.getItem(SESSION_BASELINE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !parsed.strategy || !parsed.counting) return null
    return parsed as SessionBaseline
  } catch {
    return null
  }
}

export function clearSessionBaseline(): void {
  try {
    localStorage.removeItem(SESSION_BASELINE_KEY)
  } catch {
    // ignore
  }
}

// ── Formatting helpers ───────────────────────────────────────────────────────

function pctStr(correct: number, attempts: number): string {
  return attempts === 0 ? '—' : `${((correct / attempts) * 100).toFixed(1)}%`
}

function delta(current: number, base: number): number {
  return current - base
}

/**
 * Per-deck-size personal-best list showing BOTH pace and total time, e.g.
 * "1-deck: 2.10 cards/sec (24.76s), 6-deck: 1.80 cards/sec (28.89s)". Each
 * entry stores the exact `{ ms, cards }` dealt that run (card counts vary
 * run to run in both Shoe Countdown formats), so pace is derived precisely
 * rather than assumed.
 */
function formatBestsList(current: PersonalBests): string {
  const entries = Object.entries(current)
    .map(([decks, best]) => [Number(decks), best] as const)
    .sort((a, b) => a[0] - b[0])
  if (entries.length === 0) return '—'
  return entries
    .map(([decks, best]) => `${decks}-deck: ${formatPace(best.ms / best.cards)} (${formatSeconds(best.ms)})`)
    .join(', ')
}

// ── Per-mode block builders ─────────────────────────────────────────────────
// Each returns null when the mode saw no activity in the reported window
// (session delta, or lifetime totals when there's no baseline), so the
// export only includes modes actually trained.

function strategyBlock(v1: PersistedState, baselineStrategy: { attempts: number; correct: number }): string | null {
  const { attempts, correct } = lifetimeAccuracy(v1.stats)
  const sessionAttempts = delta(attempts, baselineStrategy.attempts)
  const sessionCorrect = delta(correct, baselineStrategy.correct)
  if (sessionAttempts <= 0) return null
  return `Basic Strategy — practicing correct hit/stand/double/split/surrender decisions for every hand — hands: ${sessionAttempts}, correct: ${sessionCorrect}, accuracy: ${pctStr(sessionCorrect, sessionAttempts)}, current streak: ${v1.currentStreak}`
}

function roundsBlock(
  label: string,
  current: { roundsPlayed: number; roundsCorrect: number },
  base: { roundsPlayed: number; roundsCorrect: number },
): string | null {
  const played = delta(current.roundsPlayed, base.roundsPlayed)
  const correct = delta(current.roundsCorrect, base.roundsCorrect)
  if (played <= 0) return null
  return `${label} — rounds: ${played}, correct: ${correct}, accuracy: ${pctStr(correct, played)}`
}

function trueCountBlock(current: CountingProgress['trueCount'], base: CountingProgress['trueCount']): string | null {
  const played = delta(current.roundsPlayed, base.roundsPlayed)
  if (played <= 0) return null
  const goodEstimates = delta(current.goodEstimates, base.goodEstimates)
  const correctMath = delta(current.correctMath, base.correctMath)
  return `True Count — converting the running count to a true count by estimating decks remaining — scenarios: ${played}, good estimates: ${pctStr(goodEstimates, played)}, correct math: ${pctStr(correctMath, played)}`
}

function shoeCountdownBlocks(
  current: CountingProgress['shoeCountdown'],
  base: CountingProgress['shoeCountdown'],
): string[] {
  const lines: string[] = []

  const fcAttempts = delta(current.fullCountdown.attempts, base.fullCountdown.attempts)
  if (fcAttempts > 0) {
    const fcCorrect = delta(current.fullCountdown.correct, base.fullCountdown.correct)
    lines.push(
      `Shoe Countdown (Full Countdown) — speed-counting down a fixed-length deal (longer at bigger shoe sizes, never a zero answer) as fast as possible — attempts: ${fcAttempts}, correct: ${fcCorrect}, accuracy: ${pctStr(fcCorrect, fcAttempts)}, best pace/time: ${formatBestsList(current.fullCountdown.personalBests)}`,
    )
  }

  const mcAttempts = delta(current.missingCards.attempts, base.missingCards.attempts)
  if (mcAttempts > 0) {
    const mcCorrect = delta(current.missingCards.correct, base.missingCards.correct)
    lines.push(
      `Shoe Countdown (Missing Cards) — counting down a shoe with cards secretly removed, to find what's missing — attempts: ${mcAttempts}, correct: ${mcCorrect}, accuracy: ${pctStr(mcCorrect, mcAttempts)}, best pace/time: ${formatBestsList(current.missingCards.personalBests)}`,
    )
  }

  return lines
}

function indexPlaysBlock(current: CountingProgress['indexPlays'], base: CountingProgress['indexPlays']): string | null {
  const attempts = delta(current.attempts, base.attempts)
  if (attempts <= 0) return null
  const correct = delta(current.correct, base.correct)
  return `Index Plays — practicing count-based deviations from basic strategy (the Illustrious 18) — attempts: ${attempts}, correct: ${correct}, accuracy: ${pctStr(correct, attempts)}`
}

function sessionsBlock(
  label: string,
  current: { sessionsPlayed: number; sessionsCorrect: number },
  base: { sessionsPlayed: number; sessionsCorrect: number },
): string | null {
  const played = delta(current.sessionsPlayed, base.sessionsPlayed)
  if (played <= 0) return null
  const correct = delta(current.sessionsCorrect, base.sessionsCorrect)
  return `${label} — sessions: ${played}, correct: ${correct}, accuracy: ${pctStr(correct, played)}`
}

function evasionBlock(current: CountingProgress['evasion'], base: CountingProgress['evasion']): string | null {
  const played = delta(current.sessionsPlayed, base.sessionsPlayed)
  if (played <= 0) return null

  const edgeStr = current.bestEdgeCapturedPct === null ? '—' : `${Math.round(current.bestEdgeCapturedPct)}%`
  const heatStr = current.lowestHeat === null ? '—' : `${current.lowestHeat}`

  return `Evasion — playing the counter's seat directly to see how bet sizing and deviations read to a detector — sessions: ${played}, best edge captured: ${edgeStr}, lowest heat: ${heatStr}`
}

function livePlayBlock(current: CountingProgress['livePlay'], base: CountingProgress['livePlay']): string | null {
  const playAttempts = delta(current.playAttempts, base.playAttempts)
  if (playAttempts <= 0) return null
  const playCorrect = delta(current.playCorrect, base.playCorrect)
  const countAttempts = delta(current.countAttempts, base.countAttempts)
  const countCorrect = delta(current.countCorrect, base.countCorrect)
  const trueCountAttempts = delta(current.trueCountAttempts, base.trueCountAttempts)
  const trueCountCorrect = delta(current.trueCountCorrect, base.trueCountCorrect)
  const betAttempts = delta(current.betAttempts, base.betAttempts)
  const betCorrect = delta(current.betCorrect, base.betCorrect)

  return (
    `Live Play — playing full hands while keeping the running count, true count, and bet sizing live — plays: ${playAttempts}/${playCorrect} (${pctStr(playCorrect, playAttempts)}), ` +
    `count: ${pctStr(countCorrect, countAttempts)}, true count: ${pctStr(trueCountCorrect, trueCountAttempts)}, ` +
    `bet sizing: ${pctStr(betCorrect, betAttempts)}`
  )
}

// ── Assembly ─────────────────────────────────────────────────────────────────

export function buildTrainingLogText(
  v1: PersistedState,
  counting: CountingState,
  baseline: SessionBaseline | null,
  options: { includeHeader?: boolean } = {},
): string {
  const includeHeader = options.includeHeader ?? true
  const baseStrategy = baseline?.strategy ?? { attempts: 0, correct: 0 }
  const baseCounting = baseline?.counting ?? {
    runningCount: { roundsPlayed: 0, roundsCorrect: 0 },
    trueCount: { roundsPlayed: 0, goodEstimates: 0, correctMath: 0 },
    shoeCountdown: {
      fullCountdown: { personalBests: {}, attempts: 0, correct: 0 },
      missingCards: { personalBests: {}, attempts: 0, correct: 0 },
    },
    detection: { sessionsPlayed: 0, sessionsCorrect: 0 },
    tableScan: { sessionsPlayed: 0, sessionsCorrect: 0 },
    evidence: { sessionsPlayed: 0, sessionsCorrect: 0 },
    evasion: { sessionsPlayed: 0, bestEdgeCapturedPct: null, lowestHeat: null },
    indexPlays: { attempts: 0, correct: 0 },
    livePlay: {
      playAttempts: 0, playCorrect: 0, countAttempts: 0, countCorrect: 0,
      trueCountAttempts: 0, trueCountCorrect: 0, betAttempts: 0, betCorrect: 0,
    },
  }

  const p = counting.progress

  const lines: string[] = [
    strategyBlock(v1, baseStrategy),
    roundsBlock(
      'Running Count — tracking the Hi-Lo running count live across a multi-seat table',
      p.runningCount,
      baseCounting.runningCount,
    ),
    trueCountBlock(p.trueCount, baseCounting.trueCount),
    ...shoeCountdownBlocks(p.shoeCountdown, baseCounting.shoeCountdown),
    indexPlaysBlock(p.indexPlays, baseCounting.indexPlays),
    sessionsBlock(
      'Counter Detection — judging whether a single observed player is counting cards',
      p.detection,
      baseCounting.detection,
    ),
    sessionsBlock(
      'Table Scan — scanning every seat at a table at once to find the one counter',
      p.tableScan,
      baseCounting.tableScan,
    ),
    sessionsBlock(
      'Evidence Flagging — flagging specific rounds as counting evidence from bet spread and strategy deviations',
      p.evidence,
      baseCounting.evidence,
    ),
    evasionBlock(p.evasion, baseCounting.evasion),
    livePlayBlock(p.livePlay, baseCounting.livePlay),
  ].filter((line): line is string => line !== null)

  const header = baseline
    ? 'Training Log — since session start'
    : 'Training Log — lifetime totals (no session started)'

  const body = lines.length === 0 ? 'No activity recorded yet.' : lines.join('\n')

  return includeHeader ? `${header}\n\n${body}` : body
}
