import { describe, expect, it } from 'vitest'
import type { Action, Card, Rank } from '../types'
import {
  type DealtRound,
  type EvasionSessionState,
  beginPlay,
  currentTrueCount,
  dealRound,
  finalizeRound,
  hasRoundsRemaining,
  hitOneCard,
  standPlay,
  startEvasionSession,
} from './evasionSession'

const c = (rank: Rank): Card => ({ rank })

/** Test-only helper mirroring the old one-shot `resolveRound`: locks in `chosenAction`, and — for the interactive 'Hit' case — immediately stands without drawing any extra cards (these tests don't care about the specific cards drawn after the initial decision, only the round's classification/outcome). */
function playRound(
  state: EvasionSessionState,
  dealt: DealtRound,
  bet: number,
  trueCountAtBet: number,
  chosenAction: Action,
  roundNumber: number,
) {
  const { state: afterBegin, play: initialPlay } = beginPlay(state, dealt, chosenAction)
  const finalPlay = initialPlay.done ? initialPlay : standPlay(initialPlay)
  return finalizeRound(afterBegin, dealt, bet, trueCountAtBet, chosenAction, finalPlay, roundNumber)
}

describe('dealRound / playRound — hole-card exposure timing (same critical point as slice 1)', () => {
  it('excludes the hole card from trueCountAtDecision, but the card still depletes the shoe', () => {
    // Player draws 10,7 (hard 17). Dealer upcard 10, hole card A. Padded to
    // exactly the safety margin (20) so the round can deal but a second round can't.
    const filler = Array.from({ length: 16 }, () => c('7'))
    const shoe = [c('10'), c('7'), c('10'), c('A'), ...filler]
    const state: EvasionSessionState = { shoe, position: 0, count: 0 }

    expect(currentTrueCount(state)).toBe(0)
    expect(hasRoundsRemaining(state, 1)).toBe(true)

    const { state: afterDeal, dealt } = dealRound(state)
    expect(dealt.initialPlayerHand).toEqual([c('10'), c('7')])
    expect(dealt.dealerUpcard).toEqual(c('10'))
    expect(dealt.holeCard).toEqual(c('A'))
    expect(dealt.basicAction).toBe('Stand') // hard 17
    // Count so far: 10 (-1) + 7 (0) + dealer 10 (-1) = -2; hole card (A, -1) not yet added.
    expect(afterDeal.count).toBe(-2)
    expect(afterDeal.position).toBe(4) // hole card dealt (advances position) but not counted

    const { state: afterResolve, record } = playRound(afterDeal, dealt, 5, 0, 'Stand', 1)
    expect(record.finalPlayerHand).toEqual([c('10'), c('7')]) // Stand, no draws
    expect(record.deviationType).toBeNull()
    expect(record.bet).toBe(5)
    // Hole card (A) now revealed: count -2 + (-1) = -3.
    expect(afterResolve.count).toBe(-3)
    expect(hasRoundsRemaining(afterResolve, 2)).toBe(false) // 20 - 6 = 14 < safety margin
  })
})

describe('dealRound — indicated index plays', () => {
  it('surfaces the indicated index play when the true count meets its threshold', () => {
    const filler = Array.from({ length: 16 }, () => c('7'))
    // 8+8 (a dealt pair, played as hard 16 via the no-split bypass) plus dealer 10:
    // any two-card hard 16 nets to hiLo 0, so starting from a count of 5 (simulating
    // a positive count already built up earlier in the session) and subtracting the
    // dealer's 10 (-1) leaves count 4; decks remaining clamps to the 0.5 floor (only
    // 16/52 of a deck left) -> TC = round(4 / 0.5) = 8.
    const shoe = [c('8'), c('8'), c('10'), c('5'), ...filler]
    const state: EvasionSessionState = { shoe, position: 0, count: 5 }
    const { dealt } = dealRound(state)
    expect(dealt.situationKey).toBe('hard-16-vs-10')
    expect(dealt.basicAction).toBe('Hit')
    expect(dealt.trueCountAtDecision).toBe(8)
    expect(dealt.indicatedAction).toBe('Stand') // index play: Stand at TC>=0
  })

  it('returns null for indicatedAction when no index play applies', () => {
    const filler = Array.from({ length: 16 }, () => c('7'))
    const shoe = [c('10'), c('6'), c('9'), c('5'), ...filler] // hard 16 vs 9 -> not in INDEX_PLAYS
    const state: EvasionSessionState = { shoe, position: 0, count: 0 }
    const { dealt } = dealRound(state)
    expect(dealt.indicatedAction).toBeNull()
  })
})

