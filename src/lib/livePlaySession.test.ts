import { describe, expect, it } from 'vitest'
import type { Card, Rank } from '../types'
import {
  type LivePlaySessionState,
  type LiveRound,
  applyAction,
  correctActionFor,
  correctBetUnits,
  dealRound,
  decide,
  handOutcome,
  isRoundOver,
  legalActions,
  decksRemaining,
  needsReshuffle,
  resolveDealer,
  startLivePlaySession,
} from './livePlaySession'

const c = (rank: Rank): Card => ({ rank })

function stateFrom(shoe: Card[], position = 0, count = 0): LivePlaySessionState {
  return { shoe, position, count }
}

describe('dealRound — hole-card exposure timing (same critical point as every other v2 session)', () => {
  it('excludes the hole card from the running count, but the card still depletes the shoe', () => {
    const filler = Array.from({ length: 16 }, () => c('7'))
    const shoe = [c('10'), c('7'), c('9'), c('A'), ...filler]
    const { state, round } = dealRound(stateFrom(shoe))

    expect(round.hands[0].cards).toEqual([c('10'), c('7')])
    expect(round.dealerUpcard).toEqual(c('9'))
    expect(round.holeCard).toEqual(c('A'))
    expect(round.activeHandIndex).toBe(0)
    expect(state.position).toBe(4)
    expect(state.count).toBe(-1) // hiLo(10) + hiLo(7) + hiLo(9) = -1 + 0 + 0; hole card (A, -1) excluded
  })
})

describe('legalActions', () => {
  it('offers Hit/Stand/Double/Surrender on a non-pair first decision', () => {
    const round: LiveRound = {
      hands: [{ cards: [c('10'), c('7')], isFirstDecision: true, isSplitAces: false, done: false, surrendered: false }],
      activeHandIndex: 0,
      dealerUpcard: c('9'),
      holeCard: c('2'),
    }
    expect(legalActions(round)).toEqual(['Hit', 'Stand', 'Double', 'Surrender'])
  })

  it('also offers Split on a pair first decision when under the hand cap', () => {
    const round: LiveRound = {
      hands: [{ cards: [c('8'), c('8')], isFirstDecision: true, isSplitAces: false, done: false, surrendered: false }],
      activeHandIndex: 0,
      dealerUpcard: c('9'),
      holeCard: c('2'),
    }
    expect(legalActions(round)).toEqual(['Hit', 'Stand', 'Double', 'Split', 'Surrender'])
  })

  it('excludes Split once the hand cap (4) is reached, even on an eligible pair', () => {
    const pairHand = { cards: [c('8'), c('8')], isFirstDecision: true, isSplitAces: false, done: false, surrendered: false }
    const round: LiveRound = {
      hands: [pairHand, pairHand, pairHand, pairHand],
      activeHandIndex: 2,
      dealerUpcard: c('9'),
      holeCard: c('2'),
    }
    expect(legalActions(round)).not.toContain('Split')
  })

  it('excludes Surrender once any split has happened, even on a fresh hand\'s first decision', () => {
    const hand = { cards: [c('8'), c('2')], isFirstDecision: true, isSplitAces: false, done: false, surrendered: false }
    const round: LiveRound = { hands: [hand, hand], activeHandIndex: 0, dealerUpcard: c('9'), holeCard: c('2') }
    expect(legalActions(round)).not.toContain('Surrender')
  })

  it('only offers Hit/Stand on a non-first decision (after a Hit)', () => {
    const round: LiveRound = {
      hands: [{ cards: [c('10'), c('2'), c('4')], isFirstDecision: false, isSplitAces: false, done: false, surrendered: false }],
      activeHandIndex: 0,
      dealerUpcard: c('9'),
      holeCard: c('2'),
    }
    expect(legalActions(round)).toEqual(['Hit', 'Stand'])
  })

  it('never offers a decision on a split-Aces hand', () => {
    const round: LiveRound = {
      hands: [{ cards: [c('A'), c('5')], isFirstDecision: true, isSplitAces: true, done: true, surrendered: false }],
      activeHandIndex: 0,
      dealerUpcard: c('9'),
      holeCard: c('2'),
    }
    expect(legalActions(round)).toEqual([])
  })

  it('returns no actions once the round is over', () => {
    const round: LiveRound = {
      hands: [{ cards: [c('10'), c('7')], isFirstDecision: false, isSplitAces: false, done: true, surrendered: false }],
      activeHandIndex: -1,
      dealerUpcard: c('9'),
      holeCard: c('2'),
    }
    expect(legalActions(round)).toEqual([])
  })
})

