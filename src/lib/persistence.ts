import type { Stats } from './adaptiveEngine'
import type { PersonalBests, ShoeCountdownTotals } from './shoeCountdown'
import { DEAL_SPEEDS, type DealSpeed } from './dealSpeed'
import type { Soft17Rule, SurrenderMode } from './strategy'

const STORAGE_KEY = 'double-down:v1'

export interface PersistedState {
  stats: Stats
  handsPlayed: number
  currentStreak: number
  bestStreak: number
}

const DEFAULT_STATE: PersistedState = {
  stats: {},
  handsPlayed: 0,
  currentStreak: 0,
  bestStreak: 0,
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
      // Added after currentStreak — a state saved by an older app version
      // won't have it, so default to currentStreak itself (never less than
      // the best actually achieved) rather than 0, which would understate
      // an existing streak-in-progress as a "new" record the next time it grows.
      bestStreak: typeof parsed.bestStreak === 'number'
        ? parsed.bestStreak
        : (typeof parsed.currentStreak === 'number' ? parsed.currentStreak : 0),
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

// Exported so App.tsx's cross-tab `storage` event listener can filter to
// exactly this key (see App.tsx's sync effect for why that listener exists).
export const COUNTING_STORAGE_KEY = 'double-down:counting:v1'

export interface CountingSettings {
  numDecks: number
  seatCount: number
  /** Timed auto-deal pace for Running Count (the one mode that deals cards on a timer). */
  dealSpeed: DealSpeed
  /**
   * The full rule matrix (deck size × soft-17 rule × surrender mode × DAS),
   * applied to both Basic Strategy (grading) and Live Play via
   * strategy.ts's resolveHardTotals/resolveSoftTotals/resolvePairs — see
   * strategy.ts and livePlaySession.ts. `numDecks` above doubles as the
   * chart's deck-size axis (it already ranges over exactly {1, 2, 6}, the
   * only three sizes this app's charts are sourced for — see shoe.ts's
   * SHOE_SIZE_OPTIONS). Default H17/none/DAS-on, matching the base chart
   * already proven correct by the chart-reference test.
   */
  soft17Rule: Soft17Rule
  surrenderMode: SurrenderMode
  /** Double after split. Default true — existing/current behavior. */
  das: boolean
  /**
   * Max hands reachable by repeated splitting of one dealt pair — see
   * strategy.ts's `RuleConfig.maxSplitHands`/`effectiveMaxSplitHands`.
   * Sourced values are 4 (6-deck configs) and 2 (double-deck); typed as
   * `number` (not a union) so a future sourced value is just a new number,
   * not a type change. `parseSettings` clamps to [MIN_SPLIT_HANDS,
   * MAX_SPLIT_HANDS] and falls back to the default on anything absent or
   * out of range.
   */
  maxSplitHands: number
  /**
   * The bankroll amount a "Reset Bankroll" action restores (chip wager
   * system, shared by Basic Strategy and Live Play — see
   * livePlaySession.ts's handPayout/roundPayout). Changing this does NOT
   * retroactively touch the live `CountingState.bankroll` below — only a
   * reset applies it, same as any other "starting value" setting.
   */
  startingBankroll: number
}

/**
 * Two independent formats (Feature B, v2), both storing `{ ms, cards }`
 * personal-best entries (see `PersonalBestEntry` in shoeCountdown.ts) keyed
 * by deck size, plus lifetime attempts/correct. Both formats' card counts
 * depend on the deck-size setting — "Full countdown" deals a fixed-per-size
 * slice that scales with deck size (short at 1-deck, long at 6-deck — see
 * shoeCountdown.ts); "Missing cards" deals the whole shoe minus 1-2 removed
 * cards. Personal bests are only comparable within the same deck size for
 * either format, hence the per-deck-size keying.
 */
export interface ShoeCountdownProgress {
  fullCountdown: { personalBests: PersonalBests; totals: ShoeCountdownTotals; attempts: number; correct: number }
  missingCards: { personalBests: PersonalBests; totals: ShoeCountdownTotals; attempts: number; correct: number }
}

export interface CountingProgress {
  runningCount: { roundsPlayed: number; roundsCorrect: number }
  trueCount: { roundsPlayed: number; goodEstimates: number; correctMath: number }
  shoeCountdown: ShoeCountdownProgress
  detection: { sessionsPlayed: number; sessionsCorrect: number }
  tableScan: { sessionsPlayed: number; sessionsCorrect: number }
  evidence: { sessionsPlayed: number; sessionsCorrect: number }
  /** No single "correct" outcome here (it's a continuous heat/edge trade-off, not a verdict) — tracked as lifetime sessions plus personal bests instead, same pattern as Shoe Countdown. */
  evasion: { sessionsPlayed: number; bestEdgeCapturedPct: number | null; lowestHeat: number | null }
  /**
   * `perDeviation` mirrors Basic Strategy's per-situation `Stats` (see
   * adaptiveEngine.ts) but keyed by the 14 `INDEX_PLAYS` situationKeys only
   * — it's what powers the Index Play weakness chart. Every scenario whose
   * situationKey matches one of those 14 (whether or not the count actually
   * triggered a deviation that round) counts toward that key's attempts, so
   * both taking a real deviation and correctly resisting a false one are
   * graded the same situation.
   */
  indexPlays: { attempts: number; correct: number; perDeviation: Record<string, { attempts: number; correct: number }> }
  /**
   * Four independent stats: play accuracy, running-count accuracy,
   * true-count math accuracy (step 10 slice 2), and (step 10 slice 3)
   * bet-sizing-for-EV accuracy. Conceptually the same split the True Count
   * drill uses for estimate/math — playing, counting, converting to true
   * count, and sizing a bet are four different skills.
   */
  livePlay: {
    playAttempts: number
    playCorrect: number
    countAttempts: number
    countCorrect: number
    trueCountAttempts: number
    trueCountCorrect: number
    betAttempts: number
    betCorrect: number
  }
}

export interface CountingState {
  settings: CountingSettings
  progress: CountingProgress
  /**
   * Live chip total, shared across Basic Strategy and Live Play (both
   * settle it via livePlaySession.ts's roundPayout at the end of each
   * round) — a sibling of settings/progress, not nested under either,
   * since it's neither a per-mode setting nor a per-mode progress stat.
   */
  bankroll: number
}

const DEFAULT_COUNTING_SETTINGS: CountingSettings = {
  numDecks: 6,
  seatCount: 4,
  dealSpeed: 'medium',
  soft17Rule: 'H17',
  surrenderMode: 'none',
  das: true,
  maxSplitHands: 4,
  startingBankroll: 1000,
}

/** Sanity bounds for `maxSplitHands`, not a sourced constraint — just wide enough to hold every known real-table value (2-4) with headroom, while rejecting nonsense (0, negative, fractional, absurdly large). */
const MIN_SPLIT_HANDS = 1
const MAX_SPLIT_HANDS = 8

const DEFAULT_COUNTING_PROGRESS: CountingProgress = {
  runningCount: { roundsPlayed: 0, roundsCorrect: 0 },
  trueCount: { roundsPlayed: 0, goodEstimates: 0, correctMath: 0 },
  shoeCountdown: {
    fullCountdown: { personalBests: {}, totals: {}, attempts: 0, correct: 0 },
    missingCards: { personalBests: {}, totals: {}, attempts: 0, correct: 0 },
  },
  detection: { sessionsPlayed: 0, sessionsCorrect: 0 },
  tableScan: { sessionsPlayed: 0, sessionsCorrect: 0 },
  evidence: { sessionsPlayed: 0, sessionsCorrect: 0 },
  evasion: { sessionsPlayed: 0, bestEdgeCapturedPct: null, lowestHeat: null },
  indexPlays: { attempts: 0, correct: 0, perDeviation: {} },
  livePlay: {
    playAttempts: 0,
    playCorrect: 0,
    countAttempts: 0,
    countCorrect: 0,
    trueCountAttempts: 0,
    trueCountCorrect: 0,
    betAttempts: 0,
    betCorrect: 0,
  },
}

const DEFAULT_COUNTING_STATE: CountingState = {
  settings: DEFAULT_COUNTING_SETTINGS,
  progress: DEFAULT_COUNTING_PROGRESS,
  bankroll: DEFAULT_COUNTING_SETTINGS.startingBankroll,
}

/**
 * Validates each entry individually (rather than all-or-nothing), keeping only well-shaped
 * `{ ms, cards }` entries. This is also what silently migrates away pre-Feature-B-fix data, where
 * personalBests stored a bare number (a different metric — ms-per-card pace or raw ms depending on
 * the format's history) — those entries fail the object-shape check and are dropped rather than
 * misread as the new `{ ms, cards }` shape.
 */
function parsePersonalBests(value: unknown): PersonalBests {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const result: PersonalBests = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const decks = Number(key)
    if (!Number.isFinite(decks)) continue
    if (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as Record<string, unknown>).ms === 'number' &&
      typeof (entry as Record<string, unknown>).cards === 'number'
    ) {
      const e = entry as Record<string, unknown>
      result[decks] = { ms: e.ms as number, cards: e.cards as number }
    }
  }
  return result
}

