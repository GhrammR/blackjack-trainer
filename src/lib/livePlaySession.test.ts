import { describe, expect, it } from 'vitest'
import type { Card, Rank } from '../types'
import type { RuleConfig } from './strategy'
import {
  type LivePlaySessionState,
  type LiveRound,
  type PlayHand,
  applyAction,
  correctActionFor,
  correctBetUnits,
  dealRound,
  dealRoundFromHand,
  decide,
  handOutcome,
  handPayout,
  isRoundOver,
  netUnitsForRound,
  legalActions,
  decksRemaining,
  needsReshuffle,
  resolveDealer,
  roundPayout,
  startLivePlaySession,
} from './livePlaySession'

const c = (rank: Rank): Card => ({ rank })

// 6 decks/H17 (matches strategy.ts's proven base chart) — the two rule
// configs these tests need, named for readability at each call site.
const NO_SURRENDER: RuleConfig = { numDecks: 6, soft17Rule: 'H17', surrenderMode: 'none' }
const LATE_SURRENDER: RuleConfig = { numDecks: 6, soft17Rule: 'H17', surrenderMode: 'late' }

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

describe('dealRound — natural blackjack auto-resolves', () => {
  it('marks a 2-card Ace+10-value starting hand done immediately, with no decision offered', () => {
    const shoe = [c('A'), c('K'), c('9'), c('2'), c('7')]
    const { round } = dealRound(stateFrom(shoe))

    expect(round.hands[0].cards).toEqual([c('A'), c('K')])
    expect(round.hands[0].done).toBe(true)
    expect(round.activeHandIndex).toBe(-1)
    expect(isRoundOver(round)).toBe(true)
    expect(legalActions(round, NO_SURRENDER)).toEqual([])
  })

  it('resolves as a win against a non-blackjack dealer hand, and a push against a dealer natural', () => {
    const shoe = [c('A'), c('10'), c('9'), c('2'), c('7')]
    const { state: afterDeal, round } = dealRound(stateFrom(shoe))
    const winResolution = resolveDealer(afterDeal, round)
    expect(handOutcome(round.hands[0], winResolution.dealerCards, winResolution.dealerBusted)).toBe('win')

    const pushShoe = [c('A'), c('10'), c('A'), c('K')]
    const { state: afterPushDeal, round: pushRound } = dealRound(stateFrom(pushShoe))
    const pushResolution = resolveDealer(afterPushDeal, pushRound)
    expect(handOutcome(pushRound.hands[0], pushResolution.dealerCards, pushResolution.dealerBusted)).toBe('push')
  })

  it('does not treat a 2-card 20, or a 3-card 21 reached via a hit, as a natural', () => {
    const shoe = [c('10'), c('K'), c('9'), c('2'), c('7')]
    const { round } = dealRound(stateFrom(shoe))
    expect(round.hands[0].done).toBe(false)
    expect(round.activeHandIndex).toBe(0)
  })
})

