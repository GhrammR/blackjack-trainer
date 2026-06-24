import type { Action, Card } from '../types'
import { createShoe, shuffle } from './shoe'
import { hiLoValue, trueCount } from './counting'
import { getHardSoftAction, getHardSoftSituationKey } from './strategy'
import { indicatedDeviation } from './indexPlays'
import { resolveDealerHand, resolvePlayerHandWithAction } from './handResolution'
import { MIN_DECKS_FOR_SESSION, SESSION_ROUNDS } from './detectionSession'

/**
 * The evasion mirror (v2 step 8 slice 4): the user plays the counter's
 * seat instead of judging one. Per the user's confirmed scope, this is a
 * decision-only drill — the true count is shown directly each round rather
 * than making the user track it themselves (that combined skill is the
 * future Live Play capstone, §10 step 10, not this slice). Each round the
 * user (1) bets, then (2) chooses how to play a real decision point —
 * straight basic strategy, the count-indicated play, or a deliberate cover
 * deviation — and the session is graded afterward on Heat (would these
 * choices read as evidence to the slice-3 classifier?) and Edge captured
 * (did the bet sizing actually track the count?), see `evasionScoring.ts`.
 *
 * Round-by-round and interactive (unlike slices 1-3's "generate a whole
 * session, then review" shape), since the user's own choices — not a
 * `PlayerProfile`'s dice rolls — drive what happens next. `dealRound` and
 * `resolveRound` are split the same way slice 1's `dealSession` is: dealing
 * (and the dealer's hole-card timing) happens before the user's play
 * decision is locked in, so the running count used for that decision can
 * never see the hole card's value.
 */

const SHOE_SAFETY_MARGIN = 20

export interface EvasionSessionState {
  shoe: Card[]
  position: number
  count: number
}

export function startEvasionSession(numDecks: number, random: () => number = Math.random): EvasionSessionState {
  const shoe = shuffle(createShoe(Math.max(numDecks, MIN_DECKS_FOR_SESSION)), random)
  return { shoe, position: 0, count: 0 }
}

export function hasRoundsRemaining(state: EvasionSessionState, roundNumber: number): boolean {
  return roundNumber <= SESSION_ROUNDS && state.shoe.length - state.position >= SHOE_SAFETY_MARGIN
}

export function currentTrueCount(state: EvasionSessionState): number {
  return trueCount(state.count, (state.shoe.length - state.position) / 52)
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

export interface DealtRound {
  initialPlayerHand: Card[]
  dealerUpcard: Card
  holeCard: Card
  situationKey: string
  basicAction: Action
  indicatedAction: Action | null
  trueCountAtDecision: number
}

/** Deals one round's cards (hole card dealt but not yet counted) and the resulting decision point. Does not require a bet — betting happens before dealing, off `currentTrueCount`. */
export function dealRound(state: EvasionSessionState): { state: EvasionSessionState; dealt: DealtRound } {
  const d = makeDrawers(state.shoe, state.position, state.count)
  const initialPlayerHand = [d.drawAndCount(), d.drawAndCount()]
  const dealerUpcard = d.drawAndCount()
  const holeCard = d.draw() // dealt now (shoe depletes), but not counted until revealed in resolveRound

  const situationKey = getHardSoftSituationKey(initialPlayerHand, dealerUpcard)
  const basicAction = getHardSoftAction(initialPlayerHand, dealerUpcard)
  const trueCountAtDecision = trueCount(d.count(), (state.shoe.length - d.position()) / 52)
  const indexPlay = indicatedDeviation(situationKey, trueCountAtDecision)

  return {
    state: { shoe: state.shoe, position: d.position(), count: d.count() },
    dealt: {
      initialPlayerHand,
      dealerUpcard,
      holeCard,
      situationKey,
      basicAction,
      indicatedAction: indexPlay?.deviateTo ?? null,
      trueCountAtDecision,
    },
  }
}

export interface EvasionRoundRecord {
  roundNumber: number
  trueCountAtBet: number
  bet: number
  initialPlayerHand: Card[]
  finalPlayerHand: Card[]
  dealerUpcard: Card
  situationKey: string
  basicAction: Action
  indicatedAction: Action | null
  chosenAction: Action
  actions: Action[]
  deviated: boolean
  deviationType: 'index' | 'cover' | null
  playerBusted: boolean
  /** Finalized after the whole session, once the user's personal baseline bet is known — see `evasionScoring.finalizeRounds`. */
  isElevatedBet: boolean
}

/** Resolves the round given the user's bet (already committed before `dealRound`) and chosen action. */
export function resolveRound(
  state: EvasionSessionState,
  dealt: DealtRound,
  bet: number,
  trueCountAtBet: number,
  chosenAction: Action,
  roundNumber: number,
): { state: EvasionSessionState; record: EvasionRoundRecord } {
  const d = makeDrawers(state.shoe, state.position, state.count)
  const result = resolvePlayerHandWithAction(dealt.initialPlayerHand, dealt.dealerUpcard, dealt.trueCountAtDecision, chosenAction, d.drawAndCount)

  d.addToCount(hiLoValue(dealt.holeCard.rank)) // hole card revealed
  resolveDealerHand(dealt.dealerUpcard, dealt.holeCard, d.drawAndCount)

  const record: EvasionRoundRecord = {
    roundNumber,
    trueCountAtBet,
    bet,
    initialPlayerHand: dealt.initialPlayerHand,
    finalPlayerHand: result.cards,
    dealerUpcard: dealt.dealerUpcard,
    situationKey: result.situationKey,
    basicAction: result.basicAction,
    indicatedAction: dealt.indicatedAction,
    chosenAction,
    actions: result.actions,
    deviated: result.deviated,
    deviationType: result.deviationType,
    playerBusted: result.busted,
    isElevatedBet: false,
  }

  return { state: { shoe: state.shoe, position: d.position(), count: d.count() }, record }
}
