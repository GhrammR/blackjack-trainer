import { useEffect, useState } from 'react'
import type { Action } from '../../../types'
import { type IndexPlayScenario, generateScenario } from '../../../lib/indexPlayDrill'
import { INDEX_PLAYS } from '../../../lib/indexPlays'
import { handValue, isBust } from '../../../lib/cards'
import { createShoe, shuffle } from '../../../lib/shoe'
import {
  type DealerResolution,
  type LivePlaySessionState,
  type LiveRound,
  type PlayHand,
  dealRoundFromHand,
  decide,
  applyAction,
  handOutcome,
  isRoundOver,
  legalActions,
  resolveDealer,
} from '../../../lib/livePlaySession'
import { categoryOfSituationKey } from '../../../lib/mastery'
import { getSituationKey, type RuleConfig } from '../../../lib/strategy'
import { h17NoteFor, reasonFor as chartReasonFor } from '../../../lib/reasons'
import { signed } from '../../../lib/format'
import { HiddenCard, PlayingCard } from '../../PlayingCard'
import { ActionButtons } from '../../ActionButtons'
import { ERROR_TEXT, PRIMARY_BUTTON_LG, SUCCESS_TEXT, HUD_HEIGHT } from '../../theme'
import { CasinoTable } from '../table/CasinoTable'

/**
 * Full play-out drill (mirrors BasicStrategyMode.tsx's own recent
 * conversion): the whole hand is played out — hit/stand/double, split if
 * applicable, dealer resolution, outcome — reusing Live Play's engine
 * (`dealRoundFromHand`/`legalActions`/`decide`/`applyAction`/`isRoundOver`/
 * `resolveDealer` from livePlaySession.ts) wholesale, not a parallel
 * hand-play system.
 *
 * The mode's whole reason to exist — count-based deviation grading — is
 * preserved exactly: the FIRST decision of every round (identified as
 * `decisionLog.length === 0`, not `hand.isFirstDecision`, which also
 * resets true for each new split hand) is graded against
 * `scenario.correctAction`, the deviation-aware answer indexPlayDrill.ts
 * already computes (plain basic strategy, overridden by an Illustrious 18
 * entry once the shown true count crosses its threshold). That decision is
 * applied via `applyAction` directly, NOT `decide()` (which grades against
 * the plain chart with no concept of a count deviation).
 *
 * Every decision AFTER the first is graded normally via `decide()` —
 * against the plain chart, same as Basic Strategy Trainer. The 14
 * `INDEX_PLAYS` entries are all pre-hit hard totals; there is no deviation
 * number for an arbitrary post-hit hand, and inventing one would mean
 * fabricating data the sourced dataset doesn't have (see indexPlays.ts's
 * own sourcing-discipline comments). Consequently `attempts`/`correct`/
 * `perDeviation` (persisted, unchanged shape) update ONLY from the first
 * decision — even in the rare case a follow-up coincidentally lands back
 * on a tracked situation key — keeping the persisted stats' meaning
 * exactly "count-based deviation recognition accuracy," nothing else.
 *
 * Rule surface stays fixed at { 6 decks, H17, no surrender } (`FIXED_RULES`
 * below) regardless of the live Settings rule matrix (strategy.ts's
 * RuleConfig, added for Basic Strategy/Live Play) — matching today's exact
 * behavior. `generateScenario()` already computes `basicAction`/
 * `correctAction` against the fixed 6-deck/H17 chart with no
 * surrender-awareness, so threading the live settings in here would touch
 * the deviation-grading path itself, which is out of scope. Reusing
 * `legalActions` for real does fix one thing for free: Split now only
 * appears for an actual pair, rather than every round showing all 5
 * buttons unconditionally.
 *
 * No chip wager system here (unlike Basic Strategy/Live Play) — betting
 * has nothing to do with what this mode teaches (deviation recognition,
 * not bet sizing — that's Live Play's slice 3), so it's deliberately left
 * out rather than bolted on.
 */

type Phase = 'deciding' | 'roundComplete'

interface DecisionRecord {
  situationKey: string
  chosenAction: Action
  correctAction: Action
  isCorrect: boolean
  /** True only for the round's first (index-play) decision — drives which "why" text a miss shows. */
  isIndexDecision: boolean
}

