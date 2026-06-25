import { useEffect, useState } from 'react'
import type { Action, Card } from '../types'
import { handValue, isBust } from '../lib/cards'
import { trueCount } from '../lib/counting'
import {
  type DealerResolution,
  type LivePlaySessionState,
  type LiveRound,
  type PlayHand,
  BET_TIERS,
  correctBetUnits,
  dealRound,
  decide,
  decksRemaining,
  handOutcome,
  isRoundOver,
  legalActions,
  needsReshuffle,
  netUnitsForRound,
  resolveDealer,
  startLivePlaySession,
} from '../lib/livePlaySession'
import { PlayingCard, HiddenCard } from './PlayingCard'
import { ActionButtons } from './ActionButtons'
import { TableFelt } from './TableFelt'
import { ShoeRack } from './ShoeRack'
import { ERROR_TEXT, PAGE_WRAPPER, PRIMARY_BUTTON, PRIMARY_BUTTON_LG, SECONDARY_BUTTON, SECTION_LABEL, SUCCESS_TEXT } from './theme'

type Phase = 'idle' | 'betting' | 'deciding' | 'roundComplete' | 'countCheck'

interface LastDecision {
  chosenAction: Action
  correctAction: Action
  isCorrect: boolean
}

interface CountFeedback {
  guess: number
  actual: number
  trueCountGuess: number
  trueCountActual: number
}

interface BetFeedback {
  guess: number
  correctUnits: number
  trueCountAtBet: number
}

interface LivePlayProgress {
  playAttempts: number
  playCorrect: number
  countAttempts: number
  countCorrect: number
  trueCountAttempts: number
  trueCountCorrect: number
  betAttempts: number
  betCorrect: number
}

interface LivePlayDrillProps {
  numDecks: number
  initialProgress: LivePlayProgress
  onProgressChange: (progress: LivePlayProgress) => void
}

function accuracyLabel(correct: number, attempts: number): string {
  return attempts === 0 ? '—' : `${Math.round((correct / attempts) * 100)}%`
}

function inProgressStatus(hand: PlayHand): string | null {
  if (!hand.done) return null
  if (hand.surrendered) return 'Surrendered'
  if (isBust(hand.cards)) return 'Busted'
  return 'Stood'
}

const OUTCOME_LABELS: Record<string, string> = {
  win: 'Win',
  lose: 'Lose',
  push: 'Push',
  bust: 'Busted',
  surrendered: 'Surrendered',
}

const OUTCOME_COLORS: Record<string, string> = {
  win: 'text-emerald-400',
  lose: 'text-red-400',
  push: 'text-slate-400',
  bust: 'text-red-400',
  surrendered: 'text-slate-400',
}

