import { useState } from 'react'
import { SHOE_SIZE_OPTIONS, createShoe, shuffle } from '../lib/shoe'
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

export function TrueCountDrill() {
  const [numDecks, setNumDecks] = useState(6)
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('beginner')
  const [showScaleReference, setShowScaleReference] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [scenario, setScenario] = useState<TrueCountScenario | null>(null)
  const [playedInput, setPlayedInput] = useState('')
  const [trueCountInput, setTrueCountInput] = useState('')
  const [feedback, setFeedback] = useState<RoundFeedback | null>(null)
  const [roundsPlayed, setRoundsPlayed] = useState(0)
  const [goodEstimates, setGoodEstimates] = useState(0)
  const [correctMath, setCorrectMath] = useState(0)

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

  function handleShoeSizeChange(decks: number) {
    setNumDecks(decks)
    resetToIdle()
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
    <div className="flex flex-col items-center gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-300">
        <label className="flex items-center gap-2">
          Shoe size
          <select
            value={numDecks}
            disabled={phase !== 'idle'}
            onChange={(e) => handleShoeSizeChange(Number(e.target.value))}
            className="rounded bg-slate-800 px-2 py-1 text-white disabled:opacity-50"
          >
            {SHOE_SIZE_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} deck{d > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </label>
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
          <button
            type="button"
            onClick={() => setShowScaleReference((v) => !v)}
            className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-600"
          >
            {showScaleReference ? 'Hide scale reference' : 'Show scale reference'}
          </button>
          {showScaleReference && <DeckScaleReference totalDecks={numDecks} />}
          <button
            type="button"
            onClick={newScenario}
            className="rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-500"
          >
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
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Submit
          </button>
        </div>
      )}

      {phase === 'feedback' && feedback && (
        <div className="flex max-w-md flex-col items-center gap-2 text-center">
          <p className={`text-lg font-semibold ${feedback.estimateGood ? 'text-emerald-400' : 'text-red-400'}`}>
            {feedback.estimateGood ? 'Good estimate' : `Estimate off by ${Math.abs(feedback.estimateDelta).toFixed(1)} decks`}
          </p>
          <p className={`text-lg font-semibold ${feedback.mathCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
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

          <button
            type="button"
            onClick={newScenario}
            className="mt-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500"
          >
            Next scenario
          </button>
        </div>
      )}
    </div>
  )
}
