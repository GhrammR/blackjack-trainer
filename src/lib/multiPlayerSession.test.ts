import { describe, expect, it } from 'vitest'
import type { Card, Rank } from '../types'
import { dealMultiPlayerSession, generateMultiPlayerSession } from './multiPlayerSession'
import { SESSION_ROUNDS } from './detectionSession'

const c = (rank: Rank): Card => ({ rank })

describe('dealMultiPlayerSession — shared shoe, per-seat resolution', () => {
  it('deals round-robin, shares one running count across seats, and excludes the hole card until revealed', () => {
    // Seat 0: 10,7 (hard 17 -> Stand). Seat 1: 9,8 (hard 17 -> Stand). Dealer: 10 up, A hole.
    // Padded to exactly 40 cards: SHOE_SAFETY_MARGIN_PER_SEAT(20) * seatCount(2) = 40,
    // so round 1 proceeds (40 - 0 >= 40) and round 2 is skipped (40 - 6 = 34 < 40).
    const filler = Array.from({ length: 34 }, () => c('7'))
    const shoe = [c('10'), c('9'), c('7'), c('8'), c('10'), c('A'), ...filler]
    // random forced high so counterSeatIndex = floor(0.99 * 2) = 1, and (since the
    // counter's coverDeviationRate is 0 at beginner) no deviation logic kicks in either way.
    const session = dealMultiPlayerSession(shoe, 2, 'beginner', () => 0.99)

    expect(session.seatCount).toBe(2)
    expect(session.counterSeatIndex).toBe(1)
    expect(session.rounds).toHaveLength(1)

    const [seat0, seat1] = session.rounds[0].seats
    expect(seat0.finalPlayerHand).toEqual([c('10'), c('7')])
    expect(seat1.finalPlayerHand).toEqual([c('9'), c('8')])
    expect(seat0.basicAction).toBe('Stand')
    expect(seat1.basicAction).toBe('Stand')
    expect(seat0.dealerUpcard).toEqual(c('10'))
    expect(seat1.dealerUpcard).toEqual(c('10'))
    // Both seats bet off the same shared trueCountAtBet (round hasn't started yet -> 0).
    expect(seat0.trueCountAtBet).toBe(0)
    expect(seat1.trueCountAtBet).toBe(0)
  })

  it('exactly one seat is a counter and the rest are flat bettors (never deviate, never camouflage)', () => {
    const session = generateMultiPlayerSession(6, 4, 'expert', () => 0.5)
    const counterCount = session.rounds[0].seats.filter((_s, i) => i === session.counterSeatIndex).length
    expect(counterCount).toBe(1)

    for (const round of session.rounds) {
      for (let s = 0; s < session.seatCount; s++) {
        if (s === session.counterSeatIndex) continue
        expect(round.seats[s].deviated).toBe(false)
        expect(round.seats[s].isCoverBet).toBe(false)
      }
    }
  })
})

describe('generateMultiPlayerSession — structural correctness', () => {
  it('produces a record for every seat, every round', () => {
    const session = generateMultiPlayerSession(6, 4, 'beginner', () => 0.3)
    for (const round of session.rounds) {
      expect(round.seats).toHaveLength(4)
    }
  })

  it('scales the required shoe size with seat count instead of starving a session with more seats', () => {
    const session = generateMultiPlayerSession(1, 6, 'intermediate', () => 0.3)
    expect(session.rounds.length).toBeGreaterThanOrEqual(SESSION_ROUNDS - 2)
  })

  it('never lets a seat\'s basicAction be Split or Surrender (no player-side split, matching slice 1)', () => {
    for (const seed of [0.1, 0.4, 0.7]) {
      const session = generateMultiPlayerSession(6, 3, 'expert', () => seed)
      for (const round of session.rounds) {
        for (const seat of round.seats) {
          expect(['Hit', 'Stand', 'Double']).toContain(seat.basicAction)
        }
      }
    }
  })

  it('every seat bets at least 1 unit, every round', () => {
    const session = generateMultiPlayerSession(6, 4, 'expert', () => 0.01)
    for (const round of session.rounds) {
      for (const seat of round.seats) {
        expect(seat.bet).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('does not throw and reaches a reasonable round count across many real-random runs', () => {
    for (let i = 0; i < 10; i++) {
      const session = generateMultiPlayerSession(2, 4, 'expert')
      expect(session.rounds.length).toBeGreaterThan(5)
    }
  })
})
