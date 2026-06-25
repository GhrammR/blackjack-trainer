import type { Action, Card } from '../types'
import { createShoe, shuffle } from './shoe'
import { hiLoValue } from './counting'
import { getAction, getHardSoftAction, isPair } from './strategy'
import { handValue, isBust } from './cards'
import { resolveDealerHand } from './handResolution'
import { type BetSpreadStep, baseBetUnits } from './playerProfiles'

/**
 * The Live Play capstone, slice 1 (v2 step 10): the user plays full hands
 * against the dealer using v1's real chart, while keeping their own
 * running count. Single-seat, continuous/open-ended (no fixed session) —
 * confirmed forks logged in CLAUDE.md §11.
 *
 * This is the first engine in the app where the user can face MORE than
 * one decision per hand: every other engine (detection/evidence/evasion)
 * only ever grades a hand's first decision and auto-resolves the rest via
 * plain basic strategy. Here every decision point — including a second,
 * third, or fourth hand created by splitting — is graded independently.
 * `LiveRound.hands` is a small queue processed one at a time; choosing
 * Split replaces the current hand with two new ones (or, for a pair of
 * Aces, two immediately-terminal one-card hands) and `activeHandIndex`
 * advances to the next not-yet-done hand once the current one finishes.
 * Resplitting is allowed up to MAX_HANDS total (the standard real-table
 * cap); split Aces never get hit again (the near-universal real rule).
 */

const SAFETY_MARGIN = 20
const MAX_HANDS = 4

export interface LivePlaySessionState {
  shoe: Card[]
  position: number
  count: number
}

export function startLivePlaySession(numDecks: number, random: () => number = Math.random): LivePlaySessionState {
  return { shoe: shuffle(createShoe(numDecks), random), position: 0, count: 0 }
}

/** True once the shoe is too depleted to safely deal another round — the caller should start a fresh session (count resets to 0, same trigger `RunningCountDrill` already uses). */
export function needsReshuffle(state: LivePlaySessionState): boolean {
  return state.shoe.length - state.position < SAFETY_MARGIN
}

/**
 * Decks remaining in the shoe right now. Slice 2 (step 10) hands this to the
 * user directly at the count checkpoint rather than asking them to estimate
 * it — deck estimation is already trained standalone by the True Count
 * drill, so this isolates just the running-count -> true-count conversion
 * step. See CLAUDE.md §11.
 */
export function decksRemaining(state: LivePlaySessionState): number {
  return (state.shoe.length - state.position) / 52
}

/**
 * Slice 3 (step 10) ground-truth bet ramp: pure EV optimization, not a
 * simulated counter persona (those live in playerProfiles.ts and model
 * camouflage, which is out of scope here — see DECISIONS.md). Reuses
 * BetSpreadStep/baseBetUnits rather than duplicating the step-function
 * logic. Unlike the detection-family profiles, this isn't a single
 * objectively-correct chart (optimal spread width is a risk-tolerance
 * judgment call, not a strategy-table fact) — it's a deliberately
 * conservative, widely-taught ramp, tunable here if that judgment changes.
 */
export const EV_BET_RAMP: BetSpreadStep[] = [
  { minTrueCount: -Infinity, units: 1 },
  { minTrueCount: 2, units: 2 },
  { minTrueCount: 3, units: 4 },
  { minTrueCount: 4, units: 6 },
  { minTrueCount: 5, units: 8 },
]

/** The discrete bet sizes a user can choose from, in ramp order — drives both grading and the UI's preset buttons. */
export const BET_TIERS: number[] = EV_BET_RAMP.map((step) => step.units)

/** The EV-correct bet size for a given true count, per `EV_BET_RAMP`. */
export function correctBetUnits(trueCountAtBet: number): number {
  return baseBetUnits(EV_BET_RAMP, trueCountAtBet)
}

function makeDrawers(shoe: Card[], position: number, count: number) {
  let pos = position
  let cnt = count
  function draw(): Card {
    const card = shoe[pos]
    pos += 1
    return card
  }
  function drawAndCount(): Card {
    const card = draw()
    cnt += hiLoValue(card.rank)
    return card
  }
  function addToCount(delta: number): void {
    cnt += delta
  }
  return { draw, drawAndCount, addToCount, position: () => pos, count: () => cnt }
}