describe('correctActionFor', () => {
  function roundFor(cards: Card[], dealerUpcard: Card, isFirstDecision: boolean): LiveRound {
    return {
      hands: [{ cards, isFirstDecision, isSplitAces: false, done: false, surrendered: false }],
      activeHandIndex: 0,
      dealerUpcard,
      holeCard: c('2'),
    }
  }

  it('matches plain getAction for an ordinary hard-total first decision', () => {
    expect(correctActionFor(roundFor([c('10'), c('6')], c('10'), true))).toBe('Hit') // hard 16 vs 10
  })

  it('matches the real pairs table when Split is legal', () => {
    expect(correctActionFor(roundFor([c('8'), c('8')], c('10'), true))).toBe('Split')
  })

  it('falls back to the hard/soft bypass when the chart says Split but the hand cap is reached', () => {
    const pairHand = { cards: [c('8'), c('8')], isFirstDecision: true, isSplitAces: false, done: false, surrendered: false }
    const round: LiveRound = {
      hands: [pairHand, pairHand, pairHand, pairHand],
      activeHandIndex: 0,
      dealerUpcard: c('10'),
      holeCard: c('2'),
    }
    // hard 16 vs 10 (the hard/soft bypass reading of 8+8) is Hit, not Split.
    expect(correctActionFor(round)).toBe('Hit')
  })

  it('falls back to Hit when the chart says Double but doubling is no longer legal (hard 11, below 18)', () => {
    // 2+3+6 = hard 11, reached via a Hit, so isFirstDecision is false.
    expect(correctActionFor(roundFor([c('2'), c('3'), c('6')], c('5'), false))).toBe('Hit')
  })

  it('falls back to Stand when the chart says Double but doubling is no longer legal (soft 18, at/above 18 — the one cell where the no-double fallback is NOT Hit)', () => {
    // A+2+5 = soft 18, reached via a Hit, so isFirstDecision is false. Vs dealer 5, basic strategy's
    // doubling-allowed answer is Double; soft 18 is strong enough to stand on once that's off the table.
    expect(correctActionFor(roundFor([c('A'), c('2'), c('5')], c('5'), false))).toBe('Stand')
  })

  it('still returns Double for the same soft-18-vs-5 hand when it IS the first decision', () => {
    expect(correctActionFor(roundFor([c('A'), c('7')], c('5'), true))).toBe('Double')
  })
})

