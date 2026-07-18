import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type CountingState,
  clearState,
  loadCountingState,
  loadState,
  resetBankroll,
  resetCountingMode,
  resetCountingProgress,
  saveCountingState,
  saveState,
} from './persistence'

class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() {
    return this.store.size
  }
  clear(): void {
    this.store.clear()
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
}

beforeEach(() => {
  // jsdom isn't configured for this test run; stub a minimal in-memory localStorage.
  vi.stubGlobal('localStorage', new MemoryStorage())
})

describe('loadState', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadState()).toEqual({ stats: {}, handsPlayed: 0, currentStreak: 0, bestStreak: 0 })
  })

  it('returns defaults for corrupt JSON instead of throwing', () => {
    localStorage.setItem('double-down:v1', '{not json')
    expect(loadState()).toEqual({ stats: {}, handsPlayed: 0, currentStreak: 0, bestStreak: 0 })
  })

  it('fills in missing fields from a partial object', () => {
    localStorage.setItem('double-down:v1', JSON.stringify({ handsPlayed: 7 }))
    expect(loadState()).toEqual({ stats: {}, handsPlayed: 7, currentStreak: 0, bestStreak: 0 })
  })

  it('a missing bestStreak (saved by an older app version) falls back to the parsed currentStreak, not 0 — never understates an in-progress streak as unrecorded', () => {
    localStorage.setItem('double-down:v1', JSON.stringify({ handsPlayed: 7, currentStreak: 12 }))
    expect(loadState().bestStreak).toBe(12)
  })
})

describe('saveState / loadState round trip', () => {
  it('persists stats, handsPlayed, currentStreak, and bestStreak across a save/load cycle', () => {
    const state = {
      stats: { 'hard-16-vs-10': { key: 'hard-16-vs-10', attempts: 3, correct: 2, lastSeen: 2, recentResults: [true, false, true] } },
      handsPlayed: 3,
      currentStreak: 2,
      // Deliberately different from currentStreak, to confirm bestStreak round-trips
      // as its own real field rather than incidentally matching currentStreak.
      bestStreak: 9,
    }
    saveState(state)
    expect(loadState()).toEqual(state)
  })
})

describe('clearState', () => {
  it('removes persisted data, reverting loadState to defaults', () => {
    saveState({ stats: {}, handsPlayed: 5, currentStreak: 5, bestStreak: 5 })
    clearState()
    expect(loadState()).toEqual({ stats: {}, handsPlayed: 0, currentStreak: 0, bestStreak: 0 })
  })
})

const DEFAULT_COUNTING_STATE: CountingState = {
  settings: { numDecks: 6, seatCount: 4, dealSpeed: 'medium', soft17Rule: 'H17', surrenderMode: 'none', das: true, maxSplitHands: 4, startingBankroll: 1000 },
  bankroll: 1000,
  progress: {
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
    livePlay: { playAttempts: 0, playCorrect: 0, countAttempts: 0, countCorrect: 0, trueCountAttempts: 0, trueCountCorrect: 0, betAttempts: 0, betCorrect: 0 },
  },
}

