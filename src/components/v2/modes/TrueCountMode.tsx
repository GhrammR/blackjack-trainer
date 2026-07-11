import { useEffect, useRef, useState } from 'react'
import { createShoe, shuffle } from '../../../lib/shoe'
import {
  type DifficultyLevel,
  type TrueCountScenario,
  DIFFICULTY_LEVELS,
  decksRemainingFromPlayedEstimate,
  generateTrueCountScenario,
  gradeEstimate,
  gradeTrueCountMath,
} from '../../../lib/trueCountDrill'
import { MIN_DECKS_REMAINING, trueCount } from '../../../lib/counting'
import { isValidSignedInt, signed } from '../../../lib/format'
import { SignedNumberInput } from '../../SignedNumberInput'
import { PRIMARY_BUTTON, PRIMARY_BUTTON_LG, SECONDARY_BUTTON, SUCCESS_TEXT, ERROR_TEXT, HUD_HEIGHT } from '../../theme'
import { DiscardRack } from '../table/DiscardRack'
import { CasinoTable } from '../table/CasinoTable'

type Phase = 'idle' | 'guessing' | 'feedback'

const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  beginner: 'Beginner (full marks)',
  intermediate: 'Intermediate (sparse marks)',
  expert: 'Expert (no marks)',
}

interface RoundFeedback {
  runningCount: number
  playedEstimate: number
  derivedRemaining: number
  trueCountAnswer: number
  estimateGood: boolean
  estimateDelta: number
  mathCorrect: boolean
  expectedFromEstimate: number
  actualDecksPlayed: number
  actualDecksRemaining: number
  referenceTrueCount: number
}

interface TrueCountProgress {
  roundsPlayed: number
  goodEstimates: number
  correctMath: number
}

interface TrueCountModeProps {
  numDecks: number
  initialProgress: TrueCountProgress
  onProgressChange: (p: TrueCountProgress) => void
}

