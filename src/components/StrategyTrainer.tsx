import { useState } from 'react'
import type { Action, Card } from '../types'
import { ALL_SITUATION_KEYS, generateHand } from '../lib/handGenerator'
import { getAction } from '../lib/strategy'
import { HandDisplay } from './HandDisplay'
import { ActionButtons } from './ActionButtons'
import { Feedback } from './Feedback'

interface Round {
  playerHand: Card[]
  dealerUpcard: Card
}

function randomRound(): Round {
  const key = ALL_SITUATION_KEYS[Math.floor(Math.random() * ALL_SITUATION_KEYS.length)]
  return generateHand(key)
}

interface Result {
  chosen: Action
  correct: Action
}

export function StrategyTrainer() {
  const [round, setRound] = useState<Round>(randomRound)
  const [result, setResult] = useState<Result | null>(null)

  function handleSelect(action: Action) {
    if (result) return
    setResult({ chosen: action, correct: getAction(round.playerHand, round.dealerUpcard) })
  }

  function handleNext() {
    setRound(randomRound())
    setResult(null)
  }

  return (
    <div className="flex flex-col items-center gap-10 py-12">
      <HandDisplay playerHand={round.playerHand} dealerUpcard={round.dealerUpcard} />
      <ActionButtons onSelect={handleSelect} disabled={result !== null} />
      {result && (
        <Feedback
          isCorrect={result.chosen === result.correct}
          chosenAction={result.chosen}
          correctAction={result.correct}
          onNext={handleNext}
        />
      )}
    </div>
  )
}
