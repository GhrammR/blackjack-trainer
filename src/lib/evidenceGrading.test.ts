import { describe, expect, it } from 'vitest'
import type { RoundRecord } from './detectionSession'
import { gradeFlags, isEvidenceRound } from './evidenceGrading'

function round(overrides: Partial<RoundRecord>): RoundRecord {
  return {
    roundNumber: 1,
    trueCountAtBet: 0,
    bet: 1,
    isCoverBet: false,
    isElevatedBet: false,
    initialPlayerHand: [],
    finalPlayerHand: [],
    dealerUpcard: { rank: '10' },
    situationKey: 'hard-16-vs-10',
    basicAction: 'Hit',
    actions: ['Hit'],
    deviated: false,
    deviationType: null,
    playerBusted: false,
    ...overrides,
  }
}

describe('isEvidenceRound', () => {
  it('is evidence when the bet was elevated and not camouflaged', () => {
    expect(isEvidenceRound(round({ isElevatedBet: true }))).toBe(true)
  })

  it('is evidence when a real index deviation occurred', () => {
    expect(isEvidenceRound(round({ deviationType: 'index' }))).toBe(true)
  })

  it('is NOT evidence for a cover deviation, even though it is still a deviation', () => {
    expect(isEvidenceRound(round({ deviationType: 'cover' }))).toBe(false)
  })

  it('is NOT evidence for a plain flat round', () => {
    expect(isEvidenceRound(round({}))).toBe(false)
  })
})

describe('gradeFlags', () => {
  const rounds = [
    round({ roundNumber: 1, isElevatedBet: true }), // evidence
    round({ roundNumber: 2 }), // not evidence
    round({ roundNumber: 3, deviationType: 'index' }), // evidence
    round({ roundNumber: 4, deviationType: 'cover' }), // not evidence (camouflage)
    round({ roundNumber: 5 }), // not evidence
  ]

  it('computes precision and recall for a mixed set of correct and incorrect flags', () => {
    // Flags rounds 1 (real evidence), 3 (real evidence), and 4 (false positive). Misses none.
    const grade = gradeFlags(rounds, new Set([1, 3, 4]))
    expect(grade.evidenceRoundNumbers).toEqual([1, 3])
    expect(grade.truePositives).toEqual([1, 3])
    expect(grade.falsePositives).toEqual([4])
    expect(grade.falseNegatives).toEqual([])
    expect(grade.precision).toBeCloseTo(2 / 3)
    expect(grade.recall).toBe(1)
  })

  it('reports false negatives for missed evidence rounds', () => {
    const grade = gradeFlags(rounds, new Set([1]))
    expect(grade.truePositives).toEqual([1])
    expect(grade.falseNegatives).toEqual([3])
    expect(grade.precision).toBe(1)
    expect(grade.recall).toBeCloseTo(0.5)
  })

  it('precision is null when nothing was flagged', () => {
    const grade = gradeFlags(rounds, new Set())
    expect(grade.precision).toBeNull()
    expect(grade.recall).toBe(0)
  })

  it('recall is null when there is no evidence at all in the session (flat bettor)', () => {
    const flatRounds = [round({ roundNumber: 1 }), round({ roundNumber: 2 })]
    const grade = gradeFlags(flatRounds, new Set())
    expect(grade.recall).toBeNull()
    expect(grade.precision).toBeNull()
  })

  it('a false-positive-only flag set on a flat session yields precision 0 and recall null', () => {
    const flatRounds = [round({ roundNumber: 1 }), round({ roundNumber: 2 })]
    const grade = gradeFlags(flatRounds, new Set([1]))
    expect(grade.precision).toBe(0)
    expect(grade.recall).toBeNull()
  })
})
