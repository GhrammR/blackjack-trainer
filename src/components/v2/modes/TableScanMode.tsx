import { useEffect, useState } from 'react'
import {
  type MultiPlayerSession,
  generateMultiPlayerSession,
} from '../../../lib/multiPlayerSession'
import type { DetectionDifficulty } from '../../../lib/playerProfiles'
import { PRIMARY_BUTTON, PRIMARY_BUTTON_LG, SUCCESS_TEXT, ERROR_TEXT, HUD_HEIGHT } from '../../theme'
import { CasinoTable } from '../table/CasinoTable'

// ── Difficulty config ──────────────────────────────────────────────────────────

const DIFFICULTY_LABELS: Record<DetectionDifficulty, string> = {
  beginner: 'Beginner (obvious counter)',
  intermediate: 'Intermediate (subtle counter)',
  expert: 'Expert (camouflaged counter)',
}
const DIFFICULTIES: DetectionDifficulty[] = ['beginner', 'intermediate', 'expert']

// ── Chip stack (exact copy from CounterDetectionMode, slice 6) ─────────────────
//
// CHIP_SIZE=22, CHIP_OFFSET=11 — the same proven-legible sizing that was
// approved in Counter Detection. 1u = single 22px disc; 8u = tall stack of 8
// discs. The height difference (22px vs 99px) is immediately obvious.

const CHIP_SIZE = 22
const CHIP_OFFSET = 11
const CHIP_MAX = 10

