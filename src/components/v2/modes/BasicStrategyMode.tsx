import { useEffect, useState } from 'react'
import type { Action } from '../../../types'
import { ALL_SITUATION_KEYS, generateHand } from '../../../lib/handGenerator'
import { getSituationKey } from '../../../lib/strategy'
import { handValue, isBust } from '../../../lib/cards'
import { createShoe, shuffle } from '../../../lib/shoe'
import {
  type DealerResolution,
  type LivePlaySessionState,
  type LiveRound,
  type PlayHand,
  dealRoundFromHand,
  decide,
  handOutcome,
  isRoundOver,
  legalActions,
  resolveDealer,
  roundPayout,
} from '../../../lib/livePlaySession'
import { type Stats, recordResult, selectNextSituation } from '../../../lib/adaptiveEngine'
import { categoryOfSituationKey, lifetimeAccuracy, updateStreak } from '../../../lib/mastery'
import { loadState, saveState } from '../../../lib/persistence'
import { h17NoteFor, reasonFor } from '../../../lib/reasons'
import { HiddenCard, PlayingCard } from '../../PlayingCard'
import { ActionButtons } from '../../ActionButtons'
import { ChipBetPicker } from '../../ChipBetPicker'
import { ProgressPanel } from '../../ProgressPanel'
import { ERROR_TEXT, PRIMARY_BUTTON_LG, SUCCESS_TEXT, HUD_HEIGHT } from '../../theme'
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
 *
 * CHIP WAGER (additive, parallel to grading — never merged into it):
 * `dealRoundFromHand` now draws a real hole card, which is what lets this
 * mode call the exact same `resolveDealer` Live Play uses, unmodified, to
 * get a real win/lose/push outcome. A bet is placed BEFORE each hand is
 * dealt (new 'betting' phase); `roundPayout` (also unmodified/shared with
 * Live Play) settles the bankroll once the round is over, independent of
 * `decisionLog`/`stats`/`currentStreak`, which still grade every decision
 * exactly as before. A perfectly graded hand can still lose chips — that's
 * the intended lesson, not a bug.
 */

type Phase = 'betting' | 'deciding' | 'roundComplete'

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

const OUTCOME_LABELS: Record<string, string> = {
  win: 'Win', lose: 'Lose', push: 'Push', bust: 'Bust', surrendered: 'Surrender',
}
const OUTCOME_COLORS: Record<string, string> = {
  win: SUCCESS_TEXT, lose: ERROR_TEXT, push: 'text-slate-400',
  bust: ERROR_TEXT, surrendered: 'text-slate-400',
}