describe('playRound — deviation classification matches the user-driven resolver', () => {
  it('classifies taking the indicated play as "index"', () => {
    const filler = Array.from({ length: 16 }, () => c('7'))
    const shoe = [c('8'), c('8'), c('10'), c('5'), ...filler]
    const state: EvasionSessionState = { shoe, position: 0, count: 5 }
    const { state: afterDeal, dealt } = dealRound(state)
    const { record } = playRound(afterDeal, dealt, 1, 0, 'Stand', 1)
    expect(record.deviationType).toBe('index')
    expect(record.deviated).toBe(true)
  })

  it('classifies an unindicated deviation as "cover"', () => {
    const filler = Array.from({ length: 16 }, () => c('7'))
    const shoe = [c('10'), c('6'), c('9'), c('5'), ...filler] // hard 16 vs 9, basic Hit, nothing indicated
    const state: EvasionSessionState = { shoe, position: 0, count: 0 }
    const { state: afterDeal, dealt } = dealRound(state)
    const { record } = playRound(afterDeal, dealt, 1, 0, 'Stand', 1)
    expect(record.deviationType).toBe('cover')
    expect(record.deviated).toBe(true)
  })
})

describe('beginPlay / hitOneCard / standPlay — interactive Hit sequence (Fix 4)', () => {
  it('Stand resolves immediately with no extra card and no interaction needed', () => {
    const shoe = [c('10'), c('7'), c('10'), c('A')]
    const state: EvasionSessionState = { shoe, position: 0, count: 0 }
    const { dealt } = dealRound(state)
    const { play } = beginPlay(state, dealt, 'Stand')
    expect(play.done).toBe(true)
    expect(play.cards).toEqual([c('10'), c('7')])
    expect(play.actions).toEqual(['Stand'])
  })

  it('Double draws exactly one card and resolves immediately', () => {
    const shoe = [c('5'), c('6'), c('10'), c('A'), c('9')]
    const state: EvasionSessionState = { shoe, position: 0, count: 0 }
    const { state: afterDeal, dealt } = dealRound(state)
    const { play } = beginPlay(afterDeal, dealt, 'Double')
    expect(play.done).toBe(true)
    expect(play.cards).toEqual([c('5'), c('6'), c('9')])
    expect(play.actions).toEqual(['Double'])
  })

  it('choosing Hit deals the third card immediately — not a no-op transition before the first real hit', () => {
    const shoe = [c('5'), c('6'), c('10'), c('A'), c('4'), c('3')]
    const state: EvasionSessionState = { shoe, position: 0, count: 0 }
    const { state: afterDeal, dealt } = dealRound(state)
    expect(dealt.initialPlayerHand).toEqual([c('5'), c('6')]) // opening two-card hand, already dealt

    // The FIRST "Hit" click (choosing it as the initial action) must itself deal a card.
    const { state: afterBegin, play: started } = beginPlay(afterDeal, dealt, 'Hit')
    expect(started.cards).toEqual([c('5'), c('6'), c('4')]) // third card dealt right away
    expect(started.actions).toEqual(['Hit'])
    expect(started.done).toBe(false) // 15, not bust — interactive sequence continues

    // A further Hit click deals exactly one more card.
    const { play: afterOneHit } = hitOneCard(afterBegin, started)
    expect(afterOneHit.cards).toEqual([c('5'), c('6'), c('4'), c('3')])
    expect(afterOneHit.done).toBe(false) // 18, not bust — still the user's call

    const stood = standPlay(afterOneHit)
    expect(stood.done).toBe(true)
    expect(stood.actions).toEqual(['Hit', 'Hit', 'Stand'])
  })

  it('busting on the very first Hit resolves immediately, with no extra interactive step', () => {
    const shoe = [c('10'), c('6'), c('10'), c('A'), c('K')]
    const state: EvasionSessionState = { shoe, position: 0, count: 0 }
    const { state: afterDeal, dealt } = dealRound(state)
    const { play: busted } = beginPlay(afterDeal, dealt, 'Hit')
    expect(busted.cards).toEqual([c('10'), c('6'), c('K')])
    expect(busted.actions).toEqual(['Hit'])
    expect(busted.busted).toBe(true)
    expect(busted.done).toBe(true)
  })
})

describe('full session integration', () => {
  it('runs to roughly SESSION_ROUNDS using a real shuffled shoe without throwing', () => {
    let state = startEvasionSession(6)
    let roundNumber = 1
    let rounds = 0
    while (hasRoundsRemaining(state, roundNumber)) {
      const { state: afterDeal, dealt } = dealRound(state)
      const trueCountAtBet = currentTrueCount(state)
      const { state: afterResolve } = playRound(afterDeal, dealt, 1, trueCountAtBet, dealt.basicAction, roundNumber)
      state = afterResolve
      rounds += 1
      roundNumber += 1
    }
    expect(rounds).toBeGreaterThan(15)
  })
})
