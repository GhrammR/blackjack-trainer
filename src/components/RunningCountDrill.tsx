import { useEffect, useState } from 'react'
import type { Card } from '../types'
import { createShoe, shuffle } from '../lib/shoe'
import { type DealtRound, cardSlotAt, cardsPerRound, dealRound } from '../lib/countingDrill'
import { runningCount } from '../lib/counting'
import { signed } from '../lib/format'
import { PlayingCard } from './PlayingCard'

type Phase = 'idle' | 'dealing' | 'guessing' | 'feedback'

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

interface RunningCountDrillProps {
  numDecks: number
  seatCount: number
  cardsPerSecond: number
  initialProgress: RunningCountProgress
  onProgressChange: (progress: RunningCountProgress) => void
  isPaused: boolean
}

export function RunningCountDrill({
  numDecks,
  seatCount,
  cardsPerSecond,
  initialProgress,
  onProgressChange,
  isPaused,
}: RunningCountDrillProps) {
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

  const needed = cardsPerRound(seatCount)

  useEffect(() => {
    onProgressChange({ roundsPlayed, roundsCorrect })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundsPlayed, roundsCorrect])

  // Resyncs local counters when progress changes externally (e.g. a reset
  // from the global settings panel while this drill is mounted). A no-op on
  // the round-trip after this component's own onProgressChange call above,
  // since initialProgress will already match by the time it fires.
  useEffect(() => {
    setRoundsPlayed(initialProgress.roundsPlayed)
    setRoundsCorrect(initialProgress.roundsCorrect)
  }, [initialProgress])

  function startRound() {
    let activeShoe = shoe
    let pos = position
    if (activeShoe.length - pos < needed) {
      activeShoe = shuffle(createShoe(numDecks))
      pos = 0
      setShoe(activeShoe)
      setSessionCount(0) // a fresh shoe means a fresh running count
    }
    const { round: newRound, nextPosition } = dealRound(activeShoe, pos, seatCount)
    setRound(newRound)
    setPosition(nextPosition)
    setRevealedCount(0)
    setFeedback(null)
    setGuess('')
    setPhase('dealing')
  }

  useEffect(() => {
    if (phase !== 'dealing' || !round || isPaused) return
    if (revealedCount >= round.dealOrder.length) {
      setPhase('guessing')
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

  const visibleSeatCards: Card[][] = Array.from({ length: seatCount }, () => [] as Card[])
  const visibleDealerCards: Card[] = []
  if (round) {
    for (let i = 0; i < revealedCount; i++) {
      const slot = cardSlotAt(i, seatCount)
      if (slot.type === 'seat') visibleSeatCards[slot.seat].push(round.seatCards[slot.seat][slot.cardIndex])
      else visibleDealerCards.push(round.dealerCards[slot.cardIndex])
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-400">
        <span>
          {numDecks} deck{numDecks > 1 ? 's' : ''} · {seatCount} seat{seatCount > 1 ? 's' : ''} · {cardsPerSecond} cards/sec
          (change in Settings)
        </span>
        <span>Cards left in shoe: {shoe.length - position}</span>
      </div>

      {phase === 'idle' && (
        <button
          type="button"
          onClick={startRound}
          className="rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-500"
        >
          Deal round
        </button>
      )}

      {round && phase !== 'idle' && (
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm uppercase tracking-wide text-slate-400">Dealer</p>
            <div className="flex gap-1">
              {visibleDealerCards.map((card, i) => (
                <PlayingCard key={i} card={card} suitIndex={i} size="sm" />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {visibleSeatCards.map((cards, seat) => (
              <div key={seat} className="flex flex-col items-center gap-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Seat {seat + 1}</p>
                <div className="flex gap-1">
                  {cards.map((card, i) => (
                    <PlayingCard key={i} card={card} suitIndex={i} size="sm" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === 'guessing' && (
        <div className="flex flex-col items-center gap-3">
          <label className="flex items-center gap-2 text-slate-300">
            What's the running count?
            <input
              type="number"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              autoFocus
              className="w-20 rounded bg-slate-800 px-2 py-1 text-center text-white"
            />
          </label>
          <button
            type="button"
            onClick={submitGuess}
            disabled={guess.trim() === ''}
            className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Submit
          </button>
        </div>
      )}

      {phase === 'feedback' && feedback && (
        <div className="flex max-w-md flex-col items-center gap-2 text-center">
          <p className={`text-lg font-semibold ${feedback.guess === feedback.actual ? 'text-emerald-400' : 'text-red-400'}`}>
            {feedback.guess === feedback.actual ? 'Correct!' : `Off by ${Math.abs(feedback.guess - feedback.actual)}`}
          </p>
          <p className="text-slate-300">
            Running count: <span className="font-semibold text-white">{feedback.actual}</span> (you said {feedback.guess})
          </p>
          <div className="text-sm text-slate-400">
            <p>This round moved the count by {signed(feedback.roundDelta)}:</p>
            <p>
              {feedback.seatDeltas.map((d, i) => `Seat ${i + 1}: ${signed(d)}`).join(' · ')} · Dealer: {signed(feedback.dealerDelta)}
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Rounds: {roundsPlayed} · Correct: {roundsCorrect}
          </p>
          <button
            type="button"
            onClick={startRound}
            className="mt-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500"
          >
            Next round
          </button>
        </div>
      )}
    </div>
  )
}