interface IndexPlayProgress {
  attempts: number
  correct: number
  perDeviation: Record<string, { attempts: number; correct: number }>
}

interface IndexPlayModeProps {
  initialProgress: IndexPlayProgress
  onProgressChange: (p: IndexPlayProgress) => void
}

const INDEX_PLAY_SITUATION_KEYS = new Set(INDEX_PLAYS.map((p) => p.situationKey))

/** Index Plays' rule surface is fixed, independent of the live Settings rule matrix — see header comment. */
const FIXED_RULES: RuleConfig = { numDecks: 6, soft17Rule: 'H17', surrenderMode: 'none', das: true }

/** The count-threshold "why" for the index decision specifically — distinct from reasons.ts's chart-based reasonFor. */
function deviationReasonFor(scenario: IndexPlayScenario): string {
  if (scenario.indicatedPlay) {
    const { threshold, direction } = scenario.indicatedPlay
    const condition = direction === 'aboveOrEqual' ? `TC ≥ ${threshold}` : `TC < ${threshold}`
    return `At ${condition}, the count indicates a deviation from basic strategy (normally ${scenario.basicAction}) to ${scenario.correctAction}.`
  }
  return `The count doesn't indicate a deviation here — plain basic strategy applies: ${scenario.basicAction}.`
}

// Local, one-off — same convention as BasicStrategyMode.tsx's/LivePlayMode.tsx's own HandGroup.
function inProgressStatus(hand: PlayHand): string | null {
  if (!hand.done) return null
  if (isBust(hand.cards)) return 'Bust'
  if (hand.isNatural) return 'Blackjack!'
  return 'Stood'
}

const OUTCOME_LABELS: Record<string, string> = {
  win: 'Win', lose: 'Lose', push: 'Push', bust: 'Bust', surrendered: 'Surrender',
}
const OUTCOME_COLORS: Record<string, string> = {
  win: SUCCESS_TEXT, lose: ERROR_TEXT, push: 'text-slate-400',
  bust: ERROR_TEXT, surrendered: 'text-slate-400',
}