describe('dealRoundFromHand — builds a round from a caller-supplied hand (Basic Strategy Trainer)', () => {
  it('uses the given hand and dealer upcard exactly, with the active hand ready for a first decision', () => {
    // drawShoe[0] is now consumed as the real hole card (see dealRoundFromHand's own
    // comment) — the rest of the shoe (from position 1) backs subsequent Hit/Split draws.
    const drawShoe = [c('7'), c('3'), c('9')]
    const { state, round } = dealRoundFromHand([c('10'), c('6')], c('10'), drawShoe)

    expect(round.hands[0].cards).toEqual([c('10'), c('6')])
    expect(round.hands[0].isFirstDecision).toBe(true)
    expect(round.hands[0].done).toBe(false)
    expect(round.activeHandIndex).toBe(0)
    expect(round.dealerUpcard).toEqual(c('10'))
    expect(round.holeCard).toEqual(c('7')) // real card now, not a dealerUpcard placeholder
    expect(state.shoe).toBe(drawShoe)
    expect(state.position).toBe(1)
  })

  it('feeds legalActions/decide/applyAction exactly like a dealt round, including a real pair offering Split', () => {
    // [0] = hole card, [1]/[2] = the two split hands' second cards.
    const { state, round } = dealRoundFromHand([c('8'), c('8')], c('9'), [c('2'), c('5'), c('4')])
    expect(legalActions(round, NO_SURRENDER)).toContain('Split')
    expect(correctActionFor(round, NO_SURRENDER)).toBe('Split')

    const result = decide(state, round, 'Split', NO_SURRENDER)
    expect(result.isCorrect).toBe(true)
    expect(result.round.hands).toHaveLength(2)
  })

  it('does not offer Split for a non-pair 2-card hand (e.g. Ace+King)', () => {
    const { round } = dealRoundFromHand([c('A'), c('K')], c('6'), [c('2')])
    // A natural blackjack (A+K) auto-resolves with no decision offered at all.
    expect(isRoundOver(round)).toBe(true)
    expect(legalActions(round, NO_SURRENDER)).toEqual([])
  })

  it('does not offer Split for a non-pair, non-blackjack 2-card hand', () => {
    const { round } = dealRoundFromHand([c('9'), c('7')], c('6'), [c('2')])
    expect(legalActions(round, NO_SURRENDER)).not.toContain('Split')
  })

  it('auto-resolves a natural blackjack hand with no decision offered, same as dealRound', () => {
    const { round } = dealRoundFromHand([c('A'), c('Q')], c('9'), [c('2')])
    expect(round.hands[0].done).toBe(true)
    expect(round.activeHandIndex).toBe(-1)
    expect(isRoundOver(round)).toBe(true)
  })

  it('grades a full hand out via decide/applyAction the same as a dealt round would', () => {
    const drawShoe = [c('2'), c('3')] // [0] = hole card; [1] = the Hit card, taking hard 12 vs 6 up to 15
    const { state, round } = dealRoundFromHand([c('6'), c('6')], c('6'), drawShoe)
    // 6,6 vs 6 is a real pair -> basic strategy says Split, not Hit.
    expect(correctActionFor(round, NO_SURRENDER)).toBe('Split')
    const result = decide(state, round, 'Hit', NO_SURRENDER)
    expect(result.isCorrect).toBe(false)
    expect(result.round.hands[0].cards).toEqual([c('6'), c('6'), c('3')])
  })
})

