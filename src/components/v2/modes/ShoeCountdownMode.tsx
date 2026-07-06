import { useEffect, useRef, useState } from 'react'
import type { Card } from '../../../types'
import type { ShoeCountdownProgress } from '../../../lib/persistence'
import { createShoe, shuffle } from '../../../lib/shoe'
import { runningCount } from '../../../lib/counting'
import { generateMissingCardsRound, pickStopIndex, updatePersonalBest } from '../../../lib/shoeCountdown'
import { formatPace, formatSeconds, isValidSignedInt, signed } from '../../../lib/format'
import { PlayingCard } from '../../PlayingCard'
import { SignedNumberInput } from '../../SignedNumberInput'
import { PRIMARY_BUTTON, PRIMARY_BUTTON_LG, SECTION_LABEL, SUCCESS_TEXT, ERROR_TEXT } from '../../theme'
import { CasinoTable } from '../table/CasinoTable'

type Phase = 'idle' | 'running' | 'finished'
type Format = 'fullCountdown' | 'missingCards'

interface RunFeedback {
  isCorrect: boolean
  answer: number
  actual: number
  elapsedMs: number
  isNewBest: boolean
}

interface ShoeCountdownModeProps {
  numDecks: number
  initialProgress: ShoeCountdownProgress
  onProgressChange: (progress: ShoeCountdownProgress) => void
  isPaused: boolean
}