// Local, one-off — same convention as LivePlayMode.tsx's own HandGroup.
function inProgressStatus(hand: PlayHand): string | null {
  if (!hand.done) return null
  if (hand.surrendered) return 'Surrendered'
  if (isBust(hand.cards)) return 'Bust'
  if (hand.isNatural) return 'Blackjack!'
  return 'Stood'
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

interface BasicStrategyModeProps {
  lateSurrender: boolean
  bankroll: number
  onBankrollChange: (bankroll: number) => void
  onResetBankroll: () => void
}

export function BasicStrategyMode({ lateSurrender, bankroll, onBankrollChange, onResetBankroll }: BasicStrategyModeProps) {
  const [persisted] = useState(() => loadState())
  const [stats, setStats] = useState<Stats>(persisted.stats)
  const [handsPlayed, setHandsPlayed] = useState(persisted.handsPlayed)
  const [currentStreak, setCurrentStreak] = useState(persisted.currentStreak)
  const [bestStreak, setBestStreak] = useState(persisted.bestStreak)

  const [session, setSession] = useState<LivePlaySessionState | null>(null)
  const [round, setRound] = useState<LiveRound | null>(null)
  const [dealerResolution, setDealerResolution] = useState<DealerResolution | null>(null)
  const [currentBet, setCurrentBet] = useState<number | null>(null)
  const [payout, setPayout] = useState<number | null>(null)
  const [decisionLog, setDecisionLog] = useState<DecisionRecord[]>([])
  const [lastDecision, setLastDecision] = useState<DecisionRecord | null>(null)
  const [phase, setPhase] = useState<Phase>('betting')

  useEffect(() => {
    saveState({ stats, handsPlayed, currentStreak, bestStreak })
  }, [stats, handsPlayed, currentStreak, bestStreak])

  function settleRound(finalState: LivePlaySessionState, finalRound: LiveRound, betAmount: number) {
    const dealer = resolveDealer(finalState, finalRound)
    setDealerResolution(dealer)
    const roundPay = roundPayout(finalRound.hands, betAmount, dealer.dealerCards, dealer.dealerBusted)
    setPayout(roundPay)
    onBankrollChange(bankroll + roundPay)
    setPhase('roundComplete')
  }

  function placeBet(amount: number) {
    const next = buildRound(stats)
    setSession(next.state)
    setRound(next.round)
    setCurrentBet(amount)
    setDecisionLog([])
    setLastDecision(null)
    setDealerResolution(null)
    setPayout(null)

    if (isRoundOver(next.round)) {
      settleRound(next.state, next.round, amount)
    } else {
      setPhase('deciding')
    }
  }

  function handleChoose(action: Action) {
    if (phase !== 'deciding' || !session || !round || currentBet === null) return
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
    setCurrentStreak((prev) => {
      const next = updateStreak(prev, result.isCorrect)
      setBestStreak((best) => Math.max(best, next))
      return next
    })

    if (isRoundOver(result.round)) {
      settleRound(result.state, result.round, currentBet)
    }
  }

  function handleNext() {
    setSession(null)
    setRound(null)
    setPhase('betting')
  }

  const correctCount = decisionLog.filter((d) => d.isCorrect).length
  const misses = decisionLog.filter((d) => !d.isCorrect)

  const showCards = phase === 'deciding' || phase === 'roundComplete'

  // "Dealer" label removed — the chip tray uses that space (see CasinoTable.tsx / DealerChipTray.tsx).
  const dealerSlot = (
    <>
      {showCards && round && (
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
      )}
    </>
  )

  const seatContent = showCards && round ? (
    // flex-nowrap, not flex-wrap: the seat's box is vertically CENTERED on
    // its felt anchor point near the bottom curve (TableSeat sits inside a
    // translate(-50%,-50%) wrapper in CasinoTable.tsx), so wrapping into a
    // 2nd row grows the box downward past the felt's clipped edge — with 3+
    // split hands that showed up as "2 hands on top, 1 clipped off below."
    // A single row has far more horizontal room to work with (the felt is
    // much wider than tall near this seat), so up to 4 hands (the real
    // resplit cap) stay in one un-clipped row instead.
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
  ) : (
    <span />
  )

  return (
    <div className="flex h-full w-full flex-col items-center gap-1 px-2 py-1">
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

        <p className="text-center text-xs text-slate-500">
          Bankroll: <span className="font-semibold text-white">${bankroll.toFixed(0)}</span>
        </p>

        {phase === 'betting' && (
          <ChipBetPicker bankroll={bankroll} onBet={placeBet} onResetBankroll={onResetBankroll} />
        )}

        {phase === 'deciding' && round && (
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
              const h17Note = h17NoteFor(m.situationKey)
              return (
                <p key={i} className="text-sm text-slate-400">
                  {m.situationKey}: correct play was {m.correctAction}
                  {reason ? ` — ${reason}` : ''}
                  {h17Note && <span className="mt-1 block text-xs text-amber-300/80">{h17Note}</span>}
                </p>
              )
            })}
            {payout !== null && (
              <p className={`text-sm font-semibold ${payout > 0 ? SUCCESS_TEXT : payout < 0 ? ERROR_TEXT : 'text-slate-400'}`}>
                {payout > 0 ? `Won $${payout.toFixed(2)}` : payout < 0 ? `Lost $${Math.abs(payout).toFixed(2)}` : 'Push — bet returned'}
              </p>
            )}
            <button type="button" onClick={handleNext} className={PRIMARY_BUTTON_LG}>
              Next hand
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
