import { useEffect, useState } from 'react'
import type { Action, Card } from '../../../types'
import { ALL_SITUATION_KEYS, generateHand } from '../../../lib/handGenerator'
import { getAction } from '../../../lib/strategy'
import { handValue, isBust } from '../../../lib/cards'
import { createShoe, shuffle } from '../../../lib/shoe'
import { type Stats, recordResult, selectNextSituation } from '../../../lib/adaptiveEngine'
import { categoryOfSituationKey, lifetimeAccuracy, updateStreak } from '../../../lib/mastery'
import { loadState, saveState } from '../../../lib/persistence'
import { reasonFor } from '../../../lib/reasons'
import { HiddenCard, PlayingCard } from '../../PlayingCard'
import { ActionButtons } from '../../ActionButtons'
import { Feedback } from '../../Feedback'
import { ProgressPanel } from '../../ProgressPanel'
import { PRIMARY_BUTTON, SECONDARY_BUTTON, SECTION_LABEL } from '../../theme'
import { CasinoTable } from '../table/CasinoTable'

interface Round {
  playerHand: Card[]
  dealerUpcard: Card
  situationKey: string
  /** Extra cards available for interactive hitting — a single shuffled deck is always more than enough for one hand; this mode has no persistent shoe otherwise, so this is drawn fresh per round rather than reusing a "current shoe" concept that doesn't exist here. */
  drawPile: Card[]
}

interface Result {
  chosen: Action
  correct: Action
}

function buildRound(stats: Stats): Round {
  const situationKey = selectNextSituation(stats, ALL_SITUATION_KEYS)
  const { playerHand, dealerUpcard } = generateHand(situationKey)
  return { playerHand, dealerUpcard, situationKey, drawPile: shuffle(createShoe(1)) }
}

/**
 * Strategy Trainer wired into the 2.0 CasinoTable shell.
 * Logic is identical to StrategyTrainer.tsx — only the presentation changes.
 * Outer wrapper does NOT use PAGE_WRAPPER so CasinoTable can reach max-w-4xl
 * without being constrained by the page's max-w-3xl content column.
 *
 * The graded decision is always the INITIAL two-card hand — matching the
 * app-wide convention (Evasion, the detection-family engine) that a
 * strategy/deviation check only applies at that first decision point. If
 * that decision is Hit, the hand plays out interactively afterward (one
 * card per Hit click, Stand ends it) rather than being auto-resolved or
 * ending the round on a single click; those later decisions aren't
 * separately graded, same as Evasion's fix.
 */
export function BasicStrategyMode() {
  const [persisted] = useState(() => loadState())
  const [stats, setStats] = useState<Stats>(persisted.stats)
  const [handsPlayed, setHandsPlayed] = useState(persisted.handsPlayed)
  const [currentStreak, setCurrentStreak] = useState(persisted.currentStreak)
  const [round, setRound] = useState<Round>(() => buildRound(persisted.stats))
  const [handCards, setHandCards] = useState<Card[]>(round.playerHand)
  const [drawIndex, setDrawIndex] = useState(0)
  const [isHitting, setIsHitting] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    saveState({ stats, handsPlayed, currentStreak })
  }, [stats, handsPlayed, currentStreak])

  function handleSelect(action: Action) {
    if (result || isHitting) return
    const correct = getAction(round.playerHand, round.dealerUpcard)
    const isCorrect = action === correct
    setResult({ chosen: action, correct })
    setStats((prev) => recordResult(prev, round.situationKey, isCorrect, handsPlayed))
    setHandsPlayed((prev) => prev + 1)
    setCurrentStreak((prev) => updateStreak(prev, isCorrect))

    if (action === 'Hit') {
      // Choosing Hit deals a real card immediately — not a no-op step before the first actual hit.
      const card = round.drawPile[drawIndex]
      const newHand = [...handCards, card]
      setHandCards(newHand)
      setDrawIndex((n) => n + 1)
      if (!isBust(newHand)) {
        setResult(null) // keep playing — hide feedback until the hand is actually done
        setIsHitting(true)
      }
    }
  }

  function hitAgain() {
    const card = round.drawPile[drawIndex]
    const newHand = [...handCards, card]
    setHandCards(newHand)
    setDrawIndex((n) => n + 1)
    if (isBust(newHand)) {
      finishHitting()
    }
  }

  function finishHitting() {
    setIsHitting(false)
    setResult({ chosen: 'Hit', correct: getAction(round.playerHand, round.dealerUpcard) })
  }

  function handleNext() {
    const newRound = buildRound(stats)
    setRound(newRound)
    setHandCards(newRound.playerHand)
    setDrawIndex(0)
    setIsHitting(false)
    setResult(null)
  }

  const dealerSlot = (
    <>
      <p className={SECTION_LABEL}>Dealer</p>
      <div className="flex gap-2">
        <PlayingCard card={round.dealerUpcard} suitIndex={0} size="sm" />
        <HiddenCard size="sm" />
      </div>
    </>
  )

  const playerSeat = (
    <div className="flex gap-2">
      {handCards.map((card, i) => (
        <PlayingCard key={i} card={card} suitIndex={i + 1} size="sm" />
      ))}
    </div>
  )

  return (
    <div className="flex h-full w-full flex-col items-center gap-2 px-2 py-2">
      <div className="flex w-full flex-1 min-h-0 items-center justify-center"
        style={{ containerType: 'size' }}>
        <CasinoTable
          dealerSlot={dealerSlot}
          seatContents={[playerSeat]}
          seatLabels={['You']}
          userSeatIndex={0}
        />
      </div>

      {/* HUD */}
      <div className="flex w-full max-w-md flex-col gap-3">
        <ProgressPanel currentStreak={currentStreak} lifetime={lifetimeAccuracy(stats)} />

        {isHitting ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-slate-400">
              {(() => {
                const { total, soft } = handValue(handCards)
                return `${soft ? 'Soft' : 'Hard'} ${total}`
              })()}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button type="button" onClick={hitAgain} className={PRIMARY_BUTTON}>
                Hit
              </button>
              <button type="button" onClick={finishHitting} className={SECONDARY_BUTTON}>
                Stand
              </button>
            </div>
          </div>
        ) : (
          <ActionButtons onSelect={handleSelect} disabled={result !== null} />
        )}

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
    </div>
  )
}