describe('legalActions', () => {
  it('surrenderEnabled defaults to false: never offers Surrender even on an otherwise-eligible first decision', () => {
    const round: LiveRound = {
      hands: [{ cards: [c('10'), c('7')], isFirstDecision: true, isSplitAces: false, done: false, surrendered: false }],
      activeHandIndex: 0,
      dealerUpcard: c('9'),
      holeCard: c('2'),
    }
    expect(legalActions(round, NO_SURRENDER)).toEqual(['Hit', 'Stand', 'Double'])
    expect(legalActions(round, NO_SURRENDER)).toEqual(['Hit', 'Stand', 'Double'])
  })

  it('offers Hit/Stand/Double/Surrender on a non-pair first decision when surrenderEnabled', () => {
    const round: LiveRound = {
      hands: [{ cards: [c('10'), c('7')], isFirstDecision: true, isSplitAces: false, done: false, surrendered: false }],
      activeHandIndex: 0,
      dealerUpcard: c('9'),
      holeCard: c('2'),
    }
    expect(legalActions(round, LATE_SURRENDER)).toEqual(['Hit', 'Stand', 'Double', 'Surrender'])
  })

  it('also offers Split on a pair first decision when under the hand cap (Surrender only when enabled)', () => {
    const round: LiveRound = {
      hands: [{ cards: [c('8'), c('8')], isFirstDecision: true, isSplitAces: false, done: false, surrendered: false }],
      activeHandIndex: 0,
      dealerUpcard: c('9'),
      holeCard: c('2'),
    }
    expect(legalActions(round, NO_SURRENDER)).toEqual(['Hit', 'Stand', 'Double', 'Split'])
    expect(legalActions(round, LATE_SURRENDER)).toEqual(['Hit', 'Stand', 'Double', 'Split', 'Surrender'])
  })

  it('excludes Split once the hand cap (4) is reached, even on an eligible pair', () => {
    const pairHand = { cards: [c('8'), c('8')], isFirstDecision: true, isSplitAces: false, done: false, surrendered: false }
    const round: LiveRound = {
      hands: [pairHand, pairHand, pairHand, pairHand],
      activeHandIndex: 2,
      dealerUpcard: c('9'),
      holeCard: c('2'),
    }
    expect(legalActions(round, LATE_SURRENDER)).not.toContain('Split')
  })

  it('excludes Surrender once any split has happened, even on a fresh hand\'s first decision and even when surrenderEnabled', () => {
    const hand = { cards: [c('8'), c('2')], isFirstDecision: true, isSplitAces: false, done: false, surrendered: false }
    const round: LiveRound = { hands: [hand, hand], activeHandIndex: 0, dealerUpcard: c('9'), holeCard: c('2') }
    expect(legalActions(round, LATE_SURRENDER)).not.toContain('Surrender')
  })

  it('only offers Hit/Stand on a non-first decision (after a Hit), regardless of surrenderEnabled', () => {
    const round: LiveRound = {
      hands: [{ cards: [c('10'), c('2'), c('4')], isFirstDecision: false, isSplitAces: false, done: false, surrendered: false }],
      activeHandIndex: 0,
      dealerUpcard: c('9'),
      holeCard: c('2'),
    }
    expect(legalActions(round, NO_SURRENDER)).toEqual(['Hit', 'Stand'])
    expect(legalActions(round, LATE_SURRENDER)).toEqual(['Hit', 'Stand'])
  })

  it('never offers a decision on a split-Aces hand', () => {
    const round: LiveRound = {
      hands: [{ cards: [c('A'), c('5')], isFirstDecision: true, isSplitAces: true, done: true, surrendered: false }],
      activeHandIndex: 0,
      dealerUpcard: c('9'),
      holeCard: c('2'),
    }
    expect(legalActions(round, NO_SURRENDER)).toEqual([])
  })

  it('returns no actions once the round is over', () => {
    const round: LiveRound = {
      hands: [{ cards: [c('10'), c('7')], isFirstDecision: false, isSplitAces: false, done: true, surrendered: false }],
      activeHandIndex: -1,
      dealerUpcard: c('9'),
      holeCard: c('2'),
    }
    expect(legalActions(round, NO_SURRENDER)).toEqual([])
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
    expect(correctActionFor(roundFor([c('10'), c('6')], c('10'), true), NO_SURRENDER)).toBe('Hit') // hard 16 vs 10
  })

  it('matches the real pairs table when Split is legal', () => {
    expect(correctActionFor(roundFor([c('8'), c('8')], c('10'), true), NO_SURRENDER)).toBe('Split')
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
    expect(correctActionFor(round, NO_SURRENDER)).toBe('Hit')
  })

  it('falls back to Hit when the chart says Double but doubling is no longer legal (hard 11, below 18)', () => {
    // 2+3+6 = hard 11, reached via a Hit, so isFirstDecision is false.
    expect(correctActionFor(roundFor([c('2'), c('3'), c('6')], c('5'), false), NO_SURRENDER)).toBe('Hit')
  })

  it('falls back to Stand when the chart says Double but doubling is no longer legal (soft 18, at/above 18 — the one cell where the no-double fallback is NOT Hit)', () => {
    // A+2+5 = soft 18, reached via a Hit, so isFirstDecision is false. Vs dealer 5, basic strategy's
    // doubling-allowed answer is Double; soft 18 is strong enough to stand on once that's off the table.
    expect(correctActionFor(roundFor([c('A'), c('2'), c('5')], c('5'), false), NO_SURRENDER)).toBe('Stand')
  })

  it('still returns Double for the same soft-18-vs-5 hand when it IS the first decision', () => {
    expect(correctActionFor(roundFor([c('A'), c('7')], c('5'), true), NO_SURRENDER)).toBe('Double')
  })
})

