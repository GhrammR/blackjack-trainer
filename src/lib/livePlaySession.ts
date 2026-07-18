import type { Action, Card } from '../types'
import { createShoe, shuffle } from './shoe'
import { hiLoValue } from './counting'
import { effectiveMaxSplitHands, getActionForRules, getHardSoftActionForRules, isPair, type RuleConfig } from './strategy'
import { handValue, isBlackjack, isBust } from './cards'
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
 * Resplitting is allowed up to `rules.maxSplitHands` total (see
 * strategy.ts's `effectiveMaxSplitHands` — sourced values are 4 for 6-deck
 * configs, 2 for double-deck, per an internal tribal gaming regulatory
 * training manual documenting a specific casino's posted rules; see
 * DECISIONS.md). Aces can never be resplit and split Aces never get hit
 * again (both hardcoded, not rule-config-driven — every sourced config this
 * app knows about agrees on both, so a toggle would be unsourced
 * flexibility; see DECISIONS.md).
 */

const SAFETY_MARGIN = 20

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
  /**
   * Both optional, defaulting to falsy when absent, so no existing PlayHand
   * object literal (test fixtures included) needs updating — only the
   * production factories below (freshHand/dealRound's natural check,
   * splitHand's make) ever set them. Used by handPayout/roundPayout, not by
   * decision grading, which never reads either field.
   */
  /** Set true only for the original, never-split, still-2-card starting hand that's a real 21 — a split-created 21 is never a natural (no 3:2), matching real-table rules. */
  isNatural?: boolean
  /** Set true once this specific hand has been doubled — its wager is 2x for payout purposes, independent of any other hand in the round. */
  doubled?: boolean
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
  return { cards, isFirstDecision: true, isSplitAces: false, done: false, surrendered: false, isNatural: isBlackjack(cards) }
}

export function dealRound(state: LivePlaySessionState): { state: LivePlaySessionState; round: LiveRound } {
  const d = makeDrawers(state.shoe, state.position, state.count)
  const playerCards = [d.drawAndCount(), d.drawAndCount()]
  const dealerUpcard = d.drawAndCount()
  const holeCard = d.draw()

  // A natural blackjack auto-resolves — no Hit/Stand/Double/Split/Surrender
  // decision is ever offered on it. Marking the hand done immediately (with
  // no decision recorded) makes activeHandIndex resolve to -1 below, same
  // as a normal Stand, and `handOutcome` already compares totals correctly
  // (a natural still reads as a push against a dealer's own blackjack).
  const hand = freshHand(playerCards)
  const hands = isBlackjack(playerCards) ? [{ ...hand, done: true }] : [hand]

  return {
    state: { shoe: state.shoe, position: d.position(), count: d.count() },
    round: { hands, activeHandIndex: nextActiveHandIndex(hands, 0), dealerUpcard, holeCard },
  }
}

/**
 * Like `dealRound`, but builds the round from a caller-supplied 2-card hand
 * + dealer upcard instead of dealing them from shoe position — for callers
 * (Basic Strategy Trainer) whose hand is chosen by an adaptive weakness
 * engine rather than dealt randomly. `drawShoe` still backs subsequent
 * Hit/Split draws via the normal `applyAction`/`decide` path. `holeCard` is
 * now a REAL card drawn from `drawShoe[0]` (same hole-card-timing
 * convention as `dealRound`: dealt now, not added to the running count
 * until `resolveDealer` reveals it) — this is what lets a caller resolve
 * the dealer's hand for a real win/lose/push outcome (the chip-payout
 * system) using the exact same `resolveDealer`/`resolveDealerHand` Live
 * Play already uses, unmodified. Decision grading (`correctActionFor`/
 * `decide`/`getSituationKey`) never reads `holeCard`, so this change is
 * invisible to grading — only to callers that now choose to resolve the
 * dealer. Reuses the exact same natural-blackjack auto-resolve behavior as
 * `dealRound`.
 */
