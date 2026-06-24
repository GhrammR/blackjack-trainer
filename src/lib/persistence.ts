import type { Stats } from './adaptiveEngine'
import type { PersonalBests } from './shoeCountdown'

const STORAGE_KEY = 'double-down:v1'

export interface PersistedState {
  stats: Stats
  handsPlayed: number
  currentStreak: number
}

const DEFAULT_STATE: PersistedState = {
  stats: {},
  handsPlayed: 0,
  currentStreak: 0,
}

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_STATE

    return {
      stats: typeof parsed.stats === 'object' && parsed.stats !== null ? parsed.stats : {},
      handsPlayed: typeof parsed.handsPlayed === 'number' ? parsed.handsPlayed : 0,
      currentStreak: typeof parsed.currentStreak === 'number' ? parsed.currentStreak : 0,
    }
  } catch {
    // Corrupt JSON, or localStorage unavailable (privacy mode, etc.) — start fresh.
    return DEFAULT_STATE
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Quota exceeded or storage unavailable — progress just won't persist this time.
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * v2 Card Counting settings + progress (step 6). Kept as a separate storage
 * key/shape from the v1 strategy trainer's PersistedState so "reset progress"
 * in the counting settings panel can clear counting progress without
 * touching the unrelated strategy-trainer streak/stats — see CLAUDE.md §11.
 */

const COUNTING_STORAGE_KEY = 'double-down:counting:v1'

export interface CountingSettings {
  numDecks: number
  seatCount: number
  cardsPerSecond: number
}

export interface CountingProgress {
  runningCount: { roundsPlayed: number; roundsCorrect: number }
  trueCount: { roundsPlayed: number; goodEstimates: number; correctMath: number }
  shoeCountdown: { personalBests: PersonalBests }
  detection: { sessionsPlayed: number; sessionsCorrect: number }
  tableScan: { sessionsPlayed: number; sessionsCorrect: number }
  evidence: { sessionsPlayed: number; sessionsCorrect: number }
  /** No single "correct" outcome here (it's a continuous heat/edge trade-off, not a verdict) — tracked as lifetime sessions plus personal bests instead, same pattern as Shoe Countdown. */
  evasion: { sessionsPlayed: number; bestEdgeCapturedPct: number | null; lowestHeat: number | null }
  indexPlays: { attempts: number; correct: number }
}

export interface CountingState {
  settings: CountingSettings
  progress: CountingProgress
}

const DEFAULT_COUNTING_SETTINGS: CountingSettings = {
  numDecks: 6,
  seatCount: 4,
  cardsPerSecond: 2,
}

const DEFAULT_COUNTING_PROGRESS: CountingProgress = {
  runningCount: { roundsPlayed: 0, roundsCorrect: 0 },
  trueCount: { roundsPlayed: 0, goodEstimates: 0, correctMath: 0 },
  shoeCountdown: { personalBests: {} },
  detection: { sessionsPlayed: 0, sessionsCorrect: 0 },
  tableScan: { sessionsPlayed: 0, sessionsCorrect: 0 },
  evidence: { sessionsPlayed: 0, sessionsCorrect: 0 },
  evasion: { sessionsPlayed: 0, bestEdgeCapturedPct: null, lowestHeat: null },
  indexPlays: { attempts: 0, correct: 0 },
}

const DEFAULT_COUNTING_STATE: CountingState = {
  settings: DEFAULT_COUNTING_SETTINGS,
  progress: DEFAULT_COUNTING_PROGRESS,
}

function isRecordOfNumbers(value: unknown): value is Record<number, number> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseSettings(raw: unknown): CountingSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_COUNTING_SETTINGS
  const r = raw as Record<string, unknown>
  return {
    numDecks: typeof r.numDecks === 'number' ? r.numDecks : DEFAULT_COUNTING_SETTINGS.numDecks,
    seatCount: typeof r.seatCount === 'number' ? r.seatCount : DEFAULT_COUNTING_SETTINGS.seatCount,
    cardsPerSecond: typeof r.cardsPerSecond === 'number' ? r.cardsPerSecond : DEFAULT_COUNTING_SETTINGS.cardsPerSecond,
  }
}

