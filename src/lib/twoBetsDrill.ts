import type { Action, Card } from '../types'
import { createShoe, shuffle } from './shoe'
import { dealRoundFromHand, correctActionFor } from './livePlaySession'
import { generateHand } from './handGenerator'
import { getSituationKey, type RuleConfig } from './strategy'

/**
 * "Two Bets in a Circle" — a surveillance drill covering ONLY the decisions
 * where a player puts a second bet at risk: Double, Soft Double, and Split.
 * Sourced framing (a professional game-protection memo, George D. Joseph,
 * Worldwide Casino Consulting, held by the tribal gaming agency): ~70% of
 * basic-strategy decisions are "no-brainers" that reveal nothing about a
 * player's skill; the ~30% that involve a second bet are what actually
 * distinguish a skilled player, in BOTH directions — a correct double/split
 * is diagnostic, and an INCORRECT one ("very telling," per the memo) is
 * exactly as diagnostic. This mode drills recognizing both.
 *
 * Distinct from Basic Strategy Trainer (which grades any decision): the
 * pedagogical framing is inverted — not "what should I play?" but "which of
 * my decisions actually carry surveillance signal?"
 *
 * Reuses the Live Play engine exactly as indexPlayDrill.ts/IndexPlayMode.tsx
 * do (`dealRoundFromHand`/`correctActionFor` from livePlaySession.ts) — no
 * parallel hand-play system. Rule-aware: classification is computed against
 * the CURRENT live RuleConfig, since a double/split that's correct at one
 * deck size or soft-17 rule can be wrong at another — itself a teaching
 * point (e.g. soft 18 vs dealer 2 is Double under H17, Stand under S17; one
 * of the three cells reasons.ts's h17NoteFor already flags for this exact
 * reason).
 */

export type TwoBetCategory = 'hardDouble' | 'softDouble' | 'split'

export interface TwoBetScenario {
  playerHand: Card[]
  dealerUpcard: Card
  situationKey: string
  category: TwoBetCategory
  /** Always 'Double' | 'Split' | 'Hit' | 'Stand' — Surrender-correct candidates are excluded during classification (see classifyTwoBetCandidates). */
  correctAction: Action
  /** True when the hand LOOKS two-bet-worthy but the correct play is Hit/Stand — the "wrong second bet" case that's exactly as diagnostic as a correct one. */
  isTrap: boolean
}

interface CategoryPool {
  correct: string[]
  trap: string[]
  /** situationKey -> its correct action, for every key in `correct`/`trap` combined — avoids recomputing when a scenario is actually generated. */
  actionByKey: Record<string, Action>
}

export type TwoBetClassification = Record<TwoBetCategory, CategoryPool>

const DEALER_KEYS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']

/**
 * Candidate situationKey templates — hands that plausibly tempt a second
 * bet, independent of any rule config (pure enumeration; classification
 * against a live RuleConfig happens separately below).
 *
 * Hard totals {8,9,10,11}: 9-11 double under every sourced config; 8 is
 * included specifically because it's a real Double at 1-deck vs dealer 5/6
 * (`oneDeckHardTotalsH17`/`S17` in strategy.ts) even though it never doubles
 * at 2- or 6-deck — the memo's own "hard 8 vs 9 never doubles" example,
 * generalized. 12+ is excluded: no sourced rule config ever doubles a hard
 * 12, so it would only ever generate degenerate always-trap instances.
 *
 * Soft totals 13-19: the only soft totals with any sourced Double cell at
 * any deck/soft17 combination (soft 20/21 never double).
 *
 * All 10 pair ranks: every pair is a legitimate "should I split this?"
 * temptation, including the memo's two named examples — pair 10,10
 * (`pairs['10']` is `row({}, 'Stand')`, a permanent guaranteed trap under
 * every rule config) and pair 5,5 (resolves via the hard-10 bypass to
 * Double vs weak dealer cards, Hit vs strong ones — never Split, either
 * way).
 */
const HARD_DOUBLE_TOTALS = [8, 9, 10, 11]
const SOFT_DOUBLE_TOTALS = [13, 14, 15, 16, 17, 18, 19]
const PAIR_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']

