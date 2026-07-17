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
  it('has exactly the two named presets', () => {
    expect(RULE_PRESETS.map((p) => p.label)).toEqual(['Washington & Vegas Strip', 'Atlantic City'])
  })

  it('Washington & Vegas Strip is 6D/H17/DAS/no-surrender', () => {
    const merged = RULE_PRESETS.find((p) => p.label === 'Washington & Vegas Strip')!
    expect(merged.config).toEqual({ numDecks: 6, soft17Rule: 'H17', surrenderMode: 'none', das: true })
  })

  it('Atlantic City is genuinely distinct (S17 + late surrender)', () => {
    const ac = RULE_PRESETS.find((p) => p.label === 'Atlantic City')!
    expect(ac.config).toEqual({ numDecks: 6, soft17Rule: 'S17', surrenderMode: 'late', das: true })
  })

  it('Washington & Vegas Strip matches the default CountingSettings rule axes', () => {
    const defaults = loadCountingState().settings
    const merged = RULE_PRESETS.find((p) => p.label === 'Washington & Vegas Strip')!
    expect(presetMatches(merged, defaults)).toBe(true)
  })

  it('Atlantic City does not match the default CountingSettings rule axes', () => {
    const defaults = loadCountingState().settings
    const ac = RULE_PRESETS.find((p) => p.label === 'Atlantic City')!
    expect(presetMatches(ac, defaults)).toBe(false)
  })

  it('no two presets match simultaneously at the default settings (no duplicate case anymore)', () => {
    const defaults = loadCountingState().settings
    const matching = RULE_PRESETS.filter((p) => presetMatches(p, defaults))
    expect(matching).toHaveLength(1)
  })
})