function parseProgress(raw: unknown): CountingProgress {
  if (!raw || typeof raw !== 'object') return DEFAULT_COUNTING_PROGRESS
  const r = raw as Record<string, unknown>

  const rc = (r.runningCount ?? {}) as Record<string, unknown>
  const tc = (r.trueCount ?? {}) as Record<string, unknown>
  const sc = (r.shoeCountdown ?? {}) as Record<string, unknown>
  const dt = (r.detection ?? {}) as Record<string, unknown>
  const ts = (r.tableScan ?? {}) as Record<string, unknown>
  const ev = (r.evidence ?? {}) as Record<string, unknown>
  const ea = (r.evasion ?? {}) as Record<string, unknown>
  const ip = (r.indexPlays ?? {}) as Record<string, unknown>
  const personalBests = sc.personalBests

  return {
    runningCount: {
      roundsPlayed: typeof rc.roundsPlayed === 'number' ? rc.roundsPlayed : 0,
      roundsCorrect: typeof rc.roundsCorrect === 'number' ? rc.roundsCorrect : 0,
    },
    trueCount: {
      roundsPlayed: typeof tc.roundsPlayed === 'number' ? tc.roundsPlayed : 0,
      goodEstimates: typeof tc.goodEstimates === 'number' ? tc.goodEstimates : 0,
      correctMath: typeof tc.correctMath === 'number' ? tc.correctMath : 0,
    },
    shoeCountdown: {
      personalBests: isRecordOfNumbers(personalBests) ? (personalBests as PersonalBests) : {},
    },
    detection: {
      sessionsPlayed: typeof dt.sessionsPlayed === 'number' ? dt.sessionsPlayed : 0,
      sessionsCorrect: typeof dt.sessionsCorrect === 'number' ? dt.sessionsCorrect : 0,
    },
    tableScan: {
      sessionsPlayed: typeof ts.sessionsPlayed === 'number' ? ts.sessionsPlayed : 0,
      sessionsCorrect: typeof ts.sessionsCorrect === 'number' ? ts.sessionsCorrect : 0,
    },
    evidence: {
      sessionsPlayed: typeof ev.sessionsPlayed === 'number' ? ev.sessionsPlayed : 0,
      sessionsCorrect: typeof ev.sessionsCorrect === 'number' ? ev.sessionsCorrect : 0,
    },
    evasion: {
      sessionsPlayed: typeof ea.sessionsPlayed === 'number' ? ea.sessionsPlayed : 0,
      bestEdgeCapturedPct: typeof ea.bestEdgeCapturedPct === 'number' ? ea.bestEdgeCapturedPct : null,
      lowestHeat: typeof ea.lowestHeat === 'number' ? ea.lowestHeat : null,
    },
    indexPlays: {
      attempts: typeof ip.attempts === 'number' ? ip.attempts : 0,
      correct: typeof ip.correct === 'number' ? ip.correct : 0,
    },
  }
}

export function loadCountingState(): CountingState {
  try {
    const raw = localStorage.getItem(COUNTING_STORAGE_KEY)
    if (!raw) return DEFAULT_COUNTING_STATE

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_COUNTING_STATE

    return {
      settings: parseSettings(parsed.settings),
      progress: parseProgress(parsed.progress),
    }
  } catch {
    return DEFAULT_COUNTING_STATE
  }
}

export function saveCountingState(state: CountingState): void {
  try {
    localStorage.setItem(COUNTING_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Quota exceeded or storage unavailable — progress just won't persist this time.
  }
}

/** Resets progress (personal bests + round history) to defaults while leaving `settings` untouched. */
export function resetCountingProgress(state: CountingState): CountingState {
  return { settings: state.settings, progress: DEFAULT_COUNTING_PROGRESS }
}