describe('correctActionFor — surrenderEnabled', () => {
  function roundFor(cards: Card[], dealerUpcard: Card, isFirstDecision: boolean): LiveRound {
    return {
      hands: [{ cards, isFirstDecision, isSplitAces: false, done: false, surrendered: false }],
      activeHandIndex: 0,
      dealerUpcard,
      holeCard: c('2'),
    }
  }

  it('defaults to false: hard 16 vs 10 stays Hit even though it would be Surrender if enabled', () => {
    const round = roundFor([c('10'), c('6')], c('10'), true)
    expect(correctActionFor(round, NO_SURRENDER)).toBe('Hit')
    expect(correctActionFor(round, NO_SURRENDER)).toBe('Hit')
  })

  it('when enabled and legal (first decision, no split yet), returns Surrender for the sourced cells', () => {
    expect(correctActionFor(roundFor([c('10'), c('6')], c('10'), true), LATE_SURRENDER)).toBe('Surrender') // hard 16 vs 10
    expect(correctActionFor(roundFor([c('10'), c('6')], c('A'), true), LATE_SURRENDER)).toBe('Surrender') // hard 16 vs A
    expect(correctActionFor(roundFor([c('10'), c('5')], c('A'), true), LATE_SURRENDER)).toBe('Surrender') // hard 15 vs A
    expect(correctActionFor(roundFor([c('10'), c('7')], c('A'), true), LATE_SURRENDER)).toBe('Surrender') // hard 17 vs A
  })

  it('when enabled, pair 8,8 vs A stays Split — the correctness fix (see DECISIONS.md): under our always-DAS-on rule set, that cell is never a surrender cell', () => {
    expect(correctActionFor(roundFor([c('8'), c('8')], c('A'), true), LATE_SURRENDER)).toBe('Split')
  })

  it('when enabled but Surrender is not legal right now (not the first decision), falls back to the base no-surrender chart instead of Surrender', () => {
    // 3+3+10 = hard 16 vs 10, reached via a Hit, so isFirstDecision is false — Surrender is never legal
    // here even with the setting on; must fall back to the base chart's Hit, not "Surrender".
    expect(correctActionFor(roundFor([c('3'), c('3'), c('10')], c('10'), false), LATE_SURRENDER)).toBe('Hit')
  })

  it('when enabled but Surrender is not legal right now (already split), the Split-illegal hard/soft bypass never returns Surrender', () => {
    const pairHand = { cards: [c('8'), c('8')], isFirstDecision: true, isSplitAces: false, done: false, surrendered: false }
    const round: LiveRound = {
      hands: [pairHand, pairHand, pairHand, pairHand], // hand cap reached -> Split illegal -> hard/soft bypass reads 8+8 as hard 16
      activeHandIndex: 0,
      dealerUpcard: c('10'), // hard 16 vs 10 would be Surrender if this were a legal surrender point
      holeCard: c('2'),
    }
    expect(correctActionFor(round, LATE_SURRENDER)).toBe('Hit')
  })

  it('cells outside the sourced surrender list are unaffected when enabled', () => {
    // hard 16 vs 8 is not one of the 7 sourced surrender cells (only 9/10/A are) — stays Hit either way.
    expect(correctActionFor(roundFor([c('10'), c('6')], c('8'), true), NO_SURRENDER)).toBe('Hit')
    expect(correctActionFor(roundFor([c('10'), c('6')], c('8'), true), LATE_SURRENDER)).toBe('Hit')
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
    expect(legalActions(afterFirstSplit, NO_SURRENDER)).toContain('Split')

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
    expect(legalActions(roundWithThatHandActive, NO_SURRENDER)).not.toContain('Split')
    expect(correctActionFor(roundWithThatHandActive, NO_SURRENDER)).not.toBe('Split')
  })
})

