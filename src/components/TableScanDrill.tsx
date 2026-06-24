import { useEffect, useState } from 'react'
import { generateMultiPlayerSession, type MultiPlayerSession } from '../lib/multiPlayerSession'
import type { RoundRecord } from '../lib/detectionSession'
import type { DetectionDifficulty } from '../lib/playerProfiles'

type Phase = 'idle' | 'reviewing' | 'feedback'

const DIFFICULTY_LABELS: Record<DetectionDifficulty, string> = {
  beginner: 'Beginner (obvious counter)',
  intermediate: 'Intermediate (subtle counter)',
  expert: 'Expert (camouflaged counter)',
}
const DIFFICULTIES: DetectionDifficulty[] = ['beginner', 'intermediate', 'expert']

const UNIT_WIDTH_PX = 3
const MAX_DISPLAY_UNITS = 10

function MiniBetBar({ round, revealed }: { round: RoundRecord; revealed: boolean }) {
  const clampedUnits = Math.min(round.bet, MAX_DISPLAY_UNITS)
  const color = !revealed
    ? 'bg-slate-500'
    : round.trueCountAtBet > 0
      ? 'bg-emerald-500'
      : round.trueCountAtBet < 0
        ? 'bg-red-500'
        : 'bg-slate-500'
  const title = revealed
    ? `Round ${round.roundNumber}: ${round.bet}u, TC ${round.trueCountAtBet >= 0 ? '+' : ''}${round.trueCountAtBet}${round.deviated ? ` — deviation (${round.deviationType})` : ''}`
    : `Round ${round.roundNumber}: ${round.bet}u`

  return (
    <div
      title={title}
      className={`rounded-sm ${color} ${revealed && round.deviated ? 'ring-1 ring-amber-300' : ''}`}
      style={{ width: 4 + clampedUnits * UNIT_WIDTH_PX, height: 12 }}
    />
  )
}

function SeatRow({
  seatNumber,
  rounds,
  revealed,
  isCounterSeat,
  selected,
  onSelect,
}: {
  seatNumber: number
  rounds: RoundRecord[]
  revealed: boolean
  isCounterSeat: boolean
  selected: boolean
  onSelect?: () => void
}) {
  const deviatedRounds = rounds.filter((r) => r.deviated).map((r) => r.roundNumber)

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!onSelect}
      className={`flex w-full flex-col gap-1 rounded-md border p-2 text-left transition ${
        selected ? 'border-blue-500 bg-blue-950/40' : 'border-slate-800'
      } ${revealed && isCounterSeat ? 'border-emerald-600 bg-emerald-950/30' : ''} ${onSelect ? 'cursor-pointer hover:border-slate-600' : ''}`}
    >
      <div className="flex items-center justify-between text-sm text-slate-300">
        <span>Seat {seatNumber}</span>
        {revealed && isCounterSeat && <span className="text-xs font-medium text-emerald-400">counting</span>}
      </div>
      <div className="flex flex-wrap items-end gap-0.5">
        {rounds.map((r) => (
          <MiniBetBar key={r.roundNumber} round={r} revealed={revealed} />
        ))}
      </div>
      {revealed && deviatedRounds.length > 0 && (
        <p className="text-xs text-slate-500">Deviations: rounds {deviatedRounds.join(', ')}</p>
      )}
    </button>
  )
}

interface TableScanProgress {
  sessionsPlayed: number
  sessionsCorrect: number
}

interface TableScanDrillProps {
  numDecks: number
  seatCount: number
  initialProgress: TableScanProgress
  onProgressChange: (progress: TableScanProgress) => void
}

export function TableScanDrill({ numDecks, seatCount, initialProgress, onProgressChange }: TableScanDrillProps) {
  const [difficulty, setDifficulty] = useState<DetectionDifficulty>('beginner')
  const [phase, setPhase] = useState<Phase>('idle')
  const [session, setSession] = useState<MultiPlayerSession | null>(null)
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null)
  const [verdictSeat, setVerdictSeat] = useState<number | null>(null)
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
    setSession(generateMultiPlayerSession(numDecks, seatCount, difficulty))
    setSelectedSeat(null)
    setVerdictSeat(null)
    setPhase('reviewing')
  }

  function submitVerdict() {
    if (!session || selectedSeat === null) return
    setVerdictSeat(selectedSeat)
    setSessionsPlayed((n) => n + 1)
    if (selectedSeat === session.counterSeatIndex) setSessionsCorrect((n) => n + 1)
    setPhase('feedback')
  }

  const isCorrect = session && verdictSeat !== null ? verdictSeat === session.counterSeatIndex : null

  function seatRounds(session: MultiPlayerSession, seat: number): RoundRecord[] {
    return session.rounds.map((round) => round.seats[seat])
  }

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-6 px-4 py-10">
      {phase === 'idle' && (
        <div className="flex flex-col items-center gap-4">
          <p className="max-w-md text-center text-sm text-slate-400">
            Several seats are at this table. Exactly one of them is counting — scan their bet spreads across the shoe
            and pick the seat.
          </p>
          <p className="text-xs text-slate-500">{seatCount} seats (change shoe size/seats in Settings)</p>
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
          <button
            type="button"
            onClick={startSession}
            className="rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-500"
          >
            Start scan
          </button>
        </div>
      )}

      {phase === 'reviewing' && session && (
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-col gap-2">
            {Array.from({ length: session.seatCount }, (_, seat) => (
              <SeatRow
                key={seat}
                seatNumber={seat + 1}
                rounds={seatRounds(session, seat)}
                revealed={false}
                isCounterSeat={false}
                selected={selectedSeat === seat}
                onSelect={() => setSelectedSeat(seat)}
              />
            ))}
          </div>
          <div className="flex flex-col items-center gap-3 pt-2">
            <p className="text-slate-200">Which seat is counting?</p>
            <button
              type="button"
              onClick={submitVerdict}
              disabled={selectedSeat === null}
              className="rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {selectedSeat === null ? 'Select a seat' : `Submit: Seat ${selectedSeat + 1}`}
            </button>
          </div>
        </div>
      )}

      {phase === 'feedback' && session && (
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className={`text-lg font-semibold ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
              {isCorrect ? 'Correct!' : 'Incorrect'}
            </p>
            <p className="text-slate-300">
              The counter was at <span className="font-semibold text-white">Seat {session.counterSeatIndex + 1}</span>{' '}
              ({DIFFICULTY_LABELS[session.difficulty]}).
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {Array.from({ length: session.seatCount }, (_, seat) => (
              <SeatRow
                key={seat}
                seatNumber={seat + 1}
                rounds={seatRounds(session, seat)}
                revealed={true}
                isCounterSeat={seat === session.counterSeatIndex}
                selected={verdictSeat === seat}
              />
            ))}
          </div>

          <p className="text-center text-xs text-slate-500">
            Sessions played: {sessionsPlayed} · Correct: {sessionsCorrect}
          </p>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setPhase('idle')}
              className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500"
            >
              Back to start
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
