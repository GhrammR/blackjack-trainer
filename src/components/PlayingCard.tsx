import type { Card } from '../types'

const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣']

function suitSymbolForIndex(index: number): string {
  return SUIT_SYMBOLS[index % SUIT_SYMBOLS.length]
}

const SIZE_CLASSES = {
  md: 'h-20 w-14 text-xl',
  sm: 'h-14 w-10 text-sm',
}

interface PlayingCardProps {
  card: Card
  /** Picks a cosmetic suit symbol; cards don't otherwise track a real suit. */
  suitIndex: number
  size?: keyof typeof SIZE_CLASSES
}

export function PlayingCard({ card, suitIndex, size = 'md' }: PlayingCardProps) {
  const suit = suitSymbolForIndex(suitIndex)
  const isRed = suit === '♥' || suit === '♦'

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-slate-300 bg-white font-semibold shadow-md ${SIZE_CLASSES[size]} ${
        isRed ? 'text-red-600' : 'text-slate-900'
      }`}
    >
      <span>{card.rank}</span>
      <span>{suit}</span>
    </div>
  )
}

export function HiddenCard({ size = 'md' }: { size?: keyof typeof SIZE_CLASSES }) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl border border-dashed border-slate-500 text-slate-500 ${SIZE_CLASSES[size]}`}
    >
      ?
    </div>
  )
}