describe('decide', () => {
  it('grades the chosen action against correctActionFor and applies it in one call', () => {
    const shoe = [c('10'), c('6'), c('10'), c('5')]
    const { state: afterDeal, round: dealt } = dealRound(stateFrom(shoe))
    const result = decide(afterDeal, dealt, 'Stand', NO_SURRENDER) // hard 16 vs 10 -> basic strategy says Hit
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

describe('netUnitsForRound', () => {
  const hand = (cards: Card[], surrendered = false) => ({
    cards,
    isFirstDecision: false,
    isSplitAces: false,
    done: true,
    surrendered,
  })

  it('weights a single hand by the bet and the outcome multiplier', () => {
    expect(netUnitsForRound([hand([c('10'), c('9')])], [c('10'), c('7')], false, 4)).toBe(4) // win
    expect(netUnitsForRound([hand([c('10'), c('6')])], [c('10'), c('9')], false, 4)).toBe(-4) // lose
    expect(netUnitsForRound([hand([c('10'), c('9')])], [c('10'), c('9')], false, 4)).toBe(0) // push
    expect(netUnitsForRound([hand([c('10'), c('6')], true)], [c('10'), c('9')], false, 4)).toBe(-2) // surrendered
  })

  it('sums across multiple hands in a round (e.g. after a split)', () => {
    const hands = [hand([c('10'), c('9')]), hand([c('10'), c('6')])]
    expect(netUnitsForRound(hands, [c('10'), c('7')], false, 2)).toBe(0) // +2 win, -2 lose
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
        const actions = legalActions(round, NO_SURRENDER)
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

// ── handPayout / roundPayout — the real chip-payout consequence layer ──────────

function hand(cards: Card[], overrides: Partial<PlayHand> = {}): PlayHand {
  return { cards, isFirstDecision: false, isSplitAces: false, done: true, surrendered: false, ...overrides }
}

describe('handPayout', () => {
  it('plain win: player total beats a non-busted, non-natural dealer total', () => {
    expect(handPayout(hand([c('10'), c('9')]), 25, [c('10'), c('8')], false)).toBe(25) // 19 vs 18
  })

  it('plain lose: player total is beaten by a non-busted dealer total', () => {
    expect(handPayout(hand([c('10'), c('8')]), 25, [c('10'), c('9')], false)).toBe(-25) // 18 vs 19
  })

  it('push: equal, non-natural totals return the bet (net 0)', () => {
    expect(handPayout(hand([c('10'), c('9')]), 25, [c('10'), c('9')], false)).toBe(0) // 19 vs 19
  })

  it('dealer bust: player wins regardless of their own total (as long as they didn\'t bust first)', () => {
    expect(handPayout(hand([c('10'), c('6')]), 25, [c('10'), c('9'), c('5')], true)).toBe(25) // dealer 24, busted
  })

  it('player bust: always loses, even if the dealer also busted', () => {
    expect(handPayout(hand([c('10'), c('6'), c('9')]), 25, [c('10'), c('9'), c('5')], true)).toBe(-25) // player 25
  })

  it('natural blackjack pays 3:2 against a non-natural dealer total, even a dealer 21', () => {
    expect(handPayout(hand([c('A'), c('K')], { isNatural: true }), 20, [c('7'), c('7'), c('7')], false)).toBe(30) // dealer 21, but not natural
  })

  it('natural blackjack pushes (not wins) against a dealer natural', () => {
    expect(handPayout(hand([c('A'), c('K')], { isNatural: true }), 20, [c('A'), c('Q')], false)).toBe(0)
  })

  it('surrender loses exactly half the wager, regardless of the eventual dealer/player totals', () => {
    expect(handPayout(hand([c('10'), c('6')], { surrendered: true }), 20, [c('10'), c('9')], false)).toBe(-10)
  })

  it('a doubled hand wagers 2x for both win and loss', () => {
    expect(handPayout(hand([c('5'), c('6'), c('9')], { doubled: true }), 20, [c('10'), c('9')], false)).toBe(40) // player 20 vs dealer 19
    expect(handPayout(hand([c('5'), c('6'), c('2')], { doubled: true }), 20, [c('10'), c('9')], false)).toBe(-40) // player 13 vs dealer 19
  })

  it('a natural is never doubled in practice, but if doubled were somehow set it would not double the 3:2 payout path (isNatural takes priority, doubled is ignored for a natural since wagered already folds it in consistently)', () => {
    // isNatural + doubled is unreachable in real play (a doubled hand has 3 cards, isBlackjack requires 2) —
    // documented here as a defensive proof the math still composes sanely if it ever were true.
    expect(handPayout(hand([c('A'), c('K')], { isNatural: true, doubled: true }), 20, [c('10'), c('9')], false)).toBe(60) // 1.5 * (20*2)
  })
})

describe('roundPayout', () => {
  it('sums independent per-hand payouts across a split round', () => {
    const hands = [
      hand([c('8'), c('9')]), // 17 vs dealer 19 -> lose
      hand([c('8'), c('10')], { doubled: true }), // 18 vs dealer 19 -> lose, doubled
    ]
    expect(roundPayout(hands, 10, [c('10'), c('9')], false)).toBe(-10 + -20)
  })

  it('mixes a win and a loss across split hands correctly', () => {
    const hands = [
      hand([c('8'), c('9')]), // 17 vs dealer 16 -> win
      hand([c('8'), c('4')]), // 12 vs dealer 16 -> lose
    ]
    expect(roundPayout(hands, 10, [c('10'), c('6')], false)).toBe(10 + -10)
  })
})

// ── isNatural / doubled tracking through the real factories ────────────────────

describe('PlayHand.isNatural / PlayHand.doubled tracking', () => {
  it('dealRound marks a real 2-card 21 as natural', () => {
    const shoe = [c('A'), c('K'), c('9'), c('2'), c('7')]
    const { round } = dealRound(stateFrom(shoe))
    expect(round.hands[0].isNatural).toBe(true)
  })

  it('dealRoundFromHand marks a real 2-card 21 as natural', () => {
    const { round } = dealRoundFromHand([c('A'), c('Q')], c('9'), [c('2')])
    expect(round.hands[0].isNatural).toBe(true)
  })

  it('a split-created 21 is never natural, even though it looks like blackjack card-wise', () => {
    const shoe = [c('K'), c('K'), c('9'), c('2'), c('A'), c('7')]
    const { state, round: dealt } = dealRound(stateFrom(shoe))
    const { round: afterSplit } = applyAction(state, dealt, 'Split')
    // One of the two split hands is K + A = 21, but it must not be flagged natural.
    const twentyOne = afterSplit.hands.find((h) => h.cards.length === 2 && h.cards.some((card) => card.rank === 'A'))
    expect(twentyOne?.isNatural).toBe(false)
  })

  it('applyAction marks a hand doubled only when Double is chosen', () => {
    const shoe = [c('5'), c('6'), c('9'), c('2'), c('7')]
    const { state, round: dealt } = dealRound(stateFrom(shoe))
    const { round: afterDouble } = applyAction(state, dealt, 'Double')
    expect(afterDouble.hands[0].doubled).toBe(true)

    const { round: afterStand } = applyAction(state, dealt, 'Stand')
    expect(afterStand.hands[0].doubled).toBeFalsy()
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
