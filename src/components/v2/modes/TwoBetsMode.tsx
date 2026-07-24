import { useEffect, useMemo, useState } from 'react'
import type { Action } from '../../../types'
import { type TwoBetScenario, classifyTwoBetCandidates, generateScenario } from '../../../lib/twoBetsDrill'
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
import { HiddenCard, PlayingCard } from '../../PlayingCard'
import { ActionButtons } from '../../ActionButtons'
import { ERROR_TEXT, PRIMARY_BUTTON_LG, SUCCESS_TEXT, HUD_HEIGHT } from '../../theme'
import { CasinoTable } from '../table/CasinoTable'

/**
 * "Two Bets in a Circle" — see twoBetsDrill.ts for the full sourcing and
 * design rationale. Full play-out drill, structured identically to
 * IndexPlayMode.tsx: the whole hand is played out (hit/stand/double, split
 * if applicable, dealer resolution, outcome) via Live Play's engine
 * (`dealRoundFromHand`/`legalActions`/`decide`/`applyAction`/`isRoundOver`/
 * `resolveDealer`), reused wholesale — no parallel hand-play system.
 *
 * The mode's whole reason to exist — recognizing which decisions carry a
 * second bet — lives entirely in the round's FIRST decision (identified as
 * `decisionLog.length === 0`, matching IndexPlayMode.tsx's exact convention,
 * not `hand.isFirstDecision`, which also resets true for each new split
 * hand): graded against `scenario.correctAction` (computed by
 * twoBetsDrill.ts against the LIVE `rules`, unlike Index Plays' fixed rule
 * surface — a double/split correct at one deck size or soft-17 rule can be
 * wrong at another, itself a teaching point here) and applied via
 * `applyAction` directly, not `decide()`. Every decision AFTER the first is
 * graded normally via `decide()` against the plain chart, same as Index
 * Plays and Basic Strategy Trainer — this mode's lesson is entirely about
 * the first decision.
 */

type Phase = 'deciding' | 'roundComplete'

interface DecisionRecord {
  situationKey: string
  chosenAction: Action
  correctAction: Action
  isCorrect: boolean
  /** True only for the round's first (two-bet) decision — drives which "why" text a miss shows. */
  isTwoBetDecision: boolean
  /** Only meaningful when isTwoBetDecision — whether that first decision was a genuine trap (correct play is Hit/Stand). */
  wasTrap: boolean
}

interface TwoBetsProgress {
  attempts: number
  correct: number
  perCategory: {
    hardDouble: { attempts: number; correct: number }
    softDouble: { attempts: number; correct: number }
    split: { attempts: number; correct: number }
  }
}

interface TwoBetsModeProps {
  rules: RuleConfig
  initialProgress: TwoBetsProgress
  onProgressChange: (p: TwoBetsProgress) => void
}

/** The extra surveillance-framing line shown only when the user WRONGLY put a second bet out on a genuine trap hand — the mode's actual lesson, stated outright rather than left implicit in the chart reason alone. */
function trapWarningFor(record: DecisionRecord): string | null {
  if (!record.isTwoBetDecision || !record.wasTrap) return null
  if (record.chosenAction !== 'Double' && record.chosenAction !== 'Split') return null
  return 'Putting a second bet out here is a real tell — a player who knows what they\'re doing never does this.'
}

// Local, one-off — same convention as IndexPlayMode.tsx's/BasicStrategyMode.tsx's own HandGroup.
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

function buildRound(scenario: TwoBetScenario): { state: LivePlaySessionState; round: LiveRound } {
  return dealRoundFromHand(scenario.playerHand, scenario.dealerUpcard, shuffle(createShoe(1)))
}

const CATEGORY_LABELS: Record<TwoBetScenario['category'], string> = {
  hardDouble: 'hard double',
  softDouble: 'soft double',
  split: 'split',
}