export interface PlayHand {
  cards: Card[]
  /** Double/Split/Surrender are only legal on a hand's first decision (standard rule). */
  isFirstDecision: boolean
  /** Split Aces get exactly one more card and are immediately done — never offered a decision. */
  isSplitAces: boolean
  done: boolean
  surrendered: boolean
}

export interface LiveRound {
  hands: PlayHand[]
  /** Index into `hands` awaiting a decision; -1 once every hand has reached a terminal state. */
  activeHandIndex: number
  dealerUpcard: Card
  /** Dealt at round start (shoe depletes) but not added to the running count until `resolveDealer` reveals it. */
  holeCard: Card
}

function freshHand(cards: Card[]): PlayHand {
  return { cards, isFirstDecision: true, isSplitAces: false, done: false, surrendered: false }
}

export function dealRound(state: LivePlaySessionState): { state: LivePlaySessionState; round: LiveRound } {
  const d = makeDrawers(state.shoe, state.position, state.count)
  const playerCards = [d.drawAndCount(), d.drawAndCount()]
  const dealerUpcard = d.drawAndCount()
  const holeCard = d.draw()

  return {
    state: { shoe: state.shoe, position: d.position(), count: d.count() },
    round: { hands: [freshHand(playerCards)], activeHandIndex: 0, dealerUpcard, holeCard },
  }
}

function nextActiveHandIndex(hands: PlayHand[], from: number): number {
  for (let i = from; i < hands.length; i++) {
    if (!hands[i].done) return i
  }
  return -1
}

export function isRoundOver(round: LiveRound): boolean {
  return round.activeHandIndex === -1
}

function canSplit(round: LiveRound): boolean {
  const hand = round.hands[round.activeHandIndex]
  return hand.isFirstDecision && hand.cards.length === 2 && isPair(hand.cards) && round.hands.length < MAX_HANDS
}

/** Surrender is only legal as the very first decision of the round, before any split has happened. */
function canSurrender(round: LiveRound): boolean {
  const hand = round.hands[round.activeHandIndex]
  return hand.isFirstDecision && round.hands.length === 1
}

/** The actions legally available for the round's current active hand. Empty once the round is over (or, transiently, for a split-Aces hand, which is never actually offered a decision). */
export function legalActions(round: LiveRound): Action[] {
  if (isRoundOver(round)) return []
  const hand = round.hands[round.activeHandIndex]
  if (hand.isSplitAces) return []

  const actions: Action[] = ['Hit', 'Stand']
  if (hand.isFirstDecision) {
    actions.push('Double')
    if (canSplit(round)) actions.push('Split')
    if (canSurrender(round)) actions.push('Surrender')
  }
  return actions
}

/**
 * When basic strategy says Double but doubling isn't legal right now (the
 * hand has already taken its first decision), the real fallback isn't a
 * fixed "always Hit" — every Double cell in this app's chart collapses to
 * Hit except soft 18 (vs 3-6), which collapses to Stand instead. This
 * holds across every Double cell in `hardTotals`/`softTotals` (verified by
 * checking each one, not assumed): hard 9/10/11 and soft 13-17 are all
 * below 18 and always favor another card regardless of doubling; soft 18
 * is the one Double cell at or above 18, where the hand is already strong
 * enough to stand on once doubling for value isn't on the table. Pairs
 * never reach this path — a pair's Double cell can only be looked up on a
 * still-2-card hand, which is always a first decision by construction.
 */
function noDoubleAlternative(cards: Card[]): Action {
  return handValue(cards).total >= 18 ? 'Stand' : 'Hit'
}

/** What basic strategy (adjusted for Split/Double legality right now) says is correct for the round's current active hand. */
export function correctActionFor(round: LiveRound): Action {
  const hand = round.hands[round.activeHandIndex]
  const action = getAction(hand.cards, round.dealerUpcard)

  if (action === 'Split' && !canSplit(round)) return getHardSoftAction(hand.cards, round.dealerUpcard)
  if (action === 'Double' && !hand.isFirstDecision) return noDoubleAlternative(hand.cards)
  return action
}

function splitHand(hand: PlayHand, drawCard: () => Card): [PlayHand, PlayHand] {
  const isAces = hand.cards[0].rank === 'A'
  const make = (card: Card): PlayHand => ({
    cards: [card, drawCard()],
    isFirstDecision: true,
    isSplitAces: isAces,
    done: isAces,
    surrendered: false,
  })
  return [make(hand.cards[0]), make(hand.cards[1])]
}

