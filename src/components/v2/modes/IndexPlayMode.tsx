import { useEffect, useState } from 'react'
import type { Action } from '../../../types'
import { type IndexPlayScenario, generateScenario } from '../../../lib/indexPlayDrill'
import { signed } from '../../../lib/format'
import { HiddenCard, PlayingCard } from '../../PlayingCard'
import { ActionButtons } from '../../ActionButtons'
import { Feedback } from '../../Feedback'
import { SECTION_LABEL } from '../../theme'
import { CasinoTable } from '../table/CasinoTable'

interface IndexPlayProgress {
  attempts: number
  correct: number
}

interface IndexPlayModeProps {
  initialProgress: IndexPlayProgress
  onProgressChange: (p: IndexPlayProgress) => void
}

function reasonFor(scenario: IndexPlayScenario): string {
  if (scenario.indicatedPlay) {
    const { threshold, direction } = scenario.indicatedPlay
    const condition = direction === 'aboveOrEqual' ? `TC ≥ ${threshold}` : `TC < ${threshold}`
    return `At ${condition}, the count indicates a deviation from basic strategy (normally ${scenario.basicAction}) to ${scenario.correctAction}.`
  }
  return `The count doesn't indicate a deviation here — plain basic strategy applies: ${scenario.basicAction}.`
}

export function IndexPlayMode({ initialProgress, onProgressChange }: IndexPlayModeProps) {
  const [scenario, setScenario] = useState<IndexPlayScenario>(() => generateScenario())
  const [chosenAction, setChosenAction] = useState<Action | null>(null)
  const [attempts, setAttempts] = useState(initialProgress.attempts)
  const [correct, setCorrect] = useState(initialProgress.correct)

  useEffect(() => {
    onProgressChange({ attempts, correct })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempts, correct])

  useEffect(() => {
    setAttempts(initialProgress.attempts)
    setCorrect(initialProgress.correct)
  }, [initialProgress])

  function choose(action: Action) {
    setChosenAction(action)
    setAttempts((n) => n + 1)
    if (action === scenario.correctAction) setCorrect((n) => n + 1)
  }

  function nextScenario() {
    setScenario(generateScenario())
    setChosenAction(null)
  }

  const isCorrect = chosenAction !== null && chosenAction === scenario.correctAction

  // ── Table content ──────────────────────────────────────────────────────────

  const dealerSlot = (
    <>
      <p className={SECTION_LABEL}>Dealer</p>
      <div className="flex gap-1">
        <PlayingCard card={scenario.dealerUpcard} suitIndex={0} size="sm" />
        <HiddenCard size="sm" />
      </div>
    </>
  )

  const seatContent = (
    <div className="flex gap-1">
      {scenario.playerHand.map((card, i) => (
        <PlayingCard key={i} card={card} suitIndex={i + 1} size="sm" />
      ))}
    </div>
  )

  return (
    <div className="flex w-full flex-col items-center gap-3 px-2 py-2">
      <CasinoTable
        dealerSlot={dealerSlot}
        seatContents={[seatContent]}
        seatLabels={['YOU']}
        userSeatIndex={0}
      />

      {/* HUD */}
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <p className="text-xs text-slate-500">
          Attempts: {attempts} · Accuracy:{' '}
          {attempts === 0 ? '—' : `${Math.round((correct / attempts) * 100)}%`}
        </p>

        <p className="text-lg text-slate-200">
          True count: <span className="font-semibold text-white">{signed(scenario.trueCount)}</span>
        </p>

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
    </div>
  )
}
