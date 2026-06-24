import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type CountingState,
  clearState,
  loadCountingState,
  loadState,
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
    expect(loadState()).toEqual({ stats: {}, handsPlayed: 0, currentStreak: 0 })
  })

  it('returns defaults for corrupt JSON instead of throwing', () => {
    localStorage.setItem('double-down:v1', '{not json')
    expect(loadState()).toEqual({ stats: {}, handsPlayed: 0, currentStreak: 0 })
  })

  it('fills in missing fields from a partial object', () => {
    localStorage.setItem('double-down:v1', JSON.stringify({ handsPlayed: 7 }))
    expect(loadState()).toEqual({ stats: {}, handsPlayed: 7, currentStreak: 0 })
  })
})

describe('saveState / loadState round trip', () => {
  it('persists stats, handsPlayed, and currentStreak across a save/load cycle', () => {
    const state = {
      stats: { 'hard-16-vs-10': { key: 'hard-16-vs-10', attempts: 3, correct: 2, lastSeen: 2, recentResults: [true, false, true] } },
      handsPlayed: 3,
      currentStreak: 2,
    }
    saveState(state)
    expect(loadState()).toEqual(state)
  })
})

describe('clearState', () => {
  it('removes persisted data, reverting loadState to defaults', () => {
    saveState({ stats: {}, handsPlayed: 5, currentStreak: 5 })
    clearState()
    expect(loadState()).toEqual({ stats: {}, handsPlayed: 0, currentStreak: 0 })
  })
})

const DEFAULT_COUNTING_STATE: CountingState = {
  settings: { numDecks: 6, seatCount: 4, cardsPerSecond: 2 },
  progress: {
    runningCount: { roundsPlayed: 0, roundsCorrect: 0 },
    trueCount: { roundsPlayed: 0, goodEstimates: 0, correctMath: 0 },
    shoeCountdown: { personalBests: {} },
    detection: { sessionsPlayed: 0, sessionsCorrect: 0 },
    tableScan: { sessionsPlayed: 0, sessionsCorrect: 0 },
    evidence: { sessionsPlayed: 0, sessionsCorrect: 0 },
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
      settings: { numDecks: 2, seatCount: 4, cardsPerSecond: 2 },
      progress: DEFAULT_COUNTING_STATE.progress,
    })
  })

  it('rejects a non-object personalBests value instead of throwing', () => {
    localStorage.setItem(
      'double-down:counting:v1',
      JSON.stringify({ progress: { shoeCountdown: { personalBests: 'not an object' } } }),
    )
    expect(loadCountingState().progress.shoeCountdown.personalBests).toEqual({})
  })
})

describe('saveCountingState / loadCountingState round trip', () => {
  it('persists settings and progress, including shoe countdown personal bests and detection sessions', () => {
    const state: CountingState = {
      settings: { numDecks: 1, seatCount: 2, cardsPerSecond: 4 },
      progress: {
        runningCount: { roundsPlayed: 10, roundsCorrect: 8 },
        trueCount: { roundsPlayed: 5, goodEstimates: 4, correctMath: 3 },
        shoeCountdown: { personalBests: { 1: 12000, 6: 45000 } },
        detection: { sessionsPlayed: 6, sessionsCorrect: 4 },
        tableScan: { sessionsPlayed: 3, sessionsCorrect: 2 },
        evidence: { sessionsPlayed: 5, sessionsCorrect: 3 },
      },
    }
    saveCountingState(state)
    expect(loadCountingState()).toEqual(state)
  })
})

describe('resetCountingProgress', () => {
  it('resets progress to defaults while leaving settings untouched', () => {
    const state: CountingState = {
      settings: { numDecks: 8, seatCount: 6, cardsPerSecond: 3 },
      progress: {
        runningCount: { roundsPlayed: 10, roundsCorrect: 8 },
        trueCount: { roundsPlayed: 5, goodEstimates: 4, correctMath: 3 },
        shoeCountdown: { personalBests: { 8: 99000 } },
        detection: { sessionsPlayed: 6, sessionsCorrect: 4 },
        tableScan: { sessionsPlayed: 3, sessionsCorrect: 2 },
        evidence: { sessionsPlayed: 5, sessionsCorrect: 3 },
      },
    }
    expect(resetCountingProgress(state)).toEqual({
      settings: { numDecks: 8, seatCount: 6, cardsPerSecond: 3 },
      progress: DEFAULT_COUNTING_STATE.progress,
    })
  })
})
