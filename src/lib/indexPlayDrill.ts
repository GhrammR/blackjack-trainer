import type { Action, Card } from '../types'
import { getAction, getSituationKey } from './strategy'
import { ALL_SITUATION_KEYS, generateHand } from './handGenerator'
import { INDEX_PLAYS, type IndexPlay, indicatedDeviation } from './indexPlays'

/**
 * The new step 9 drill: connects v1's strategy engine with v2's counting
 * engine directly. The true count is given (decision-only, same as step
 * 8 slice 4 — this isn't a counting-skill test), and the user must pick
 * the index-aware correct action: usually plain basic strategy, but
 * sometimes a real deviation once the shown true count crosses one of
 * `INDEX_PLAYS`' thresholds. Unlike v2's simulated-counter drills, this
 * one reuses v1's real `getAction`/`getSituationKey` (full pairs/Split
 * support included) rather than the hard/soft-only bypass — it only
 * grades a decision, never resolves a played-out hand, so Split is a
 * perfectly gradable answer here even though v2's engine can't model it.
 *
 * Hand generation is weighted so the drill actually exercises what it's
 * teaching: a uniformly random deal would land on one of the 14 specific
 * index-play situations only rarely. 70% of scenarios are "targeted" —
 * pick one of the 14 index-play entries, generate that exact hand, and
 * pick a true count that's sometimes on the deviation side of the
 * threshold and sometimes not (so resisting a false trigger is tested as
 * often as taking a real one). The other 30% are fully random situations
 * with no index play at all, so the user can't shortcut by assuming every
 * round is a trick deviation.
 */

const TARGETED_RATE = 0.7
const THRESHOLD_OFFSET_RANGE = 3
const RANDOM_TRUE_COUNT_RANGE = 8

/**
 * A 2-card hard total of 20 isn't a real dealable starting hand: the only
 * way to reach 20 with two cards is two ten-value cards, and this app's
 * rank-bucketed pair detection (see strategy.ts's pairRankKey) always reads
 * two ten-value cards as a pair — regardless of concrete rank match — so
 * `getSituationKey` would report "pair-10", never "hard-20". handGenerator's
 * `hard-20` entry only exists as a synthetic 3-card combo (e.g. 4+6+10) to
 * reproduce that label, which is exactly the "dealt a 3-card starting hand"
 * bug. Route it to the real, already-distinct "pair-10" situation instead,
 * which generateHand already produces as an honest 2-card deal.
 */
function normalizeSituationKey(key: string): string {
  return key.startsWith('hard-20-vs-') ? key.replace('hard-20-vs-', 'pair-10-vs-') : key
}

export interface IndexPlayScenario {
  playerHand: Card[]
  dealerUpcard: Card
  trueCount: number
  situationKey: string
  basicAction: Action
  indicatedPlay: IndexPlay | null
  correctAction: Action
}

function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1))
}

/** Picks a true count that's sometimes on the deviation side of `play`'s threshold, sometimes not. */
function sampleTrueCountForPlay(play: IndexPlay, random: () => number): number {
  const deviationApplies = random() < 0.5
  const offset = randomInt(random, 0, THRESHOLD_OFFSET_RANGE)
  if (play.direction === 'aboveOrEqual') {
    return deviationApplies ? play.threshold + offset : play.threshold - 1 - offset
  }
  // 'below': the deviation applies when trueCount < threshold.
  return deviationApplies ? play.threshold - 1 - offset : play.threshold + offset
}

export function generateScenario(random: () => number = Math.random): IndexPlayScenario {
  let situationKey: string
  let trueCount: number

  if (random() < TARGETED_RATE) {
    const play = INDEX_PLAYS[Math.floor(random() * INDEX_PLAYS.length)]
    situationKey = play.situationKey
    trueCount = sampleTrueCountForPlay(play, random)
  } else {
    situationKey = ALL_SITUATION_KEYS[Math.floor(random() * ALL_SITUATION_KEYS.length)]
    trueCount = randomInt(random, -RANDOM_TRUE_COUNT_RANGE, RANDOM_TRUE_COUNT_RANGE)
  }

  situationKey = normalizeSituationKey(situationKey)
  const { playerHand, dealerUpcard } = generateHand(situationKey)
  const basicAction = getAction(playerHand, dealerUpcard)
  const indicatedPlay = indicatedDeviation(situationKey, trueCount)
  const correctAction = indicatedPlay?.deviateTo ?? basicAction

  return { playerHand, dealerUpcard, trueCount, situationKey, basicAction, indicatedPlay, correctAction }
}

/** Sanity check used by tests: re-derives the situation key from the generated cards, confirming `generateHand` and `getSituationKey` agree. */
export function verifySituationKey(scenario: IndexPlayScenario): boolean {
  return getSituationKey(scenario.playerHand, scenario.dealerUpcard) === scenario.situationKey
}
