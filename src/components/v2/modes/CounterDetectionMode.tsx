import { useEffect, useState } from 'react'
import {
  type DetectionSession,
  type RoundRecord,
  generateDetectionSession,
} from '../../../lib/detectionSession'
import type { DetectionDifficulty } from '../../../lib/playerProfiles'
import { SECTION_LABEL, PRIMARY_BUTTON, PRIMARY_BUTTON_LG, SECONDARY_BUTTON, SUCCESS_TEXT, ERROR_TEXT, HUD_HEIGHT } from '../../theme'
import { CasinoTable } from '../table/CasinoTable'

// ── Difficulty config ──────────────────────────────────────────────────────────

const DIFFICULTY_LABELS: Record<DetectionDifficulty, string> = {
  beginner: 'Beginner (obvious counter)',
  intermediate: 'Intermediate (subtle counter)',
  expert: 'Expert (camouflaged counter)',
}
const DIFFICULTIES: DetectionDifficulty[] = ['beginner', 'intermediate', 'expert']

// ── Chip stack ─────────────────────────────────────────────────────────────────
//
// Each chip: 22px circle, CSS concentric ring via box-shadow.
// CHIP_OFFSET = 11px (half the chip diameter) means each stacked chip shows
// its full lower half below the one above — clearly countable separate discs.
// Stack grows upward; row height = stack height so 1u vs 8u rows are 4.5×
// different in height, unmistakable when scanning down the column.

const CHIP_SIZE = 22     // diameter px
const CHIP_OFFSET = 11   // visible px of each chip below the one above (= half chip)
const CHIP_MAX = 10      // cap at 10 chips in display