export function applyAction(
  state: LivePlaySessionState,
  round: LiveRound,
  action: Action,
): { state: LivePlaySessionState; round: LiveRound } {
  const d = makeDrawers(state.shoe, state.position, state.count)
  const hands = [...round.hands]
  const idx = round.activeHandIndex
  const hand = hands[idx]

  let nextIdx = idx

  switch (action) {
    case 'Stand':
      hands[idx] = { ...hand, done: true }
      nextIdx = nextActiveHandIndex(hands, idx + 1)
      break
    case 'Surrender':
      hands[idx] = { ...hand, done: true, surrendered: true }
      nextIdx = nextActiveHandIndex(hands, idx + 1)
      break
    case 'Double': {
      const cards = [...hand.cards, d.drawAndCount()]
      hands[idx] = { ...hand, cards, isFirstDecision: false, done: true }
      nextIdx = nextActiveHandIndex(hands, idx + 1)
      break
    }
    case 'Hit': {
      const cards = [...hand.cards, d.drawAndCount()]
      const bust = isBust(cards)
      hands[idx] = { ...hand, cards, isFirstDecision: false, done: bust }
      nextIdx = bust ? nextActiveHandIndex(hands, idx + 1) : idx
      break
    }
    case 'Split': {
      const [h1, h2] = splitHand(hand, d.drawAndCount)
      hands.splice(idx, 1, h1, h2)
      nextIdx = nextActiveHandIndex(hands, idx)
      break
    }
  }

  return {
    state: { shoe: state.shoe, position: d.position(), count: d.count() },
    round: { ...round, hands, activeHandIndex: nextIdx },
  }
}

export interface DecisionResult {
  chosenAction: Action
  correctAction: Action
  isCorrect: boolean
  state: LivePlaySessionState
  round: LiveRound
}

/** Grades `chosenAction` against what basic strategy indicates right now, then applies it. */
export function decide(state: LivePlaySessionState, round: LiveRound, chosenAction: Action): DecisionResult {
  const correctAction = correctActionFor(round)
  const { state: nextState, round: nextRound } = applyAction(state, round, chosenAction)
  return { chosenAction, correctAction, isCorrect: chosenAction === correctAction, state: nextState, round: nextRound }
}

export interface DealerResolution {
  state: LivePlaySessionState
  dealerCards: Card[]
  dealerBusted: boolean
}

/** Resolves the dealer's hand once every player hand is done. Reveals (and finally counts) the hole card first. */
export function resolveDealer(state: LivePlaySessionState, round: LiveRound): DealerResolution {
  const d = makeDrawers(state.shoe, state.position, state.count)
  d.addToCount(hiLoValue(round.holeCard.rank))
  const result = resolveDealerHand(round.dealerUpcard, round.holeCard, d.drawAndCount)
  return {
    state: { shoe: state.shoe, position: d.position(), count: d.count() },
    dealerCards: result.cards,
    dealerBusted: result.busted,
  }
}

export type HandOutcome = 'win' | 'lose' | 'push' | 'bust' | 'surrendered'

export function handOutcome(hand: PlayHand, dealerCards: Card[], dealerBusted: boolean): HandOutcome {
  if (hand.surrendered) return 'surrendered'
  const playerTotal = handValue(hand.cards).total
  if (playerTotal > 21) return 'bust'
  if (dealerBusted) return 'win'
  const dealerTotal = handValue(dealerCards).total
  if (playerTotal > dealerTotal) return 'win'
  if (playerTotal < dealerTotal) return 'lose'
  return 'push'
}

const OUTCOME_UNIT_MULTIPLIER: Record<HandOutcome, number> = {
  win: 1,
  lose: -1,
  bust: -1,
  push: 0,
  surrendered: -0.5,
}

/**
 * A flavor-only net-units tally for the step 11 visual pass's one approved
 * display line — NOT a real payout simulation. Every hand in the round is
 * weighted by the single bet placed before the round (doubles and extra
 * split bets are deliberately not modeled), since this is a derived display
 * value, not a graded or persisted mechanic. See DECISIONS.md.
 */
export function netUnitsForRound(hands: PlayHand[], dealerCards: Card[], dealerBusted: boolean, betUnits: number): number {
  return hands.reduce((sum, hand) => sum + OUTCOME_UNIT_MULTIPLIER[handOutcome(hand, dealerCards, dealerBusted)] * betUnits, 0)
}
