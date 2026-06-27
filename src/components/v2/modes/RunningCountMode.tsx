import { useEffect, useRef, useState } from 'react'
import type { Card } from '../../../types'
import { createShoe, shuffle } from '../../../lib/shoe'
import { type DealtRound, cardSlotAt, cardsPerRound, dealRound } from '../../../lib/countingDrill'
import { runningCount } from '../../../lib/counting'
import { signed } from '../../../lib/format'
import { HiddenCard, PlayingCard } from '../../PlayingCard'
import { ERROR_TEXT, PRIMARY_BUTTON, PRIMARY_BUTTON_LG, SECTION_LABEL, SUCCESS_TEXT } from '../../theme'
import { CasinoTable } from '../table/CasinoTable'

type Phase = 'idle' | 'dealing' | 'input' | 'feedback'

interface Feedback {
  guess: number
  actual: number
  roundDelta: number
  seatDeltas: number[]
  dealerDelta: number
}

interface RunningCountProgress {
  roundsPlayed: number
  roundsCorrect: number
}

interface RunningCountModeProps {
  numDecks: number
  seatCount: number
  cardsPerSecond: number
  initialProgress: RunningCountProgress
  onProgressChange: (p: RunningCountProgress) => void
  isPaused: boolean
}

export function RunningCountMode({
  numDecks,
  seatCount,
  cardsPerSecond,
  initialProgress,
  onProgressChange,
  isPaused,
}: RunningCountModeProps) {
  const [shoe, setShoe] = useState<Card[]>(() => shuffle(createShoe(numDecks)))
  const [position, setPosition] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [round, setRound] = useState<DealtRound | null>(null)
  const [revealedCount, setRevealedCount] = useState(0)
  const [guess, setGuess] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [roundsPlayed, setRoundsPlayed] = useState(initialProgress.roundsPlayed)
  const [roundsCorrect, setRoundsCorrect] = useState(initialProgress.roundsCorrect)
  const inputRef = useRef<HTMLInputElement>(null)

  const needed = cardsPerRound(seatCount)

  useEffect(() => {
    onProgressChange({ roundsPlayed, roundsCorrect })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundsPlayed, roundsCorrect])

  useEffect(() => {
    setRoundsPlayed(initialProgress.roundsPlayed)
    setRoundsCorrect(initialProgress.roundsCorrect)
  }, [initialProgress])

  // Auto-focus the count input when entering the input phase
  useEffect(() => {
    if (phase === 'input') inputRef.current?.focus()
  }, [phase])

  function startRound() {
    let activeShoe = shoe
    let pos = position
    if (activeShoe.length - pos < needed) {
      activeShoe = shuffle(createShoe(numDecks))
      pos = 0
      setShoe(activeShoe)
      setSessionCount(0)
    }
    const { round: newRound, nextPosition } = dealRound(activeShoe, pos, seatCount)
    setRound(newRound)
    setPosition(nextPosition)
    setRevealedCount(0)
    setFeedback(null)
    setGuess('')
    setPhase('dealing')
  }

  // Card reveal timer
  useEffect(() => {
    if (phase !== 'dealing' || !round || isPaused) return
    if (revealedCount >= round.dealOrder.length) {
      setPhase('input')
      return
    }
    const timer = setTimeout(() => setRevealedCount((n) => n + 1), 1000 / cardsPerSecond)
    return () => clearTimeout(timer)
  }, [phase, round, revealedCount, cardsPerSecond, isPaused])

  function submitGuess() {
    if (!round) return
    const guessNum = Number(guess)
    const seatDeltas = round.seatCards.map((cards) => runningCount(cards))
    const dealerDelta = runningCount(round.dealerCards)
    const roundDelta = seatDeltas.reduce((sum, d) => sum + d, dealerDelta)
    const actual = sessionCount + roundDelta
    setSessionCount(actual)
    setFeedback({ guess: guessNum, actual, roundDelta, seatDeltas, dealerDelta })
    setRoundsPlayed((n) => n + 1)
    if (guessNum === actual) setRoundsCorrect((n) => n + 1)
    setPhase('feedback')
  }

  // ── Compute visible cards from revealedCount ────────────────────────────────

  const visibleSeatCards: Card[][] = Array.from({ length: seatCount }, () => [])
  let dealerUpcardVisible = false
  // Hole card is only revealed when all slots are done (phase is input/feedback)
  const holeCardRevealed = phase === 'input' || phase === 'feedback'

  if (round) {
    for (let i = 0; i < revealedCount; i++) {
      const slot = cardSlotAt(i, seatCount)
      if (slot.type === 'seat') {
        visibleSeatCards[slot.seat].push(round.seatCards[slot.seat][slot.cardIndex])
      } else {
        if (slot.cardIndex === 0) dealerUpcardVisible = true
        // cardIndex === 1 is the hole card — not shown face-up until holeCardRevealed
      }
    }
  }

  // ── Table slot content ──────────────────────────────────────────────────────

  const dealerSlot = (
    <>
      <p className={SECTION_LABEL}>Dealer</p>
      <div className="flex gap-1">
        {dealerUpcardVisible && round && (
          <PlayingCard card={round.dealerCards[0]} suitIndex={0} size="sm" />
        )}
        {dealerUpcardVisible && (
          holeCardRevealed && round
            ? <PlayingCard card={round.dealerCards[1]} suitIndex={1} size="sm" />
            : <HiddenCard size="sm" />
        )}
      </div>
    </>
  )

  const seatContents = Array.from({ length: seatCount }, (_, i) => (
    <div className="flex gap-1">
      {visibleSeatCards[i].map((card, j) => (
        <PlayingCard key={j} card={card} suitIndex={j} size="sm" />
      ))}
    </div>
  ))

  const seatLabels = Array.from({ length: seatCount }, (_, i) =>
    seatCount === 1 ? undefined : `Seat ${i + 1}`,
  )

  const cardsLeft = shoe.length - position
  const discardFraction = position / shoe.length
  const decksRemaining = cardsLeft / 52

  return (
    <div className="flex w-full flex-col items-center gap-3 px-2 py-4">
      <CasinoTable
        dealerSlot={dealerSlot}
        seatContents={seatContents}
        seatLabels={seatLabels}
        userSeatIndex={-1}
        totalDecks={numDecks}
        decksRemaining={decksRemaining}
        discardFraction={discardFraction}
      />

      {/* HUD */}
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        {/* Session metadata — always visible */}
        <p className="text-center text-sm text-slate-500">
          {numDecks} deck{numDecks !== 1 ? 's' : ''} · {seatCount} seat{seatCount !== 1 ? 's' : ''} · {cardsPerSecond} cards/s
          · {cardsLeft} cards left
        </p>

        {phase === 'idle' && (
          <button type="button" onClick={startRound} className={PRIMARY_BUTTON_LG}>
            Deal Round
          </button>
        )}

        {phase === 'dealing' && (
          <p className="text-sm text-slate-400">Dealing&hellip; keep your count</p>
        )}

        {phase === 'input' && (
          <div className="flex flex-col items-center gap-3">
            <label className="flex items-center gap-2 text-slate-300">
              Running count?
              <input
                ref={inputRef}
                type="number"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && guess.trim() !== '') submitGuess() }}
                className="w-20 rounded bg-slate-800 px-2 py-1 text-center text-white"
              />
            </label>
            <button
              type="button"
              onClick={submitGuess}
              disabled={guess.trim() === ''}
              className={PRIMARY_BUTTON}
            >
              Submit
            </button>
          </div>
        )}

        {phase === 'feedback' && feedback && (
          <div className="flex max-w-md flex-col items-center gap-2 text-center">
            <p className={`text-lg font-semibold ${feedback.guess === feedback.actual ? SUCCESS_TEXT : ERROR_TEXT}`}>
              {feedback.guess === feedback.actual
                ? 'Correct!'
                : `Off by ${Math.abs(feedback.guess - feedback.actual)}`}
            </p>
            <p className="text-slate-300">
              Running count:{' '}
              <span className="font-semibold text-white">{signed(feedback.actual)}</span>
              {feedback.guess !== feedback.actual && ` (you said ${signed(feedback.guess)})`}
            </p>
            <p className="text-sm text-slate-400">
              This round moved the count by {signed(feedback.roundDelta)}:{' '}
              {feedback.seatDeltas.map((d, i) => `Seat ${i + 1}: ${signed(d)}`).join(' · ')} · Dealer: {signed(feedback.dealerDelta)}
            </p>
            <p className="text-xs text-slate-500">
              Rounds: {roundsPlayed} · Correct: {roundsCorrect}
            </p>
            <button type="button" onClick={startRound} className={`mt-2 ${PRIMARY_BUTTON}`}>
              Next Round
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
