import { useEffect, useState } from 'react'
import type { Card } from '../types'
import { SHOE_SIZE_OPTIONS, createShoe, shuffle } from '../lib/shoe'
import { runningCount } from '../lib/counting'
import { type PersonalBests, updatePersonalBest } from '../lib/shoeCountdown'
import { formatSeconds } from '../lib/format'
import { PlayingCard } from './PlayingCard'

type Phase = 'idle' | 'running' | 'finished'

interface RunFeedback {
  isCorrect: boolean
  answer: number
  elapsedMs: number
  isNewBest: boolean
}

export function ShoeCountdownDrill() {
  const [numDecks, setNumDecks] = useState(6)
  const [phase, setPhase] = useState<Phase>('idle')
  const [shoe, setShoe] = useState<Card[]>([])
  const [revealedCount, setRevealedCount] = useState(0)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [countAnswer, setCountAnswer] = useState('')
  const [feedback, setFeedback] = useState<RunFeedback | null>(null)
  const [personalBests, setPersonalBests] = useState<PersonalBests>({})

  function start() {
    setShoe(shuffle(createShoe(numDecks)))
    setRevealedCount(1)
    setStartTime(performance.now())
    setElapsedMs(null)
    setCountAnswer('')
    setFeedback(null)
    setPhase('running')
  }

  function finishRun() {
    if (startTime === null) return
    setElapsedMs(performance.now() - startTime)
    setPhase('finished')
  }

  function advance() {
    if (revealedCount < shoe.length) {
      setRevealedCount((n) => n + 1)
    } else {
      finishRun()
    }
  }

  function giveUp() {
    setPhase('idle')
    setShoe([])
  }

  useEffect(() => {
    if (phase !== 'running') return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, revealedCount, shoe])

  function submit() {
    if (elapsedMs === null) return
    const answer = Number(countAnswer)
    const actual = runningCount(shoe)
    const isCorrect = answer === actual

    let isNewBest = false
    if (isCorrect) {
      const updated = updatePersonalBest(personalBests, numDecks, elapsedMs)
      isNewBest = updated !== personalBests
      setPersonalBests(updated)
    }

    setFeedback({ isCorrect, answer, elapsedMs, isNewBest })
  }

  function backToIdle() {
    setPhase('idle')
    setShoe([])
    setFeedback(null)
  }

  const currentCard = shoe[revealedCount - 1]
  const personalBest = personalBests[numDecks]

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-10">
      {phase === 'idle' && (
        <div className="flex flex-col items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            Shoe size
            <select
              value={numDecks}
              onChange={(e) => setNumDecks(Number(e.target.value))}
              className="rounded bg-slate-800 px-2 py-1 text-white"
            >
              {SHOE_SIZE_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} deck{d > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-slate-400">
            Personal best: {personalBest !== undefined ? formatSeconds(personalBest) : '—'}
          </p>
          <p className="max-w-xs text-center text-xs text-slate-500">
            Flip every card in the shoe as fast as you can, keeping a running count in your head. The count must come
            back to exactly 0 for a full shoe.
          </p>
          <button
            type="button"
            onClick={start}
            className="rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-500"
          >
            Start
          </button>
        </div>
      )}

      {phase === 'running' && currentCard && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-slate-400">
            Card {revealedCount} of {shoe.length}
          </p>
          <PlayingCard card={currentCard} suitIndex={revealedCount} />
          <button
            type="button"
            onClick={advance}
            className="rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-500"
          >
            Next card (Space)
          </button>
          <button type="button" onClick={giveUp} className="text-xs text-slate-500 underline hover:text-slate-400">
            Give up
          </button>
        </div>
      )}

      {phase === 'finished' && elapsedMs !== null && !feedback && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-lg text-slate-200">
            Time: <span className="font-semibold text-white">{formatSeconds(elapsedMs)}</span>
          </p>
          <label className="flex items-center gap-2 text-slate-300">
            What's your final count?
            <input
              type="number"
              value={countAnswer}
              onChange={(e) => setCountAnswer(e.target.value)}
              autoFocus
              className="w-20 rounded bg-slate-800 px-2 py-1 text-center text-white"
            />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={countAnswer.trim() === ''}
            className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Submit
          </button>
        </div>
      )}

      {feedback && (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className={`text-lg font-semibold ${feedback.isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
            {feedback.isCorrect ? 'Correct — count came back to 0!' : `Off — you said ${feedback.answer}, should be 0`}
          </p>
          <p className="text-slate-300">Time: {formatSeconds(feedback.elapsedMs)}</p>
          {feedback.isNewBest && <p className="font-semibold text-amber-300">New personal best!</p>}
          {!feedback.isCorrect && (
            <p className="max-w-xs text-xs text-slate-500">
              A full shoe always nets to 0 — a non-zero answer means a card got missed or miscounted somewhere along
              the way.
            </p>
          )}
          <button
            type="button"
            onClick={backToIdle}
            className="mt-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500"
          >
            Back to start
          </button>
        </div>
      )}
    </div>
  )
}
