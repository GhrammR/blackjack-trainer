import { describe, expect, it } from 'vitest'
import { hiLoValue } from './counting'
import {
  MAX_STOP_FRACTION,
  MIN_STOP_FRACTION,
  generateMissingCardsRound,
  pickStopIndex,
  updatePersonalBest,
} from './shoeCountdown'

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

  it('stays within [min, max] bounds across a range of shoe sizes', () => {
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

describe('generateMissingCardsRound', () => {
  it('removes exactly 1 card when the coin-flip draw is below 0.5, and it is gone from the dealt shoe', () => {
    const round = generateMissingCardsRound(1, () => 0.1) // < 0.5 -> removedCount = 1

    expect(round.removed).toHaveLength(1)
    expect(round.shoe).toHaveLength(51)
    // A single deck has one of each rank/suit — the removed card must not appear in the dealt shoe.
    const stillPresent = round.shoe.some(
      (c) => c.rank === round.removed[0].rank && c.suit === round.removed[0].suit,
    )
    expect(stillPresent).toBe(false)
  })

  it('missingCount is the Hi-Lo sum of the removed cards, and equals the negative Hi-Lo sum of the dealt shoe', () => {
    const round = generateMissingCardsRound(2, () => 0.999999) // forces removedCount = 2, and picks last indices
    expect(round.removed.length).toBeGreaterThanOrEqual(1)

    const expectedMissing = round.removed.reduce((sum, c) => sum + hiLoValue(c.rank), 0)
    expect(round.missingCount).toBe(expectedMissing)

    const dealtSum = round.shoe.reduce((sum, c) => sum + hiLoValue(c.rank), 0)
    expect(dealtSum).toBe(-round.missingCount)
  })

  it('the dealt shoe plus the removed cards reconstitute a full, proper shoe composition', () => {
    const round = generateMissingCardsRound(1, () => 0.7)
    const all = [...round.shoe, ...round.removed]
    expect(all).toHaveLength(52)

    const counts = new Map<string, number>()
    for (const c of all) {
      const key = `${c.rank}-${c.suit}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    // A single deck has exactly one of each rank/suit combination.
    expect([...counts.values()].every((n) => n === 1)).toBe(true)
    expect(counts.size).toBe(52)
  })

  it('removes 1 or 2 cards, never 0 or more than 2', () => {
    for (const draw of [0, 0.1, 0.49, 0.5, 0.51, 0.9, 0.999999]) {
      const round = generateMissingCardsRound(6, () => draw)
      expect([1, 2]).toContain(round.removed.length)
    }
  })
})