export function dealRoundFromHand(
  playerHand: Card[],
  dealerUpcard: Card,
  drawShoe: Card[],
): { state: LivePlaySessionState; round: LiveRound } {
  const d = makeDrawers(drawShoe, 0, 0)
  const holeCard = d.draw()
  const hand = freshHand(playerHand)
  const hands = isBlackjack(playerHand) ? [{ ...hand, done: true }] : [hand]

  return {
    state: { shoe: drawShoe, position: d.position(), count: d.count() },
    round: { hands, activeHandIndex: nextActiveHandIndex(hands, 0), dealerUpcard, holeCard },
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

function canSplit(round: LiveRound, rules: RuleConfig): boolean {
  const hand = round.hands[round.activeHandIndex]
  return hand.isFirstDecision && hand.cards.length === 2 && isPair(hand.cards) && round.hands.length < effectiveMaxSplitHands(rules)
}

/** Surrender is only legal as the very first decision of the round, before any split has happened. */
function canSurrender(round: LiveRound): boolean {
  const hand = round.hands[round.activeHandIndex]
  return hand.isFirstDecision && round.hands.length === 1
}

/**
 * The actions legally available for the round's current active hand. Empty
 * once the round is over (or, transiently, for a split-Aces hand, which is
 * never actually offered a decision). `rules.surrenderMode` gates whether
 * Surrender is ever offered — every caller (Basic Strategy Trainer, Live
 * Play, Index Plays) must now pass a `RuleConfig` explicitly; there's no
 * default, since silently defaulting a correctness-critical parameter is
 * exactly what this rule matrix is trying to avoid.
 */
export function legalActions(round: LiveRound, rules: RuleConfig): Action[] {
  if (isRoundOver(round)) return []
  const hand = round.hands[round.activeHandIndex]
  if (hand.isSplitAces) return []

  const actions: Action[] = ['Hit', 'Stand']
  if (hand.isFirstDecision) {
    actions.push('Double')
    if (canSplit(round, rules)) actions.push('Split')
    if (rules.surrenderMode !== 'none' && canSurrender(round)) actions.push('Surrender')
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

/**
 * What basic strategy (adjusted for Split/Double/Surrender legality right
 * now) says is correct for the round's current active hand.
 *
 * `eligibleForSurrender` folds the setting AND `canSurrender`'s own
 * decision-point legality gate together before it ever reaches
 * `getActionForRules` — so "chart says Surrender" can never surface as the
 * correct answer at a point where Surrender isn't actually a legal button
 * (e.g. after a hit, or on any hand past the first decision of a split).
 */
export function correctActionFor(round: LiveRound, rules: RuleConfig): Action {
  const hand = round.hands[round.activeHandIndex]
  const eligibleForSurrender = rules.surrenderMode !== 'none' && canSurrender(round)
  const effectiveRules: RuleConfig = eligibleForSurrender ? rules : { ...rules, surrenderMode: 'none' }
  const action = getActionForRules(hand.cards, round.dealerUpcard, effectiveRules)

  if (action === 'Split' && !canSplit(round, rules)) {
    // Never surrender-eligible here: reaching this fallback with the hand
    // cap already hit requires round.hands.length >= effectiveMaxSplitHands(rules), which is
    // mutually exclusive with canSurrender's round.hands.length === 1
    // requirement — so eligibleForSurrender is always already false by the
    // time this branch is reachable. Passed explicitly rather than reused,
    // so that invariant doesn't have to be trusted implicitly here.
    return getHardSoftActionForRules(hand.cards, round.dealerUpcard, { ...rules, surrenderMode: 'none' })
  }
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
    isNatural: false, // a split-created 21 is never a natural (no 3:2) — real-table rule
    doubled: false,
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
      hands[idx] = { ...hand, cards, isFirstDecision: false, done: true, doubled: true }
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
export function decide(state: LivePlaySessionState, round: LiveRound, chosenAction: Action, rules: RuleConfig): DecisionResult {
  const correctAction = correctActionFor(round, rules)
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

/**
 * The REAL chip-payout consequence layer (step "chip wager" — separate from
 * the flavor-only netUnitsForRound above, which stays untouched and keeps
 * powering its own display). Unlike netUnitsForRound, this is
 * blackjack/double/split-aware:
 *   - A natural (hand.isNatural) pays 3:2, UNLESS the dealer also has a
 *     natural (isBlackjack(dealerCards) — resolveDealerHand never draws
 *     past a 2-card 21, so this is a reliable check), in which case it's a
 *     push, not a win. A dealer natural beats any non-natural player hand
 *     outright (checked before the bust/compare path).
 *   - Surrender loses exactly half the wager — that's what surrender is.
 *   - A doubled hand's wager is 2x `betAmount` for that hand only; other
 *     hands in the same split round use their own `doubled` flag
 *     independently (roundPayout below sums each hand's own payout).
 * Decision-grading never calls or is called by this — chips are a parallel
 * consequence of the actual outcome, not merged into the chart grade (see
 * BasicStrategyMode.tsx / LivePlayMode.tsx: a perfectly graded hand can
 * still lose chips here, which is the point).
 */
export function handPayout(hand: PlayHand, betAmount: number, dealerCards: Card[], dealerBusted: boolean): number {
  const wagered = betAmount * (hand.doubled ? 2 : 1)
  if (hand.surrendered) return -wagered / 2
  const playerTotal = handValue(hand.cards).total
  if (playerTotal > 21) return -wagered
  const dealerNatural = isBlackjack(dealerCards)
  if (hand.isNatural) return dealerNatural ? 0 : wagered * 1.5
  if (dealerNatural) return -wagered
  if (dealerBusted) return wagered
  const dealerTotal = handValue(dealerCards).total
  if (playerTotal > dealerTotal) return wagered
  if (playerTotal < dealerTotal) return -wagered
  return 0
}

/** Sums handPayout across every hand in the round — each split hand resolves (and pays) independently. */
export function roundPayout(hands: PlayHand[], betAmount: number, dealerCards: Card[], dealerBusted: boolean): number {
  return hands.reduce((sum, hand) => sum + handPayout(hand, betAmount, dealerCards, dealerBusted), 0)
}