export function TwoBetsMode({ rules, initialProgress, onProgressChange }: TwoBetsModeProps) {
  // Recomputed only when the live rule config actually changes — cheap
  // (~210 lightweight lookups) but no reason to redo it every render.
  const classified = useMemo(() => classifyTwoBetCandidates(rules), [rules])

  const [attempts, setAttempts] = useState(initialProgress.attempts)
  const [correct, setCorrect] = useState(initialProgress.correct)
  const [perCategory, setPerCategory] = useState(initialProgress.perCategory)

  // Pull-down only — same convention as IndexPlayMode.tsx, for the same
  // reason: a matching reactive "push on every local state change" effect
  // is what caused Index Plays' real, observed infinite loop once
  // perDeviation's (here: perCategory's) nested-object reference stopped
  // surviving round-trips. Every local push happens directly at its point
  // of mutation, below.
  useEffect(() => {
    setAttempts(initialProgress.attempts)
    setCorrect(initialProgress.correct)
    setPerCategory(initialProgress.perCategory)
  }, [initialProgress])

  function freshRound(): { scenario: TwoBetScenario; state: LivePlaySessionState; round: LiveRound } {
    const scenario = generateScenario(classified)
    const { state, round } = buildRound(scenario)
    return { scenario, state, round }
  }

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
    const isTwoBetDecision = decisionLog.length === 0
    const situationKey = getSituationKey(hand.cards, round.dealerUpcard)

    let record: DecisionRecord
    let nextState: LivePlaySessionState
    let nextRound: LiveRound

    if (isTwoBetDecision) {
      const isCorrect = action === scenario.correctAction
      const applied = applyAction(session, round, action)
      nextState = applied.state
      nextRound = applied.round
      record = {
        situationKey,
        chosenAction: action,
        correctAction: scenario.correctAction,
        isCorrect,
        isTwoBetDecision: true,
        wasTrap: scenario.isTrap,
      }

      const nextAttempts = attempts + 1
      const nextCorrect = correct + (isCorrect ? 1 : 0)
      const categoryStat = perCategory[scenario.category]
      const nextPerCategory = {
        ...perCategory,
        [scenario.category]: {
          attempts: categoryStat.attempts + 1,
          correct: categoryStat.correct + (isCorrect ? 1 : 0),
        },
      }
      setAttempts(nextAttempts)
      setCorrect(nextCorrect)
      setPerCategory(nextPerCategory)
      onProgressChange({ attempts: nextAttempts, correct: nextCorrect, perCategory: nextPerCategory })
    } else {
      const result = decide(session, round, action, rules)
      nextState = result.state
      nextRound = result.round
      record = {
        situationKey,
        chosenAction: result.chosenAction,
        correctAction: result.correctAction,
        isCorrect: result.isCorrect,
        isTwoBetDecision: false,
        wasTrap: false,
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
      <div className="flex w-full flex-1 min-h-0 items-center justify-center" style={{ containerType: 'size' }}>
        <CasinoTable dealerSlot={dealerSlot} seatContents={[seatContent]} seatLabels={['YOU']} userSeatIndex={0} />
      </div>

      {/* HUD */}
      <div
        className="flex w-full max-w-md flex-col items-center gap-4 overflow-y-auto"
        style={{ height: HUD_HEIGHT.twoBets, flexShrink: 0 }}
      >
        <p className="text-xs text-slate-500">
          Attempts: {attempts} · Accuracy: {attempts === 0 ? '—' : `${Math.round((correct / attempts) * 100)}%`}
        </p>

        <p className="text-sm text-slate-400">This round: {CATEGORY_LABELS[scenario.category]}</p>

        {phase === 'deciding' && (
          <div className="flex flex-col items-center gap-3">
            {lastDecision && (
              <p className={`text-sm font-medium ${lastDecision.isCorrect ? SUCCESS_TEXT : ERROR_TEXT}`}>
                {lastDecision.isCorrect ? 'Correct!' : `Incorrect — correct play was ${lastDecision.correctAction}`}
              </p>
            )}
            <ActionButtons onSelect={choose} actions={legalActions(round, rules)} />
          </div>
        )}

        {phase === 'roundComplete' && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className={`text-lg font-semibold ${misses.length === 0 ? SUCCESS_TEXT : ERROR_TEXT}`}>
              {decisionLog.length === 0 ? 'No decision needed' : `${correctCount}/${decisionLog.length} correct this hand`}
            </p>
            {misses.map((m, i) => {
              const reason = chartReasonFor(categoryOfSituationKey(m.situationKey), m.correctAction)
              const h17Note = h17NoteFor(m.situationKey)
              const trapWarning = trapWarningFor(m)
              return (
                <p key={i} className="text-sm text-slate-400">
                  {m.situationKey}: correct play was {m.correctAction}
                  {reason ? ` — ${reason}` : ''}
                  {h17Note && <span className="mt-1 block text-xs text-amber-300/80">{h17Note}</span>}
                  {trapWarning && <span className="mt-1 block text-xs text-amber-300/80">{trapWarning}</span>}
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
