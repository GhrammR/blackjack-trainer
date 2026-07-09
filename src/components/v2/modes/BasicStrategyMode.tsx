import { useEffect, useState } from 'react'
import type { Action } from '../../../types'
import { ALL_SITUATION_KEYS, generateHand } from '../../../lib/handGenerator'
import { getSituationKey } from '../../../lib/strategy'
import { handValue, isBlackjack, isBust } from '../../../lib/cards'
import { createShoe, shuffle } from '../../../lib/shoe'
import {
  type LivePlaySessionState,
  type LiveRound,
  type PlayHand,
  dealRoundFromHand,
  decide,
  isRoundOver,
  legalActions,
} from '../../../lib/livePlaySession'
import { type Stats, recordResult, selectNextSituation } from '../../../lib/adaptiveEngine'
import { categoryOfSituationKey, lifetimeAccuracy, updateStreak } from '../../../lib/mastery'
import { loadState, saveState } from '../../../lib/persistence'
import { reasonFor } from '../../../lib/reasons'
import { HiddenCard, PlayingCard } from '../../PlayingCard'
import { ActionButtons } from '../../ActionButtons'
import { ProgressPanel } from '../../ProgressPanel'
import { ERROR_TEXT, PRIMARY_BUTTON_LG, SECTION_LABEL, SUCCESS_TEXT, HUD_HEIGHT } from '../../theme'
import { CasinoTable } from '../table/CasinoTable'

/**
 * Full play-out drill: the whole hand is played (including every split
 * hand) and EVERY decision is graded against the chart, not just the
 * initial one. Reuses Live Play's hand/split engine wholesale
 * (`legalActions`/`decide`/`isRoundOver`/`LiveRound`/`PlayHand` from
 * livePlaySession.ts, unmodified) via the one new addition there,
 * `dealRoundFromHand` — which seeds the round from a hand chosen by the
 * adaptive weakness engine instead of dealing from shoe position. This is
 * also why Split now only appears for a real pair (Ace+King no longer
 * offers it): `legalActions` already gates it on `isPair`, matching-rank
 * only — this mode simply never wired that gating in before.
 *
 * `lateSurrender` (the global setting) is threaded into both `legalActions`
 * and `decide` — before this prop existed, `legalActions` offered Surrender
 * unconditionally, which meant this mode showed a Surrender button that the
 * chart could never actually grade correct. Default off fixes that; on
 * makes the 7 sourced surrender cells (see strategy.ts) both offered and
 * graded correctly.
 */

type Phase = 'deciding' | 'roundComplete'

interface DecisionRecord {
  situationKey: string
  chosenAction: Action
  correctAction: Action
  isCorrect: boolean
}

function buildRound(stats: Stats): { state: LivePlaySessionState; round: LiveRound } {
  const situationKey = selectNextSituation(stats, ALL_SITUATION_KEYS)
  const { playerHand, dealerUpcard } = generateHand(situationKey)
  return dealRoundFromHand(playerHand, dealerUpcard, shuffle(createShoe(1)))
}

// Local, one-off — same convention as LivePlayMode.tsx's own HandGroup.
// No `outcome` prop here: this drill grades decisions, not a dealer play-out,
// so status is just how the hand ended, never win/lose/push.
function inProgressStatus(hand: PlayHand): string | null {
  if (!hand.done) return null
  if (hand.surrendered) return 'Surrendered'
  if (isBust(hand.cards)) return 'Bust'
  if (isBlackjack(hand.cards)) return 'Blackjack!'
  return 'Stood'
}

function HandGroup({ hand, isActive }: { hand: PlayHand; isActive: boolean }) {
  const { total, soft } = handValue(hand.cards)
  const statusText = inProgressStatus(hand)
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
      {statusText && <p className="text-xs font-medium text-slate-500">{statusText}</p>}
    </div>
  )
}

interface BasicStrategyModeProps {
  lateSurrender: boolean
}