/** Same validation pattern as `parsePersonalBests`, for the `{ ms, cards, runs }` average-totals shape. */
function parseShoeCountdownTotals(value: unknown): ShoeCountdownTotals {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const result: ShoeCountdownTotals = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const decks = Number(key)
    if (!Number.isFinite(decks)) continue
    if (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as Record<string, unknown>).ms === 'number' &&
      typeof (entry as Record<string, unknown>).cards === 'number' &&
      typeof (entry as Record<string, unknown>).runs === 'number'
    ) {
      const e = entry as Record<string, unknown>
      result[decks] = { ms: e.ms as number, cards: e.cards as number, runs: e.runs as number }
    }
  }
  return result
}

/** Validates each entry individually (rather than all-or-nothing), keeping only well-shaped `{ attempts, correct }` entries. Used for Index Play's per-deviation weakness stats, keyed by situationKey string. */
function parseAttemptsCorrectMap(value: unknown): Record<string, { attempts: number; correct: number }> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const result: Record<string, { attempts: number; correct: number }> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as Record<string, unknown>).attempts === 'number' &&
      typeof (entry as Record<string, unknown>).correct === 'number'
    ) {
      const e = entry as Record<string, unknown>
      result[key] = { attempts: e.attempts as number, correct: e.correct as number }
    }
  }
  return result
}

