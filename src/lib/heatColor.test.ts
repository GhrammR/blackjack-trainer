import { describe, expect, it } from 'vitest'
import { heatColor } from './heatColor'

describe('heatColor', () => {
  it('returns neutral gray for unseen entries regardless of accuracy', () => {
    expect(heatColor(0, false)).toBe('#334155')
    expect(heatColor(1, false)).toBe('#334155')
  })

  it('tiers seen entries green -> yellow -> orange -> red as accuracy drops', () => {
    expect(heatColor(1, true)).toBe('#15803d') // green
    expect(heatColor(0.85, true)).toBe('#15803d') // green (boundary, inclusive)
    expect(heatColor(0.84, true)).toBe('#a16207') // yellow
    expect(heatColor(0.7, true)).toBe('#a16207') // yellow (boundary, inclusive)
    expect(heatColor(0.69, true)).toBe('#c2410c') // orange
    expect(heatColor(0.5, true)).toBe('#c2410c') // orange (boundary, inclusive)
    expect(heatColor(0.49, true)).toBe('#b91c1c') // red
    expect(heatColor(0, true)).toBe('#b91c1c') // red
  })
})
