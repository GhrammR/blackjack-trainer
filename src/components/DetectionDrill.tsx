import { useEffect, useState } from 'react'
import {
  type DetectionSession,
  type RoundRecord,
  generateDetectionSession,
} from '../lib/detectionSession'
import type { DetectionDifficulty } from '../lib/playerProfiles'
import { PAGE_WRAPPER, PRIMARY_BUTTON, PRIMARY_BUTTON_LG, SECONDARY_BUTTON, SUCCESS_TEXT, ERROR_TEXT } from './theme'

type Phase = 'idle' | 'reviewing' | 'feedback'

const DIFFICULTY_LABELS: Record<DetectionDifficulty, string> = {
  beginner: 'Beginner (obvious counter)',
  intermediate: 'Intermediate (subtle counter)',
  expert: 'Expert (camouflaged counter)',
}
const DIFFICULTIES: DetectionDifficulty[] = ['beginner', 'intermediate', 'expert']

const UNIT_WIDTH_PX = 14
const MAX_DISPLAY_UNITS = 12

function formatSituation(situationKey: string): string {
  const [category, total, , dealer] = situationKey.split('-')
  return `${category[0].toUpperCase()}${category.slice(1)} ${total} vs ${dealer}`
}

interface BetBarProps {
  units: number
  revealed: boolean
  trueCountAtBet: number
}

function BetBar({ units, revealed, trueCountAtBet }: BetBarProps) {
  const clampedUnits = Math.min(units, MAX_DISPLAY_UNITS)
  const color = !revealed
    ? 'bg-slate-400'
    : trueCountAtBet > 0
      ? 'bg-emerald-500'
      : trueCountAtBet < 0
        ? 'bg-red-500'
        : 'bg-slate-400'

  return (
    <div className="flex items-center gap-2">
      <div className="h-3 rounded bg-slate-800" style={{ width: MAX_DISPLAY_UNITS * UNIT_WIDTH_PX }}>
        <div className={`h-3 rounded ${color}`} style={{ width: clampedUnits * UNIT_WIDTH_PX }} />
      </div>
      <span className="w-10 text-xs text-slate-400">{units}u</span>
      {revealed && <span className="w-10 text-xs text-slate-500">TC {trueCountAtBet >= 0 ? '+' : ''}{trueCountAtBet}</span>}
    </div>
  )
}

function RoundRow({ round, revealed }: { round: RoundRecord; revealed: boolean }) {
  const actionText = round.actions.join(' → ')
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 py-2 text-sm">
      <span className="w-10 text-slate-500">#{round.roundNumber}</span>
      <span className="flex-1 text-slate-300">
        {formatSituation(round.situationKey)} → {actionText}
        {round.playerBusted && <span className="ml-1 text-red-400">(bust)</span>}
      </span>
      {revealed && round.deviated && (
        <span className={`text-xs ${round.deviationType === 'index' ? 'text-amber-300' : 'text-sky-300'}`}>
          {round.deviationType === 'index'
            ? `deviation: basic strategy said ${round.basicAction}`
            : `cover play: basic strategy said ${round.basicAction}`}
        </span>
      )}
      {revealed && round.isCoverBet && <span className="text-xs text-sky-300">cover bet</span>}
      <BetBar units={round.bet} revealed={revealed} trueCountAtBet={round.trueCountAtBet} />
    </div>
  )
}

interface DetectionProgress {
  sessionsPlayed: number
  sessionsCorrect: number
}

interface DetectionDrillProps {
  numDecks: number
  initialProgress: DetectionProgress
  onProgressChange: (progress: DetectionProgress) => void
}

export function DetectionDrill({ numDecks, initialProgress, onProgressChange }: DetectionDrillProps) {
  const [difficulty, setDifficulty] = useState<DetectionDifficulty>('beginner')
  const [phase, setPhase] = useState<Phase>('idle')
  const [session, setSession] = useState<DetectionSession | null>(null)
  const [verdict, setVerdict] = useState<boolean | null>(null)
  const [sessionsPlayed, setSessionsPlayed] = useState(initialProgress.sessionsPlayed)
  const [sessionsCorrect, setSessionsCorrect] = useState(initialProgress.sessionsCorrect)

  useEffect(() => {
    onProgressChange({ sessionsPlayed, sessionsCorrect })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionsPlayed, sessionsCorrect])

  useEffect(() => {
    setSessionsPlayed(initialProgress.sessionsPlayed)
    setSessionsCorrect(initialProgress.sessionsCorrect)
  }, [initialProgress])

  function startSession() {
    setSession(generateDetectionSession(numDecks, difficulty))
    setVerdict(null)
    setPhase('reviewing')
  }

  function submitVerdict(saysCounting: boolean) {
    if (!session) return
    const isCorrect = saysCounting === session.isCounting
    setVerdict(saysCounting)
    setSessionsPlayed((n) => n + 1)
    if (isCorrect) setSessionsCorrect((n) => n + 1)
    setPhase('feedback')
  }

  const isCorrect = session && verdict !== null ? verdict === session.isCounting : null

  return (
    <div className={PAGE_WRAPPER}>
      {phase === 'idle' && (
        <div className="flex flex-col items-center gap-4">
          <p className="max-w-md text-center text-sm text-slate-400">
            You're reviewing one simulated player's last hands at a table. Watch how their bet size moves and whether
            any of their plays look off — then judge: counting, or not?
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            Difficulty
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as DetectionDifficulty)}
              className="rounded bg-slate-800 px-2 py-1 text-white"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-slate-500">
            Sessions played: {sessionsPlayed} · Correct: {sessionsCorrect}
          </p>
          <button type="button" onClick={startSession} className={PRIMARY_BUTTON_LG}>
            Start review
          </button>
        </div>
      )}

      {phase === 'reviewing' && session && (
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-col">
            {session.rounds.map((round) => (
              <RoundRow key={round.roundNumber} round={round} revealed={false} />
            ))}
          </div>
          <div className="flex flex-col items-center gap-3 pt-2">
            <p className="text-slate-200">Was this player counting cards?</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => submitVerdict(true)} className={PRIMARY_BUTTON_LG}>
                Counting
              </button>
              <button type="button" onClick={() => submitVerdict(false)} className={SECONDARY_BUTTON}>
                Not counting
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'feedback' && session && (
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className={`text-lg font-semibold ${isCorrect ? SUCCESS_TEXT : ERROR_TEXT}`}>
              {isCorrect ? 'Correct!' : 'Incorrect'}
            </p>
            <p className="text-slate-300">
              This player was <span className="font-semibold text-white">{session.profileName}</span>
              {session.isCounting ? ` (${DIFFICULTY_LABELS[session.difficulty]})` : ''}.
            </p>
            <p className="max-w-md text-sm text-slate-400">
              {session.isCounting
                ? "Their bet size tracked the true count — bigger bets when the count favored them — and they made at least one count-dependent strategy deviation a recreational player wouldn't know to make."
                : "Their bets stayed flat regardless of the count, and every play matched plain basic strategy — no count-dependent signal anywhere in this session."}
            </p>
          </div>

          <div className="flex flex-col">
            {session.rounds.map((round) => (
              <RoundRow key={round.roundNumber} round={round} revealed={true} />
            ))}
          </div>

          <p className="text-center text-xs text-slate-500">
            Sessions played: {sessionsPlayed} · Correct: {sessionsCorrect}
          </p>

          <div className="flex justify-center">
            <button type="button" onClick={() => setPhase('idle')} className={PRIMARY_BUTTON}>
              Back to start
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