const CHIP_COLOR: Record<number, string> = {
  1: '#94a3b8',   // slate  — "white chip" (minimum bet)
  2: '#f87171',   // red
  3: '#4ade80',   // green
  4: '#60a5fa',   // blue
  5: '#a78bfa',   // violet
  6: '#fb923c',   // orange
  7: '#f472b6',   // pink
  8: '#fbbf24',   // gold   — maximum bet
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

// ── Per-round detail ───────────────────────────────────────────────────────────
//
// Row height is determined by the chip stack, not a fixed minimum.
// 1u row ≈ 30px tall; 8u row ≈ 105px tall — 3.5× difference, unmistakable
// when scanning down the column.
//
// Layout: two side-by-side columns.
//   Left: #N · situation → actions · deviation label* — flex, fills height,
//         text vertically centered so it reads cleanly even in tall rows.
//   Right: ChipStack (grows upward, bottom-aligned) + TC ±N* beside it.
// * revealed=false during review (TC hidden; chip sizes fully visible)
// * revealed=true in feedback (TC column appears beside each stack)

function formatSituation(situationKey: string): string {
  const [category, total, , dealer] = situationKey.split('-')
  return `${category[0].toUpperCase()}${category.slice(1)} ${total} vs ${dealer}`
}

function RoundRow({ round, revealed }: { round: RoundRecord; revealed: boolean }) {
  const actionText = round.actions.join(' → ')
  const stackH = CHIP_SIZE + (Math.min(round.bet, CHIP_MAX) - 1) * CHIP_OFFSET
  const rowH = stackH + 12  // 6px padding top + bottom

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 8,
        height: rowH,
        borderBottom: '1px solid #1e293b',
        padding: '6px 0',
      }}
    >
      {/* Left column: round number + situation text + deviation labels */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        <span style={{ width: 32, color: '#64748b', fontSize: 12, flexShrink: 0 }}>
          #{round.roundNumber}
        </span>
        <span style={{ flex: 1, color: '#cbd5e1', fontSize: 12, minWidth: 0 }}>
          {formatSituation(round.situationKey)} → {actionText}
          {round.playerBusted && <span style={{ color: '#f87171' }}> (bust)</span>}
        </span>
        {revealed && round.deviated && (
          <span style={{
            fontSize: 11, flexShrink: 0,
            color: round.deviationType === 'index' ? '#fcd34d' : '#7dd3fc',
          }}>
            {round.deviationType === 'index'
              ? `dev: ${round.basicAction}`
              : `cover: ${round.basicAction}`}
          </span>
        )}
        {revealed && round.isCoverBet && (
          <span style={{ fontSize: 11, color: '#7dd3fc', flexShrink: 0 }}>cover bet</span>
        )}
      </div>

      {/* Right column: chip stack (bottom-aligned, grows upward) + TC */}
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

// ── Main component ─────────────────────────────────────────────────────────────

type Phase = 'idle' | 'reviewing' | 'feedback'

interface DetectionProgress {
  sessionsPlayed: number
  sessionsCorrect: number
}

interface CounterDetectionModeProps {
  numDecks: number
  initialProgress: DetectionProgress
  onProgressChange: (p: DetectionProgress) => void
}

export function CounterDetectionMode({ numDecks, initialProgress, onProgressChange }: CounterDetectionModeProps) {
  const [difficulty, setDifficulty] = useState<DetectionDifficulty>('beginner')
  const [phase, setPhase] = useState<Phase>('idle')
  const [session, setSession] = useState<DetectionSession | null>(null)
  const [verdict, setVerdict] = useState<boolean | null>(null)
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
    setVerdict(null)
    setPhase('reviewing')
  }

  function submitVerdict(saysCounting: boolean) {
    if (!session) return
    const isCorrect = saysCounting === session.isCounting
    setVerdict(saysCounting)
    setSessionsPlayed((n) => n + 1)
    if (isCorrect) setSessionsCorrect((n) => n + 1)
    setDetailOpen(true)
    setPhase('feedback')
  }

  const isCorrect = session && verdict !== null ? verdict === session.isCounting : null

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
      <div
        className="flex w-full max-w-2xl flex-col items-center gap-4 overflow-y-auto"
        style={{ height: HUD_HEIGHT.counterDetection, flexShrink: 0 }}
      >

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
              You're reviewing one simulated player's last hands at a table. Watch how their bet size moves and
              whether any of their plays look off — then judge: counting, or not?
            </p>
            <button type="button" onClick={startSession} className={PRIMARY_BUTTON_LG}>
              Start review
            </button>
          </div>
        )}

        {/* ── REVIEWING ── */}
        {phase === 'reviewing' && session && (
          <div className="flex w-full flex-col gap-4">
            <div className="w-full rounded border border-slate-800">
              <div className="flex flex-col px-2">
                {session.rounds.map((round) => (
                  <RoundRow key={round.roundNumber} round={round} revealed={false} />
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 border-t border-slate-800 pt-4">
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

        {/* ── FEEDBACK ── */}
        {phase === 'feedback' && session && (
          <div className="flex w-full flex-col gap-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className={`text-lg font-semibold ${isCorrect ? SUCCESS_TEXT : ERROR_TEXT}`}>
                {isCorrect ? 'Correct!' : 'Incorrect'}
              </p>
              <p className="text-slate-300">
                This player was{' '}
                <span className="font-semibold text-white">{session.profileName}</span>
                {session.isCounting ? ` (${DIFFICULTY_LABELS[session.difficulty]})` : ''}.
              </p>
              <p className="max-w-md text-sm text-slate-400">
                {session.isCounting
                  ? "Their bet size tracked the true count — bigger bets when the count favored them — and they made at least one count-dependent strategy deviation a recreational player wouldn't know to make."
                  : "Their bets stayed flat regardless of the count, and every play matched plain basic strategy — no count-dependent signal anywhere in this session."}
              </p>
            </div>

            <div className="w-full rounded border border-slate-800">
              <button
                type="button"
                onClick={() => setDetailOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <span>{detailOpen ? 'Hide round detail' : `View round detail (${session.rounds.length} rounds)`}</span>
                <span aria-hidden>{detailOpen ? '▲' : '▼'}</span>
              </button>
              {detailOpen && (
                <div className="flex flex-col px-2">
                  {session.rounds.map((round) => (
                    <RoundRow key={round.roundNumber} round={round} revealed={true} />
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
