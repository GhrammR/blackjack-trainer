import { describe, expect, it } from 'vitest'
import { handValue, isBust } from './cards'
import type { Card } from '../types'

const c = (rank: Card['rank']): Card => ({ rank })

describe('handValue', () => {
  it('computes a basic hard total', () => {
    expect(handValue([c('10'), c('6')])).toEqual({ total: 16, soft: false })
  })

  it('treats face cards as 10', () => {
    expect(handValue([c('K'), c('9')])).toEqual({ total: 19, soft: false })
  })

  it('counts a single ace as 11 when it does not bust', () => {
    expect(handValue([c('A'), c('7')])).toEqual({ total: 18, soft: true })
  })

  it('demotes an ace from 11 to 1 when it would otherwise bust', () => {
    // A + 6 = soft 17, drawing a 10 would make it 27 if the ace stayed at
    // 11 — it must demote to 1, giving a hard 17.
    expect(handValue([c('A'), c('6'), c('10')])).toEqual({
      total: 17,
      soft: false,
    })
  })

  it('demotes one of two aces, keeping the other soft', () => {
    // A + A + 9: one ace demotes to 1, the other stays at 11 -> soft 21.
    expect(handValue([c('A'), c('A'), c('9')])).toEqual({
      total: 21,
      soft: true,
    })
  })

  it('demotes both aces if needed', () => {
    // A + A + 9 + 9 = 11+11+9+9 = 40 -> demote both aces -> 1+1+9+9 = 20, hard.
    expect(handValue([c('A'), c('A'), c('9'), c('9')])).toEqual({
      total: 20,
      soft: false,
    })
  })

  it('identifies a bust', () => {
    expect(isBust([c('10'), c('9'), c('5')])).toBe(true)
    expect(isBust([c('10'), c('9')])).toBe(false)
  })
})
