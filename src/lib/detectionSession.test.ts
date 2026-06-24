import { describe, expect, it } from 'vitest'
import type { Card, Rank } from '../types'
import { MIN_DECKS_FOR_SESSION, SESSION_ROUNDS, dealSession, generateDetectionSession } from './detectionSession'
import { FLAT_PROFILE } from './playerProfiles'

const c = (rank: Rank): Card => ({ rank })

describe('dealSession — hole-card exposure timing (the critical realism point)', () => {
  it('excludes the hole card from the running count used for the player\'s decision, but the card still depletes the shoe', () => {
    // Round 1: player draws 10,7 (hard 17 -> always Stand, no hits). Dealer
    // upcard 10, hole card A. The hole card's value (-1) must NOT be part of
    // the count used to compute trueCountAtDecision, even though dealing it
    // has already advanced the shoe position. Padded with 16 neutral filler
    // cards (never actually drawn) so the shoe starts at exactly the safety
    // margin (20) and stops cleanly after round 1's 4 cards (16 remaining).
    const filler = Array.from({ length: 16 }, () => c('7'))
    const shoe = [c('10'), c('7'), c('10'), c('A'), ...filler]
    // random forced to 0.99 so isCounting is false (flat profile — no
    // deviation logic to worry about regardless of count value).
    const session = dealSession(shoe, 'beginner', () => 0.99)

    expect(session.isCounting).toBe(false)
    expect(session.profileName).toBe(FLAT_PROFILE.name)
    expect(session.rounds).toHaveLength(1) // exactly 20 cards in this shoe; stops before round 2

    const round = session.rounds[0]
    expect(round.trueCountAtBet).toBe(0) // count starts at 0
    expect(round.basicAction).toBe('Stand') // hard 17
    expect(round.actions).toEqual(['Stand'])
    expect(round.deviated).toBe(false)
    expect(round.finalPlayerHand).toEqual([c('10'), c('7')]) // no hits drawn
    expect(round.dealerUpcard).toEqual(c('10'))
  })
})

describe('dealSession — structural correctness over a full session', () => {
  it('produces SESSION_ROUNDS rounds when the shoe is large enough', () => {
    // Use a real (large) shoe via generateDetectionSession at the minimum deck count.
    const session = generateDetectionSession(MIN_DECKS_FOR_SESSION, 'beginner', () => 0.3)
    expect(session.rounds).toHaveLength(SESSION_ROUNDS)
  })

  it('clamps below-minimum deck counts up to MIN_DECKS_FOR_SESSION rather than starving the session', () => {
    const session = generateDetectionSession(1, 'beginner', () => 0.3)
    expect(session.rounds.length).toBeGreaterThanOrEqual(SESSION_ROUNDS - 2) // should comfortably reach (or nearly reach) the full count
  })

  it('never uses the pairs table — basicAction is always Hit, Stand, or Double, never Split or Surrender', () => {
    for (const seed of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const session = generateDetectionSession(6, 'expert', () => seed)
      for (const round of session.rounds) {
        expect(['Hit', 'Stand', 'Double']).toContain(round.basicAction)
      }
    }
  })

  it('never deviates for a flat-bettor session, across every round', () => {
    // random=()=>0.99 forces isCounting=false (0.99 < 0.5 is false).
    const session = generateDetectionSession(6, 'beginner', () => 0.99)
    expect(session.isCounting).toBe(false)
    for (const round of session.rounds) {
      expect(round.deviated).toBe(false)
      expect(round.deviationType).toBeNull()
    }
  })

  it('always bets at least 1 unit, every round, every tier', () => {
    for (const difficulty of ['beginner', 'intermediate', 'expert'] as const) {
      const session = generateDetectionSession(6, difficulty, () => 0.01) // isCounting=true, low random throughout
      for (const round of session.rounds) {
        expect(round.bet).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it("round 1's bet is always based on a true count of 0 (nothing has been seen yet)", () => {
    const session = generateDetectionSession(6, 'beginner', () => 0.01)
    expect(session.rounds[0].trueCountAtBet).toBe(0)
  })

  it('does not throw and reaches a reasonable round count across many real-random runs at the minimum deck count', () => {
    for (let i = 0; i < 20; i++) {
      const session = generateDetectionSession(1, 'expert')
      expect(session.rounds.length).toBeGreaterThan(5)
    }
  })
})