/**
 * `surrenderMode` migration: a state saved before this rule-matrix pass
 * has no `surrenderMode` at all, only the old boolean `lateSurrender` —
 * map `true` to `'late'` and `false`/absent to `'none'`, so existing
 * saves keep their exact prior behavior instead of silently resetting.
 */
function parseSurrenderMode(r: Record<string, unknown>): SurrenderMode {
  if (r.surrenderMode === 'none' || r.surrenderMode === 'late') return r.surrenderMode
  return r.lateSurrender === true ? 'late' : DEFAULT_COUNTING_SETTINGS.surrenderMode
}

function parseSettings(raw: unknown): CountingSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_COUNTING_SETTINGS
  const r = raw as Record<string, unknown>
  return {
    numDecks: typeof r.numDecks === 'number' ? r.numDecks : DEFAULT_COUNTING_SETTINGS.numDecks,
    seatCount: typeof r.seatCount === 'number' ? r.seatCount : DEFAULT_COUNTING_SETTINGS.seatCount,
    dealSpeed: DEAL_SPEEDS.includes(r.dealSpeed as DealSpeed)
      ? (r.dealSpeed as DealSpeed)
      : DEFAULT_COUNTING_SETTINGS.dealSpeed,
    soft17Rule: r.soft17Rule === 'H17' || r.soft17Rule === 'S17' ? r.soft17Rule : DEFAULT_COUNTING_SETTINGS.soft17Rule,
    surrenderMode: parseSurrenderMode(r),
    das: typeof r.das === 'boolean' ? r.das : DEFAULT_COUNTING_SETTINGS.das,
    maxSplitHands:
      typeof r.maxSplitHands === 'number' &&
      Number.isInteger(r.maxSplitHands) &&
      r.maxSplitHands >= MIN_SPLIT_HANDS &&
      r.maxSplitHands <= MAX_SPLIT_HANDS
        ? r.maxSplitHands
        : DEFAULT_COUNTING_SETTINGS.maxSplitHands,
    startingBankroll: typeof r.startingBankroll === 'number' ? r.startingBankroll : DEFAULT_COUNTING_SETTINGS.startingBankroll,
  }
}

/**
 * Exported so trainingLog.ts's session-baseline loader can normalize a
 * baseline snapshot the same defensive way `loadCountingState` normalizes
 * live progress — a baseline captured under an older app version (missing a
 * field a later release added, e.g. Shoe Countdown's fullCountdown
 * attempts/correct) must not silently corrupt just that field's delta math.
 */
