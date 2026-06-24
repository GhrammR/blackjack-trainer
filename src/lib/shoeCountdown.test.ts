import { describe, expect, it } from 'vitest'
import { MAX_STOP_FRACTION, MIN_STOP_FRACTION, pickStopIndex, updatePersonalBest } from './shoeCountdown'

describe('updatePersonalBest', () => {
  it('records a time when there is no existing best', () => {
    expect(updatePersonalBest({}, 6, 45000)).toEqual({ 6: 45000 })
  })

  it('replaces the best when the new time is strictly faster', () => {
    expect(updatePersonalBest({ 6: 45000 }, 6, 40000)).toEqual({ 6: 40000 })
  })

  it('keeps the existing best when the new time is slower', () => {
    expect(updatePersonalBest({ 6: 40000 }, 6, 45000)).toEqual({ 6: 40000 })
  })

  it('keeps the existing best on a tie (not a new record)', () => {
    const bests = { 6: 40000 }
    expect(updatePersonalBest(bests, 6, 40000)).toEqual({ 6: 40000 })
  })

  it('tracks each shoe size independently', () => {
    const bests = updatePersonalBest({ 6: 40000 }, 2, 15000)
    expect(bests).toEqual({ 6: 40000, 2: 15000 })
  })

  it('does not mutate the input object', () => {
    const bests = { 6: 45000 }
    updatePersonalBest(bests, 6, 40000)
    expect(bests).toEqual({ 6: 45000 })
  })
})

describe('pickStopIndex', () => {
  it('returns the lower bound when random draws 0', () => {
    expect(pickStopIndex(52, () => 0)).toBe(Math.ceil(52 * MIN_STOP_FRACTION))
  })

  it('returns the upper bound when random draws just under 1', () => {
    expect(pickStopIndex(52, () => 0.999999)).toBe(Math.floor(52 * MAX_STOP_FRACTION))
  })

  it('never returns the full shoe length or the very start', () => {
    const stop = pickStopIndex(52, () => 0.5)
    expect(stop).toBeGreaterThanOrEqual(Math.ceil(52 * MIN_STOP_FRACTION))
    expect(stop).toBeLessThanOrEqual(Math.floor(52 * MAX_STOP_FRACTION))
    expect(stop).toBeLessThan(52)
  })

  it('stays within [min, max] bounds across supported shoe sizes (1-8 decks)', () => {
    for (let decks = 1; decks <= 8; decks++) {
      const shoeLength = decks * 52
      const min = Math.ceil(shoeLength * MIN_STOP_FRACTION)
      const max = Math.floor(shoeLength * MAX_STOP_FRACTION)
      expect(min).toBeLessThanOrEqual(max)
      for (const draw of [0, 0.25, 0.5, 0.75, 0.999999]) {
        const stop = pickStopIndex(shoeLength, () => draw)
        expect(stop).toBeGreaterThanOrEqual(min)
        expect(stop).toBeLessThanOrEqual(max)
      }
    }
  })

  it('defaults to Math.random and still respects bounds', () => {
    const stop = pickStopIndex(52)
    expect(stop).toBeGreaterThanOrEqual(Math.ceil(52 * MIN_STOP_FRACTION))
    expect(stop).toBeLessThanOrEqual(Math.floor(52 * MAX_STOP_FRACTION))
  })
})
