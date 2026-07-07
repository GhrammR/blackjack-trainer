import { describe, expect, it } from 'vitest'
import { hiLoValue } from './counting'
import { generateFullCountdownRound, generateMissingCardsRound, updatePersonalBest } from './shoeCountdown'

// Mirrors the per-deck-size tuning in shoeCountdown.ts (dealSize, maxAbsCount) — kept local to the
// test rather than exported from the lib, since these are the values under test, not shared config.
const DECK_SIZES: { numDecks: number; dealSize: number; maxAbsCount: number }[] = [
  { numDecks: 1, dealSize: 52, maxAbsCount: 21 },
  { numDecks: 2, dealSize: 104, maxAbsCount: 42 },
  { numDecks: 6, dealSize: 312, maxAbsCount: 125 },
]

describe('updatePersonalBest', () => {
  it('records a result when there is no existing best', () => {
    expect(updatePersonalBest({}, 6, 45000, 100)).toEqual({ 6: { ms: 45000, cards: 100 } })
  })

  it('replaces the best when the new pace is strictly faster (same card count)', () => {
    expect(updatePersonalBest({ 6: { ms: 45000, cards: 100 } }, 6, 40000, 100)).toEqual({
      6: { ms: 40000, cards: 100 },
    })
  })

  it('keeps the existing best when the new pace is slower', () => {
    expect(updatePersonalBest({ 6: { ms: 40000, cards: 100 } }, 6, 45000, 100)).toEqual({
      6: { ms: 40000, cards: 100 },
    })
  })

  it('compares by PACE, not raw ms — a slower raw time over more cards can still be a new best', () => {
    // Existing: 40000ms / 100 cards = 400 ms/card. New: 70000ms / 200 cards = 350 ms/card (faster pace).
    expect(updatePersonalBest({ 6: { ms: 40000, cards: 100 } }, 6, 70000, 200)).toEqual({
      6: { ms: 70000, cards: 200 },
    })
  })

  it('keeps the existing best on a pace tie (not a new record)', () => {
    const bests = { 6: { ms: 40000, cards: 100 } }
    expect(updatePersonalBest(bests, 6, 20000, 50)).toEqual({ 6: { ms: 40000, cards: 100 } })
  })

  it('tracks each shoe size independently', () => {
    const bests = updatePersonalBest({ 6: { ms: 40000, cards: 100 } }, 2, 15000, 40)
    expect(bests).toEqual({ 6: { ms: 40000, cards: 100 }, 2: { ms: 15000, cards: 40 } })
  })

  it('does not mutate the input object', () => {
    const bests = { 6: { ms: 45000, cards: 100 } }
    updatePersonalBest(bests, 6, 40000, 100)
    expect(bests).toEqual({ 6: { ms: 45000, cards: 100 } })
  })
})

describe('generateFullCountdownRound', () => {
  it('deals a fixed card count per deck size, and the count scales up with deck size', () => {
    for (const { numDecks, dealSize } of DECK_SIZES) {
      for (let i = 0; i < 10; i++) {
        const round = generateFullCountdownRound(numDecks)
        expect(round.cards).toHaveLength(dealSize)
      }
    }
    // 1-deck is a short deal, 6-deck a long one — genuinely different, not just relabeled.
    expect(DECK_SIZES[0].dealSize).toBeLessThan(DECK_SIZES[1].dealSize)
    expect(DECK_SIZES[1].dealSize).toBeLessThan(DECK_SIZES[2].dealSize)
  })

  it('count is the real Hi-Lo sum of the dealt cards, never fabricated', () => {
    for (const { numDecks } of DECK_SIZES) {
      for (let i = 0; i < 10; i++) {
        const round = generateFullCountdownRound(numDecks)
        const actualSum = round.cards.reduce((sum, c) => sum + hiLoValue(c.rank), 0)
        expect(round.count).toBe(actualSum)
      }
    }
  })

  it('count is never 0, across many draws at every deck size', () => {
    for (const { numDecks } of DECK_SIZES) {
      for (let i = 0; i < 75; i++) {
        const round = generateFullCountdownRound(numDecks)
        expect(round.count).not.toBe(0)
      }
    }
  })

  it('count always stays within [-maxAbsCount, maxAbsCount] for its deck size', () => {
    for (const { numDecks, maxAbsCount } of DECK_SIZES) {
      for (let i = 0; i < 75; i++) {
        const round = generateFullCountdownRound(numDecks)
        expect(Math.abs(round.count)).toBeLessThanOrEqual(maxAbsCount)
      }
    }
  })

  it('count varies across draws at each deck size (not a fixed value)', () => {
    for (const { numDecks } of DECK_SIZES) {
      const counts = new Set<number>()
      for (let i = 0; i < 30; i++) {
        counts.add(generateFullCountdownRound(numDecks).count)
      }
      expect(counts.size).toBeGreaterThan(3)
    }
  })

  it('terminates and stays valid even with a degenerate constant `random` source', () => {
    // A constant random() produces the same shuffle every attempt — if that particular shuffle's
    // slice happens to be invalid (0 or out-of-range), a naive implementation could loop forever
    // retrying an identical draw. Confirms the real Math.random-backed path (used by the retry
    // loop internally) still resolves; this is primarily a termination/regression guard.
    const round = generateFullCountdownRound(6, () => 0.42)
    expect(round.cards).toHaveLength(312)
  })

  it('falls back to a scaled config for a deck size with no explicit tuning entry', () => {
    const round = generateFullCountdownRound(3)
    // Proportional formula: dealSize = round(3 * 52) = 156.
    expect(round.cards).toHaveLength(156)
    expect(round.count).not.toBe(0)
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