export function BasicStrategyMode({ lateSurrender }: BasicStrategyModeProps) {
  const [persisted] = useState(() => loadState())
  const [stats, setStats] = useState<Stats>(persisted.stats)
  const [handsPlayed, setHandsPlayed] = useState(persisted.handsPlayed)
  const [currentStreak, setCurrentStreak] = useState(persisted.currentStreak)

  const [initial] = useState(() => buildRound(persisted.stats))
  const [session, setSession] = useState<LivePlaySessionState>(initial.state)
  const [round, setRound] = useState<LiveRound>(initial.round)
  const [decisionLog, setDecisionLog] = useState<DecisionRecord[]>([])
  const [lastDecision, setLastDecision] = useState<DecisionRecord | null>(null)
  const [phase, setPhase] = useState<Phase>(isRoundOver(initial.round) ? 'roundComplete' : 'deciding')

  useEffect(() => {
    saveState({ stats, handsPlayed, currentStreak })
  }, [stats, handsPlayed, currentStreak])

  function handleChoose(action: Action) {
    if (phase !== 'deciding') return
    const hand = round.hands[round.activeHandIndex]
    // Derived fresh from the CURRENT hand state, not the original generation
    // key — this is what makes every decision (post-hit, post-split) its
    // own gradable, trackable situation, feeding the weakness heatmap at
    // every real decision point encountered, not just the first.
    const situationKey = getSituationKey(hand.cards, round.dealerUpcard)
    const result = decide(session, round, action, lateSurrender)

    const record: DecisionRecord = {
      situationKey,
      chosenAction: result.chosenAction,
      correctAction: result.correctAction,
      isCorrect: result.isCorrect,
    }

    setSession(result.state)
    setRound(result.round)
    setLastDecision(record)
    setDecisionLog((log) => [...log, record])
    setStats((prev) => recordResult(prev, situationKey, result.isCorrect, handsPlayed))
    setHandsPlayed((prev) => prev + 1)
    setCurrentStreak((prev) => updateStreak(prev, result.isCorrect))

    if (isRoundOver(result.round)) {
      setPhase('roundComplete')
    }
  }

  function handleNext() {
    const next = buildRound(stats)
    setSession(next.state)
    setRound(next.round)
    setDecisionLog([])
    setLastDecision(null)
    setPhase(isRoundOver(next.round) ? 'roundComplete' : 'deciding')
  }

  const correctCount = decisionLog.filter((d) => d.isCorrect).length
  const misses = decisionLog.filter((d) => !d.isCorrect)

  const dealerSlot = (
    <>
      <p className={SECTION_LABEL}>Dealer</p>
      <div className="flex gap-2">
        <PlayingCard card={round.dealerUpcard} suitIndex={0} size="sm" />
        <HiddenCard size="sm" />
      </div>
    </>
  )

  const seatContent = (
    <div className="flex flex-wrap justify-center gap-2">
      {round.hands.map((hand, i) => (
        <HandGroup key={i} hand={hand} isActive={i === round.activeHandIndex} />
      ))}
    </div>
  )

  return (
    <div className="flex h-full w-full flex-col items-center gap-2 px-2 py-2">
      <div className="flex w-full flex-1 min-h-0 items-center justify-center"
        style={{ containerType: 'size' }}>
        <CasinoTable
          dealerSlot={dealerSlot}
          seatContents={[seatContent]}
          seatLabels={['You']}
          userSeatIndex={0}
        />
      </div>

      {/* HUD — fixed height (HUD_HEIGHT.strategy), this mode's own routine
          max, so the table above never resizes within this mode. The rare
          multi-miss roundComplete state scrolls internally via
          overflow-y-auto instead of being reserved for — see HUD_HEIGHT's
          doc comment in theme.ts. */}
      <div
        className="flex w-full max-w-md flex-col gap-3 overflow-y-auto"
        style={{ height: HUD_HEIGHT.strategy, flexShrink: 0 }}
      >
        <ProgressPanel currentStreak={currentStreak} lifetime={lifetimeAccuracy(stats)} />

        {phase === 'deciding' && (
          <div className="flex flex-col items-center gap-3">
            {lastDecision && (
              <p className={`text-sm font-medium ${lastDecision.isCorrect ? SUCCESS_TEXT : ERROR_TEXT}`}>
                {lastDecision.isCorrect
                  ? 'Correct!'
                  : `Incorrect — correct play was ${lastDecision.correctAction}`}
              </p>
            )}
            <ActionButtons onSelect={handleChoose} actions={legalActions(round, lateSurrender)} />
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
              const reason = reasonFor(categoryOfSituationKey(m.situationKey), m.correctAction)
              return (
                <p key={i} className="text-sm text-slate-400">
                  {m.situationKey}: correct play was {m.correctAction}
                  {reason ? ` — ${reason}` : ''}
                </p>
              )
            })}
            <button type="button" onClick={handleNext} className={PRIMARY_BUTTON_LG}>
              Next hand
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
