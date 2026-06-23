import { describe, expect, it } from 'vitest'
import {
  DECK_ESTIMATE_TOLERANCE,
  HALF_DECK,
  decksRemainingFromPlayedEstimate,
  generateTrueCountScenario,
  gradeEstimate,
  gradeTrueCountMath,
  tickMarks,
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

  it('computes actualDecksPlayed from the cards already dealt, in decks', () => {
    const shoe = createShoe(6)
    const scenario = generateTrueCountScenario(shoe, () => 0.3)
    expect(scenario.actualDecksPlayed).toBe(scenario.cardsDealt / 52)
  })

  it('handles a single deck, which has only one valid split point', () => {
    const shoe = createShoe(1)
    const scenario = generateTrueCountScenario(shoe, () => 0.7)
    expect(scenario.cardsDealt).toBe(HALF_DECK)
    expect(scenario.actualDecksPlayed).toBe(0.5)
  })
})

describe('decksRemainingFromPlayedEstimate', () => {
  it('subtracts played decks from the shoe size', () => {
    expect(decksRemainingFromPlayedEstimate(6, 2)).toBe(4)
    expect(decksRemainingFromPlayedEstimate(6, 2.5)).toBe(3.5)
  })

  it('can go negative if the estimate exceeds the shoe size (caller/trueCount clamps downstream)', () => {
    expect(decksRemainingFromPlayedEstimate(6, 8)).toBe(-2)
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
  it('is correct when the submission matches the math on the supplied decks-remaining figure', () => {
    // running count 8, decks remaining 4 -> 8/4 = 2
    const grade = gradeTrueCountMath(8, 4, 2)
    expect(grade.isCorrect).toBe(true)
    expect(grade.expected).toBe(2)
  })

  it('is incorrect when the submission does not match', () => {
    expect(gradeTrueCountMath(8, 4, 999).isCorrect).toBe(false)
  })

  it('grades against whatever decks-remaining figure is passed in, not a hidden actual value', () => {
    // running count 5, decks remaining 2 (e.g. derived from a played estimate) -> 5/2 = 2.5 -> rounds to 3
    const grade = gradeTrueCountMath(5, 2, 3)
    expect(grade.isCorrect).toBe(true)
    expect(grade.expected).toBe(3)
  })

  it('documents the inherited negative-half rounding behavior (see CLAUDE.md §11)', () => {
    // running count -5, decks remaining 2 -> -5/2 = -2.5 -> Math.round rounds toward
    // +Infinity, landing on -2 rather than the -3 a manual "round away from zero" might expect.
    const grade = gradeTrueCountMath(-5, 2, -2)
    expect(grade.isCorrect).toBe(true)
    expect(grade.expected).toBe(-2)
  })
})

describe('tickMarks', () => {
  it('returns no ticks for expert difficulty', () => {
    expect(tickMarks(6, 'expert')).toEqual([])
  })

  it('returns only labeled whole-deck ticks for intermediate difficulty', () => {
    const ticks = tickMarks(6, 'intermediate')
    expect(ticks).toHaveLength(5)
    expect(ticks.every((t) => t.label !== undefined)).toBe(true)
    expect(ticks.map((t) => t.fraction)).toEqual([1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6])
    expect(ticks.map((t) => t.label)).toEqual(['1', '2', '3', '4', '5'])
  })

  it('adds unlabeled half-deck ticks for beginner difficulty', () => {
    const ticks = tickMarks(6, 'beginner')
    expect(ticks).toHaveLength(11) // 5 labeled whole-deck + 6 unlabeled half-deck
    const labeled = ticks.filter((t) => t.label !== undefined)
    const unlabeled = ticks.filter((t) => t.label === undefined)
    expect(labeled).toHaveLength(5)
    expect(unlabeled).toHaveLength(6)
    expect(unlabeled.map((t) => t.fraction)).toEqual([0.5 / 6, 1.5 / 6, 2.5 / 6, 3.5 / 6, 4.5 / 6, 5.5 / 6])
  })

  it('returns ticks sorted by fraction', () => {
    const ticks = tickMarks(6, 'beginner')
    const fractions = ticks.map((t) => t.fraction)
    expect(fractions).toEqual([...fractions].sort((a, b) => a - b))
  })

  it('handles a single deck: no whole-deck ticks, one half-deck tick at beginner', () => {
    expect(tickMarks(1, 'intermediate')).toEqual([])
    expect(tickMarks(1, 'beginner')).toEqual([{ fraction: 0.5 }])
  })
})
