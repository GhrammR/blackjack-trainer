import { describe, expect, it } from 'vitest'
import type { EvasionRoundRecord } from './evasionSession'
import { finalizeRounds, scoreSession } from './evasionScoring'

type RawRound = Omit<EvasionRoundRecord, 'isElevatedBet'>

function rawRound(overrides: Partial<RawRound>): RawRound {
  return {
    roundNumber: 1,
    trueCountAtBet: 0,
    bet: 1,
    initialPlayerHand: [],
    finalPlayerHand: [],
    dealerUpcard: { rank: '10' },
    situationKey: 'hard-16-vs-10',
    basicAction: 'Hit',
    indicatedAction: null,
    chosenAction: 'Hit',
    actions: ['Hit'],
    deviated: false,
    deviationType: null,
    playerBusted: false,
    ...overrides,
  }
}

describe('finalizeRounds', () => {
  it('marks every round above the session minimum bet as elevated', () => {
    const rounds = [rawRound({ roundNumber: 1, bet: 1 }), rawRound({ roundNumber: 2, bet: 5 }), rawRound({ roundNumber: 3, bet: 1 })]
    const finalized = finalizeRounds(rounds)
    expect(finalized.map((r) => r.isElevatedBet)).toEqual([false, true, false])
  })

  it('flags nothing as elevated when every round bet the same amount', () => {
    const rounds = [rawRound({ bet: 3 }), rawRound({ bet: 3 })]
    expect(finalizeRounds(rounds).every((r) => !r.isElevatedBet)).toBe(true)
  })

  it('returns an empty array for an empty session', () => {
    expect(finalizeRounds([])).toEqual([])
  })
})

describe('scoreSession', () => {
  it('counts heat using the same evidence rule as slice 3: elevated bets or real index deviations', () => {
    const rounds = finalizeRounds([
      rawRound({ roundNumber: 1, bet: 1, trueCountAtBet: 0 }),
      rawRound({ roundNumber: 2, bet: 8, trueCountAtBet: 3 }), // elevated -> evidence
      rawRound({ roundNumber: 3, bet: 1, trueCountAtBet: 0, deviationType: 'index' }), // real deviation -> evidence
      rawRound({ roundNumber: 4, bet: 1, trueCountAtBet: 0, deviationType: 'cover' }), // camouflage -> not evidence
    ])
    const card = scoreSession(rounds)
    expect(card.heat).toBe(2)
    expect(card.totalRounds).toBe(4)
  })

  it('computes a raw edge score as sum(bet * trueCountAtBet), and flat/aggressive baselines off the same true-count trajectory', () => {
    const rounds = finalizeRounds([
      rawRound({ roundNumber: 1, bet: 1, trueCountAtBet: 0 }),
      rawRound({ roundNumber: 2, bet: 8, trueCountAtBet: 3 }),
    ])
    const card = scoreSession(rounds)
    expect(card.rawEdgeScore).toBe(1 * 0 + 8 * 3) // 24
    expect(card.flatEdgeScore).toBe(1 * 0 + 1 * 3) // 3 (always 1 unit)
    // Aggressive (beginner spread: 1 unit below TC 2, 8 units at/above TC 2) bets 1 at TC0, 8 at TC3.
    expect(card.aggressiveEdgeScore).toBe(1 * 0 + 8 * 3) // 24
  })

  it('scores 100% edge captured when the user matches the aggressive baseline exactly', () => {
    const rounds = finalizeRounds([rawRound({ roundNumber: 1, bet: 8, trueCountAtBet: 3 })])
    const card = scoreSession(rounds)
    expect(card.edgeCapturedPct).toBe(100)
  })

  it('scores 0% edge captured when the user bets flat throughout', () => {
    const rounds = finalizeRounds([
      rawRound({ roundNumber: 1, bet: 1, trueCountAtBet: 0 }),
      rawRound({ roundNumber: 2, bet: 1, trueCountAtBet: 3 }),
    ])
    const card = scoreSession(rounds)
    expect(card.edgeCapturedPct).toBe(0)
  })

  it('returns null edgeCapturedPct when the aggressive and flat baselines are identical (the count never moved)', () => {
    const rounds = finalizeRounds([rawRound({ roundNumber: 1, bet: 5, trueCountAtBet: 0 })])
    const card = scoreSession(rounds)
    expect(card.edgeCapturedPct).toBeNull()
  })
})