export function TrueCountMode({ numDecks, initialProgress, onProgressChange }: TrueCountModeProps) {
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('beginner')
  const [showScaleRef, setShowScaleRef] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [scenario, setScenario] = useState<TrueCountScenario | null>(null)
  const [playedInput, setPlayedInput] = useState('')
  const [trueCountInput, setTrueCountInput] = useState('')
  const [feedback, setFeedback] = useState<RoundFeedback | null>(null)
  const [roundsPlayed, setRoundsPlayed] = useState(initialProgress.roundsPlayed)
  const [goodEstimates, setGoodEstimates] = useState(initialProgress.goodEstimates)
  const [correctMath, setCorrectMath] = useState(initialProgress.correctMath)
  const playedRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    onProgressChange({ roundsPlayed, goodEstimates, correctMath })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundsPlayed, goodEstimates, correctMath])

  useEffect(() => {
    setRoundsPlayed(initialProgress.roundsPlayed)
    setGoodEstimates(initialProgress.goodEstimates)
    setCorrectMath(initialProgress.correctMath)
  }, [initialProgress])

  useEffect(() => {
    if (phase === 'guessing') playedRef.current?.focus()
  }, [phase])

  function newScenario() {
    const freshShoe = shuffle(createShoe(numDecks))
    setScenario(generateTrueCountScenario(freshShoe))
    setPlayedInput('')
    setTrueCountInput('')
    setFeedback(null)
    setPhase('guessing')
  }

  function handleDifficultyChange(level: DifficultyLevel) {
    setDifficulty(level)
    setPhase('idle')
    setScenario(null)
    setFeedback(null)
  }

  function submit() {
    if (!scenario) return
    const playedEstimate = Number(playedInput)
    const trueCountAnswer = Number(trueCountInput)
    // Floored the same way trueCount()'s own denominator is floored (see counting.ts) —
    // an overshoot estimate (playedEstimate > numDecks) would otherwise produce a negative
    // "decks remaining" that's shown to the user but doesn't match what trueCount() actually
    // divides by internally, making the displayed math (e.g. "-2 ÷ -1.5 = -4") look nonsensical.
    const derivedRemaining = Math.max(
      MIN_DECKS_REMAINING,
      decksRemainingFromPlayedEstimate(scenario.numDecks, playedEstimate),
    )
    const actualDecksRemaining = scenario.numDecks - scenario.actualDecksPlayed

    const estimateGrade = gradeEstimate(playedEstimate, scenario.actualDecksPlayed)
    const mathGrade = gradeTrueCountMath(scenario.runningCount, derivedRemaining, trueCountAnswer)
    const referenceTrueCount = trueCount(scenario.runningCount, actualDecksRemaining)

    setFeedback({
      runningCount: scenario.runningCount,
      playedEstimate,
      derivedRemaining,
      trueCountAnswer,
      estimateGood: estimateGrade.isGood,
      estimateDelta: estimateGrade.delta,
      mathCorrect: mathGrade.isCorrect,
      expectedFromEstimate: mathGrade.expected,
      actualDecksPlayed: scenario.actualDecksPlayed,
      actualDecksRemaining,
      referenceTrueCount,
    })
    setRoundsPlayed((n) => n + 1)
    if (estimateGrade.isGood) setGoodEstimates((n) => n + 1)
    if (mathGrade.isCorrect) setCorrectMath((n) => n + 1)
    setPhase('feedback')
  }

  const canSubmit = playedInput.trim() !== '' && Number(playedInput) >= 0 && isValidSignedInt(trueCountInput)

  // "Dealer" label removed — the chip tray uses that space (see CasinoTable.tsx / DealerChipTray.tsx).
  const dealerSlot = null

  // Discard rack fill + difficulty ticks driven by scenario (or empty in idle)
  const discardFraction = scenario ? scenario.dealtFraction : 0
  const discardDifficulty = phase !== 'idle' ? difficulty : undefined

  return (
    <div className="flex h-full w-full flex-col items-center gap-1 px-2 py-1">
      <div className="flex w-full flex-1 min-h-0 items-center justify-center"
        style={{ containerType: 'size' }}>
        <CasinoTable
          dealerSlot={dealerSlot}
          seatContents={[]}
          discardFraction={discardFraction}
          discardDifficulty={discardDifficulty}
          totalDecks={numDecks}
        />
      </div>

      {/* HUD */}
      <div
        className="flex w-full max-w-md flex-col items-center gap-4 overflow-y-auto"
        style={{ height: HUD_HEIGHT.trueCount, flexShrink: 0 }}
      >
        {/* Settings row — difficulty selector, always visible */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
          <span className="text-slate-500">{numDecks} deck{numDecks !== 1 ? 's' : ''} (change in Settings)</span>
          <label className="flex items-center gap-2 text-slate-300">
            Difficulty
            <select
              value={difficulty}
              disabled={phase !== 'idle'}
              onChange={(e) => handleDifficultyChange(e.target.value as DifficultyLevel)}
              className="rounded bg-slate-800 px-2 py-1 text-white disabled:opacity-50"
            >
              {DIFFICULTY_LEVELS.map((level) => (
                <option key={level} value={level}>{DIFFICULTY_LABELS[level]}</option>
              ))}
            </select>
          </label>
        </div>

        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setShowScaleRef((v) => !v)}
              className={SECONDARY_BUTTON}
            >
              {showScaleRef ? 'Hide scale reference' : 'Show scale reference'}
            </button>
            {showScaleRef && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-slate-400">
                  Scale reference — {numDecks} deck{numDecks !== 1 ? 's' : ''} shoe
                </p>
                {/* Empty rack with full beginner ticks — study before drilling */}
                <DiscardRack fillFraction={0} totalDecks={numDecks} difficulty="beginner" />
                <p className="max-w-[14rem] text-center text-xs text-slate-500">
                  Study these calibration marks, then start a scenario — marks may be sparser during the real drill
                </p>
              </div>
            )}
            <button type="button" onClick={newScenario} className={PRIMARY_BUTTON_LG}>
              New Scenario
            </button>
          </div>
        )}

        {phase === 'guessing' && scenario && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-lg text-slate-200">
              Running count: <span className="font-semibold text-white">{signed(scenario.runningCount)}</span>
            </p>
            <p className="max-w-xs text-center text-xs text-slate-500">
              Estimate decks played from the discard rack, then compute: true count = running count ÷ decks remaining (rounded)
            </p>
            <label className="flex items-center gap-2 text-slate-300">
              Decks played (estimate)
              <input
                ref={playedRef}
                type="number"
                step="0.5"
                min="0"
                value={playedInput}
                onChange={(e) => setPlayedInput(e.target.value)}
                className="w-20 rounded bg-slate-800 px-2 py-1 text-center text-white"
              />
            </label>
            <label className="flex items-center gap-2 text-slate-300">
              True count
              <SignedNumberInput
                value={trueCountInput}
                onChange={setTrueCountInput}
                onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) submit() }}
              />
            </label>
            <button type="button" onClick={submit} disabled={!canSubmit} className={PRIMARY_BUTTON}>
              Submit
            </button>
          </div>
        )}

        {phase === 'feedback' && feedback && (
          <div className="flex max-w-md flex-col items-center gap-2 text-center">
            <p className={`text-lg font-semibold ${feedback.estimateGood ? SUCCESS_TEXT : ERROR_TEXT}`}>
              {feedback.estimateGood
                ? 'Good estimate'
                : `Estimate off by ${Math.abs(feedback.estimateDelta).toFixed(1)} decks`}
            </p>
            <p className={`text-lg font-semibold ${feedback.mathCorrect ? SUCCESS_TEXT : ERROR_TEXT}`}>
              {feedback.mathCorrect
                ? 'Correct math'
                : `Math off — should be ${feedback.expectedFromEstimate}`}
            </p>

            <div className="text-sm text-slate-300">
              <p>
                {feedback.playedEstimate} decks played → {feedback.derivedRemaining} decks remaining
              </p>
              <p>
                True count = {signed(feedback.runningCount)} ÷ {feedback.derivedRemaining} = {signed(feedback.expectedFromEstimate)}
              </p>
              <p>You answered: {feedback.trueCountAnswer}</p>
            </div>

            <div className="mt-2 border-t border-slate-700 pt-2 text-xs text-slate-500">
              <p>
                Actual: {feedback.actualDecksPlayed.toFixed(1)} decks played ({feedback.actualDecksRemaining.toFixed(1)} remaining)
                · reference true count: {signed(feedback.referenceTrueCount)}
              </p>
              <p>
                Scenarios: {roundsPlayed} · Good estimates: {goodEstimates} · Correct math: {correctMath}
              </p>
            </div>

            <button type="button" onClick={newScenario} className={`mt-2 ${PRIMARY_BUTTON}`}>
              Next Scenario
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
