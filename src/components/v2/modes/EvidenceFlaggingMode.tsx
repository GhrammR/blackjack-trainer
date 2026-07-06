import { useEffect, useState } from 'react'
import {
  type DetectionSession,
  type RoundRecord,
  generateDetectionSession,
} from '../../../lib/detectionSession'
import { type FlagGrade, gradeFlags, isEvidenceRound } from '../../../lib/evidenceGrading'
import type { DetectionDifficulty } from '../../../lib/playerProfiles'
import {
  SECTION_LABEL,
  PRIMARY_BUTTON,
  PRIMARY_BUTTON_LG,
  SECONDARY_BUTTON,
  SUCCESS_TEXT,
  ERROR_TEXT,
} from '../../theme'
import { CasinoTable } from '../table/CasinoTable'

// ── Difficulty config ──────────────────────────────────────────────────────────

const DIFFICULTY_LABELS: Record<DetectionDifficulty, string> = {
  beginner: 'Beginner (obvious counter)',
  intermediate: 'Intermediate (subtle counter)',
  expert: 'Expert (camouflaged counter)',
}
const DIFFICULTIES: DetectionDifficulty[] = ['beginner', 'intermediate', 'expert']

// ── Chip stack (exact copy from CounterDetectionMode, slice 6) ─────────────────

const CHIP_SIZE = 22
const CHIP_OFFSET = 11
const CHIP_MAX = 10

const CHIP_COLOR: Record<number, string> = {
  1: '#94a3b8',
  2: '#f87171',
  3: '#4ade80',
  4: '#60a5fa',
  5: '#a78bfa',
  6: '#fb923c',
  7: '#f472b6',
  8: '#fbbf24',
}

function resolveChipColor(units: number): string {
  return CHIP_COLOR[Math.min(Math.max(units, 1), 8)]
}

function ChipStack({ units }: { units: number }) {
  const count = Math.min(Math.max(units, 1), CHIP_MAX)
  const color = resolveChipColor(units)
  const stackH = CHIP_SIZE + (count - 1) * CHIP_OFFSET

  return (
    <div style={{ position: 'relative', width: CHIP_SIZE + 2, height: stackH, flexShrink: 0 }}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            bottom: i * CHIP_OFFSET,
            width: CHIP_SIZE,
            height: CHIP_SIZE,
            borderRadius: '50%',
            background: color,
            border: '1.5px solid rgba(255,255,255,0.40)',
            boxShadow: [
              `inset 0 0 0 4px ${color}`,
              'inset 0 0 0 7px rgba(255,255,255,0.28)',
              '0 1px 3px rgba(0,0,0,0.60)',
            ].join(', '),
          }}
        />
      ))}
    </div>
  )
}

// ── Per-round detail row ───────────────────────────────────────────────────────
//
// Extends slice 6's RoundRow with:
//   • A flag checkbox + click-anywhere-to-toggle during review.
//   • A left-border color + result badge in feedback:
//       emerald  = flagged — evidence (true positive)
//       red      = flagged — not evidence (false positive)
//       amber    = missed evidence (false negative)
//       none     = correctly ignored
//
// Row height is still driven by the chip stack, as in slice 6, so 1u vs 8u
// rows are unmistakably different heights when scanning down the panel.

function formatSituation(situationKey: string): string {
  const [category, total, , dealer] = situationKey.split('-')
  return `${category[0].toUpperCase()}${category.slice(1)} ${total} vs ${dealer}`
}