function HandGroup({ hand, isActive, outcome }: { hand: PlayHand; isActive: boolean; outcome: string | null }) {
  const { total, soft } = handValue(hand.cards)
  const statusText = outcome ? (outcome === 'win' && hand.isNatural ? 'Blackjack!' : OUTCOME_LABELS[outcome]) : inProgressStatus(hand)
  const statusColor = outcome ? OUTCOME_COLORS[outcome] : 'text-slate-500'
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-md p-1 ${isActive ? 'ring-2 ring-blue-500' : ''}`}
      style={{ opacity: hand.done ? 0.85 : 1 }}
    >
      <div className="flex gap-1">
        {hand.cards.map((card, i) => (
          <PlayingCard key={i} card={card} suitIndex={i} size="sm" />
        ))}
      </div>
      <p className="text-xs text-slate-400">
        {total}
        {soft ? ' soft' : ''}
      </p>
      {statusText && <p className={`text-xs font-medium ${statusColor}`}>{statusText}</p>}
    </div>
  )
}

function buildRound(scenario: IndexPlayScenario): { state: LivePlaySessionState; round: LiveRound } {
  return dealRoundFromHand(scenario.playerHand, scenario.dealerUpcard, shuffle(createShoe(1)))
}

function freshRound(): { scenario: IndexPlayScenario; state: LivePlaySessionState; round: LiveRound } {
  const scenario = generateScenario()
  const { state, round } = buildRound(scenario)
  return { scenario, state, round }
}

export function IndexPlayMode({ initialProgress, onProgressChange }: IndexPlayModeProps) {
  const [attempts, setAttempts] = useState(initialProgress.attempts)
  const [correct, setCorrect] = useState(initialProgress.correct)
  const [perDeviation, setPerDeviation] = useState(initialProgress.perDeviation)

  // Pull-down only — see git history / CLAUDE.md for why there is
  // deliberately no matching reactive "push on every local state change"
  // effect (that pairing caused a real, observed infinite loop once
  // perDeviation's nested-object reference stopped surviving round-trips).
  // Every local push happens directly at its point of mutation, below.
  useEffect(() => {
    setAttempts(initialProgress.attempts)
    setCorrect(initialProgress.correct)
    setPerDeviation(initialProgress.perDeviation)
  }, [initialProgress])

  // Seeded once via a lazy initializer — `useState(() => ...)` guarantees
  // React only calls this bundle-builder on the component's first render,
  // never on re-renders (unlike calling `freshRound()` directly in the
  // render body, which would silently generate and discard a fresh random
  // hand on every render). A fresh hand is always available immediately —
  // there's no "waiting for a bet" phase to gate it, unlike Basic
  // Strategy/Live Play — so this bundle already resolves the natural-
  // blackjack case up front, the same synchronous logic `nextHand()`
  // (below) reuses for every hand after the first.
  const [initialBundle] = useState(() => {
    const { scenario, state, round } = freshRound()
    const over = isRoundOver(round)
    return {
      scenario, state, round,
      dealerResolution: over ? resolveDealer(state, round) : null,
      phase: (over ? 'roundComplete' : 'deciding') as Phase,
    }
  })
  const [scenario, setScenario] = useState(initialBundle.scenario)
  const [session, setSession] = useState(initialBundle.state)
  const [round, setRound] = useState(initialBundle.round)
  const [dealerResolution, setDealerResolution] = useState<DealerResolution | null>(initialBundle.dealerResolution)
  const [decisionLog, setDecisionLog] = useState<DecisionRecord[]>([])
  const [lastDecision, setLastDecision] = useState<DecisionRecord | null>(null)
  const [phase, setPhase] = useState<Phase>(initialBundle.phase)

  function settleRound(finalState: LivePlaySessionState, finalRound: LiveRound) {
    setDealerResolution(resolveDealer(finalState, finalRound))
    setPhase('roundComplete')
  }

  function choose(action: Action) {
    if (phase !== 'deciding') return
    const hand = round.hands[round.activeHandIndex]
    const isIndexDecision = decisionLog.length === 0
    const situationKey = getSituationKey(hand.cards, round.dealerUpcard)

    let record: DecisionRecord
    let nextState: LivePlaySessionState
    let nextRound: LiveRound

    if (isIndexDecision) {
      const isCorrect = action === scenario.correctAction
      const applied = applyAction(session, round, action)
      nextState = applied.state
      nextRound = applied.round
      record = { situationKey, chosenAction: action, correctAction: scenario.correctAction, isCorrect, isIndexDecision: true }

      const nextAttempts = attempts + 1
      const nextCorrect = correct + (isCorrect ? 1 : 0)
      let nextPerDeviation = perDeviation
      if (INDEX_PLAY_SITUATION_KEYS.has(scenario.situationKey)) {
        const existing = perDeviation[scenario.situationKey] ?? { attempts: 0, correct: 0 }
        nextPerDeviation = {
          ...perDeviation,
          [scenario.situationKey]: {
            attempts: existing.attempts + 1,
            correct: existing.correct + (isCorrect ? 1 : 0),
          },
        }
      }
      setAttempts(nextAttempts)
      setCorrect(nextCorrect)
      setPerDeviation(nextPerDeviation)
      onProgressChange({ attempts: nextAttempts, correct: nextCorrect, perDeviation: nextPerDeviation })
    } else {
      const result = decide(session, round, action, FIXED_RULES)
      nextState = result.state
      nextRound = result.round
      record = {
        situationKey,
        chosenAction: result.chosenAction,
        correctAction: result.correctAction,
        isCorrect: result.isCorrect,
        isIndexDecision: false,
      }
    }

    setSession(nextState)
    setRound(nextRound)
    setLastDecision(record)
    setDecisionLog((log) => [...log, record])

    if (isRoundOver(nextRound)) settleRound(nextState, nextRound)
  }

  function nextHand() {
    const next = freshRound()
    setScenario(next.scenario)
    setSession(next.state)
    setRound(next.round)
    setDecisionLog([])
    setLastDecision(null)
    if (isRoundOver(next.round)) {
      settleRound(next.state, next.round)
    } else {
      setDealerResolution(null)
      setPhase('deciding')
    }
  }

  const correctCount = decisionLog.filter((d) => d.isCorrect).length
  const misses = decisionLog.filter((d) => !d.isCorrect)

  // ── Table content ──────────────────────────────────────────────────────────

  // "Dealer" label removed — the chip tray uses that space (see CasinoTable.tsx / DealerChipTray.tsx).
  const dealerSlot = (
    <>
      <div className="flex gap-2">
        <PlayingCard card={round.dealerUpcard} suitIndex={0} size="sm" />
        {phase === 'roundComplete' && dealerResolution ? (
          dealerResolution.dealerCards.slice(1).map((card, i) => (
            <PlayingCard key={i} card={card} suitIndex={i + 1} size="sm" />
          ))
        ) : (
          <HiddenCard size="sm" />
        )}
      </div>
      {phase === 'roundComplete' && dealerResolution && (
        <p className="text-xs text-slate-400">
          {handValue(dealerResolution.dealerCards).total}
          {dealerResolution.dealerBusted ? ' (bust)' : ''}
        </p>
      )}
    </>
  )

  const seatContent = (
    // flex-nowrap — see BasicStrategyMode.tsx's identical comment: wrapping
    // into a 2nd row grows the seat box past the felt's clipped edge.
    <div className="flex flex-nowrap justify-center gap-2">
      {round.hands.map((hand, i) => (
        <HandGroup
          key={i}
          hand={hand}
          isActive={i === round.activeHandIndex}
          outcome={
            phase === 'roundComplete' && dealerResolution
              ? handOutcome(hand, dealerResolution.dealerCards, dealerResolution.dealerBusted)
              : null
          }
        />
      ))}
    </div>
  )

  return (
    <div className="flex h-full w-full flex-col items-center gap-1 px-2 py-1">
      <div className="flex w-full flex-1 min-h-0 items-center justify-center"
        style={{ containerType: 'size' }}>
        <CasinoTable
          dealerSlot={dealerSlot}
          seatContents={[seatContent]}
          seatLabels={['YOU']}
          userSeatIndex={0}
        />
      </div>

      {/* HUD */}
      <div
        className="flex w-full max-w-md flex-col items-center gap-4 overflow-y-auto"
        style={{ height: HUD_HEIGHT.indexPlays, flexShrink: 0 }}
      >
        <p className="text-xs text-slate-500">
          Attempts: {attempts} · Accuracy:{' '}
          {attempts === 0 ? '—' : `${Math.round((correct / attempts) * 100)}%`}
        </p>

        <p className="text-lg text-slate-200">
          True count: <span className="font-semibold text-white">{signed(scenario.trueCount)}</span>
        </p>

        {phase === 'deciding' && (
          <div className="flex flex-col items-center gap-3">
            {lastDecision && (
              <p className={`text-sm font-medium ${lastDecision.isCorrect ? SUCCESS_TEXT : ERROR_TEXT}`}>
                {lastDecision.isCorrect
                  ? 'Correct!'
                  : `Incorrect — correct play was ${lastDecision.correctAction}`}
              </p>
            )}
            <ActionButtons onSelect={choose} actions={legalActions(round, FIXED_RULES)} />
          </div>
        )}

        {phase === 'roundComplete' && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className={`text-lg font-semibold ${misses.length === 0 ? SUCCESS_TEXT : ERROR_TEXT}`}>
              {decisionLog.length === 0
                ? 'No decision needed'
                : `${correctCount}/${decisionLog.length} correct this hand`}
            </p>
            {misses.map((m, i) => {
              const reason = m.isIndexDecision
                ? deviationReasonFor(scenario)
                : chartReasonFor(categoryOfSituationKey(m.situationKey), m.correctAction)
              const h17Note = m.isIndexDecision ? null : h17NoteFor(m.situationKey)
              return (
                <p key={i} className="text-sm text-slate-400">
                  {m.situationKey}: correct play was {m.correctAction}
                  {reason ? ` — ${reason}` : ''}
                  {h17Note && <span className="mt-1 block text-xs text-amber-300/80">{h17Note}</span>}
                </p>
              )
            })}
            {dealerResolution && (
              <p className="text-sm text-slate-300">
                {round.hands
                  .map((hand) => handOutcome(hand, dealerResolution.dealerCards, dealerResolution.dealerBusted))
                  .map((o) => OUTCOME_LABELS[o])
                  .join(' · ')}
              </p>
            )}
            <button type="button" onClick={nextHand} className={PRIMARY_BUTTON_LG}>
              Next hand
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
