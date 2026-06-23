import { useEffect, useState } from 'react'
import type { Action, Card } from '../types'
import { ALL_SITUATION_KEYS, generateHand } from '../lib/handGenerator'
import { getAction } from '../lib/strategy'
import { type Stats, recordResult, selectNextSituation } from '../lib/adaptiveEngine'
import { categoryOfSituationKey, lifetimeAccuracy, updateStreak } from '../lib/mastery'
import { loadState, saveState } from '../lib/persistence'
import { reasonFor } from '../lib/reasons'
import { HandDisplay } from './HandDisplay'
import { ActionButtons } from './ActionButtons'
import { Feedback } from './Feedback'
import { ProgressPanel } from './ProgressPanel'
import { WeaknessHeatmap } from './WeaknessHeatmap'

interface Round {
  playerHand: Card[]
  dealerUpcard: Card
  situationKey: string
}

function buildRound(stats: Stats): Round {
  const situationKey = selectNextSituation(stats, ALL_SITUATION_KEYS)
  const { playerHand, dealerUpcard } = generateHand(situationKey)
  return { playerHand, dealerUpcard, situationKey }
}

interface Result {
  chosen: Action
  correct: Action
}

export function StrategyTrainer() {
  const [persisted] = useState(() => loadState())
  const [stats, setStats] = useState<Stats>(persisted.stats)
  const [handsPlayed, setHandsPlayed] = useState(persisted.handsPlayed)
  const [currentStreak, setCurrentStreak] = useState(persisted.currentStreak)
  const [round, setRound] = useState<Round>(() => buildRound(persisted.stats))
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    saveState({ stats, handsPlayed, currentStreak })
  }, [stats, handsPlayed, currentStreak])

  function handleSelect(action: Action) {
    if (result) return
    const correct = getAction(round.playerHand, round.dealerUpcard)
    const isCorrect = action === correct
    setResult({ chosen: action, correct })
    setStats((prev) => recordResult(prev, round.situationKey, isCorrect, handsPlayed))
    setHandsPlayed((prev) => prev + 1)
    setCurrentStreak((prev) => updateStreak(prev, isCorrect))
  }

  function handleNext() {
    setRound(buildRound(stats))
    setResult(null)
  }

  return (
    <div className="flex flex-col items-center gap-10 px-4 py-12">
      {handsPlayed === 0 && (
        <p className="max-w-md text-center text-slate-400">
          Pick the correct play for each hand — Hit, Stand, Double, Split, or Surrender. We'll track your weak
          spots and bring them back until you've got them down.
        </p>
      )}
      <ProgressPanel currentStreak={currentStreak} lifetime={lifetimeAccuracy(stats)} />
      <HandDisplay playerHand={round.playerHand} dealerUpcard={round.dealerUpcard} />
      <ActionButtons onSelect={handleSelect} disabled={result !== null} />
      {result && (
        <Feedback
          isCorrect={result.chosen === result.correct}
          chosenAction={result.chosen}
          correctAction={result.correct}
          reason={
            result.chosen === result.correct
              ? null
              : reasonFor(categoryOfSituationKey(round.situationKey), result.correct)
          }
          onNext={handleNext}
        />
      )}
      <WeaknessHeatmap stats={stats} />
    </div>
  )
}