describe('applyAction', () => {
  it('Hit that does not bust keeps the same hand active and clears isFirstDecision', () => {
    const shoe = [c('10'), c('2'), c('9'), c('3'), c('5')]
    const { state: afterDeal, round: dealt } = dealRound(stateFrom(shoe))
    const { state, round } = applyAction(afterDeal, dealt, 'Hit')
    expect(round.hands[0].cards).toEqual([c('10'), c('2'), c('5')]) // 17, no bust
    expect(round.hands[0].isFirstDecision).toBe(false)
    expect(round.hands[0].done).toBe(false)
    expect(round.activeHandIndex).toBe(0)
    expect(state.count).toBe(hiLoSum(['10', '2', '9', '5']))
  })

  it('Hit that busts ends the hand and the round (single hand)', () => {
    const shoe = [c('10'), c('2'), c('9'), c('3'), c('K')]
    const { state: afterDeal, round: dealt } = dealRound(stateFrom(shoe))
    const { round } = applyAction(afterDeal, dealt, 'Hit')
    expect(round.hands[0].done).toBe(true)
    expect(isRoundOver(round)).toBe(true)
  })

  it('Stand ends the hand and the round (single hand)', () => {
    const shoe = [c('10'), c('7'), c('9'), c('3')]
    const { state: afterDeal, round: dealt } = dealRound(stateFrom(shoe))
    const { round } = applyAction(afterDeal, dealt, 'Stand')
    expect(round.hands[0].done).toBe(true)
    expect(isRoundOver(round)).toBe(true)
  })

  it('Double draws exactly one card and ends the hand', () => {
    const shoe = [c('6'), c('5'), c('9'), c('3'), c('9')]
    const { state: afterDeal, round: dealt } = dealRound(stateFrom(shoe))
    const { state, round } = applyAction(afterDeal, dealt, 'Double')
    expect(round.hands[0].cards).toEqual([c('6'), c('5'), c('9')])
    expect(round.hands[0].done).toBe(true)
    expect(isRoundOver(round)).toBe(true)
    expect(state.position).toBe(5) // exactly one extra card drawn
  })

  it('Surrender ends the hand without drawing a card', () => {
    const shoe = [c('10'), c('6'), c('9'), c('3')]
    const { state: afterDeal, round: dealt } = dealRound(stateFrom(shoe))
    const { state, round } = applyAction(afterDeal, dealt, 'Surrender')
    expect(round.hands[0].done).toBe(true)
    expect(round.hands[0].surrendered).toBe(true)
    expect(state.position).toBe(4) // no extra card drawn beyond the initial deal
  })

  it('Split on a non-Ace pair creates two first-decision hands and keeps the first one active', () => {
    const shoe = [c('8'), c('8'), c('9'), c('3'), c('2'), c('5')]
    const { state: afterDeal, round: dealt } = dealRound(stateFrom(shoe))
    const { round } = applyAction(afterDeal, dealt, 'Split')
    expect(round.hands).toHaveLength(2)
    expect(round.hands[0]).toMatchObject({ cards: [c('8'), c('2')], isFirstDecision: true, isSplitAces: false, done: false })
    expect(round.hands[1]).toMatchObject({ cards: [c('8'), c('5')], isFirstDecision: true, isSplitAces: false, done: false })
    expect(round.activeHandIndex).toBe(0)
  })

  it('Split on Aces deals one card to each and ends the round immediately (single starting hand)', () => {
    const shoe = [c('A'), c('A'), c('9'), c('3'), c('5'), c('6')]
    const { state: afterDeal, round: dealt } = dealRound(stateFrom(shoe))
    const { round } = applyAction(afterDeal, dealt, 'Split')
    expect(round.hands).toHaveLength(2)
    expect(round.hands[0]).toMatchObject({ cards: [c('A'), c('5')], isSplitAces: true, done: true })
    expect(round.hands[1]).toMatchObject({ cards: [c('A'), c('6')], isSplitAces: true, done: true })
    expect(isRoundOver(round)).toBe(true) // both new hands are already done -> nothing left to act on
  })

  it('supports resplitting: a post-split hand that draws into a new pair can split again, growing the hand count', () => {
    // Initial 8,8 splits into [8,8] and [8,5]; the first resulting [8,8] is itself a fresh pair under the cap.
    const shoe = [c('8'), c('8'), c('10'), c('5'), c('8'), c('5'), c('2'), c('3')]
    const { state: s1, round: dealt } = dealRound(stateFrom(shoe))
    const { state: s2, round: afterFirstSplit } = applyAction(s1, dealt, 'Split')
    expect(afterFirstSplit.hands[0].cards).toEqual([c('8'), c('8')]) // a fresh pair
    expect(legalActions(afterFirstSplit)).toContain('Split')

    const { round: afterResplit } = applyAction(s2, afterFirstSplit, 'Split')
    expect(afterResplit.hands).toHaveLength(3)
    expect(afterResplit.hands[0].cards).toEqual([c('8'), c('2')])
    expect(afterResplit.hands[1].cards).toEqual([c('8'), c('3')])
    expect(afterResplit.hands[2].cards).toEqual([c('8'), c('5')]) // untouched second hand from the first split
  })

  it('stops offering Split once the hand cap (4) is reached, even via real resplitting', () => {
    // 8,8 -> split -> [8,8],[8,8] -> split first -> [8,8],[8,8],[8,8] -> split first again -> 4 hands, two of which are still [8,8] pairs.
    const shoe = [
      c('8'), c('8'), c('10'), c('5'), // initial deal
      c('8'), c('8'), // first split's two new cards
      c('8'), c('8'), // resplit #1's two new cards
      c('2'), c('3'), // resplit #2's two new cards
    ]
    let state = stateFrom(shoe)
    let round: LiveRound
    ;({ state, round } = dealRound(state))
    ;({ state, round } = applyAction(state, round, 'Split'))
    ;({ state, round } = applyAction(state, round, 'Split'))
    ;({ state, round } = applyAction(state, round, 'Split'))

    expect(round.hands).toHaveLength(4)
    expect(round.hands[2].cards).toEqual([c('8'), c('8')]) // still a pair, but at the cap
    const roundWithThatHandActive = { ...round, activeHandIndex: 2 }
    expect(legalActions(roundWithThatHandActive)).not.toContain('Split')
    expect(correctActionFor(roundWithThatHandActive)).not.toBe('Split')
  })
})

describe('decide', () => {
  it('grades the chosen action against correctActionFor and applies it in one call', () => {
    const shoe = [c('10'), c('6'), c('10'), c('5')]
    const { state: afterDeal, round: dealt } = dealRound(stateFrom(shoe))
    const result = decide(afterDeal, dealt, 'Stand') // hard 16 vs 10 -> basic strategy says Hit
    expect(result.correctAction).toBe('Hit')
    expect(result.chosenAction).toBe('Stand')
    expect(result.isCorrect).toBe(false)
    expect(result.round.hands[0].done).toBe(true)
  })
})

