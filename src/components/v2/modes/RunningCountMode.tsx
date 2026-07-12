import { useEffect, useRef, useState } from 'react'
import type { Card } from '../../../types'
import { createShoe, shuffle } from '../../../lib/shoe'
import { type DealtRound, cardSlotAt, cardsPerRound, dealRound } from '../../../lib/countingDrill'
import { runningCount } from '../../../lib/counting'
import { DEAL_SPEED_MS_PER_CARD, type DealSpeed } from '../../../lib/dealSpeed'
import { isValidSignedInt, signed } from '../../../lib/format'
import { HiddenCard, PlayingCard } from '../../PlayingCard'
import { SignedNumberInput } from '../../SignedNumberInput'
import { ERROR_TEXT, PRIMARY_BUTTON, PRIMARY_BUTTON_LG, SECONDARY_BUTTON, SUCCESS_TEXT, HUD_HEIGHT } from '../../theme'
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

/**
 * The live shoe + cumulative count — lifted to App.tsx (see App.tsx) so it
 * survives a Card Counting sub-tab switch away from Running Count and back.
 * Previously this was local component state, which meant switching tabs
 * unmounted RunningCountMode and silently reset the running count to 0 mid-
 * shoe — the count would then disagree with what the user had kept in their
 * head, marking a genuinely correct count as wrong. Only the in-flight round
 * (cards dealt, guess, feedback) stays local; that's fine to lose on a tab
 * switch, but the shoe and its cumulative count must not be.
 */
export interface RunningCountShoeState {
  shoe: Card[]
  position: number
  sessionCount: number
}

interface RunningCountModeProps {
  numDecks: number
  seatCount: number
  dealSpeed: DealSpeed
  initialProgress: RunningCountProgress
  onProgressChange: (p: RunningCountProgress) => void
  isPaused: boolean
  shoeState: RunningCountShoeState
  onShoeStateChange: (s: RunningCountShoeState) => void
}

