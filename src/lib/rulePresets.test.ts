import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadCountingState } from './persistence'
import { RULE_PRESETS, presetMatches } from './rulePresets'

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
  vi.stubGlobal('localStorage', new MemoryStorage())
})

describe('RULE_PRESETS', () => {
  it('has exactly the three named presets', () => {
    expect(RULE_PRESETS.map((p) => p.label)).toEqual(['Washington & Vegas Strip · 6-Deck', 'Atlantic City · 6-Deck', 'Double Deck · H17, No DAS'])
  })

  it('Washington & Vegas Strip is 6D/H17/DAS/no-surrender/4-hand split', () => {
    const merged = RULE_PRESETS.find((p) => p.label === 'Washington & Vegas Strip · 6-Deck')!
    expect(merged.config).toEqual({ numDecks: 6, soft17Rule: 'H17', surrenderMode: 'none', das: true, maxSplitHands: 4 })
  })

  it('Atlantic City is genuinely distinct (S17 + late surrender)', () => {
    const ac = RULE_PRESETS.find((p) => p.label === 'Atlantic City · 6-Deck')!
    expect(ac.config).toEqual({ numDecks: 6, soft17Rule: 'S17', surrenderMode: 'late', das: true, maxSplitHands: 4 })
  })

  it('Double Deck (H17 · No DAS) is 2D/H17/no-DAS/no-surrender/2-hand split', () => {
    const dd = RULE_PRESETS.find((p) => p.label === 'Double Deck · H17, No DAS')!
    expect(dd.config).toEqual({ numDecks: 2, soft17Rule: 'H17', surrenderMode: 'none', das: false, maxSplitHands: 2 })
  })

  it('Washington & Vegas Strip matches the default CountingSettings rule axes', () => {
    const defaults = loadCountingState().settings
    const merged = RULE_PRESETS.find((p) => p.label === 'Washington & Vegas Strip · 6-Deck')!
    expect(presetMatches(merged, defaults)).toBe(true)
  })

  it('Atlantic City does not match the default CountingSettings rule axes', () => {
    const defaults = loadCountingState().settings
    const ac = RULE_PRESETS.find((p) => p.label === 'Atlantic City · 6-Deck')!
    expect(presetMatches(ac, defaults)).toBe(false)
  })

  it('Double Deck (H17 · No DAS) does not match the default CountingSettings rule axes', () => {
    const defaults = loadCountingState().settings
    const dd = RULE_PRESETS.find((p) => p.label === 'Double Deck · H17, No DAS')!
    expect(presetMatches(dd, defaults)).toBe(false)
  })

  it('no two presets match simultaneously at the default settings (no duplicate case anymore)', () => {
    const defaults = loadCountingState().settings
    const matching = RULE_PRESETS.filter((p) => presetMatches(p, defaults))
    expect(matching).toHaveLength(1)
  })
})
