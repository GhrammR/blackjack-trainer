import { useEffect, useState } from 'react'
import type { Action } from '../types'
import { type IndexPlayScenario, generateScenario } from '../lib/indexPlayDrill'
import { HandDisplay } from './HandDisplay'
import { ActionButtons } from './ActionButtons'
import { Feedback } from './Feedback'

interface IndexPlayProgress {
  attempts: number
  correct: number
}

interface IndexPlayDrillProps {
  initialProgress: IndexPlayProgress
  onProgressChange: (progress: IndexPlayProgress) => void
}

function reasonFor(scenario: IndexPlayScenario): string {
  if (scenario.indicatedPlay) {
    const { threshold, direction } = scenario.indicatedPlay
    const condition = direction === 'aboveOrEqual' ? `TC ≥ ${threshold}` : `TC < ${threshold}`
    return `At ${condition}, the count indicates a deviation from basic strategy (normally ${scenario.basicAction}) to ${scenario.correctAction}.`
  }
  return `The count doesn't indicate a deviation here — plain basic strategy applies: ${scenario.basicAction}.`
}

export function IndexPlayDrill({ initialProgress, onProgressChange }: IndexPlayDrillProps) {
  const [scenario, setScenario] = useState<IndexPlayScenario>(() => generateScenario())
  const [chosenAction, setChosenAction] = useState<Action | null>(null)
  const [progress, setProgress] = useState(initialProgress)

  useEffect(() => {
    onProgressChange(progress)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress])

  useEffect(() => {
    setProgress(initialProgress)
  }, [initialProgress])

  function choose(action: Action) {
    setChosenAction(action)
    setProgress((prev) => ({
      attempts: prev.attempts + 1,
      correct: prev.correct + (action === scenario.correctAction ? 1 : 0),
    }))
  }

  function nextScenario() {
    setScenario(generateScenario())
    setChosenAction(null)
  }

  const isCorrect = chosenAction !== null && chosenAction === scenario.correctAction

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-10">
      <p className="max-w-md text-center text-sm text-slate-400">
        Basic strategy plus the count: the true count is shown directly — your job is to know when it indicates a
        real deviation from basic strategy, and when it doesn't.
      </p>
      <p className="text-xs text-slate-500">
        Attempts: {progress.attempts} · Accuracy:{' '}
        {progress.attempts === 0 ? '—' : `${Math.round((progress.correct / progress.attempts) * 100)}%`}
      </p>

      <p className="text-lg text-slate-200">
        True count: <span className="font-semibold">{scenario.trueCount >= 0 ? '+' : ''}{scenario.trueCount}</span>
      </p>

      <HandDisplay playerHand={scenario.playerHand} dealerUpcard={scenario.dealerUpcard} />

      {chosenAction === null ? (
        <ActionButtons onSelect={choose} />
      ) : (
        <Feedback
          isCorrect={isCorrect}
          chosenAction={chosenAction}
          correctAction={scenario.correctAction}
          reason={reasonFor(scenario)}
          onNext={nextScenario}
        />
      )}
    </div>
  )
}
