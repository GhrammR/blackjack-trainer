import { describe, expect, it } from 'vitest'
import { getAction, getSituationKey } from './strategy'
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