function RoundRow({
  round,
  revealed,
  flagged,
  onToggleFlag,
  grade,
}: {
  round: RoundRecord
  revealed: boolean
  flagged: boolean
  onToggleFlag?: () => void
  grade: FlagGrade | null
}) {
  const actionText = round.actions.join(' → ')
  const stackH = CHIP_SIZE + (Math.min(round.bet, CHIP_MAX) - 1) * CHIP_OFFSET
  const rowH = stackH + 12

  let badge: { text: string; color: string } | null = null
  let leftBorderColor = 'transparent'
  if (revealed && grade) {
    if (grade.truePositives.includes(round.roundNumber)) {
      badge = { text: 'flagged — evidence', color: '#4ade80' }
      leftBorderColor = '#4ade80'
    } else if (grade.falsePositives.includes(round.roundNumber)) {
      badge = { text: 'flagged — not evidence', color: '#f87171' }
      leftBorderColor = '#f87171'
    } else if (grade.falseNegatives.includes(round.roundNumber)) {
      badge = { text: 'missed evidence', color: '#fcd34d' }
      leftBorderColor = '#fcd34d'
    }
  }

  return (
    <div
      onClick={onToggleFlag}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 8,
        height: rowH,
        borderBottom: '1px solid #1e293b',
        borderLeft: `3px solid ${leftBorderColor}`,
        padding: '6px 0 6px 4px',
        background: flagged && !revealed ? 'rgba(29,78,216,0.12)' : undefined,
        cursor: onToggleFlag ? 'pointer' : 'default',
        transition: 'background 0.1s',
      }}
    >
      {/* Left: checkbox + round number */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 56, flexShrink: 0 }}>
        <input
          type="checkbox"
          readOnly
          checked={flagged}
          style={{ pointerEvents: 'none', width: 13, height: 13 }}
        />
        <span style={{ color: '#64748b', fontSize: 12 }}>#{round.roundNumber}</span>
      </div>

      {/* Center: situation + actions + deviation labels + result badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        <span style={{ flex: 1, color: '#cbd5e1', fontSize: 12, minWidth: 0 }}>
          {formatSituation(round.situationKey)} → {actionText}
          {round.playerBusted && <span style={{ color: '#f87171' }}> (bust)</span>}
        </span>
        {revealed && round.deviated && (
          <span
            style={{
              fontSize: 11,
              flexShrink: 0,
              color: round.deviationType === 'index' ? '#fcd34d' : '#7dd3fc',
            }}
          >
            {round.deviationType === 'index'
              ? `dev: ${round.basicAction}`
              : `cover: ${round.basicAction}`}
          </span>
        )}
        {revealed && round.isCoverBet && (
          <span style={{ fontSize: 11, color: '#7dd3fc', flexShrink: 0 }}>cover bet</span>
        )}
        {badge && (
          <span style={{ fontSize: 11, fontWeight: 600, color: badge.color, flexShrink: 0 }}>
            {badge.text}
          </span>
        )}
      </div>

      {/* Right: chip stack (grows upward, bottom-aligned) + TC hidden during review */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <ChipStack units={round.bet} />
        {revealed ? (
          <span style={{ fontSize: 11, color: '#64748b', width: 40, paddingBottom: 2 }}>
            TC {round.trueCountAtBet >= 0 ? '+' : ''}{round.trueCountAtBet}
          </span>
        ) : (
          <span style={{ width: 40 }} />
        )}
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`
}

// ── Main component ─────────────────────────────────────────────────────────────

type Phase = 'idle' | 'reviewing' | 'feedback'

interface EvidenceProgress {
  sessionsPlayed: number
  sessionsCorrect: number
}

interface EvidenceFlaggingModeProps {
  numDecks: number
  initialProgress: EvidenceProgress
  onProgressChange: (p: EvidenceProgress) => void
}

export function EvidenceFlaggingMode({
  numDecks,
  initialProgress,
  onProgressChange,
}: EvidenceFlaggingModeProps) {
  const [difficulty, setDifficulty] = useState<DetectionDifficulty>('beginner')
  const [phase, setPhase] = useState<Phase>('idle')
  const [session, setSession] = useState<DetectionSession | null>(null)
  const [flagged, setFlagged] = useState<Set<number>>(new Set())
  const [verdict, setVerdict] = useState<boolean | null>(null)
  const [grade, setGrade] = useState<FlagGrade | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
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
    setDetailOpen(true)
    setPhase('feedback')
  }

  const isVerdictCorrect = session && verdict !== null ? verdict === session.isCounting : null
  const evidenceCount = session ? session.rounds.filter(isEvidenceRound).length : 0

  const dealerSlot = <p className={SECTION_LABEL}>Dealer</p>

  return (
    <div className="flex h-full w-full flex-col items-center gap-2 px-2 py-2">
      <div className="flex w-full flex-1 min-h-0 items-center justify-center"
        style={{ containerType: 'size' }}>
        <CasinoTable
          dealerSlot={dealerSlot}
          seatContents={[]}
          userSeatIndex={-1}
        />
      </div>

      {/* HUD */}
      <div className="flex w-full max-w-2xl flex-col items-center gap-4">

        {/* Difficulty + progress — always visible */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
          <label className="flex items-center gap-2 text-slate-300">
            Difficulty
            <select
              value={difficulty}
              disabled={phase !== 'idle'}
              onChange={(e) => setDifficulty(e.target.value as DetectionDifficulty)}
              className="rounded bg-slate-800 px-2 py-1 text-white disabled:opacity-50"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
              ))}
            </select>
          </label>
          <span className="text-slate-500">
            Sessions: {sessionsPlayed} · Correct: {sessionsCorrect}
          </span>
        </div>

        {/* ── IDLE ── */}
        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-3">
            <p className="max-w-md text-center text-sm text-slate-400">
              Review one player's hands and flag every round you think shows real evidence of
              counting — a genuine bet-size tell or a count-driven strategy deviation — then give
              your overall verdict.
            </p>
            <button type="button" onClick={startSession} className={PRIMARY_BUTTON_LG}>
              Start review
            </button>
          </div>
        )}

        {/* ── REVIEWING ── */}
        {phase === 'reviewing' && session && (
          <div className="flex w-full flex-col gap-4">

            {/* Always-visible round panel — click any row to flag it */}
            <div className="w-full rounded border border-slate-800">
              <p className="px-3 py-2 text-sm text-slate-400">
                Click rounds to flag as evidence{flagged.size > 0 ? ` · ${flagged.size} flagged` : ''}
              </p>
              <div className="flex flex-col px-2">
                {session.rounds.map((round) => (
                  <RoundRow
                    key={round.roundNumber}
                    round={round}
                    revealed={false}
                    flagged={flagged.has(round.roundNumber)}
                    onToggleFlag={() => toggleFlag(round.roundNumber)}
                    grade={null}
                  />
                ))}
              </div>
            </div>

            {/* Verdict — fires both the binary verdict and gradeFlags together */}
            <div className="flex flex-col items-center gap-3 border-t border-slate-800 pt-4">
              <p className="text-slate-200">Was this player counting cards?</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => submitVerdict(true)}
                  className={PRIMARY_BUTTON_LG}
                >
                  Counting
                </button>
                <button
                  type="button"
                  onClick={() => submitVerdict(false)}
                  className={SECONDARY_BUTTON}
                >
                  Not counting
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── FEEDBACK ── */}
        {phase === 'feedback' && session && grade && (
          <div className="flex w-full flex-col gap-4">

            {/* Summary */}
            <div className="flex flex-col items-center gap-2 text-center">
              <p className={`text-lg font-semibold ${isVerdictCorrect ? SUCCESS_TEXT : ERROR_TEXT}`}>
                Verdict: {isVerdictCorrect ? 'Correct!' : 'Incorrect'}
              </p>
              <p className="text-slate-300">
                This player was{' '}
                <span className="font-semibold text-white">{session.profileName}</span>
                {session.isCounting ? ` (${DIFFICULTY_LABELS[session.difficulty]})` : ''}.
              </p>
              <p className="text-sm text-slate-400">
                {evidenceCount} real evidence round{evidenceCount === 1 ? '' : 's'} ·{' '}
                Precision {formatPercent(grade.precision)} · Recall {formatPercent(grade.recall)}
              </p>
              <p className="max-w-md text-xs text-slate-500">
                Precision: of the rounds you flagged, how many were real evidence.
                Recall: of the real evidence rounds, how many you caught.
              </p>
            </div>

            {/* Round detail — auto-expanded on submit, collapsible */}
            <div className="w-full rounded border border-slate-800">
              <button
                type="button"
                onClick={() => setDetailOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <span>
                  {detailOpen
                    ? 'Hide round detail'
                    : `View round detail (${session.rounds.length} rounds)`}
                </span>
                <span aria-hidden>{detailOpen ? '▲' : '▼'}</span>
              </button>
              {detailOpen && (
                <div className="flex flex-col px-2">
                  {session.rounds.map((round) => (
                    <RoundRow
                      key={round.roundNumber}
                      round={round}
                      revealed={true}
                      flagged={flagged.has(round.roundNumber)}
                      grade={grade}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => { setPhase('idle'); setSession(null) }}
                className={PRIMARY_BUTTON}
              >
                Back to start
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
