import { describe, expect, it } from 'vitest'
import {
  DECK_ESTIMATE_TOLERANCE,
  HALF_DECK,
  gradeEstimate,
  gradeTrueCountMath,
  generateTrueCountScenario,
} from './trueCountDrill'
import { createShoe } from './shoe'
import { runningCount } from './counting'

describe('generateTrueCountScenario', () => {
  it('deals a multiple of half a deck (26 cards)', () => {
    const shoe = createShoe(6)
    const scenario = generateTrueCountScenario(shoe, () => 0.5)
    expect(scenario.cardsDealt % HALF_DECK).toBe(0)
  })

  it('always deals at least half a deck and leaves at least half a deck remaining', () => {
    const shoe = createShoe(6)
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const scenario = generateTrueCountScenario(shoe, () => r)
      expect(scenario.cardsDealt).toBeGreaterThanOrEqual(HALF_DECK)
      expect(scenario.totalCards - scenario.cardsDealt).toBeGreaterThanOrEqual(HALF_DECK)
    }
  })

  it('picks the minimum split when random() returns 0', () => {
    const shoe = createShoe(6)
    const scenario = generateTrueCountScenario(shoe, () => 0)
    expect(scenario.cardsDealt).toBe(HALF_DECK)
  })

  it('picks the maximum split as random() approaches 1', () => {
    const shoe = createShoe(6)
    const scenario = generateTrueCountScenario(shoe, () => 0.999999)
    expect(scenario.totalCards - scenario.cardsDealt).toBe(HALF_DECK)
  })

  it('computes running count as the Hi-Lo sum of exactly the dealt cards', () => {
    const shoe = createShoe(6)
    const scenario = generateTrueCountScenario(shoe, () => 0.3)
    expect(scenario.runningCount).toBe(runningCount(shoe.slice(0, scenario.cardsDealt)))
  })

  it('computes actualDecksRemaining from the cards left, in decks', () => {
    const shoe = createShoe(6)
    const scenario = generateTrueCountScenario(shoe, () => 0.3)
    expect(scenario.actualDecksRemaining).toBe((scenario.totalCards - scenario.cardsDealt) / 52)
  })

  it('handles a single deck, which has only one valid split point', () => {
    const shoe = createShoe(1)
    const scenario = generateTrueCountScenario(shoe, () => 0.7)
    expect(scenario.cardsDealt).toBe(HALF_DECK)
    expect(scenario.actualDecksRemaining).toBe(0.5)
  })
})

describe('gradeEstimate', () => {
  it('is good when exactly on target', () => {
    expect(gradeEstimate(3, 3).isGood).toBe(true)
  })

  it('is good at exactly the tolerance boundary', () => {
    expect(gradeEstimate(3 + DECK_ESTIMATE_TOLERANCE, 3).isGood).toBe(true)
  })

  it('is not good just past the tolerance boundary', () => {
    expect(gradeEstimate(3 + DECK_ESTIMATE_TOLERANCE + 0.01, 3).isGood).toBe(false)
  })

  it('reports the signed delta', () => {
    expect(gradeEstimate(4, 3).delta).toBe(1)
    expect(gradeEstimate(2, 3).delta).toBe(-1)
  })
})

describe('gradeTrueCountMath', () => {
  it('is correct when the submission matches the math on the same estimate', () => {
    // running count 8, decks-remaining estimate 4 -> 8/4 = 2
    const grade = gradeTrueCountMath(8, 4, 2)
    expect(grade.isCorrect).toBe(true)
    expect(grade.expected).toBe(2)
  })

  it('is incorrect when the submission does not match', () => {
    expect(gradeTrueCountMath(8, 4, 999).isCorrect).toBe(false)
  })

  it("grades against the user's own estimate, not the actual deck count", () => {
    // running count 5, decks-remaining estimate 2 -> 5/2 = 2.5 -> rounds to 3
    const grade = gradeTrueCountMath(5, 2, 3)
    expect(grade.isCorrect).toBe(true)
    expect(grade.expected).toBe(3)
  })

  it('documents the inherited negative-half rounding behavior (see CLAUDE.md §11)', () => {
    // running count -5, decks-remaining estimate 2 -> -5/2 = -2.5 -> Math.round rounds toward
    // +Infinity, landing on -2 rather than the -3 a manual "round away from zero" might expect.
    const grade = gradeTrueCountMath(-5, 2, -2)
    expect(grade.isCorrect).toBe(true)
    expect(grade.expected).toBe(-2)
  })
})
