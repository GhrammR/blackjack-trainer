import { useEffect, useState } from 'react'
import { createShoe, shuffle } from '../lib/shoe'
import {
  type DifficultyLevel,
  type TrueCountScenario,
  DIFFICULTY_LEVELS,
  decksRemainingFromPlayedEstimate,
  generateTrueCountScenario,
  gradeEstimate,
  gradeTrueCountMath,
} from '../lib/trueCountDrill'
import { trueCount } from '../lib/counting'
import { signed } from '../lib/format'
import { DeckEstimateTray, DeckScaleReference } from './DeckEstimateTray'
import { PAGE_WRAPPER, PRIMARY_BUTTON, PRIMARY_BUTTON_LG, SECONDARY_BUTTON, SUCCESS_TEXT, ERROR_TEXT } from './theme'

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

interface TrueCountDrillProps {
  numDecks: number
  initialProgress: TrueCountProgress
  onProgressChange: (progress: TrueCountProgress) => void
}

export function TrueCountDrill({ numDecks, initialProgress, onProgressChange }: TrueCountDrillProps) {
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('beginner')
  const [showScaleReference, setShowScaleReference] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [scenario, setScenario] = useState<TrueCountScenario | null>(null)
  const [playedInput, setPlayedInput] = useState('')
  const [trueCountInput, setTrueCountInput] = useState('')
  const [feedback, setFeedback] = useState<RoundFeedback | null>(null)
  const [roundsPlayed, setRoundsPlayed] = useState(initialProgress.roundsPlayed)
  const [goodEstimates, setGoodEstimates] = useState(initialProgress.goodEstimates)
  const [correctMath, setCorrectMath] = useState(initialProgress.correctMath)

  useEffect(() => {
    onProgressChange({ roundsPlayed, goodEstimates, correctMath })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundsPlayed, goodEstimates, correctMath])

  // Resyncs local counters when progress changes externally (e.g. a reset
  // from the global settings panel while this drill is mounted).
  useEffect(() => {
    setRoundsPlayed(initialProgress.roundsPlayed)
    setGoodEstimates(initialProgress.goodEstimates)
    setCorrectMath(initialProgress.correctMath)
  }, [initialProgress])

  function newScenario() {
    const freshShoe = shuffle(createShoe(numDecks))
    setScenario(generateTrueCountScenario(freshShoe))
    setPlayedInput('')
    setTrueCountInput('')
    setFeedback(null)
    setPhase('guessing')
  }

  function resetToIdle() {
    setScenario(null)
    setFeedback(null)
    setPhase('idle')
  }

  function handleDifficultyChange(level: DifficultyLevel) {
    setDifficulty(level)
    resetToIdle()
  }

  function submit() {
    if (!scenario) return
    const playedEstimate = Number(playedInput)
    const trueCountAnswer = Number(trueCountInput)
    const derivedRemaining = decksRemainingFromPlayedEstimate(scenario.numDecks, playedEstimate)
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

  const canSubmit = playedInput.trim() !== '' && Number(playedInput) >= 0 && trueCountInput.trim() !== ''

  return (
    <div className={PAGE_WRAPPER}>
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-300">
        <span className="text-slate-400">
          {numDecks} deck{numDecks > 1 ? 's' : ''} (change in Settings)
        </span>
        <label className="flex items-center gap-2">
          Difficulty
          <select
            value={difficulty}
            disabled={phase !== 'idle'}
            onChange={(e) => handleDifficultyChange(e.target.value as DifficultyLevel)}
            className="rounded bg-slate-800 px-2 py-1 text-white disabled:opacity-50"
          >
            {DIFFICULTY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {DIFFICULTY_LABELS[level]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {phase === 'idle' && (
        <div className="flex flex-col items-center gap-4">
          <button type="button" onClick={() => setShowScaleReference((v) => !v)} className={SECONDARY_BUTTON}>
            {showScaleReference ? 'Hide scale reference' : 'Show scale reference'}
          </button>
          {showScaleReference && <DeckScaleReference totalDecks={numDecks} />}
          <button type="button" onClick={newScenario} className={PRIMARY_BUTTON_LG}>
            New scenario
          </button>
        </div>
      )}

      {scenario && phase !== 'idle' && (
        <div className="flex flex-col items-center gap-4">
          <DeckEstimateTray fillFraction={scenario.dealtFraction} totalDecks={scenario.numDecks} difficulty={difficulty} />
          <p className="text-lg text-slate-200">
            Running count: <span className="font-semibold text-white">{signed(scenario.runningCount)}</span>
          </p>
        </div>
      )}

      {phase === 'guessing' && (
        <div className="flex flex-col items-center gap-3">
          <p className="max-w-xs text-center text-xs text-slate-500">
            How this works: true count = running count ÷ decks remaining (rounded). Estimate decks played first, then
            subtract from the shoe size to get decks remaining.
          </p>
          <label className="flex items-center gap-2 text-slate-300">
            Decks played (estimate)
            <input
              type="number"
              step="0.5"
              min="0"
              value={playedInput}
              onChange={(e) => setPlayedInput(e.target.value)}
              autoFocus
              className="w-20 rounded bg-slate-800 px-2 py-1 text-center text-white"
            />
          </label>
          <label className="flex items-center gap-2 text-slate-300">
            True count
            <input
              type="number"
              value={trueCountInput}
              onChange={(e) => setTrueCountInput(e.target.value)}
              className="w-20 rounded bg-slate-800 px-2 py-1 text-center text-white"
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
            {feedback.estimateGood ? 'Good estimate' : `Estimate off by ${Math.abs(feedback.estimateDelta).toFixed(1)} decks`}
          </p>
          <p className={`text-lg font-semibold ${feedback.mathCorrect ? SUCCESS_TEXT : ERROR_TEXT}`}>
            {feedback.mathCorrect ? 'Correct math' : `Math off — should be ${feedback.expectedFromEstimate}`}
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
              Actual: {feedback.actualDecksPlayed.toFixed(1)} decks played ({feedback.actualDecksRemaining.toFixed(1)} remaining) ·
              reference true count: {feedback.referenceTrueCount}
            </p>
            <p>
              Scenarios: {roundsPlayed} · Good estimates: {goodEstimates} · Correct math: {correctMath}
            </p>
          </div>

          <button type="button" onClick={newScenario} className={`mt-2 ${PRIMARY_BUTTON}`}>
            Next scenario
          </button>
        </div>
      )}
    </div>
  )
}
