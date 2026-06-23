import type { Card } from '../types'

const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣']

function CardFace({ card, suitIndex }: { card: Card; suitIndex: number }) {
  const suit = SUIT_SYMBOLS[suitIndex % SUIT_SYMBOLS.length]
  const isRed = suit === '♥' || suit === '♦'

  return (
    <div
      className={`flex h-20 w-14 flex-col items-center justify-center rounded-lg border border-slate-300 bg-white text-xl font-semibold shadow ${
        isRed ? 'text-red-600' : 'text-slate-900'
      }`}
    >
      <span>{card.rank}</span>
      <span>{suit}</span>
    </div>
  )
}

function HiddenCard() {
  return (
    <div className="flex h-20 w-14 items-center justify-center rounded-lg border border-dashed border-slate-500 text-2xl text-slate-500">
      ?
    </div>
  )
}

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
          <CardFace card={dealerUpcard} suitIndex={0} />
          <HiddenCard />
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm uppercase tracking-wide text-slate-400">You</p>
        <div className="flex gap-2">
          {playerHand.map((card, i) => (
            <CardFace key={i} card={card} suitIndex={i + 1} />
          ))}
        </div>
      </div>
    </div>
  )
}
