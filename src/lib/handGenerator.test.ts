import { describe, expect, it } from 'vitest'
import { generateHand } from './handGenerator'
import { getSituationKey } from './strategy'
import { handValue } from './cards'
import type { DealerUpcardKey, PairRankKey } from '../types'

const DEALER_KEYS: DealerUpcardKey[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']
const PAIR_RANKS: PairRankKey[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']
const HARD_TOTALS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
const SOFT_TOTALS = [13, 14, 15, 16, 17, 18, 19, 20]

// Generation involves a random pick among 10/J/Q/K, so each key is checked
// several times to catch issues tied to a specific ten-bucket rank.
const REPEATS = 8

function allSituationKeys(): string[] {
  const keys: string[] = []
  for (const d of DEALER_KEYS) {
    for (const t of HARD_TOTALS) keys.push(`hard-${t}-vs-${d}`)
    for (const t of SOFT_TOTALS) keys.push(`soft-${t}-vs-${d}`)
    for (const p of PAIR_RANKS) keys.push(`pair-${p}-vs-${d}`)
  }
  return keys
}

describe('generateHand', () => {
  it('round-trips every valid situation key through getSituationKey', () => {
    for (const key of allSituationKeys()) {
      for (let i = 0; i < REPEATS; i++) {
        const { playerHand, dealerUpcard } = generateHand(key)
        expect(getSituationKey(playerHand, dealerUpcard)).toBe(key)
      }
    }
  })

  it('produces hard hands that are actually hard (no usable ace)', () => {
    for (const total of HARD_TOTALS) {
      const { playerHand } = generateHand(`hard-${total}-vs-10`)
      expect(handValue(playerHand)).toEqual({ total, soft: false })
    }
  })

  it('produces soft hands that are actually soft', () => {
    for (const total of SOFT_TOTALS) {
      const { playerHand } = generateHand(`soft-${total}-vs-9`)
      expect(handValue(playerHand)).toEqual({ total, soft: true })
    }
  })

  it('produces two-card hands for pairs', () => {
    for (const rank of PAIR_RANKS) {
      const { playerHand } = generateHand(`pair-${rank}-vs-6`)
      expect(playerHand).toHaveLength(2)
    }
  })

  it('throws on a malformed situation key', () => {
    expect(() => generateHand('nonsense')).toThrow()
  })
})
