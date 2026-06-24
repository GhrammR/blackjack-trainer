import { useEffect, useState } from 'react'
import type { Action } from '../types'
import {
  type DealtRound,
  type EvasionRoundRecord,
  type EvasionSessionState,
  currentTrueCount,
  dealRound,
  hasRoundsRemaining,
  resolveRound,
  startEvasionSession,
} from '../lib/evasionSession'
import { finalizeRounds, scoreSession } from '../lib/evasionScoring'
import { HandDisplay } from './HandDisplay'

type Phase = 'idle' | 'betting' | 'playing' | 'roundDone' | 'summary'

const BET_OPTIONS = [1, 2, 3, 5, 8, 12] as const

function formatSituation(situationKey: string): string {
  const [category, total, , dealer] = situationKey.split('-')
  return `${category[0].toUpperCase()}${category.slice(1)} ${total} vs ${dealer}`
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}%`
}

interface EvasionProgress {
  sessionsPlayed: number
  bestEdgeCapturedPct: number | null
  lowestHeat: number | null
}

interface EvasionDrillProps {
  numDecks: number
  initialProgress: EvasionProgress
  onProgressChange: (progress: EvasionProgress) => void
}

export function EvasionDrill({ numDecks, initialProgress, onProgressChange }: EvasionDrillProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [session, setSession] = useState<EvasionSessionState | null>(null)
  const [roundNumber, setRoundNumber] = useState(1)
  const [trueCountAtBet, setTrueCountAtBet] = useState(0)
  const [bet, setBet] = useState(1)
  const [dealt, setDealt] = useState<DealtRound | null>(null)
  const [rounds, setRounds] = useState<Omit<EvasionRoundRecord, 'isElevatedBet'>[]>([])
  const [lastRecord, setLastRecord] = useState<Omit<EvasionRoundRecord, 'isElevatedBet'> | null>(null)
  const [progress, setProgress] = useState(initialProgress)

  useEffect(() => {
    onProgressChange(progress)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress])

  useEffect(() => {
    setProgress(initialProgress)
  }, [initialProgress])

  function startSession() {
    const newSession = startEvasionSession(numDecks)
    setSession(newSession)
    setRoundNumber(1)
    setRounds([])
    setTrueCountAtBet(currentTrueCount(newSession))
    setBet(1)
    setPhase('betting')
  }

  function placeBet() {
    if (!session) return
    const { state: afterDeal, dealt: dealtRound } = dealRound(session)
    setSession(afterDeal)
    setDealt(dealtRound)
    setPhase('playing')
  }

  function choosePlay(action: Action) {
    if (!session || !dealt) return
    const { state: afterResolve, record } = resolveRound(session, dealt, bet, trueCountAtBet, action, roundNumber)
    setSession(afterResolve)
    setRounds((prev) => [...prev, record])
    setLastRecord(record)
    setPhase('roundDone')
  }

  function nextRound() {
    if (!session) return
    const nextRoundNumber = roundNumber + 1
    if (!hasRoundsRemaining(session, nextRoundNumber)) {
      finishSession()
      return
    }
    setRoundNumber(nextRoundNumber)
    setTrueCountAtBet(currentTrueCount(session))
    setBet(1)
    setPhase('betting')
  }

  function finishSession() {
    setPhase('summary')
  }

  function backToStart() {
    setPhase('idle')
  }

  const finalizedRounds = phase === 'summary' ? finalizeRounds(rounds) : []
  const scorecard = phase === 'summary' ? scoreSession(finalizedRounds) : null

  useEffect(() => {
    if (phase !== 'summary' || !scorecard) return
    setProgress((prev) => ({
      sessionsPlayed: prev.sessionsPlayed + 1,
      bestEdgeCapturedPct:
        scorecard.edgeCapturedPct === null
          ? prev.bestEdgeCapturedPct
          : prev.bestEdgeCapturedPct === null
            ? scorecard.edgeCapturedPct
            : Math.max(prev.bestEdgeCapturedPct, scorecard.edgeCapturedPct),
      lowestHeat: prev.lowestHeat === null ? scorecard.heat : Math.min(prev.lowestHeat, scorecard.heat),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const flip: Action | null = dealt?.basicAction === 'Hit' ? 'Stand' : dealt?.basicAction === 'Stand' ? 'Hit' : null
  const showCoverButton = flip !== null && flip !== dealt?.indicatedAction

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-10">
      {phase === 'idle' && (
        <div className="flex flex-col items-center gap-4">
          <p className="max-w-md text-center text-sm text-slate-400">
            Play the counter's seat. The true count is shown plainly each round — your job is the camouflage
            decision: bet enough to capture the edge without betting in a way that would read as evidence.
          </p>
          <p className="text-xs text-slate-500">
            Sessions played: {progress.sessionsPlayed} · Best edge captured: {formatPercent(progress.bestEdgeCapturedPct)} ·
            Lowest heat: {progress.lowestHeat ?? '—'}
          </p>
          <button
            type="button"
            onClick={startSession}
            className="rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-500"
          >
            Start session
          </button>
        </div>
      )}

      {phase === 'betting' && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Round {roundNumber}</p>
          <p className="text-lg text-slate-200">
            True count: <span className="font-semibold">{trueCountAtBet >= 0 ? '+' : ''}{trueCountAtBet}</span>
          </p>
          <p className="text-sm text-slate-400">How many units do you bet?</p>
          <div className="flex gap-2">
            {BET_OPTIONS.map((units) => (
              <button
                key={units}
                type="button"
                onClick={() => setBet(units)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  bet === units ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {units}u
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={placeBet}
            className="rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-500"
          >
            Deal ({bet}u)
          </button>
        </div>
      )}

      {phase === 'playing' && dealt && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Round {roundNumber} · {formatSituation(dealt.situationKey)} · bet {bet}u
          </p>
          <HandDisplay playerHand={dealt.initialPlayerHand} dealerUpcard={dealt.dealerUpcard} />
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => choosePlay(dealt.basicAction)}
              className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-600"
            >
              Play it straight: {dealt.basicAction}
            </button>
            {dealt.indicatedAction && (
              <button
                type="button"
                onClick={() => choosePlay(dealt.indicatedAction as Action)}
                className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-600"
              >
                Take the count's play: {dealt.indicatedAction}
              </button>
            )}
            {showCoverButton && flip && (
              <button
                type="button"
                onClick={() => choosePlay(flip)}
                className="rounded-md bg-sky-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
              >
                Cover deviation: {flip}
              </button>
            )}
          </div>
        </div>
      )}

      {phase === 'roundDone' && lastRecord && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-slate-300">
            Round {lastRecord.roundNumber}: bet {lastRecord.bet}u on {formatSituation(lastRecord.situationKey)}, played{' '}
            {lastRecord.actions.join(' → ')}
            {lastRecord.playerBusted && <span className="text-red-400"> (bust)</span>}.
          </p>
          <button
            type="button"
            onClick={nextRound}
            className="rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-500"
          >
            Next round
          </button>
        </div>
      )}

      {phase === 'summary' && scorecard && (
        <div className="flex w-full flex-col items-center gap-4">
          <p className="text-lg font-semibold text-slate-100">Session complete — {scorecard.totalRounds} rounds</p>
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-slate-200">
              Heat: <span className="font-semibold">{scorecard.heat}</span> / {scorecard.totalRounds} rounds would read as
              evidence
            </p>
            <p className="text-slate-200">
              Edge captured: <span className="font-semibold">{formatPercent(scorecard.edgeCapturedPct)}</span> of the
              aggressive, uncamouflaged baseline
            </p>
            <p className="max-w-md text-xs text-slate-500">
              0% = no better than flat betting throughout. 100% = matched an obvious counter's bet spread exactly,
              with no camouflage. Heat lower is safer; edge captured higher is more profitable — the trade-off is the
              point.
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Sessions played: {progress.sessionsPlayed} · Best edge captured: {formatPercent(progress.bestEdgeCapturedPct)} ·
            Lowest heat: {progress.lowestHeat ?? '—'}
          </p>
          <button
            type="button"
            onClick={backToStart}
            className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500"
          >
            Back to start
          </button>
        </div>
      )}
    </div>
  )
}
