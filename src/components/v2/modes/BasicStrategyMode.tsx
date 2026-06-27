import { useEffect, useState } from 'react'
import type { Action, Card } from '../../../types'
import { ALL_SITUATION_KEYS, generateHand } from '../../../lib/handGenerator'
import { getAction } from '../../../lib/strategy'
import { type Stats, recordResult, selectNextSituation } from '../../../lib/adaptiveEngine'
import { categoryOfSituationKey, lifetimeAccuracy, updateStreak } from '../../../lib/mastery'
import { loadState, saveState } from '../../../lib/persistence'
import { reasonFor } from '../../../lib/reasons'
import { HiddenCard, PlayingCard } from '../../PlayingCard'
import { ActionButtons } from '../../ActionButtons'
import { Feedback } from '../../Feedback'
import { ProgressPanel } from '../../ProgressPanel'
import { WeaknessHeatmap } from '../../WeaknessHeatmap'
import { SECTION_LABEL } from '../../theme'
import { CasinoTable } from '../table/CasinoTable'

interface Round {
  playerHand: Card[]
  dealerUpcard: Card
  situationKey: string
}

interface Result {
  chosen: Action
  correct: Action
}

function buildRound(stats: Stats): Round {
  const situationKey = selectNextSituation(stats, ALL_SITUATION_KEYS)
  const { playerHand, dealerUpcard } = generateHand(situationKey)
  return { playerHand, dealerUpcard, situationKey }
}

/**
 * Strategy Trainer wired into the 2.0 CasinoTable shell.
 * Logic is identical to StrategyTrainer.tsx — only the presentation changes.
 * Outer wrapper does NOT use PAGE_WRAPPER so CasinoTable can reach max-w-4xl
 * without being constrained by the page's max-w-3xl content column.
 */
export function BasicStrategyMode() {
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

  const dealerSlot = (
    <>
      <p className={SECTION_LABEL}>Dealer</p>
      <div className="flex gap-2">
        <PlayingCard card={round.dealerUpcard} suitIndex={0} />
        <HiddenCard />
      </div>
    </>
  )

  const playerSeat = (
    <div className="flex gap-2">
      {round.playerHand.map((card, i) => (
        <PlayingCard key={i} card={card} suitIndex={i + 1} />
      ))}
    </div>
  )

  return (
    <div className="flex w-full flex-col items-center gap-3 px-2 py-4">
      <CasinoTable
        dealerSlot={dealerSlot}
        seatContents={[playerSeat]}
        seatLabels={['You']}
        userSeatIndex={0}
      />

      {/* HUD */}
      <div className="flex w-full max-w-md flex-col gap-4">
        <ProgressPanel currentStreak={currentStreak} lifetime={lifetimeAccuracy(stats)} />
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
      </div>

      <div className="w-full max-w-3xl">
        <WeaknessHeatmap stats={stats} />
      </div>
    </div>
  )
}
