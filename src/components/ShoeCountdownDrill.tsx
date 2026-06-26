import { useEffect, useRef, useState } from 'react'
import type { Card } from '../types'
import { createShoe, shuffle } from '../lib/shoe'
import { runningCount } from '../lib/counting'
import { type PersonalBests, pickStopIndex, updatePersonalBest } from '../lib/shoeCountdown'
import { formatSeconds } from '../lib/format'
import { PlayingCard } from './PlayingCard'
import { PAGE_WRAPPER, PRIMARY_BUTTON, PRIMARY_BUTTON_LG, SUCCESS_TEXT, ERROR_TEXT } from './theme'

type Phase = 'idle' | 'running' | 'finished'

interface RunFeedback {
  isCorrect: boolean
  answer: number
  actual: number
  elapsedMs: number
  isNewBest: boolean
}

interface ShoeCountdownDrillProps {
  numDecks: number
  personalBests: PersonalBests
  onPersonalBestsChange: (bests: PersonalBests) => void
  isPaused: boolean
}

export function ShoeCountdownDrill({ numDecks, personalBests, onPersonalBestsChange, isPaused }: ShoeCountdownDrillProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [shoe, setShoe] = useState<Card[]>([])
  const [stopIndex, setStopIndex] = useState(0)
  const [revealedCount, setRevealedCount] = useState(0)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [countAnswer, setCountAnswer] = useState('')
  const [feedback, setFeedback] = useState<RunFeedback | null>(null)

  /** Total time spent paused so far this run, and when the current pause (if any) began. Refs because neither needs to trigger a render. */
  const pausedMsRef = useRef(0)
  const pauseStartedAtRef = useRef<number | null>(null)

  function start() {
    const newShoe = shuffle(createShoe(numDecks))
    setShoe(newShoe)
    setStopIndex(pickStopIndex(newShoe.length))
    setRevealedCount(1)
    setStartTime(performance.now())
    setElapsedMs(null)
    setCountAnswer('')
    setFeedback(null)
    setPhase('running')
    pausedMsRef.current = 0
    pauseStartedAtRef.current = null
  }

  function finishRun() {
    if (startTime === null) return
    let totalPaused = pausedMsRef.current
    if (pauseStartedAtRef.current !== null) {
      // Defensive: close out an unclosed pause segment rather than undercount it.
      totalPaused += performance.now() - pauseStartedAtRef.current
    }
    setElapsedMs(performance.now() - startTime - totalPaused)
    setPhase('finished')
  }

  useEffect(() => {
    if (phase !== 'running') return
    if (isPaused) {
      pauseStartedAtRef.current = performance.now()
    } else if (pauseStartedAtRef.current !== null) {
      pausedMsRef.current += performance.now() - pauseStartedAtRef.current
      pauseStartedAtRef.current = null
    }
  }, [isPaused, phase])

  function advance() {
    if (revealedCount < stopIndex) {
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
    if (phase !== 'running' || isPaused) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, revealedCount, shoe, isPaused])

  function submit() {
    if (elapsedMs === null) return
    const answer = Number(countAnswer)
    const actual = runningCount(shoe.slice(0, stopIndex))
    const isCorrect = answer === actual

    let isNewBest = false
    if (isCorrect) {
      const updated = updatePersonalBest(personalBests, numDecks, elapsedMs)
      isNewBest = updated !== personalBests
      onPersonalBestsChange(updated)
    }

    setFeedback({ isCorrect, answer, actual, elapsedMs, isNewBest })
  }

  function backToIdle() {
    setPhase('idle')
    setShoe([])
    setFeedback(null)
  }

  const currentCard = shoe[revealedCount - 1]
  const personalBest = personalBests[numDecks]

  return (
    <div className={PAGE_WRAPPER}>
      {phase === 'idle' && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-slate-400">
            {numDecks} deck{numDecks > 1 ? 's' : ''} (change in Settings)
          </p>
          <p className="text-sm text-slate-400">
            Personal best: {personalBest !== undefined ? formatSeconds(personalBest) : '—'}
          </p>
          <p className="max-w-xs text-center text-xs text-slate-500">
            Flip cards as fast as you can, keeping a running count in your head. The deal stops at an unpredictable
            point — you won't know when, so the count has to be right the whole way, not just guessed at the end.
            1 deck is a quick speed rep; a full multi-deck shoe is the endurance test.
          </p>
          <button type="button" onClick={start} className={PRIMARY_BUTTON_LG}>
            Start
          </button>
        </div>
      )}

      {phase === 'running' && currentCard && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-slate-400">Card {revealedCount}</p>
          <PlayingCard card={currentCard} suitIndex={revealedCount} />
          <button type="button" onClick={advance} className={PRIMARY_BUTTON_LG}>
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
          <button type="button" onClick={submit} disabled={countAnswer.trim() === ''} className={PRIMARY_BUTTON}>
            Submit
          </button>
        </div>
      )}

      {feedback && (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className={`text-lg font-semibold ${feedback.isCorrect ? SUCCESS_TEXT : ERROR_TEXT}`}>
            {feedback.isCorrect ? 'Correct!' : `Off — you said ${feedback.answer}, actual count was ${feedback.actual}`}
          </p>
          <p className="text-slate-300">Time: {formatSeconds(feedback.elapsedMs)}</p>
          {feedback.isNewBest && <p className="font-semibold text-amber-300">New personal best!</p>}
          {!feedback.isCorrect && (
            <p className="max-w-xs text-xs text-slate-500">
              The deal stopped at a random point, so the count couldn't be guessed in advance — it had to be tracked
              the whole way.
            </p>
          )}
          <button type="button" onClick={backToIdle} className={`mt-2 ${PRIMARY_BUTTON}`}>
            Back to start
          </button>
        </div>
      )}
    </div>
  )
}