export function RunningCountMode({
  numDecks,
  seatCount,
  dealSpeed,
  initialProgress,
  onProgressChange,
  isPaused,
  shoeState,
  onShoeStateChange,
}: RunningCountModeProps) {
  const msPerCard = DEAL_SPEED_MS_PER_CARD[dealSpeed]
  const { shoe, position, sessionCount } = shoeState
  const [roundNextPosition, setRoundNextPosition] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [round, setRound] = useState<DealtRound | null>(null)
  const [revealedCount, setRevealedCount] = useState(0)
  const [guess, setGuess] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [roundsPlayed, setRoundsPlayed] = useState(initialProgress.roundsPlayed)
  const [roundsCorrect, setRoundsCorrect] = useState(initialProgress.roundsCorrect)
  // Resume/start-fresh choice — the shoe/count deliberately persist across a
  // tab switch away from Running Count and back (see RunningCountShoeState's
  // doc comment: resetting mid-shoe was marking correct counts wrong). But
  // the user still loses their place when they return, so re-mounting onto
  // a shoe that's already partway through (`position > 0`) asks once,
  // rather than silently resuming with no way to re-orient. Read ONCE at
  // mount (not derived from the live `position` prop) so dealing rounds
  // afterward doesn't make the prompt reappear. A fresh/unstarted shoe
  // (`position === 0`) needs no prompt — nothing to choose between yet.
  const [awaitingResumeChoice] = useState(() => shoeState.position > 0)
  const [resumeChosen, setResumeChosen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const isFirstNumDecks = useRef(true)

  const needed = cardsPerRound(seatCount)
  const showResumePrompt = awaitingResumeChoice && !resumeChosen

  function resumeShoe() {
    setResumeChosen(true)
  }

  function startFreshShoe() {
    onShoeStateChange({ shoe: shuffle(createShoe(numDecks)), position: 0, sessionCount: 0 })
    setResumeChosen(true)
  }

  useEffect(() => {
    onProgressChange({ roundsPlayed, roundsCorrect })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundsPlayed, roundsCorrect])

  useEffect(() => {
    setRoundsPlayed(initialProgress.roundsPlayed)
    setRoundsCorrect(initialProgress.roundsCorrect)
  }, [initialProgress])

  // Re-shuffle a fresh shoe of the right size whenever the shoe-size setting changes
  // (the shoe otherwise only gets created once, at mount, from whatever numDecks was then).
  useEffect(() => {
    if (isFirstNumDecks.current) {
      isFirstNumDecks.current = false
      return
    }
    onShoeStateChange({ shoe: shuffle(createShoe(numDecks)), position: 0, sessionCount: 0 })
    setPhase('idle')
    setRound(null)
    setFeedback(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numDecks])

  // Auto-focus the count input when entering the input phase
  useEffect(() => {
    if (phase === 'input') inputRef.current?.focus()
  }, [phase])

  function startRound() {
    let activeShoe = shoe
    let pos = position
    // Shoe genuinely exhausted (can't deal a full round) — this is the ONLY
    // place the running count resets, matching a real shoe change.
    if (activeShoe.length - pos < needed) {
      activeShoe = shuffle(createShoe(numDecks))
      pos = 0
      onShoeStateChange({ shoe: activeShoe, position: 0, sessionCount: 0 })
    }
    const { round: newRound, nextPosition } = dealRound(activeShoe, pos, seatCount)
    setRound(newRound)
    setRoundNextPosition(nextPosition)
    setRevealedCount(0)
    setFeedback(null)
    setGuess('')
    setPhase('dealing')
  }

  // Card reveal timer — advances the shoe position card-by-card as each one is
  // revealed, so "cards left" ticks down in step with the visible deal instead
  // of jumping by a whole round's worth the instant "Deal Round" is pressed.
  useEffect(() => {
    if (phase !== 'dealing' || !round || isPaused) return
    if (revealedCount >= round.dealOrder.length) {
      onShoeStateChange({ shoe, position: roundNextPosition, sessionCount })
      setPhase('input')
      return
    }
    const timer = setTimeout(() => setRevealedCount((n) => n + 1), msPerCard)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round, revealedCount, msPerCard, isPaused, roundNextPosition])

  function submitGuess() {
    if (!round) return
    const guessNum = Number(guess)
    const seatDeltas = round.seatCards.map((cards) => runningCount(cards))
    const dealerDelta = runningCount(round.dealerCards)
    const roundDelta = seatDeltas.reduce((sum, d) => sum + d, dealerDelta)
    const actual = sessionCount + roundDelta
    onShoeStateChange({ shoe, position, sessionCount: actual })
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

  // "Dealer" label removed — the chip tray uses that space (see CasinoTable.tsx / DealerChipTray.tsx).
  const dealerSlot = (
    <>
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

  // While dealing, count only the cards actually revealed so far — `position`
  // itself doesn't advance until the round finishes (see the reveal-timer effect above).
  const dealtSoFar = phase === 'dealing' ? position + revealedCount : position
  const cardsLeft = shoe.length - dealtSoFar
  const discardFraction = shoe.length > 0 ? dealtSoFar / shoe.length : 0
  const decksRemaining = cardsLeft / 52

  return (
    <div className="flex h-full w-full flex-col items-center gap-1 px-2 py-1">
      <div className="flex w-full flex-1 min-h-0 items-center justify-center"
        style={{ containerType: 'size' }}>
        <CasinoTable
          dealerSlot={dealerSlot}
          seatContents={seatContents}
          seatLabels={seatLabels}
          userSeatIndex={-1}
          totalDecks={numDecks}
          decksRemaining={decksRemaining}
          discardFraction={discardFraction}
        />
      </div>

      {/* HUD */}
      <div
        className="flex w-full max-w-md flex-col items-center gap-4 overflow-y-auto"
        style={{ height: HUD_HEIGHT.runningCount, flexShrink: 0 }}
      >
        {/* Session metadata — always visible */}
        <p className="text-center text-sm text-slate-500">
          {numDecks} deck{numDecks !== 1 ? 's' : ''} · {seatCount} seat{seatCount !== 1 ? 's' : ''} ·{' '}
          {dealSpeed} pace · {cardsLeft} cards left
        </p>

        {phase === 'idle' && showResumePrompt && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-slate-400">You left a shoe in progress.</p>
            {/* The running count is shown ONLY here, to re-orient after
                returning — never during play, where it's the answer the
                user is supposed to be computing. */}
            <div className="flex flex-wrap justify-center gap-3">
              <button type="button" onClick={resumeShoe} className={PRIMARY_BUTTON_LG}>
                Resume shoe (Running Count: {signed(sessionCount)})
              </button>
              <button type="button" onClick={startFreshShoe} className={SECONDARY_BUTTON}>
                Start fresh shoe
              </button>
            </div>
          </div>
        )}

        {phase === 'idle' && !showResumePrompt && (
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
              <SignedNumberInput
                ref={inputRef}
                value={guess}
                onChange={setGuess}
                onKeyDown={(e) => { if (e.key === 'Enter' && isValidSignedInt(guess)) submitGuess() }}
              />
            </label>
            <button
              type="button"
              onClick={submitGuess}
              disabled={!isValidSignedInt(guess)}
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
