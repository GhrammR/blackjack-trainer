import { describe, expect, it } from 'vitest'
import { MIN_DECKS_REMAINING, hiLoValue, runningCount, trueCount } from './counting'
import type { Card, Rank } from '../types'

const c = (rank: Rank): Card => ({ rank })

describe('hiLoValue', () => {
  it('values 2-6 at +1', () => {
    for (const rank of ['2', '3', '4', '5', '6'] as Rank[]) {
      expect(hiLoValue(rank)).toBe(1)
    }
  })

  it('values 7-9 at 0', () => {
    for (const rank of ['7', '8', '9'] as Rank[]) {
      expect(hiLoValue(rank)).toBe(0)
    }
  })

  it('values 10/J/Q/K/A at -1', () => {
    for (const rank of ['10', 'J', 'Q', 'K', 'A'] as Rank[]) {
      expect(hiLoValue(rank)).toBe(-1)
    }
  })
})

describe('runningCount', () => {
  it('sums Hi-Lo values across a sequence of cards', () => {
    // +1 +1 +0 -1 -1 +1 = 1
    const cards = [c('2'), c('5'), c('8'), c('K'), c('A'), c('3')]
    expect(runningCount(cards)).toBe(1)
  })

  it('starts from a given starting count', () => {
    expect(runningCount([c('2'), c('3')], 5)).toBe(7)
  })

  it('returns the starting count unchanged for an empty sequence', () => {
    expect(runningCount([], 4)).toBe(4)
  })
})

describe('trueCount', () => {
  it('divides running count by decks remaining and rounds', () => {
    expect(trueCount(8, 4)).toBe(2)
    expect(trueCount(5, 2)).toBe(3) // 2.5 rounds to 3
  })

  it('clamps decks remaining to avoid a divide-by-near-zero spike', () => {
    expect(trueCount(2, 0.1)).toBe(trueCount(2, MIN_DECKS_REMAINING))
  })

  it('handles a negative running count', () => {
    expect(trueCount(-6, 3)).toBe(-2)
  })
})