function HandGroup({
  hand,
  isActive,
  outcome,
}: {
  hand: PlayHand
  isActive: boolean
  outcome: string | null
}) {
  const { total, soft } = handValue(hand.cards)
  const status = outcome ? OUTCOME_LABELS[outcome] : inProgressStatus(hand)
  const color = outcome ? OUTCOME_COLORS[outcome] : 'text-slate-500'

  return (
    <div className={`flex flex-col items-center gap-1 rounded-md p-2 ${isActive ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="flex gap-1">
        {hand.cards.map((card, i) => (
          <PlayingCard key={i} card={card} suitIndex={i} size="sm" />
        ))}
      </div>
      <p className="text-xs text-slate-400">
        {total}
        {soft ? ' (soft)' : ''}
      </p>
      {status && <p className={`text-xs font-medium ${color}`}>{status}</p>}
    </div>
  )
}

export function LivePlayDrill({ numDecks, initialProgress, onProgressChange }: LivePlayDrillProps) {
  const [session, setSession] = useState<LivePlaySessionState | null>(null)
  const [round, setRound] = useState<LiveRound | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [lastDecision, setLastDecision] = useState<LastDecision | null>(null)
  const [dealerResolution, setDealerResolution] = useState<DealerResolution | null>(null)
  const [countGuess, setCountGuess] = useState('')
  const [trueCountGuess, setTrueCountGuess] = useState('')
  const [countFeedback, setCountFeedback] = useState<CountFeedback | null>(null)
  const [pendingTrueCountForBet, setPendingTrueCountForBet] = useState(0)
  const [betFeedback, setBetFeedback] = useState<BetFeedback | null>(null)
  const [currentBetUnits, setCurrentBetUnits] = useState(0)
  const [netUnits, setNetUnits] = useState(0)
  const [progress, setProgress] = useState(initialProgress)

  useEffect(() => {
    onProgressChange(progress)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress])

  useEffect(() => {
    setProgress(initialProgress)
  }, [initialProgress])

  function dealNextRound(fromSession: LivePlaySessionState) {
    const activeSession = needsReshuffle(fromSession) ? startLivePlaySession(numDecks) : fromSession
    const { state, round: newRound } = dealRound(activeSession)
    setSession(state)
    setRound(newRound)
    setLastDecision(null)
    setDealerResolution(null)
    setCountGuess('')
    setTrueCountGuess('')
    setCountFeedback(null)
    setBetFeedback(null)
    setPhase('deciding')
  }

  function start() {
    const newSession = startLivePlaySession(numDecks)
    setSession(newSession)
    setPendingTrueCountForBet(0)
    setBetFeedback(null)
    setPhase('betting')
  }

  function choose(action: Action) {
    if (!session || !round) return
    const result = decide(session, round, action)
    setSession(result.state)
    setRound(result.round)
    setLastDecision({ chosenAction: result.chosenAction, correctAction: result.correctAction, isCorrect: result.isCorrect })
    setProgress((prev) => ({
      ...prev,
      playAttempts: prev.playAttempts + 1,
      playCorrect: prev.playCorrect + (result.isCorrect ? 1 : 0),
    }))

    if (isRoundOver(result.round)) {
      const dealer = resolveDealer(result.state, result.round)
      setSession(dealer.state)
      setDealerResolution(dealer)
      setPhase('roundComplete')
      setNetUnits((prev) => prev + netUnitsForRound(result.round.hands, dealer.dealerCards, dealer.dealerBusted, currentBetUnits))
    }
  }

  function continueToCountCheck() {
    setPhase('countCheck')
  }

  function submitCount() {
    if (!session) return
    const guess = Number(countGuess)
    const actual = session.count
    const trueCountGuessValue = Number(trueCountGuess)
    const trueCountActual = trueCount(actual, decksRemaining(session))
    setCountFeedback({ guess, actual, trueCountGuess: trueCountGuessValue, trueCountActual })
    setProgress((prev) => ({
      ...prev,
      countAttempts: prev.countAttempts + 1,
      countCorrect: prev.countCorrect + (guess === actual ? 1 : 0),
      trueCountAttempts: prev.trueCountAttempts + 1,
      trueCountCorrect: prev.trueCountCorrect + (trueCountGuessValue === trueCountActual ? 1 : 0),
    }))
  }

  function continueToBetting() {
    if (!countFeedback) return
    setPendingTrueCountForBet(countFeedback.trueCountActual)
    setBetFeedback(null)
    setPhase('betting')
  }

  function chooseBet(units: number) {
    const correctUnits = correctBetUnits(pendingTrueCountForBet)
    setBetFeedback({ guess: units, correctUnits, trueCountAtBet: pendingTrueCountForBet })
    setCurrentBetUnits(units)
    setProgress((prev) => ({
      ...prev,
      betAttempts: prev.betAttempts + 1,
      betCorrect: prev.betCorrect + (units === correctUnits ? 1 : 0),
    }))
  }

  function dealAfterBet() {
    if (!session) return
    dealNextRound(session)
  }

  const showTable = round && (phase === 'deciding' || phase === 'roundComplete')

  return (
    <div className={PAGE_WRAPPER}>
      <p className="max-w-md text-center text-sm text-slate-400">
        Play full hands against the dealer using basic strategy, while keeping your own running count in your head —
        nothing is shown live. Once per hand, right before the next deal, you'll be shown the decks remaining and
        asked for both the running count and the true count. You'll then be shown that true count once more and
        asked to size your bet for EV before the next hand is dealt.
      </p>
      <p className="text-xs text-slate-500">
        Play accuracy: {accuracyLabel(progress.playCorrect, progress.playAttempts)} ({progress.playAttempts}) · Count
        accuracy: {accuracyLabel(progress.countCorrect, progress.countAttempts)} ({progress.countAttempts}) · True
        count accuracy: {accuracyLabel(progress.trueCountCorrect, progress.trueCountAttempts)} (
        {progress.trueCountAttempts}) · Bet accuracy: {accuracyLabel(progress.betCorrect, progress.betAttempts)} (
        {progress.betAttempts})
      </p>
      {phase !== 'idle' && (
        <p className="text-xs text-slate-500">
          Net units this session:{' '}
          <span className={netUnits > 0 ? SUCCESS_TEXT : netUnits < 0 ? ERROR_TEXT : 'text-slate-400'}>
            {netUnits > 0 ? '+' : ''}
            {netUnits.toFixed(1)}
          </span>
        </p>
      )}

      {phase === 'idle' && (
        <button type="button" onClick={start} className={PRIMARY_BUTTON_LG}>
          Start playing
        </button>
      )}

      {showTable && round && (
        <div className="flex flex-col items-center gap-6">
          <TableFelt
            dealer={
              <>
                <p className={SECTION_LABEL}>Dealer</p>
                <div className="flex gap-1">
                  <PlayingCard card={round.dealerUpcard} suitIndex={0} />
                  {phase === 'roundComplete' && dealerResolution ? (
                    dealerResolution.dealerCards.slice(1).map((card: Card, i: number) => (
                      <PlayingCard key={i} card={card} suitIndex={i + 1} />
                    ))
                  ) : (
                    <HiddenCard />
                  )}
                </div>
                {phase === 'roundComplete' && dealerResolution && (
                  <p className="text-xs text-slate-400">
                    {handValue(dealerResolution.dealerCards).total}
                    {dealerResolution.dealerBusted ? ' (bust)' : ''}
                  </p>
                )}
              </>
            }
            seats={round.hands.map((hand, i) => (
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
          />

          {lastDecision && (
            <p className={`text-sm font-medium ${lastDecision.isCorrect ? SUCCESS_TEXT : ERROR_TEXT}`}>
              {lastDecision.isCorrect ? 'Correct!' : `Incorrect — correct play was ${lastDecision.correctAction}`}
            </p>
          )}
        </div>
      )}

      {phase === 'deciding' && round && !isRoundOver(round) && (
        <ActionButtons onSelect={choose} actions={legalActions(round)} />
      )}

      {phase === 'roundComplete' && (
        <button type="button" onClick={continueToCountCheck} className={PRIMARY_BUTTON_LG}>
          Continue
        </button>
      )}

      {phase === 'countCheck' && !countFeedback && session && (
        <div className="flex flex-col items-center gap-3">
          <ShoeRack decksRemaining={decksRemaining(session)} totalDecks={numDecks} />
          <label className="flex items-center gap-2 text-slate-300">
            What's the running count?
            <input
              type="number"
              value={countGuess}
              onChange={(e) => setCountGuess(e.target.value)}
              autoFocus
              className="w-20 rounded bg-slate-800 px-2 py-1 text-center text-white"
            />
          </label>
          <label className="flex items-center gap-2 text-slate-300">
            What's the true count?
            <input
              type="number"
              value={trueCountGuess}
              onChange={(e) => setTrueCountGuess(e.target.value)}
              className="w-20 rounded bg-slate-800 px-2 py-1 text-center text-white"
            />
          </label>
          <button
            type="button"
            onClick={submitCount}
            disabled={countGuess.trim() === '' || trueCountGuess.trim() === ''}
            className={PRIMARY_BUTTON}
          >
            Submit
          </button>
        </div>
      )}

      {phase === 'countCheck' && countFeedback && (
        <div className="flex max-w-md flex-col items-center gap-2 text-center">
          <p className={`text-lg font-semibold ${countFeedback.guess === countFeedback.actual ? SUCCESS_TEXT : ERROR_TEXT}`}>
            Running count: {countFeedback.guess === countFeedback.actual ? 'Correct!' : `Off by ${Math.abs(countFeedback.guess - countFeedback.actual)}`}
          </p>
          <p className="text-slate-300">
            Running count: <span className="font-semibold text-white">{countFeedback.actual}</span> (you said{' '}
            {countFeedback.guess})
          </p>
          <p
            className={`text-lg font-semibold ${countFeedback.trueCountGuess === countFeedback.trueCountActual ? SUCCESS_TEXT : ERROR_TEXT}`}
          >
            True count:{' '}
            {countFeedback.trueCountGuess === countFeedback.trueCountActual
              ? 'Correct!'
              : `Off by ${Math.abs(countFeedback.trueCountGuess - countFeedback.trueCountActual)}`}
          </p>
          <p className="text-slate-300">
            True count: <span className="font-semibold text-white">{countFeedback.trueCountActual}</span> (you said{' '}
            {countFeedback.trueCountGuess})
          </p>
          <button type="button" onClick={continueToBetting} className={`mt-2 ${PRIMARY_BUTTON}`}>
            Continue
          </button>
        </div>
      )}

      {phase === 'betting' && !betFeedback && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-slate-300">
            True count entering this hand:{' '}
            <span className="font-semibold text-white">{pendingTrueCountForBet}</span>
          </p>
          <p className="text-sm text-slate-400">Place your bet:</p>
          <div className="flex flex-wrap justify-center gap-3">
            {BET_TIERS.map((units) => (
              <button key={units} type="button" onClick={() => chooseBet(units)} className={SECONDARY_BUTTON}>
                {units} unit{units === 1 ? '' : 's'}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'betting' && betFeedback && (
        <div className="flex max-w-md flex-col items-center gap-2 text-center">
          <p className={`text-lg font-semibold ${betFeedback.guess === betFeedback.correctUnits ? SUCCESS_TEXT : ERROR_TEXT}`}>
            {betFeedback.guess === betFeedback.correctUnits
              ? 'Correct!'
              : `Incorrect — correct bet was ${betFeedback.correctUnits} unit${betFeedback.correctUnits === 1 ? '' : 's'}`}
          </p>
          <p className="text-slate-300">
            True count was <span className="font-semibold text-white">{betFeedback.trueCountAtBet}</span>; you bet{' '}
            {betFeedback.guess} unit{betFeedback.guess === 1 ? '' : 's'}
          </p>
          <button type="button" onClick={dealAfterBet} className={`mt-2 ${PRIMARY_BUTTON}`}>
            Deal hand
          </button>
        </div>
      )}
    </div>
  )
}