describe('loadCountingState', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadCountingState()).toEqual(DEFAULT_COUNTING_STATE)
  })

  it('returns defaults for corrupt JSON instead of throwing', () => {
    localStorage.setItem('double-down:counting:v1', '{not json')
    expect(loadCountingState()).toEqual(DEFAULT_COUNTING_STATE)
  })

  it('fills in missing fields from a partial object', () => {
    localStorage.setItem('double-down:counting:v1', JSON.stringify({ settings: { numDecks: 2 } }))
    expect(loadCountingState()).toEqual({
      settings: { numDecks: 2, seatCount: 4, dealSpeed: 'medium', soft17Rule: 'H17', surrenderMode: 'none', das: true, maxSplitHands: 4, startingBankroll: 1000 },
      progress: DEFAULT_COUNTING_STATE.progress,
      bankroll: 1000,
    })
  })

  it('a missing bankroll falls back to the (parsed) startingBankroll setting, not the hardcoded default', () => {
    localStorage.setItem('double-down:counting:v1', JSON.stringify({ settings: { startingBankroll: 500 } }))
    expect(loadCountingState().bankroll).toBe(500)
  })

  it('a present bankroll is used as-is, independent of startingBankroll', () => {
    localStorage.setItem('double-down:counting:v1', JSON.stringify({ settings: { startingBankroll: 500 }, bankroll: 275 }))
    expect(loadCountingState().bankroll).toBe(275)
  })

  it('migrates a pre-rule-matrix save (old boolean lateSurrender, no surrenderMode) to the new surrenderMode field', () => {
    localStorage.setItem('double-down:counting:v1', JSON.stringify({ settings: { lateSurrender: true } }))
    expect(loadCountingState().settings.surrenderMode).toBe('late')
  })

  it('a pre-rule-matrix save with lateSurrender false migrates to surrenderMode "none"', () => {
    localStorage.setItem('double-down:counting:v1', JSON.stringify({ settings: { lateSurrender: false } }))
    expect(loadCountingState().settings.surrenderMode).toBe('none')
  })

  it('a saved surrenderMode takes priority over a stale lateSurrender boolean, if somehow both are present', () => {
    localStorage.setItem('double-down:counting:v1', JSON.stringify({ settings: { lateSurrender: true, surrenderMode: 'none' } }))
    expect(loadCountingState().settings.surrenderMode).toBe('none')
  })

  it('a pre-DAS-axis save (no das field) migrates to das: true, preserving existing behavior', () => {
    localStorage.setItem('double-down:counting:v1', JSON.stringify({ settings: { numDecks: 6, soft17Rule: 'H17', surrenderMode: 'none' } }))
    expect(loadCountingState().settings.das).toBe(true)
  })

  it('a saved das: false is honored, not overridden by the default', () => {
    localStorage.setItem('double-down:counting:v1', JSON.stringify({ settings: { das: false } }))
    expect(loadCountingState().settings.das).toBe(false)
  })

  it('a pre-maxSplitHands save (no field) migrates to the default of 4', () => {
    localStorage.setItem('double-down:counting:v1', JSON.stringify({ settings: { numDecks: 6, soft17Rule: 'H17', surrenderMode: 'none', das: true } }))
    expect(loadCountingState().settings.maxSplitHands).toBe(4)
  })

  it('a saved maxSplitHands: 2 is honored, not overridden by the default', () => {
    localStorage.setItem('double-down:counting:v1', JSON.stringify({ settings: { maxSplitHands: 2 } }))
    expect(loadCountingState().settings.maxSplitHands).toBe(2)
  })

  it('an out-of-range or malformed maxSplitHands (negative, fractional, non-numeric, absurdly large) falls back to the default of 4', () => {
    for (const bad of [0, -1, 2.5, '4', null, 9999]) {
      localStorage.setItem('double-down:counting:v1', JSON.stringify({ settings: { maxSplitHands: bad } }))
      expect(loadCountingState().settings.maxSplitHands).toBe(4)
    }
  })

  it('rejects a non-object personalBests value instead of throwing, for either format', () => {
    localStorage.setItem(
      'double-down:counting:v1',
      JSON.stringify({
        progress: {
          shoeCountdown: {
            fullCountdown: { personalBests: 'not an object', attempts: 5, correct: 3 },
            missingCards: { personalBests: 42 },
          },
        },
      }),
    )
    const sc = loadCountingState().progress.shoeCountdown
    expect(sc.fullCountdown.personalBests).toEqual({})
    expect(sc.fullCountdown.attempts).toBe(5)
    expect(sc.fullCountdown.correct).toBe(3)
    expect(sc.missingCards.personalBests).toEqual({})
  })

  it('rejects a malformed totals value instead of throwing, keeping only well-shaped { ms, cards, runs } entries', () => {
    localStorage.setItem(
      'double-down:counting:v1',
      JSON.stringify({
        progress: {
          shoeCountdown: {
            fullCountdown: {
              totals: { 1: { ms: 9500, cards: 40 }, 6: { ms: 61000, cards: 260, runs: 2 }, 2: 'not an object' },
            },
            missingCards: { totals: 'not an object' },
          },
        },
      }),
    )
    const sc = loadCountingState().progress.shoeCountdown
    // The 1-deck entry is missing `runs` (a pre-average-tracking shape) and gets dropped, same
    // migration pattern as parsePersonalBests dropping a bare-number pre-`{ms,cards}` entry.
    expect(sc.fullCountdown.totals).toEqual({ 6: { ms: 61000, cards: 260, runs: 2 } })
    expect(sc.missingCards.totals).toEqual({})
  })

  it('treats the old flat shoeCountdown shape (pre-Feature-B) as absent and starts fresh', () => {
    localStorage.setItem(
      'double-down:counting:v1',
      JSON.stringify({ progress: { shoeCountdown: { personalBests: { 6: 45000 } } } }),
    )
    expect(loadCountingState().progress.shoeCountdown).toEqual(DEFAULT_COUNTING_STATE.progress.shoeCountdown)
  })

  it('drops pre-migration personal-best entries (a bare number, from before the `{ ms, cards }` shape) instead of misreading them', () => {
    localStorage.setItem(
      'double-down:counting:v1',
      JSON.stringify({
        progress: {
          shoeCountdown: {
            fullCountdown: { personalBests: { 6: 385 }, attempts: 3, correct: 2 },
            missingCards: { personalBests: { 6: 45000 } },
          },
        },
      }),
    )
    const sc = loadCountingState().progress.shoeCountdown
    expect(sc.fullCountdown.personalBests).toEqual({})
    expect(sc.fullCountdown.attempts).toBe(3)
    expect(sc.fullCountdown.correct).toBe(2)
    expect(sc.missingCards.personalBests).toEqual({})
  })

  it('keeps well-shaped Full Countdown entries per deck size (personal bests are per-deck-size again)', () => {
    localStorage.setItem(
      'double-down:counting:v1',
      JSON.stringify({
        progress: {
          shoeCountdown: {
            fullCountdown: {
              personalBests: { 1: { ms: 9500, cards: 40 }, 6: { ms: 61000, cards: 260 } },
            },
          },
        },
      }),
    )
    const fc = loadCountingState().progress.shoeCountdown.fullCountdown
    expect(fc.personalBests).toEqual({ 1: { ms: 9500, cards: 40 }, 6: { ms: 61000, cards: 260 } })
  })

  it('keeps well-shaped Index Play perDeviation entries and drops malformed ones', () => {
    localStorage.setItem(
      'double-down:counting:v1',
      JSON.stringify({
        progress: {
          indexPlays: {
            attempts: 20,
            correct: 15,
            perDeviation: {
              'hard-16-vs-10': { attempts: 5, correct: 4 },
              'hard-15-vs-10': 'not an object',
              'hard-12-vs-3': { attempts: 'nope', correct: 1 },
            },
          },
        },
      }),
    )
    const indexPlays = loadCountingState().progress.indexPlays
    expect(indexPlays.attempts).toBe(20)
    expect(indexPlays.correct).toBe(15)
    expect(indexPlays.perDeviation).toEqual({ 'hard-16-vs-10': { attempts: 5, correct: 4 } })
  })

  it('rejects non-number evasion personal bests, defaulting to null instead of throwing', () => {
    localStorage.setItem(
      'double-down:counting:v1',
      JSON.stringify({ progress: { evasion: { sessionsPlayed: 3, bestEdgeCapturedPct: 'great', lowestHeat: 'none' } } }),
    )
    const evasion = loadCountingState().progress.evasion
    expect(evasion).toEqual({ sessionsPlayed: 3, bestEdgeCapturedPct: null, lowestHeat: null })
  })
})