describe('resolveDealer', () => {
  it('reveals the hole card into the running count and resolves the dealer hand to completion', () => {
    const shoe = [c('10'), c('7'), c('10'), c('6'), c('5')]
    const { state: afterDeal, round: dealt } = dealRound(stateFrom(shoe))
    const { round } = applyAction(afterDeal, dealt, 'Stand')
    const countBeforeReveal = afterDeal.count // -1 (10) + 0 (7) + -1 (10) = -2, hole card (6, +1) not yet counted
    expect(countBeforeReveal).toBe(-2)

    const resolution = resolveDealer(afterDeal, round)
    expect(resolution.dealerCards).toEqual([c('10'), c('6'), c('5')]) // hits from 16 to 21
    expect(resolution.dealerBusted).toBe(false)
    expect(resolution.state.count).toBe(-2 + 1 + 1) // hole card (6) revealed, then one more hit (5) counted
  })
})

describe('handOutcome', () => {
  const hand = (cards: Card[], surrendered = false) => ({
    cards,
    isFirstDecision: false,
    isSplitAces: false,
    done: true,
    surrendered,
  })

  it('reports bust when the player total exceeds 21, regardless of the dealer', () => {
    expect(handOutcome(hand([c('10'), c('6'), c('K')]), [c('10'), c('7')], false)).toBe('bust')
  })

  it('reports win when the dealer busts and the player did not', () => {
    expect(handOutcome(hand([c('10'), c('8')]), [c('10'), c('6'), c('K')], true)).toBe('win')
  })

  it('compares totals when neither busted', () => {
    expect(handOutcome(hand([c('10'), c('9')]), [c('10'), c('7')], false)).toBe('win') // 19 vs 17
    expect(handOutcome(hand([c('10'), c('6')]), [c('10'), c('9')], false)).toBe('lose') // 16 vs 19
    expect(handOutcome(hand([c('10'), c('9')]), [c('10'), c('9')], false)).toBe('push') // 19 vs 19
  })

  it('reports surrendered regardless of the cards', () => {
    expect(handOutcome(hand([c('10'), c('6')], true), [c('10'), c('9')], false)).toBe('surrendered')
  })
})

describe('needsReshuffle', () => {
  it('is false comfortably above the safety margin and true once below it', () => {
    expect(needsReshuffle(stateFrom(Array.from({ length: 30 }, () => c('7')), 5))).toBe(false) // 25 remaining
    expect(needsReshuffle(stateFrom(Array.from({ length: 30 }, () => c('7')), 15))).toBe(true) // 15 remaining
  })
})

describe('decksRemaining', () => {
  it('converts cards remaining into decks remaining', () => {
    expect(decksRemaining(stateFrom(Array.from({ length: 312 }, () => c('7')), 0))).toBe(6) // 312 remaining = 6 decks
    expect(decksRemaining(stateFrom(Array.from({ length: 312 }, () => c('7')), 260))).toBe(1) // 52 remaining = 1 deck
    expect(decksRemaining(stateFrom(Array.from({ length: 312 }, () => c('7')), 286))).toBe(0.5) // 26 remaining
  })
})

describe('correctBetUnits', () => {
  it('follows the EV_BET_RAMP step function', () => {
    expect(correctBetUnits(-5)).toBe(1)
    expect(correctBetUnits(0)).toBe(1)
    expect(correctBetUnits(1)).toBe(1)
    expect(correctBetUnits(2)).toBe(2)
    expect(correctBetUnits(3)).toBe(4)
    expect(correctBetUnits(4)).toBe(6)
    expect(correctBetUnits(5)).toBe(8)
    expect(correctBetUnits(9)).toBe(8)
  })
})

describe('full session integration', () => {
  it('plays many real-shoe rounds to completion without throwing, including occasional splits', () => {
    let state = startLivePlaySession(6)
    for (let i = 0; i < 100; i++) {
      if (needsReshuffle(state)) state = startLivePlaySession(6)
      let round: LiveRound
      ;({ state, round } = dealRound(state))
      let guard = 0
      while (!isRoundOver(round) && guard < 50) {
        const actions = legalActions(round)
        expect(actions.length).toBeGreaterThan(0)
        const action = actions.includes('Stand') ? 'Stand' : actions[0] // always a legal, terminating choice
        ;({ state, round } = applyAction(state, round, action))
        guard += 1
      }
      expect(guard).toBeLessThan(50)
      const dealer = resolveDealer(state, round)
      state = dealer.state
      for (const hand of round.hands) {
        expect(['win', 'lose', 'push', 'bust', 'surrendered']).toContain(handOutcome(hand, dealer.dealerCards, dealer.dealerBusted))
      }
    }
  })
})

function hiLoSum(ranks: string[]): number {
  const values: Record<string, number> = {
    '2': 1, '3': 1, '4': 1, '5': 1, '6': 1,
    '7': 0, '8': 0, '9': 0,
    '10': -1, J: -1, Q: -1, K: -1, A: -1,
  }
  return ranks.reduce((sum, r) => sum + values[r], 0)
}