const CHIP_COLOR: Record<number, string> = {
  1: '#94a3b8',  // slate  — minimum bet
  2: '#f87171',  // red
  3: '#4ade80',  // green
  4: '#60a5fa',  // blue
  5: '#a78bfa',  // violet
  6: '#fb923c',  // orange
  7: '#f472b6',  // pink
  8: '#fbbf24',  // gold   — maximum bet
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

// ── Main component ─────────────────────────────────────────────────────────────

type Phase = 'idle' | 'reviewing' | 'feedback'

interface TableScanProgress {
  sessionsPlayed: number
  sessionsCorrect: number
}

interface TableScanModeProps {
  numDecks: number
  seatCount: number
  initialProgress: TableScanProgress
  onProgressChange: (p: TableScanProgress) => void
}

export function TableScanMode({
  numDecks,
  seatCount,
  initialProgress,
  onProgressChange,
}: TableScanModeProps) {
  const [difficulty, setDifficulty] = useState<DetectionDifficulty>('beginner')
  const [phase, setPhase] = useState<Phase>('idle')
  const [session, setSession] = useState<MultiPlayerSession | null>(null)
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
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
    // Deep multi-seat shoes (12 decks for 4 seats) rarely produce TC≥2 in 25 rounds.
    // Retry until the counter has at least one elevated bet so the drill is identifiable.
    let sess = generateMultiPlayerSession(numDecks, seatCount, difficulty)
    for (let i = 0; i < 10 && sess.rounds.every(r => r.seats[sess.counterSeatIndex].bet <= 1); i++) {
      sess = generateMultiPlayerSession(numDecks, seatCount, difficulty)
    }
    setSession(sess)
    setSelectedSeat(null)
    setIsCorrect(null)
    setPhase('reviewing')
  }

  function submitVerdict() {
    if (!session || selectedSeat === null) return
    const correct = selectedSeat === session.counterSeatIndex
    setIsCorrect(correct)
    setSessionsPlayed((n) => n + 1)
    if (correct) setSessionsCorrect((n) => n + 1)
    setPhase('feedback')
  }

  function handleSeatSelect(i: number) {
    if (phase === 'reviewing') setSelectedSeat(i)
  }

  const revealed = phase === 'feedback'
  const effectiveSeatCount = session ? session.seatCount : seatCount

  // ── Table seat markers ──────────────────────────────────────────────────────
  // Numbered betting-position circles at each seat. Click to select during review.
  // Color ring reflects selection / verdict — content-free so the comparison
  // panel below carries all the readable bet-pattern information.

  const seatContents = Array.from({ length: effectiveSeatCount }, (_, i) => {
    const isSelected = selectedSeat === i
    const isCounter = revealed && !!session && i === session.counterSeatIndex
    const isWrongPick = revealed && isSelected && !isCounter

    let borderColor = '#334155'
    if (isCounter) borderColor = '#4ade80'
    else if (isWrongPick) borderColor = '#f87171'
    else if (isSelected) borderColor = '#60a5fa'

    return (
      <div
        onClick={() => handleSeatSelect(i)}
        title={`Seat ${i + 1}`}
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#0f172a',
          border: `2px solid ${borderColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: phase === 'reviewing' ? 'pointer' : 'default',
          color: isCounter ? '#4ade80' : isSelected ? '#60a5fa' : '#475569',
          fontSize: 13,
          fontWeight: 600,
          transition: 'border-color 0.12s',
        }}
      >
        {i + 1}
      </div>
    )
  })

  // "Dealer" label removed — the chip tray uses that space (see CasinoTable.tsx / DealerChipTray.tsx).
  const dealerSlot = null
  const seatLabels = Array.from({ length: effectiveSeatCount }, (_, i) => `Seat ${i + 1}`)

  return (
    <div className="flex h-full w-full flex-col items-center gap-2 px-2 py-2">
      <div className="flex w-full flex-1 min-h-0 items-center justify-center"
        style={{ containerType: 'size' }}>
        <CasinoTable
          dealerSlot={dealerSlot}
          seatContents={seatContents}
          seatLabels={seatLabels}
          userSeatIndex={-1}
        />
      </div>

      {/* ── Comparison panel ─────────────────────────────────────────────────── */}
      {/* One column per seat, side by side. Each column: 25 rounds of chip stacks.
          Click a column header to select that seat as the counter.
          Chip stacks always visible during review (no gate, no toggle).
          TC revealed per round in feedback only; counter column highlighted green. */}
      {(phase === 'reviewing' || phase === 'feedback') && session && (
        <div
          className="w-full max-w-2xl rounded border border-slate-800"
          style={{ overflowX: 'auto' }}
        >
          <div style={{ overflowY: 'auto', maxHeight: 440 }}>
            <table
              style={{
                borderCollapse: 'collapse',
                width: '100%',
                minWidth: effectiveSeatCount * 96,
              }}
            >
              <thead>
                <tr>
                  {Array.from({ length: effectiveSeatCount }, (_, i) => {
                    const isCounter = revealed && i === session.counterSeatIndex
                    const isSelected = selectedSeat === i
                    const isWrong = revealed && isSelected && !isCounter

                    let bottomBorderColor = 'transparent'
                    if (isCounter) bottomBorderColor = '#4ade80'
                    else if (isWrong) bottomBorderColor = '#f87171'
                    else if (isSelected && !revealed) bottomBorderColor = '#60a5fa'

                    return (
                      <th
                        key={i}
                        onClick={() => handleSeatSelect(i)}
                        style={{
                          minWidth: 96,
                          padding: '8px 4px 6px',
                          textAlign: 'center',
                          position: 'sticky',
                          top: 0,
                          zIndex: 2,
                          background: isCounter ? '#14532d' : '#0f172a',
                          borderBottom: `2px solid ${bottomBorderColor}`,
                          color: isCounter ? '#4ade80' : isSelected ? '#60a5fa' : '#94a3b8',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: revealed ? 'default' : 'pointer',
                          userSelect: 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Seat {i + 1}
                        {isCounter && (
                          <span style={{ display: 'block', fontSize: 10, marginTop: 1 }}>
                            ← counter
                          </span>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {[...session.rounds].reverse().map((round) => (
                  <tr key={round.roundNumber}>
                    {round.seats.map((seatRound, seatIdx) => (
                      <td
                        key={seatIdx}
                        style={{
                          verticalAlign: 'bottom',
                          textAlign: 'center',
                          padding: '2px 0 4px',
                          borderBottom: '1px solid #1e293b',
                        }}
                      >
                        <div
                          style={{
                            display: 'inline-flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <ChipStack units={seatRound.bet} />
                          {revealed && (
                            <span style={{ fontSize: 10, color: '#64748b', lineHeight: 1 }}>
                              TC {seatRound.trueCountAtBet >= 0 ? '+' : ''}
                              {seatRound.trueCountAtBet}
                            </span>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── HUD ──────────────────────────────────────────────────────────────── */}
      <div
        className="flex w-full max-w-2xl flex-col items-center gap-4 overflow-y-auto"
        style={{ height: HUD_HEIGHT.tableScan, flexShrink: 0 }}
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
              A full table just finished a shoe. One seat was counting — the rest were flat
              bettors. Compare the chip-stack columns and pick the counter.
            </p>
            <button type="button" onClick={startSession} className={PRIMARY_BUTTON_LG}>
              Start scan
            </button>
          </div>
        )}

        {/* ── REVIEWING ── */}
        {phase === 'reviewing' && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-slate-300">
              {selectedSeat === null
                ? 'Click a column header (or seat circle above) to select the counter.'
                : `Seat ${selectedSeat + 1} selected — confirm or pick a different seat.`}
            </p>
            <button
              type="button"
              onClick={submitVerdict}
              disabled={selectedSeat === null}
              className={PRIMARY_BUTTON_LG}
            >
              {selectedSeat === null ? 'Select a seat first' : `Submit: Seat ${selectedSeat + 1}`}
            </button>
          </div>
        )}

        {/* ── FEEDBACK ── */}
        {phase === 'feedback' && session && isCorrect !== null && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className={`text-lg font-semibold ${isCorrect ? SUCCESS_TEXT : ERROR_TEXT}`}>
              {isCorrect ? 'Correct!' : 'Incorrect'}
            </p>
            <p className="text-slate-300">
              The counter was at{' '}
              <span className="font-semibold text-white">
                Seat {session.counterSeatIndex + 1}
              </span>{' '}
              ({DIFFICULTY_LABELS[session.difficulty]}
              {selectedSeat !== null && !isCorrect
                ? ` — you picked Seat ${selectedSeat + 1}`
                : ''}
              ).
            </p>
            <p className="max-w-md text-sm text-slate-400">
              Their column is highlighted above — compare the tall chip stacks against the flat
              bettors' uniform single chips. True count per round is now revealed below each stack.
            </p>
            <button
              type="button"
              onClick={() => { setPhase('idle'); setSession(null) }}
              className={PRIMARY_BUTTON}
            >
              Back to start
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
