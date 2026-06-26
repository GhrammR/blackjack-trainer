import { useEffect, useState } from 'react'
import { type DetectionSession, type RoundRecord, generateDetectionSession } from '../lib/detectionSession'
import { type FlagGrade, gradeFlags, isEvidenceRound } from '../lib/evidenceGrading'
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

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`
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

interface EvidenceRoundRowProps {
  round: RoundRecord
  revealed: boolean
  flagged: boolean
  onToggleFlag?: () => void
  grade: FlagGrade | null
}

function EvidenceRoundRow({ round, revealed, flagged, onToggleFlag, grade }: EvidenceRoundRowProps) {
  const actionText = round.actions.join(' → ')

  let resultBadge: { text: string; className: string } | null = null
  if (revealed && grade) {
    if (grade.truePositives.includes(round.roundNumber)) resultBadge = { text: 'flagged — evidence', className: 'text-emerald-400' }
    else if (grade.falsePositives.includes(round.roundNumber)) resultBadge = { text: 'flagged — not evidence', className: 'text-red-400' }
    else if (grade.falseNegatives.includes(round.roundNumber)) resultBadge = { text: 'missed evidence', className: 'text-amber-300' }
  }

  return (
    <div
      onClick={onToggleFlag}
      className={`flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 py-2 text-sm ${
        onToggleFlag ? 'cursor-pointer hover:bg-slate-800/40' : ''
      } ${flagged && !revealed ? 'bg-blue-950/30' : ''}`}
    >
      <span className="flex w-14 items-center gap-1 text-slate-500">
        <input type="checkbox" readOnly checked={flagged} className="pointer-events-none" />#{round.roundNumber}
      </span>
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
      {resultBadge && <span className={`text-xs font-medium ${resultBadge.className}`}>{resultBadge.text}</span>}
    </div>
  )
}

interface EvidenceProgress {
  sessionsPlayed: number
  sessionsCorrect: number
}

interface EvidenceDrillProps {
  numDecks: number
  initialProgress: EvidenceProgress
  onProgressChange: (progress: EvidenceProgress) => void
}

export function EvidenceDrill({ numDecks, initialProgress, onProgressChange }: EvidenceDrillProps) {
  const [difficulty, setDifficulty] = useState<DetectionDifficulty>('beginner')
  const [phase, setPhase] = useState<Phase>('idle')
  const [session, setSession] = useState<DetectionSession | null>(null)
  const [flagged, setFlagged] = useState<Set<number>>(new Set())
  const [verdict, setVerdict] = useState<boolean | null>(null)
  const [grade, setGrade] = useState<FlagGrade | null>(null)
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
    setFlagged(new Set())
    setVerdict(null)
    setGrade(null)
    setPhase('reviewing')
  }

  function toggleFlag(roundNumber: number) {
    setFlagged((prev) => {
      const next = new Set(prev)
      if (next.has(roundNumber)) next.delete(roundNumber)
      else next.add(roundNumber)
      return next
    })
  }

  function submitVerdict(saysCounting: boolean) {
    if (!session) return
    const verdictCorrect = saysCounting === session.isCounting
    const flagGrade = gradeFlags(session.rounds, flagged)
    setVerdict(saysCounting)
    setGrade(flagGrade)
    setSessionsPlayed((n) => n + 1)
    if (verdictCorrect) setSessionsCorrect((n) => n + 1)
    setPhase('feedback')
  }

  const isVerdictCorrect = session && verdict !== null ? verdict === session.isCounting : null
  const evidenceCount = session ? session.rounds.filter(isEvidenceRound).length : 0

  return (
    <div className={PAGE_WRAPPER}>
      {phase === 'idle' && (
        <div className="flex flex-col items-center gap-4">
          <p className="max-w-md text-center text-sm text-slate-400">
            Review one player's last hands and flag every round you think shows real evidence of counting — a
            genuine bet-size tell or a count-driven strategy deviation — then give your overall verdict.
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
            Sessions played: {sessionsPlayed} · Verdicts correct: {sessionsCorrect}
          </p>
          <button type="button" onClick={startSession} className={PRIMARY_BUTTON_LG}>
            Start review
          </button>
        </div>
      )}

      {phase === 'reviewing' && session && (
        <div className="flex w-full flex-col gap-4">
          <p className="text-center text-xs text-slate-500">Click a round to flag it as evidence. {flagged.size} flagged.</p>
          <div className="flex flex-col">
            {session.rounds.map((round) => (
              <EvidenceRoundRow
                key={round.roundNumber}
                round={round}
                revealed={false}
                flagged={flagged.has(round.roundNumber)}
                onToggleFlag={() => toggleFlag(round.roundNumber)}
                grade={null}
              />
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

      {phase === 'feedback' && session && grade && (
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className={`text-lg font-semibold ${isVerdictCorrect ? SUCCESS_TEXT : ERROR_TEXT}`}>
              Verdict: {isVerdictCorrect ? 'Correct!' : 'Incorrect'}
            </p>
            <p className="text-slate-300">
              This player was <span className="font-semibold text-white">{session.profileName}</span>
              {session.isCounting ? ` (${DIFFICULTY_LABELS[session.difficulty]})` : ''}.
            </p>
            <p className="text-sm text-slate-400">
              {evidenceCount} real evidence round{evidenceCount === 1 ? '' : 's'} this session · Precision{' '}
              {formatPercent(grade.precision)} · Recall {formatPercent(grade.recall)}
            </p>
            <p className="max-w-md text-xs text-slate-500">
              Precision: of the rounds you flagged, how many were real evidence. Recall: of the real evidence
              rounds, how many you caught.
            </p>
          </div>

          <div className="flex flex-col">
            {session.rounds.map((round) => (
              <EvidenceRoundRow
                key={round.roundNumber}
                round={round}
                revealed={true}
                flagged={flagged.has(round.roundNumber)}
                grade={grade}
              />
            ))}
          </div>

          <p className="text-center text-xs text-slate-500">
            Sessions played: {sessionsPlayed} · Verdicts correct: {sessionsCorrect}
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