export function ShoeCountdownMode({
  numDecks,
  initialProgress,
  onProgressChange,
  isPaused,
}: ShoeCountdownModeProps) {
  const [format, setFormat] = useState<Format>('fullCountdown')
  const [phase, setPhase] = useState<Phase>('idle')
  const [shoe, setShoe] = useState<Card[]>([])
  const [stopIndex, setStopIndex] = useState(0)
  const [missingCount, setMissingCount] = useState<number | null>(null)
  const [revealedCount, setRevealedCount] = useState(0)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [displayMs, setDisplayMs] = useState(0)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [countAnswer, setCountAnswer] = useState('')
  const [feedback, setFeedback] = useState<RunFeedback | null>(null)
  const [progress, setProgress] = useState(initialProgress)
  const countInputRef = useRef<HTMLInputElement>(null)

  const pausedMsRef = useRef(0)
  const pauseStartedAtRef = useRef<number | null>(null)

  useEffect(() => {
    onProgressChange(progress)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress])

  useEffect(() => {
    setProgress(initialProgress)
  }, [initialProgress])

  // Live timer — updates every 100ms during running phase
  useEffect(() => {
    if (phase !== 'running' || isPaused || startTime === null) return
    const id = setInterval(() => {
      setDisplayMs(performance.now() - startTime - pausedMsRef.current)
    }, 100)
    return () => clearInterval(id)
  }, [phase, isPaused, startTime])

  // Pause accounting — same pattern as v1
  useEffect(() => {
    if (phase !== 'running') return
    if (isPaused) {
      pauseStartedAtRef.current = performance.now()
    } else if (pauseStartedAtRef.current !== null) {
      pausedMsRef.current += performance.now() - pauseStartedAtRef.current
      pauseStartedAtRef.current = null
    }
  }, [isPaused, phase])

  function start() {
    let newShoe: Card[]
    let newStopIndex: number
    let newMissingCount: number | null = null

    if (format === 'fullCountdown') {
      newShoe = shuffle(createShoe(numDecks))
      newStopIndex = pickStopIndex(newShoe.length)
    } else {
      const round = generateMissingCardsRound(numDecks)
      newShoe = round.shoe
      newStopIndex = newShoe.length // deal every remaining card — no random stop needed here
      newMissingCount = round.missingCount
    }

    setShoe(newShoe)
    setStopIndex(newStopIndex)
    setMissingCount(newMissingCount)
    setRevealedCount(1)
    setStartTime(performance.now())
    setDisplayMs(0)
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
      totalPaused += performance.now() - pauseStartedAtRef.current
    }
    const ms = performance.now() - startTime - totalPaused
    setElapsedMs(ms)
    setDisplayMs(ms)
    setPhase('finished')
  }

  function advance() {
    if (revealedCount < stopIndex) {
      setRevealedCount((n) => n + 1)
    } else {
      finishRun()
    }
  }

  // Space / Enter advances card; gated on running + not paused
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

  // Auto-focus count input when finished phase starts
  useEffect(() => {
    if (phase === 'finished') countInputRef.current?.focus()
  }, [phase])

  function submit() {
    if (elapsedMs === null) return
    const answer = Number(countAnswer)
    const actual = format === 'fullCountdown' ? runningCount(shoe.slice(0, stopIndex)) : (missingCount as number)
    const isCorrect = answer === actual
    let isNewBest = false

    if (format === 'fullCountdown') {
      if (isCorrect) {
        // Pace (ms/card), not raw completion time — see shoeCountdown.ts for why raw time isn't comparable.
        const pace = elapsedMs / stopIndex
        const updated = updatePersonalBest(progress.fullCountdown.personalBests, numDecks, pace)
        isNewBest = updated !== progress.fullCountdown.personalBests
        setProgress((prev) => ({ ...prev, fullCountdown: { personalBests: updated } }))
      }
    } else {
      const mc = progress.missingCards
      const updatedBests = isCorrect ? updatePersonalBest(mc.personalBests, numDecks, elapsedMs) : mc.personalBests
      isNewBest = isCorrect && updatedBests !== mc.personalBests
      setProgress((prev) => ({
        ...prev,
        missingCards: {
          personalBests: updatedBests,
          attempts: mc.attempts + 1,
          correct: mc.correct + (isCorrect ? 1 : 0),
        },
      }))
    }

    setFeedback({ isCorrect, answer, actual, elapsedMs, isNewBest })
  }

  function backToIdle() {
    setPhase('idle')
    setShoe([])
    setFeedback(null)
  }

  // ── Table content ───────────────────────────────────────────────────────────

  const currentCard = phase === 'running' ? shoe[revealedCount - 1] : null

  // Single center seat with the current flipping card.
  // During idle/finished: empty seat (no content) so the felt is clean.
  const seatContents = currentCard
    ? [
        <div
          key="card"
          onClick={!isPaused ? advance : undefined}
          style={{ cursor: isPaused ? 'default' : 'pointer' }}
        >
          <PlayingCard card={currentCard} suitIndex={revealedCount} size="md" />
        </div>,
      ]
    : [<span key="empty" />]

  const dealerSlot = <p className={SECTION_LABEL}>Dealer</p>

  // Shoe rack depletes, discard fills — live per card flip (anti-cheese: no ratio label)
  const decksRemaining = shoe.length > 0 ? (shoe.length - revealedCount) / 52 : numDecks
  const discardFraction = shoe.length > 0 ? revealedCount / shoe.length : 0

  const fullCountdownBest = progress.fullCountdown.personalBests[numDecks]
  const missingCardsBest = progress.missingCards.personalBests[numDecks]
  const missingCardsStats = progress.missingCards

  return (
    <div className="flex w-full flex-col items-center gap-3 px-2 py-2">
      <CasinoTable
        dealerSlot={dealerSlot}
        seatContents={seatContents}
        userSeatIndex={0}
        totalDecks={numDecks}
        decksRemaining={decksRemaining}
        discardFraction={discardFraction}
      />

      {/* HUD */}
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <p className="text-sm text-slate-500">
          {numDecks} deck{numDecks !== 1 ? 's' : ''} (change in Settings)
          {format === 'fullCountdown' && fullCountdownBest !== undefined && ` · Best pace: ${formatPace(fullCountdownBest)}`}
          {format === 'missingCards' && missingCardsBest !== undefined && ` · Best: ${formatSeconds(missingCardsBest)}`}
          {format === 'missingCards' && missingCardsStats.attempts > 0 &&
            ` · ${missingCardsStats.correct}/${missingCardsStats.attempts} correct`}
        </p>

        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-3">
            <span role="group" aria-label="Format" className="inline-flex overflow-hidden rounded border border-slate-600">
              <button
                type="button"
                onClick={() => setFormat('fullCountdown')}
                aria-pressed={format === 'fullCountdown'}
                className={`px-3 py-1.5 text-sm font-medium transition ${
                  format === 'fullCountdown' ? 'bg-slate-100 text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Full Countdown
              </button>
              <button
                type="button"
                onClick={() => setFormat('missingCards')}
                aria-pressed={format === 'missingCards'}
                className={`px-3 py-1.5 text-sm font-medium transition ${
                  format === 'missingCards' ? 'bg-slate-100 text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Missing Cards
              </button>
            </span>
            <p className="max-w-xs text-center text-xs text-slate-500">
              {format === 'fullCountdown'
                ? 'Flip cards as fast as you can, keeping a running count in your head. The deal stops at an unpredictable point — the count has to be right the whole way, not just guessed at the end.'
                : "A real shoe with 1-2 cards secretly removed. Flip and count down every remaining card, then guess the removed card(s)' combined Hi-Lo value."}
            </p>
            <button type="button" onClick={start} className={PRIMARY_BUTTON_LG}>
              Start
            </button>
          </div>
        )}

        {phase === 'running' && (
          <div className="flex flex-col items-center gap-3">
            {/* Live timer — no card-count label (anti-cheese) */}
            <p className="font-mono text-2xl text-white">{formatSeconds(displayMs)}</p>
            <button
              type="button"
              onClick={!isPaused ? advance : undefined}
              disabled={isPaused}
              className={PRIMARY_BUTTON_LG}
            >
              Next card (Space)
            </button>
            <button
              type="button"
              onClick={backToIdle}
              className="text-xs text-slate-500 underline hover:text-slate-400"
            >
              Give up
            </button>
          </div>
        )}

        {phase === 'finished' && !feedback && elapsedMs !== null && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-lg text-slate-200">
              Time: <span className="font-semibold text-white">{formatSeconds(elapsedMs)}</span>
            </p>
            <label className="flex items-center gap-2 text-slate-300">
              {format === 'fullCountdown' ? "What's your final count?" : "What's the missing count?"}
              <SignedNumberInput
                ref={countInputRef}
                value={countAnswer}
                onChange={setCountAnswer}
                onKeyDown={(e) => { if (e.key === 'Enter' && isValidSignedInt(countAnswer)) submit() }}
              />
            </label>
            <button
              type="button"
              onClick={submit}
              disabled={!isValidSignedInt(countAnswer)}
              className={PRIMARY_BUTTON}
            >
              Submit
            </button>
          </div>
        )}

        {feedback && (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className={`text-lg font-semibold ${feedback.isCorrect ? SUCCESS_TEXT : ERROR_TEXT}`}>
              {feedback.isCorrect
                ? 'Correct!'
                : `Off — you said ${signed(feedback.answer)}, actual was ${signed(feedback.actual)}`}
            </p>
            <p className="text-slate-300">Time: {formatSeconds(feedback.elapsedMs)}</p>
            {feedback.isNewBest && (
              <p className="font-semibold text-amber-300">New personal best!</p>
            )}
            {!feedback.isCorrect && format === 'fullCountdown' && (
              <p className="max-w-xs text-xs text-slate-500">
                The deal stopped at a random point — the count had to be tracked the whole way, not guessed
                at the end.
              </p>
            )}
            <button type="button" onClick={backToIdle} className={`mt-2 ${PRIMARY_BUTTON}`}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
