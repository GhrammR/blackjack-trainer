import { describe, expect, it } from 'vitest'
import { reasonFor } from './reasons'
import { ALL_SITUATION_KEYS, generateHand } from './handGenerator'
import { getAction } from './strategy'
import { categoryOfSituationKey } from './mastery'

describe('reasonFor', () => {
  it('has a reason for every category/action combo that actually appears in the chart', () => {
    for (const key of ALL_SITUATION_KEYS) {
      const { playerHand, dealerUpcard } = generateHand(key)
      const action = getAction(playerHand, dealerUpcard)
      const category = categoryOfSituationKey(key)
      const reason = reasonFor(category, action)
      expect(reason, `missing reason for ${category}-${action} (from ${key})`).toBeTruthy()
    }
  })

  it('returns null for a combo that never occurs (e.g. surrender, never correct in this rule set)', () => {
    expect(reasonFor('hard', 'Surrender')).toBeNull()
  })
})