describe('saveCountingState / loadCountingState round trip', () => {
  it('persists settings and progress, including shoe countdown personal bests and detection sessions', () => {
    const state: CountingState = {
      settings: { numDecks: 1, seatCount: 2, dealSpeed: 'fast', soft17Rule: 'H17', surrenderMode: 'late', das: true, maxSplitHands: 4, startingBankroll: 2000 },
      bankroll: 1875.5,
      progress: {
        runningCount: { roundsPlayed: 10, roundsCorrect: 8 },
        trueCount: { roundsPlayed: 5, goodEstimates: 4, correctMath: 3 },
        shoeCountdown: {
          fullCountdown: {
            personalBests: { 1: { ms: 12600, cards: 40 }, 6: { ms: 61000, cards: 260 } },
            totals: { 1: { ms: 12600, cards: 40, runs: 1 }, 6: { ms: 122000, cards: 520, runs: 2 } },
            attempts: 12,
            correct: 10,
          },
          missingCards: {
            personalBests: { 1: { ms: 12000, cards: 51 }, 6: { ms: 45000, cards: 311 } },
            totals: { 1: { ms: 12000, cards: 51, runs: 1 }, 6: { ms: 45000, cards: 311, runs: 1 } },
            attempts: 9,
            correct: 7,
          },
        },
        detection: { sessionsPlayed: 6, sessionsCorrect: 4 },
        tableScan: { sessionsPlayed: 3, sessionsCorrect: 2 },
        evidence: { sessionsPlayed: 5, sessionsCorrect: 3 },
        evasion: { sessionsPlayed: 4, bestEdgeCapturedPct: 72.5, lowestHeat: 2 },
        indexPlays: { attempts: 20, correct: 15, perDeviation: { 'hard-16-vs-10': { attempts: 5, correct: 4 } } },
        livePlay: { playAttempts: 50, playCorrect: 44, countAttempts: 12, countCorrect: 10, trueCountAttempts: 30, trueCountCorrect: 27, betAttempts: 20, betCorrect: 16 },
      },
    }
    saveCountingState(state)
    expect(loadCountingState()).toEqual(state)
  })
})

