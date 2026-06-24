import { describe, expect, it } from 'vitest'
import { INDEX_PLAYS } from './indexPlays'
import { generateScenario, verifySituationKey } from './indexPlayDrill'

describe('generateScenario', () => {
  it('produces a hand whose situation key matches the generated cards, across many seeds', () => {
    for (let i = 0; i < 100; i++) {
      const scenario = generateScenario(() => (i % 97) / 97)
      expect(verifySituationKey(scenario)).toBe(true)
    }
  })

  it('produces real-random sessions without throwing, across many runs', () => {
    for (let i = 0; i < 50; i++) {
      const scenario = generateScenario()
      expect(scenario.playerHand.length).toBeGreaterThanOrEqual(2)
      expect(['Hit', 'Stand', 'Double', 'Split', 'Surrender']).toContain(scenario.basicAction)
      expect(['Hit', 'Stand', 'Double', 'Split', 'Surrender']).toContain(scenario.correctAction)
    }
  })

  it('correctAction falls back to basicAction when no index play is indicated', () => {
    // Force the "random" branch (random() >= 0.7) and a situation key with no defined index play.
    const random = (() => {
      const values = [0.99, 0.01, 0.5] // 0.99 picks random branch; 0.01 picks a low-index situation key; 0.5 picks true count
      let i = 0
      return () => values[Math.min(i++, values.length - 1)]
    })()
    const scenario = generateScenario(random)
    if (!scenario.indicatedPlay) {
      expect(scenario.correctAction).toBe(scenario.basicAction)
    }
  })

  it('correctAction follows the indicated deviation when one applies', () => {
    // Force the targeted branch and the first INDEX_PLAYS entry, with the true count sampled to apply the deviation.
    const random = (() => {
      const values = [0.0, 0.0, 0.0, 0.0] // targeted branch, play index 0, deviationApplies=true, offset=0
      let i = 0
      return () => values[Math.min(i++, values.length - 1)]
    })()
    const scenario = generateScenario(random)
    expect(scenario.indicatedPlay).not.toBeNull()
    expect(scenario.correctAction).toBe(scenario.indicatedPlay?.deviateTo)
    expect(scenario.situationKey).toBe(INDEX_PLAYS[0].situationKey)
  })

  it('targeted scenarios always use a situation key drawn from INDEX_PLAYS', () => {
    const indexPlayKeys = new Set(INDEX_PLAYS.map((p) => p.situationKey))
    for (let seed = 0; seed < 30; seed++) {
      // Bias random() low so the 70% targeted branch is taken; vary subsequent draws by seed.
      let call = 0
      const random = () => {
        call += 1
        if (call === 1) return 0.1 // targeted branch
        return ((seed + call) % 11) / 11
      }
      const scenario = generateScenario(random)
      expect(indexPlayKeys.has(scenario.situationKey)).toBe(true)
    }
  })
})
