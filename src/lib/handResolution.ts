import type { Action, Card } from '../types'
import { handValue, isBust } from './cards'
import { getHardSoftAction, getHardSoftSituationKey } from './strategy'
import { indicatedDeviation } from './indexPlays'
import type { PlayerProfile } from './playerProfiles'

/**
 * Resolves one simulated player's hand to completion (v2 step 8). No
 * player-side Split — a dealt pair is just played as its hard/soft total,
 * since the detection drill's deviation set is all hard-total entries and
 * multi-hand bookkeeping isn't worth it for the signal this models. The
 * deviation check (basic strategy vs. a possible index play) only applies
 * at the initial two-card decision point, matching how the chosen index
 * plays are all defined on the first decision; any cards drawn after a Hit
 * follow plain basic strategy.
 */

export interface PlayerHandResult {
  cards: Card[]
  actions: Action[]
  /** The initial (two-card) decision point's situation key, e.g. "hard-16-vs-10". */
  situationKey: string
  /** What plain basic strategy says for the initial decision. */
  basicAction: Action
  /** The action actually taken at the initial decision. */
  initialAction: Action
  deviated: boolean
  /** "index" = a real count-driven deviation; "cover" = a disguised, non-indicated deviation. null = played basic strategy straight. */
  deviationType: 'index' | 'cover' | null
  busted: boolean
}

/** Shared tail end of hand resolution once the initial action is already decided — by a profile's dice rolls (`resolvePlayerHand`) or by a user's explicit choice (`resolvePlayerHandWithAction`, step 8 slice 4). */
function resolveFromInitialAction(
  initialCards: Card[],
  dealerUpcard: Card,
  situationKey: string,
  basicAction: Action,
  initialAction: Action,
  deviationType: PlayerHandResult['deviationType'],
  drawCard: () => Card,
): PlayerHandResult {
  const cards = [...initialCards]
  const actions: Action[] = [initialAction]

  if (initialAction === 'Double') {
    cards.push(drawCard())
  } else if (initialAction === 'Hit') {
    let current: Action = initialAction
    while (current === 'Hit' && !isBust(cards)) {
      cards.push(drawCard())
      if (isBust(cards)) break
      current = getHardSoftAction(cards, dealerUpcard)
      actions.push(current)
    }
  }

  return {
    cards,
    actions,
    situationKey,
    basicAction,
    initialAction,
    deviated: initialAction !== basicAction,
    deviationType,
    busted: isBust(cards),
  }
}

/**
 * `drawCard` deals the next card from the shoe (and is expected to advance
 * the shoe position / running count as a side effect — this function is
 * deliberately agnostic to where cards come from).
 */
export function resolvePlayerHand(
  initialCards: Card[],
  dealerUpcard: Card,
  profile: PlayerProfile,
  trueCountAtDecision: number,
  drawCard: () => Card,
  random: () => number = Math.random,
): PlayerHandResult {
  const situationKey = getHardSoftSituationKey(initialCards, dealerUpcard)
  const basicAction = getHardSoftAction(initialCards, dealerUpcard)

  const indexPlay = indicatedDeviation(situationKey, trueCountAtDecision)
  let initialAction = basicAction
  let deviationType: PlayerHandResult['deviationType'] = null

  if (indexPlay && random() < profile.deviationComplianceRate) {
    initialAction = indexPlay.deviateTo
    deviationType = 'index'
  } else if (!indexPlay && random() < profile.coverDeviationRate && (basicAction === 'Hit' || basicAction === 'Stand')) {
    // Camouflage: flip Hit<->Stand even though nothing is actually indicated.
    initialAction = basicAction === 'Hit' ? 'Stand' : 'Hit'
    deviationType = 'cover'
  }

  return resolveFromInitialAction(initialCards, dealerUpcard, situationKey, basicAction, initialAction, deviationType, drawCard)
}

/**
 * The evasion drill's mirror of `resolvePlayerHand` (step 8 slice 4): the
 * initial action is supplied directly by the user instead of rolled from a
 * `PlayerProfile`'s compliance/cover rates. `deviationType` is derived the
 * same way it would have come out of the profile-driven path: 'index' if
 * the chosen action matches what the count actually indicates, 'cover' if
 * it differs from basic strategy without matching an indicated play, null
 * if it's just basic strategy played straight.
 */
export function resolvePlayerHandWithAction(
  initialCards: Card[],
  dealerUpcard: Card,
  trueCountAtDecision: number,
  chosenAction: Action,
  drawCard: () => Card,
): PlayerHandResult {
  const situationKey = getHardSoftSituationKey(initialCards, dealerUpcard)
  const basicAction = getHardSoftAction(initialCards, dealerUpcard)
  const indexPlay = indicatedDeviation(situationKey, trueCountAtDecision)

  const deviationType: PlayerHandResult['deviationType'] =
    chosenAction === basicAction ? null : indexPlay && chosenAction === indexPlay.deviateTo ? 'index' : 'cover'

  return resolveFromInitialAction(initialCards, dealerUpcard, situationKey, basicAction, chosenAction, deviationType, drawCard)
}

export interface DealerHandResult {
  cards: Card[]
  busted: boolean
}

/** Hits to 17, stands on soft 17 — matching this app's fixed rule set. */
export function resolveDealerHand(upcard: Card, holeCard: Card, drawCard: () => Card): DealerHandResult {
  const cards = [upcard, holeCard]

  while (true) {
    const { total } = handValue(cards)
    if (total >= 17) break
    cards.push(drawCard())
  }

  return { cards, busted: isBust(cards) }
}
