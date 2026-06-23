import type { Card } from '../types'
import { HiddenCard, PlayingCard } from './PlayingCard'

interface HandDisplayProps {
  playerHand: Card[]
  dealerUpcard: Card
}

export function HandDisplay({ playerHand, dealerUpcard }: HandDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm uppercase tracking-wide text-slate-400">Dealer</p>
        <div className="flex gap-2">
          <PlayingCard card={dealerUpcard} suitIndex={0} />
          <HiddenCard />
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm uppercase tracking-wide text-slate-400">You</p>
        <div className="flex gap-2">
          {playerHand.map((card, i) => (
            <PlayingCard key={i} card={card} suitIndex={i + 1} />
          ))}
        </div>
      </div>
    </div>
  )
}
