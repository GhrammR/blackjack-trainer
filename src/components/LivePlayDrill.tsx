import { useEffect, useState } from 'react'
import type { Action, Card } from '../types'
import { handValue, isBust } from '../lib/cards'
import {
  type DealerResolution,
  type LivePlaySessionState,
  type LiveRound,
  type PlayHand,
  dealRound,
  decide,
  handOutcome,
  isRoundOver,
  legalActions,
  needsReshuffle,
  resolveDealer,
  startLivePlaySession,
} from '../lib/livePlaySession'
import { PlayingCard, HiddenCard } from './PlayingCard'
import { ActionButtons } from './ActionButtons'

type Phase = 'idle' | 'deciding' | 'roundComplete' | 'countCheck'

interface LastDecision {
  chosenAction: Action
  correctAction: Action
  isCorrect: boolean
}

interface CountFeedback {
  guess: number
  actual: number
}

interface LivePlayProgress {
  playAttempts: number
  playCorrect: number
  countAttempts: number
  countCorrect: number
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
  const [countFeedback, setCountFeedback] = useState<CountFeedback | null>(null)
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
    setCountFeedback(null)
    setPhase('deciding')
  }

  function start() {
    dealNextRound(startLivePlaySession(numDecks))
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
    }
  }

  function continueToCountCheck() {
    setPhase('countCheck')
  }

  function submitCount() {
    if (!session) return
    const guess = Number(countGuess)
    const actual = session.count
    setCountFeedback({ guess, actual })
    setProgress((prev) => ({
      ...prev,
      countAttempts: prev.countAttempts + 1,
      countCorrect: prev.countCorrect + (guess === actual ? 1 : 0),
    }))
  }

  function nextHand() {
    if (!session) return
    dealNextRound(session)
  }

  const showTable = round && (phase === 'deciding' || phase === 'roundComplete')

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-6 px-4 py-10">
      <p className="max-w-md text-center text-sm text-slate-400">
        Play full hands against the dealer using basic strategy, while keeping your own running count in your head —
        nothing is shown live. The count is checked once per hand, right before the next deal.
      </p>
      <p className="text-xs text-slate-500">
        Play accuracy: {accuracyLabel(progress.playCorrect, progress.playAttempts)} ({progress.playAttempts}) · Count
        accuracy: {accuracyLabel(progress.countCorrect, progress.countAttempts)} ({progress.countAttempts})
      </p>

      {phase === 'idle' && (
        <button
          type="button"
          onClick={start}
          className="rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-500"
        >
          Start playing
        </button>
      )}

      {showTable && round && (
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm uppercase tracking-wide text-slate-400">Dealer</p>
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
          </div>

          <div className="flex flex-wrap justify-center gap-4">
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

          {lastDecision && (
            <p className={`text-sm font-medium ${lastDecision.isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
              {lastDecision.isCorrect ? 'Correct!' : `Incorrect — correct play was ${lastDecision.correctAction}`}
            </p>
          )}
        </div>
      )}

      {phase === 'deciding' && round && !isRoundOver(round) && (
        <ActionButtons onSelect={choose} actions={legalActions(round)} />
      )}

      {phase === 'roundComplete' && (
        <button
          type="button"
          onClick={continueToCountCheck}
          className="rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-500"
        >
          Continue
        </button>
      )}

      {phase === 'countCheck' && !countFeedback && (
        <div className="flex flex-col items-center gap-3">
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
          <button
            type="button"
            onClick={submitCount}
            disabled={countGuess.trim() === ''}
            className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Submit
          </button>
        </div>
      )}

      {phase === 'countCheck' && countFeedback && (
        <div className="flex max-w-md flex-col items-center gap-2 text-center">
          <p className={`text-lg font-semibold ${countFeedback.guess === countFeedback.actual ? 'text-emerald-400' : 'text-red-400'}`}>
            {countFeedback.guess === countFeedback.actual ? 'Correct!' : `Off by ${Math.abs(countFeedback.guess - countFeedback.actual)}`}
          </p>
          <p className="text-slate-300">
            Running count: <span className="font-semibold text-white">{countFeedback.actual}</span> (you said{' '}
            {countFeedback.guess})
          </p>
          <button
            type="button"
            onClick={nextHand}
            className="mt-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500"
          >
            Next hand
          </button>
        </div>
      )}
    </div>
  )
}
