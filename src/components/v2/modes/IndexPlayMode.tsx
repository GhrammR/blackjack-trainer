import { useEffect, useState } from 'react'
import type { Action } from '../../../types'
import { type IndexPlayScenario, generateScenario } from '../../../lib/indexPlayDrill'
import { INDEX_PLAYS } from '../../../lib/indexPlays'
import { signed } from '../../../lib/format'
import { HiddenCard, PlayingCard } from '../../PlayingCard'
import { ActionButtons } from '../../ActionButtons'
import { Feedback } from '../../Feedback'
import { HUD_HEIGHT } from '../../theme'
import { CasinoTable } from '../table/CasinoTable'

const INDEX_PLAY_SITUATION_KEYS = new Set(INDEX_PLAYS.map((p) => p.situationKey))

interface IndexPlayProgress {
  attempts: number
  correct: number
  perDeviation: Record<string, { attempts: number; correct: number }>
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
  const [perDeviation, setPerDeviation] = useState(initialProgress.perDeviation)

  // Pull-down only — picks up EXTERNAL changes to progress (e.g. a "Reset
  // Counting" action from the Settings modal while this mode stays
  // mounted underneath it). There is deliberately no matching "push on
  // every local state change" effect: an earlier version reactively
  // pushed `{ attempts, correct, perDeviation }` up via a `useEffect`
  // keyed on those three values, which — because `perDeviation` is a
  // plain object rebuilt via spread — got a NEW reference on every
  // round-trip even when its contents were unchanged. That defeated
  // React's reference-equality bail-out and this pull-down effect's own
  // `setPerDeviation(initialProgress.perDeviation)` call, so pushing up
  // and pulling back down kept re-triggering each other — a real,
  // observed-live infinite loop (attempts/accuracy oscillating between
  // two stale values forever, matching the reported "flashes, then
  // disappears" symptom). Every OTHER v2 mode uses this same push/pull
  // effect pair safely because their progress fields are plain numbers,
  // where Object.is correctly bails out on an unchanged value regardless
  // of round-trips — Index Plays is the one mode whose progress includes
  // a nested object (`perDeviation`), which is what exposed the bug.
  // Pushing directly at the point of mutation (`choose()` below) instead
  // of reactively means a pull-down here can never trigger a push back up.
  useEffect(() => {
    setAttempts(initialProgress.attempts)
    setCorrect(initialProgress.correct)
    setPerDeviation(initialProgress.perDeviation)
  }, [initialProgress])

  function choose(action: Action) {
    const isCorrect = action === scenario.correctAction
    const nextAttempts = attempts + 1
    const nextCorrect = correct + (isCorrect ? 1 : 0)
    let nextPerDeviation = perDeviation
    if (INDEX_PLAY_SITUATION_KEYS.has(scenario.situationKey)) {
      const existing = perDeviation[scenario.situationKey] ?? { attempts: 0, correct: 0 }
      nextPerDeviation = {
        ...perDeviation,
        [scenario.situationKey]: {
          attempts: existing.attempts + 1,
          correct: existing.correct + (isCorrect ? 1 : 0),
        },
      }
    }

    setChosenAction(action)
    setAttempts(nextAttempts)
    setCorrect(nextCorrect)
    setPerDeviation(nextPerDeviation)
    onProgressChange({ attempts: nextAttempts, correct: nextCorrect, perDeviation: nextPerDeviation })
  }

  function nextScenario() {
    setScenario(generateScenario())
    setChosenAction(null)
  }

  const isCorrect = chosenAction !== null && chosenAction === scenario.correctAction

  // ── Table content ──────────────────────────────────────────────────────────

  // "Dealer" label removed — the chip tray uses that space (see CasinoTable.tsx / DealerChipTray.tsx).
  const dealerSlot = (
    <>
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
    <div className="flex h-full w-full flex-col items-center gap-1 px-2 py-1">
      <div className="flex w-full flex-1 min-h-0 items-center justify-center"
        style={{ containerType: 'size' }}>
        <CasinoTable
          dealerSlot={dealerSlot}
          seatContents={[seatContent]}
          seatLabels={['YOU']}
          userSeatIndex={0}
        />
      </div>

      {/* HUD */}
      <div
        className="flex w-full max-w-md flex-col items-center gap-4 overflow-y-auto"
        style={{ height: HUD_HEIGHT.indexPlays, flexShrink: 0 }}
      >
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
