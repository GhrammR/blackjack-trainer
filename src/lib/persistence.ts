import type { Stats } from './adaptiveEngine'

const STORAGE_KEY = 'double-down:v1'

export interface PersistedState {
  stats: Stats
  handsPlayed: number
}

const DEFAULT_STATE: PersistedState = {
  stats: {},
  handsPlayed: 0,
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