function candidateKeys(category: TwoBetCategory): string[] {
  if (category === 'hardDouble') return HARD_DOUBLE_TOTALS.flatMap((t) => DEALER_KEYS.map((d) => `hard-${t}-vs-${d}`))
  if (category === 'softDouble') return SOFT_DOUBLE_TOTALS.flatMap((t) => DEALER_KEYS.map((d) => `soft-${t}-vs-${d}`))
  return PAIR_RANKS.flatMap((p) => DEALER_KEYS.map((d) => `pair-${p}-vs-${d}`))
}

const TWO_BET_ACTIONS: ReadonlySet<Action> = new Set(['Double', 'Split'])
const TRAP_ACTIONS: ReadonlySet<Action> = new Set(['Hit', 'Stand'])

/** The actual correct action for `situationKey` under `rules`, via the exact same engine path Live Play uses — reuses correctActionFor's own Split-legality bypass (maxSplitHands, etc.) instead of reimplementing it. */
function resolveCorrectAction(situationKey: string, rules: RuleConfig): Action {
  const { playerHand, dealerUpcard } = generateHand(situationKey)
  const { round } = dealRoundFromHand(playerHand, dealerUpcard, shuffle(createShoe(1)))
  return correctActionFor(round, rules)
}

/**
 * Classifies every candidate key into "correct two-bet" or "trap" for the
 * given live RuleConfig. Surrender-correct candidates (e.g. pair 8,8 vs A
 * under DAS-off + late surrender) are excluded from both lists entirely —
 * this mode is strictly Double/Split vs. Hit/Stand, not a Surrender drill.
 * Recomputed whenever `rules` changes (cheap: ~210 lightweight lookups) —
 * callers should memoize on `rules` (see TwoBetsMode.tsx).
 */
export function classifyTwoBetCandidates(rules: RuleConfig): TwoBetClassification {
  const categories: TwoBetCategory[] = ['hardDouble', 'softDouble', 'split']
  const result = {} as TwoBetClassification
  for (const category of categories) {
    const correct: string[] = []
    const trap: string[] = []
    const actionByKey: Record<string, Action> = {}
    for (const key of candidateKeys(category)) {
      const action = resolveCorrectAction(key, rules)
      if (TWO_BET_ACTIONS.has(action)) {
        correct.push(key)
        actionByKey[key] = action
      } else if (TRAP_ACTIONS.has(action)) {
        trap.push(key)
        actionByKey[key] = action
      }
      // else Surrender — excluded entirely.
    }
    result[category] = { correct, trap, actionByKey }
  }
  return result
}

const TRAP_RATE = 0.35

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]
}

/**
 * Generates one scenario from an already-computed classification (see
 * classifyTwoBetCandidates — callers memoize that on the live RuleConfig).
 * Category is chosen uniformly 1/3 each, so per-category progress stats get
 * comparable sample sizes regardless of the raw pool-size skew (100 pair
 * keys vs 70 soft vs 40 hard). Within a category, TRAP_RATE (35%) of
 * scenarios are drawn from the trap pool — substantial enough that "always
 * say Double/Split" can't be pattern-matched, matching the memo's point that
 * a wrong two-bet is exactly as diagnostic as a right one.
 */
export function generateScenario(classified: TwoBetClassification, random: () => number = Math.random): TwoBetScenario {
  const categories: TwoBetCategory[] = ['hardDouble', 'softDouble', 'split']
  const category = pick(categories, random)
  const pools = classified[category]

  const wantsTrap = random() < TRAP_RATE
  const useTrap = wantsTrap && pools.trap.length > 0
  // Falls back to whichever pool is non-empty — defensive only; every
  // sourced rule config this app supports produces both a correct and a
  // trap instance in all three categories.
  const pool = useTrap ? pools.trap : pools.correct.length > 0 ? pools.correct : pools.trap
  const isTrap = pool === pools.trap

  const situationKey = pick(pool, random)
  const { playerHand, dealerUpcard } = generateHand(situationKey)
  const correctAction = pools.actionByKey[situationKey]

  return { playerHand, dealerUpcard, situationKey, category, correctAction, isTrap }
}

/** Sanity check used by tests: re-derives the situation key from the generated cards, confirming generateHand and getSituationKey agree. */
export function verifySituationKey(scenario: TwoBetScenario): boolean {
  return getSituationKey(scenario.playerHand, scenario.dealerUpcard) === scenario.situationKey
}
