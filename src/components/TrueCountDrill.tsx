import { useState } from 'react'
import { SHOE_SIZE_OPTIONS, createShoe, shuffle } from '../lib/shoe'
import { type TrueCountScenario, gradeEstimate, gradeTrueCountMath, generateTrueCountScenario } from '../lib/trueCountDrill'
import { trueCount } from '../lib/counting'
import { signed } from '../lib/format'
import { DeckEstimateTray } from './DeckEstimateTray'

type Phase = 'idle' | 'guessing' | 'feedback'

interface RoundFeedback {
  estimate: number
  trueCountAnswer: number
  estimateGood: boolean
  estimateDelta: number
  mathCorrect: boolean
  expectedFromEstimate: number
  actualDecksRemaining: number
  referenceTrueCount: number
}

export function TrueCountDrill() {
  const [numDecks, setNumDecks] = useState(6)
  const [phase, setPhase] = useState<Phase>('idle')
  const [scenario, setScenario] = useState<TrueCountScenario | null>(null)
  const [estimateInput, setEstimateInput] = useState('')
  const [trueCountInput, setTrueCountInput] = useState('')
  const [feedback, setFeedback] = useState<RoundFeedback | null>(null)
  const [roundsPlayed, setRoundsPlayed] = useState(0)
  const [goodEstimates, setGoodEstimates] = useState(0)
  const [correctMath, setCorrectMath] = useState(0)

  function newScenario() {
    const freshShoe = shuffle(createShoe(numDecks))
    setScenario(generateTrueCountScenario(freshShoe))
    setEstimateInput('')
    setTrueCountInput('')
    setFeedback(null)
    setPhase('guessing')
  }

  function handleShoeSizeChange(decks: number) {
    setNumDecks(decks)
    setScenario(null)
    setFeedback(null)
    setPhase('idle')
  }

  function submit() {
    if (!scenario) return
    const estimate = Number(estimateInput)
    const trueCountAnswer = Number(trueCountInput)
    const estimateGrade = gradeEstimate(estimate, scenario.actualDecksRemaining)
    const mathGrade = gradeTrueCountMath(scenario.runningCount, estimate, trueCountAnswer)
    const referenceTrueCount = trueCount(scenario.runningCount, scenario.actualDecksRemaining)

    setFeedback({
      estimate,
      trueCountAnswer,
      estimateGood: estimateGrade.isGood,
      estimateDelta: estimateGrade.delta,
      mathCorrect: mathGrade.isCorrect,
      expectedFromEstimate: mathGrade.expected,
      actualDecksRemaining: scenario.actualDecksRemaining,
      referenceTrueCount,
    })
    setRoundsPlayed((n) => n + 1)
    if (estimateGrade.isGood) setGoodEstimates((n) => n + 1)
    if (mathGrade.isCorrect) setCorrectMath((n) => n + 1)
    setPhase('feedback')
  }

  const canSubmit = estimateInput.trim() !== '' && Number(estimateInput) > 0 && trueCountInput.trim() !== ''

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
      </div>

      {phase === 'idle' && (
        <button
          type="button"
          onClick={newScenario}
          className="rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-500"
        >
          New scenario
        </button>
      )}

      {scenario && phase !== 'idle' && (
        <div className="flex flex-col items-center gap-4">
          <DeckEstimateTray fillFraction={scenario.dealtFraction} totalDecks={scenario.numDecks} />
          <p className="text-lg text-slate-200">
            Running count: <span className="font-semibold text-white">{signed(scenario.runningCount)}</span>
          </p>
        </div>
      )}

      {phase === 'guessing' && (
        <div className="flex flex-col items-center gap-3">
          <label className="flex items-center gap-2 text-slate-300">
            Decks remaining (estimate)
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={estimateInput}
              onChange={(e) => setEstimateInput(e.target.value)}
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
          <div className="text-sm text-slate-400">
            <p>
              Your estimate: {feedback.estimate} decks · Actual: {feedback.actualDecksRemaining.toFixed(1)} decks
            </p>
            <p>
              Your true count: {feedback.trueCountAnswer} · Expected from your estimate: {feedback.expectedFromEstimate}
            </p>
            <p>Reference: using the actual deck count, true count would be {feedback.referenceTrueCount}.</p>
          </div>
          <p className="text-xs text-slate-500">
            Scenarios: {roundsPlayed} · Good estimates: {goodEstimates} · Correct math: {correctMath}
          </p>
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
