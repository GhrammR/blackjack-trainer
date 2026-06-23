import { describe, expect, it } from 'vitest'
import { formatSeconds, signed } from './format'

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