describe('resetCountingProgress', () => {
  it('resets progress to defaults while leaving settings and the live bankroll untouched', () => {
    const state: CountingState = {
      settings: { numDecks: 8, seatCount: 6, dealSpeed: 'slow', soft17Rule: 'H17', surrenderMode: 'late', das: true, maxSplitHands: 4, startingBankroll: 1000 },
      bankroll: 640,
      progress: {
        runningCount: { roundsPlayed: 10, roundsCorrect: 8 },
        trueCount: { roundsPlayed: 5, goodEstimates: 4, correctMath: 3 },
        shoeCountdown: {
          fullCountdown: { personalBests: { 6: { ms: 61000, cards: 260 } }, totals: { 6: { ms: 61000, cards: 260, runs: 1 } }, attempts: 4, correct: 3 },
          missingCards: { personalBests: { 8: { ms: 99000, cards: 415 } }, totals: { 8: { ms: 99000, cards: 415, runs: 1 } }, attempts: 4, correct: 3 },
        },
        detection: { sessionsPlayed: 6, sessionsCorrect: 4 },
        tableScan: { sessionsPlayed: 3, sessionsCorrect: 2 },
        evidence: { sessionsPlayed: 5, sessionsCorrect: 3 },
        evasion: { sessionsPlayed: 4, bestEdgeCapturedPct: 72.5, lowestHeat: 2 },
        indexPlays: { attempts: 20, correct: 15, perDeviation: {} },
        livePlay: { playAttempts: 50, playCorrect: 44, countAttempts: 12, countCorrect: 10, trueCountAttempts: 30, trueCountCorrect: 27, betAttempts: 20, betCorrect: 16 },
      },
    }
    expect(resetCountingProgress(state)).toEqual({
      settings: { numDecks: 8, seatCount: 6, dealSpeed: 'slow', soft17Rule: 'H17', surrenderMode: 'late', das: true, maxSplitHands: 4, startingBankroll: 1000 },
      bankroll: 640,
      progress: DEFAULT_COUNTING_STATE.progress,
    })
  })
})

