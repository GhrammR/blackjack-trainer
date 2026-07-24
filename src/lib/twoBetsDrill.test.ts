import { describe, expect, it } from 'vitest'
import type { RuleConfig } from './strategy'
import { classifyTwoBetCandidates, generateScenario, verifySituationKey } from './twoBetsDrill'

const SIX_DECK_H17: RuleConfig = { numDecks: 6, soft17Rule: 'H17', surrenderMode: 'none', das: true }
const SIX_DECK_S17: RuleConfig = { numDecks: 6, soft17Rule: 'S17', surrenderMode: 'none', das: true }
const ONE_DECK_H17: RuleConfig = { numDecks: 1, soft17Rule: 'H17', surrenderMode: 'none', das: true }

describe('classifyTwoBetCandidates', () => {
  it('hard 8 vs 9 is a trap at 6-deck (never doubles at 2+ decks)', () => {
    const classified = classifyTwoBetCandidates(SIX_DECK_H17)
    expect(classified.hardDouble.trap).toContain('hard-8-vs-9')
    expect(classified.hardDouble.correct).not.toContain('hard-8-vs-9')
  })

  it('hard 8 vs 5 and vs 6 are correct doubles at 1-deck only (the memo\'s example, generalized)', () => {
    const oneDeck = classifyTwoBetCandidates(ONE_DECK_H17)
    expect(oneDeck.hardDouble.correct).toContain('hard-8-vs-5')
    expect(oneDeck.hardDouble.correct).toContain('hard-8-vs-6')

    const sixDeck = classifyTwoBetCandidates(SIX_DECK_H17)
    expect(sixDeck.hardDouble.trap).toContain('hard-8-vs-5')
    expect(sixDeck.hardDouble.trap).toContain('hard-8-vs-6')
  })

  it('pair 10,10 is a permanent trap under every dealer upcard and every rule config', () => {
    for (const rules of [SIX_DECK_H17, SIX_DECK_S17, ONE_DECK_H17]) {
      const classified = classifyTwoBetCandidates(rules)
      for (const dealer of ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']) {
        expect(classified.split.trap).toContain(`pair-10-vs-${dealer}`)
        expect(classified.split.correct).not.toContain(`pair-10-vs-${dealer}`)
      }
    }
  })

  it('pair A,A is always a correct split, never a trap, under every rule config', () => {
    for (const rules of [SIX_DECK_H17, SIX_DECK_S17, ONE_DECK_H17]) {
      const classified = classifyTwoBetCandidates(rules)
      for (const dealer of ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']) {
        expect(classified.split.correct).toContain(`pair-A-vs-${dealer}`)
      }
    }
  })

  it('pair 5,5 is never a split — either a correct double (weak dealer) or a trap Hit (strong dealer), never in the split pool', () => {
    const classified = classifyTwoBetCandidates(SIX_DECK_H17)
    for (const dealer of ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']) {
      const key = `pair-5-vs-${dealer}`
      const inCorrect = classified.split.correct.includes(key)
      const inTrap = classified.split.trap.includes(key)
      expect(inCorrect || inTrap).toBe(true)
      // The correct action for pair 5,5, wherever it lands, is Double or Hit — never Split.
      expect(['Double', 'Hit']).toContain(classified.split.actionByKey[key])
    }
  })

  it('hard 11 vs A is a correct double at the fixed H17 default (this app\'s always-Double-11 rule)', () => {
    const classified = classifyTwoBetCandidates(SIX_DECK_H17)
    expect(classified.hardDouble.correct).toContain('hard-11-vs-A')
  })

  it('soft 18 vs dealer 2 flips category with the soft-17 rule: Double (correct) under H17, Stand (trap) under S17', () => {
    const h17 = classifyTwoBetCandidates(SIX_DECK_H17)
    expect(h17.softDouble.correct).toContain('soft-18-vs-2')
    expect(h17.softDouble.trap).not.toContain('soft-18-vs-2')

    const s17 = classifyTwoBetCandidates(SIX_DECK_S17)
    expect(s17.softDouble.trap).toContain('soft-18-vs-2')
    expect(s17.softDouble.correct).not.toContain('soft-18-vs-2')
  })

  it('never includes a Surrender-correct candidate in either pool', () => {
    const dasOffLateSurrender: RuleConfig = { numDecks: 6, soft17Rule: 'H17', surrenderMode: 'late', das: false }
    const classified = classifyTwoBetCandidates(dasOffLateSurrender)
    // Pair 8,8 vs A is a Surrender cell under DAS-off + late surrender + H17 at 6-deck (see strategy.ts's DAS_OFF_LATE_SURRENDER_PAIR_CELLS).
    expect(classified.split.correct).not.toContain('pair-8-vs-A')
    expect(classified.split.trap).not.toContain('pair-8-vs-A')
  })

  it('every category has both a correct instance and a trap instance under the default rule set', () => {
    const classified = classifyTwoBetCandidates(SIX_DECK_H17)
    for (const category of ['hardDouble', 'softDouble', 'split'] as const) {
      expect(classified[category].correct.length).toBeGreaterThan(0)
      expect(classified[category].trap.length).toBeGreaterThan(0)
    }
  })
})

describe('generateScenario', () => {
  it('produces a hand whose situation key matches the generated cards, across many seeds', () => {
    const classified = classifyTwoBetCandidates(SIX_DECK_H17)
    for (let i = 0; i < 100; i++) {
      const scenario = generateScenario(classified, () => (i % 97) / 97)
      expect(verifySituationKey(scenario)).toBe(true)
    }
  })

  it('correctAction is always Double/Split when not a trap, and always Hit/Stand when a trap', () => {
    const classified = classifyTwoBetCandidates(SIX_DECK_H17)
    for (let i = 0; i < 200; i++) {
      const scenario = generateScenario(classified, () => (i % 191) / 191)
      if (scenario.isTrap) {
        expect(['Hit', 'Stand']).toContain(scenario.correctAction)
      } else {
        expect(['Double', 'Split']).toContain(scenario.correctAction)
      }
    }
  })

  it('produces real-random sessions without throwing, across many runs', () => {
    const classified = classifyTwoBetCandidates(SIX_DECK_H17)
    for (let i = 0; i < 50; i++) {
      const scenario = generateScenario(classified)
      expect(scenario.playerHand).toHaveLength(2)
      expect(['hardDouble', 'softDouble', 'split']).toContain(scenario.category)
    }
  })

  it('always deals exactly a 2-card starting hand', () => {
    const classified = classifyTwoBetCandidates(SIX_DECK_H17)
    for (let i = 0; i < 100; i++) {
      const scenario = generateScenario(classified, () => (i % 89) / 89)
      expect(scenario.playerHand).toHaveLength(2)
    }
  })
})
