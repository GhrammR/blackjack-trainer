import { describe, expect, it } from 'vitest'
import { getAction, getHardSoftAction, getHardSoftSituationKey, getSituationKey } from './strategy'
import type { Card, Rank } from '../types'

const c = (rank: Rank): Card => ({ rank })

describe('basic strategy spot checks', () => {
  it('hard 16 vs 10 -> Hit', () => {
    expect(getAction([c('10'), c('6')], c('10'))).toBe('Hit')
  })

  it('A-A vs anything -> Split', () => {
    expect(getAction([c('A'), c('A')], c('6'))).toBe('Split')
    expect(getAction([c('A'), c('A')], c('A'))).toBe('Split')
  })

  it('8-8 -> Split', () => {
    expect(getAction([c('8'), c('8')], c('10'))).toBe('Split')
  })

  it('soft 18 vs 9 -> Hit', () => {
    expect(getAction([c('A'), c('7')], c('9'))).toBe('Hit')
  })

  it('hard 11 vs anything -> Double', () => {
    const upcards: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']
    for (const rank of upcards) {
      expect(getAction([c('6'), c('5')], c(rank))).toBe('Double')
    }
  })

  it('hard 12 vs 3 -> Hit', () => {
    expect(getAction([c('10'), c('2')], c('3'))).toBe('Hit')
  })

  it('hard 13 vs 6 -> Stand', () => {
    expect(getAction([c('10'), c('3')], c('6'))).toBe('Stand')
  })

  // H17 (dealer hits soft 17) spot checks — these three cells are the
  // well-known "H17 adds a double" set; all three are Stand/Hit under S17.
  it('soft 18 (A,7) vs 2 -> Double (H17; would be Stand under S17)', () => {
    expect(getAction([c('A'), c('7')], c('2'))).toBe('Double')
  })

  it('soft 19 (A,8) vs 6 -> Double (H17; would be Stand under S17)', () => {
    expect(getAction([c('A'), c('8')], c('6'))).toBe('Double')
  })

  it('hard 11 vs A -> Double (H17-correct; S17 charts say Hit vs Ace)', () => {
    expect(getAction([c('6'), c('5')], c('A'))).toBe('Double')
  })
})

describe('getSituationKey', () => {
  it('builds hard total keys', () => {
    expect(getSituationKey([c('10'), c('6')], c('10'))).toBe('hard-16-vs-10')
  })

  it('builds soft total keys', () => {
    expect(getSituationKey([c('A'), c('7')], c('9'))).toBe('soft-18-vs-9')
  })

  it('builds pair keys, bucketing face cards as 10', () => {
    expect(getSituationKey([c('8'), c('8')], c('10'))).toBe('pair-8-vs-10')
    expect(getSituationKey([c('K'), c('Q')], c('5'))).toBe('pair-10-vs-5')
  })
})

describe('getHardSoftAction / getHardSoftSituationKey', () => {
  it('resolves a pair via the hard-total table instead of Split, unlike getAction', () => {
    expect(getAction([c('8'), c('8')], c('10'))).toBe('Split')
    expect(getHardSoftAction([c('8'), c('8')], c('10'))).toBe('Hit') // hard 16 vs 10, per the existing spot-check above
  })

  it('matches getAction/getSituationKey exactly for non-pair hands', () => {
    expect(getHardSoftAction([c('10'), c('6')], c('10'))).toBe(getAction([c('10'), c('6')], c('10')))
    expect(getHardSoftSituationKey([c('A'), c('7')], c('9'))).toBe(getSituationKey([c('A'), c('7')], c('9')))
  })

  it('never returns a pair key, even for a dealt pair', () => {
    expect(getHardSoftSituationKey([c('8'), c('8')], c('10'))).toBe('hard-16-vs-10')
  })

  it('handles 2-2 (hard 4, below the normal hard-total table minimum of 5) without throwing', () => {
    expect(getHardSoftAction([c('2'), c('2')], c('6'))).toBe('Hit')
    expect(getHardSoftSituationKey([c('2'), c('2')], c('6'))).toBe('hard-4-vs-6')
  })

  it('handles A-A (soft 12, below the normal soft-total table minimum of 13) without throwing', () => {
    expect(getHardSoftAction([c('A'), c('A')], c('6'))).toBe('Hit')
    expect(getHardSoftSituationKey([c('A'), c('A')], c('6'))).toBe('soft-12-vs-6')
  })
})