describe('resetCountingMode', () => {
  const state: CountingState = {
    settings: { numDecks: 2, seatCount: 3, dealSpeed: 'medium', soft17Rule: 'H17', surrenderMode: 'none', das: true, maxSplitHands: 4, startingBankroll: 1000 },
    bankroll: 730,
    progress: {
      runningCount: { roundsPlayed: 10, roundsCorrect: 8 },
      trueCount: { roundsPlayed: 5, goodEstimates: 4, correctMath: 3 },
      shoeCountdown: {
        fullCountdown: { personalBests: { 2: { ms: 33000, cards: 85 } }, totals: { 2: { ms: 33000, cards: 85, runs: 1 } }, attempts: 5, correct: 4 },
        missingCards: { personalBests: { 6: { ms: 45000, cards: 311 } }, totals: { 6: { ms: 45000, cards: 311, runs: 1 } }, attempts: 5, correct: 4 },
      },
      detection: { sessionsPlayed: 6, sessionsCorrect: 4 },
      tableScan: { sessionsPlayed: 3, sessionsCorrect: 2 },
      evidence: { sessionsPlayed: 5, sessionsCorrect: 3 },
      evasion: { sessionsPlayed: 4, bestEdgeCapturedPct: 72.5, lowestHeat: 2 },
      indexPlays: { attempts: 20, correct: 15, perDeviation: { 'hard-16-vs-10': { attempts: 5, correct: 4 } } },
      livePlay: { playAttempts: 50, playCorrect: 44, countAttempts: 12, countCorrect: 10, trueCountAttempts: 30, trueCountCorrect: 27, betAttempts: 20, betCorrect: 16 },
    },
  }

  it('resets only the targeted mode, leaving every other mode, settings, and the live bankroll untouched', () => {
    const result = resetCountingMode(state, 'runningCount')
    expect(result.settings).toEqual(state.settings)
    expect(result.bankroll).toBe(state.bankroll)
    expect(result.progress.runningCount).toEqual(DEFAULT_COUNTING_STATE.progress.runningCount)
    // Every other mode's progress is byte-for-byte unchanged.
    expect(result.progress.trueCount).toEqual(state.progress.trueCount)
    expect(result.progress.shoeCountdown).toEqual(state.progress.shoeCountdown)
    expect(result.progress.detection).toEqual(state.progress.detection)
    expect(result.progress.tableScan).toEqual(state.progress.tableScan)
    expect(result.progress.evidence).toEqual(state.progress.evidence)
    expect(result.progress.evasion).toEqual(state.progress.evasion)
    expect(result.progress.indexPlays).toEqual(state.progress.indexPlays)
    expect(result.progress.livePlay).toEqual(state.progress.livePlay)
  })

  it('resets a different mode (evasion) independently, confirming it is not hardcoded to one key', () => {
    const result = resetCountingMode(state, 'evasion')
    expect(result.progress.evasion).toEqual(DEFAULT_COUNTING_STATE.progress.evasion)
    expect(result.progress.runningCount).toEqual(state.progress.runningCount)
    expect(result.progress.livePlay).toEqual(state.progress.livePlay)
  })

  it('resetting shoeCountdown clears BOTH formats together, since they share one mode key', () => {
    const result = resetCountingMode(state, 'shoeCountdown')
    expect(result.progress.shoeCountdown).toEqual(DEFAULT_COUNTING_STATE.progress.shoeCountdown)
    expect(result.progress.runningCount).toEqual(state.progress.runningCount)
  })
})

describe('resetBankroll', () => {
  it('resets the live bankroll to the current startingBankroll setting, leaving settings and progress untouched', () => {
    const state: CountingState = {
      settings: { numDecks: 2, seatCount: 3, dealSpeed: 'medium', soft17Rule: 'H17', surrenderMode: 'none', das: true, maxSplitHands: 4, startingBankroll: 500 },
      bankroll: 0,
      progress: DEFAULT_COUNTING_STATE.progress,
    }
    const result = resetBankroll(state)
    expect(result.bankroll).toBe(500)
    expect(result.settings).toEqual(state.settings)
    expect(result.progress).toEqual(state.progress)
  })

  it('is independent of a customized startingBankroll (not hardcoded to 1000)', () => {
    const state: CountingState = {
      settings: { numDecks: 6, seatCount: 4, dealSpeed: 'medium', soft17Rule: 'H17', surrenderMode: 'none', das: true, maxSplitHands: 4, startingBankroll: 2500 },
      bankroll: 12,
      progress: DEFAULT_COUNTING_STATE.progress,
    }
    expect(resetBankroll(state).bankroll).toBe(2500)
  })
})
