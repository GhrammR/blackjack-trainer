import { describe, expect, it } from 'vitest'
import { formatPace, formatSeconds, signed } from './format'

describe('signed', () => {
  it('adds a leading + for non-negative numbers', () => {
    expect(signed(3)).toBe('+3')
    expect(signed(0)).toBe('+0')
  })

  it('leaves the leading - for negative numbers', () => {
    expect(signed(-2)).toBe('-2')
  })
})

describe('formatSeconds', () => {
  it('converts milliseconds to seconds with 2 decimal places', () => {
    expect(formatSeconds(12340)).toBe('12.34s')
    expect(formatSeconds(500)).toBe('0.50s')
    expect(formatSeconds(0)).toBe('0.00s')
  })
})

describe('formatPace', () => {
  it('converts ms/card to a labeled cards/sec rate', () => {
    expect(formatPace(1000)).toBe('1.00 cards/sec')
    expect(formatPace(500)).toBe('2.00 cards/sec')
    expect(formatPace(420)).toBe('2.38 cards/sec')
  })

  it('a lower (faster) pace value converts to a higher cards/sec rate — confirms the unit conversion did not invert the comparison', () => {
    const fasterRate = 1000 / 300 // pace of 300ms/card
    const slowerRate = 1000 / 600 // pace of 600ms/card
    expect(fasterRate).toBeGreaterThan(slowerRate)
    expect(formatPace(300)).toBe(`${fasterRate.toFixed(2)} cards/sec`)
  })
})
