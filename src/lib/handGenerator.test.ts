import { describe, expect, it } from 'vitest'
import { ALL_SITUATION_KEYS, HARD_TOTALS, PAIR_RANKS, SOFT_TOTALS, generateHand } from './handGenerator'
import { getSituationKey } from './strategy'
import { handValue } from './cards'

// Generation involves a random pick among 10/J/Q/K, so each key is checked
// several times to catch issues tied to a specific ten-bucket rank.
const REPEATS = 8

describe('generateHand', () => {
  it('round-trips every valid situation key through getSituationKey', () => {
    for (const key of ALL_SITUATION_KEYS) {
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
