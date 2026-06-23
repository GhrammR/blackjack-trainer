import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearState, loadState, saveState } from './persistence'

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