export function parseProgress(raw: unknown): CountingProgress {
  if (!raw || typeof raw !== 'object') return DEFAULT_COUNTING_PROGRESS
  const r = raw as Record<string, unknown>

  const rc = (r.runningCount ?? {}) as Record<string, unknown>
  const tc = (r.trueCount ?? {}) as Record<string, unknown>
  const sc = (r.shoeCountdown ?? {}) as Record<string, unknown>
  const scFull = (sc.fullCountdown ?? {}) as Record<string, unknown>
  const scMissing = (sc.missingCards ?? {}) as Record<string, unknown>
  const dt = (r.detection ?? {}) as Record<string, unknown>
  const ts = (r.tableScan ?? {}) as Record<string, unknown>
  const ev = (r.evidence ?? {}) as Record<string, unknown>
  const ea = (r.evasion ?? {}) as Record<string, unknown>
  const ip = (r.indexPlays ?? {}) as Record<string, unknown>
  const lp = (r.livePlay ?? {}) as Record<string, unknown>

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
      fullCountdown: {
        personalBests: parsePersonalBests(scFull.personalBests),
        totals: parseShoeCountdownTotals(scFull.totals),
        attempts: typeof scFull.attempts === 'number' ? scFull.attempts : 0,
        correct: typeof scFull.correct === 'number' ? scFull.correct : 0,
      },
      missingCards: {
        personalBests: parsePersonalBests(scMissing.personalBests),
        totals: parseShoeCountdownTotals(scMissing.totals),
        attempts: typeof scMissing.attempts === 'number' ? scMissing.attempts : 0,
        correct: typeof scMissing.correct === 'number' ? scMissing.correct : 0,
      },
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
      perDeviation: parseAttemptsCorrectMap(ip.perDeviation),
    },
    livePlay: {
      playAttempts: typeof lp.playAttempts === 'number' ? lp.playAttempts : 0,
      playCorrect: typeof lp.playCorrect === 'number' ? lp.playCorrect : 0,
      countAttempts: typeof lp.countAttempts === 'number' ? lp.countAttempts : 0,
      countCorrect: typeof lp.countCorrect === 'number' ? lp.countCorrect : 0,
      trueCountAttempts: typeof lp.trueCountAttempts === 'number' ? lp.trueCountAttempts : 0,
      trueCountCorrect: typeof lp.trueCountCorrect === 'number' ? lp.trueCountCorrect : 0,
      betAttempts: typeof lp.betAttempts === 'number' ? lp.betAttempts : 0,
      betCorrect: typeof lp.betCorrect === 'number' ? lp.betCorrect : 0,
    },
  }
}

export function loadCountingState(): CountingState {
  try {
    const raw = localStorage.getItem(COUNTING_STORAGE_KEY)
    if (!raw) return DEFAULT_COUNTING_STATE

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return DEFAULT_COUNTING_STATE

    const settings = parseSettings(parsed.settings)
    return {
      settings,
      progress: parseProgress(parsed.progress),
      // Falls back to the (parsed) startingBankroll setting, not the hardcoded
      // default, so a first-ever load with a customized startingBankroll but no
      // bankroll value yet saved still starts at the right amount.
      bankroll: typeof parsed.bankroll === 'number' ? parsed.bankroll : settings.startingBankroll,
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

/** Resets progress (personal bests + round history) to defaults while leaving `settings` and the live `bankroll` untouched. */
export function resetCountingProgress(state: CountingState): CountingState {
  return { settings: state.settings, progress: DEFAULT_COUNTING_PROGRESS, bankroll: state.bankroll }
}

/** One of the nine independent Card Counting modes tracked in `CountingProgress`. */
export type CountingModeKey = keyof CountingProgress

/** Resets a single counting mode's stats to defaults, leaving every other mode's progress, all settings, and the live bankroll untouched. */
export function resetCountingMode(state: CountingState, mode: CountingModeKey): CountingState {
  return {
    settings: state.settings,
    progress: { ...state.progress, [mode]: DEFAULT_COUNTING_PROGRESS[mode] },
    bankroll: state.bankroll,
  }
}

/** Resets the live bankroll to the current `startingBankroll` setting — independent of (and not implied by) any progress reset. */
export function resetBankroll(state: CountingState): CountingState {
  return { ...state, bankroll: state.settings.startingBankroll }
}
