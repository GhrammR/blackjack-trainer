import type { Card } from '../types'
import { HiddenCard, PlayingCard } from './PlayingCard'
import { TableFelt } from './TableFelt'
import { SECTION_LABEL } from './theme'

interface HandDisplayProps {
  playerHand: Card[]
  dealerUpcard: Card
}

export function HandDisplay({ playerHand, dealerUpcard }: HandDisplayProps) {
  return (
    <TableFelt
      dealer={
        <>
          <p className={SECTION_LABEL}>Dealer</p>
          <div className="flex gap-2">
            <PlayingCard card={dealerUpcard} suitIndex={0} />
            <HiddenCard />
          </div>
        </>
      }
      seats={
        <div className="flex flex-col items-center gap-2">
          <p className={SECTION_LABEL}>You</p>
          <div className="flex gap-2">
            {playerHand.map((card, i) => (
              <PlayingCard key={i} card={card} suitIndex={i + 1} />
            ))}
          </div>
        </div>
      }
    />
  )
}
