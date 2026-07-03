import type { Card } from '../types'

const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣']

function suitSymbolForIndex(index: number): string {
  return SUIT_SYMBOLS[index % SUIT_SYMBOLS.length]
}

// Card size scales with CasinoTable's own rendered width via container-query units
// (cqw), not the viewport — the table sets containerType:'inline-size' so 1cqw = 1%
// of the felt's actual width. The clamp() MAX is pinned to the pre-mobile-fix pixel
// values (h-20 w-14 text-xl / h-14 w-10 text-sm) at the table's 800px max width, so
// desktop is pixel-identical; below that the card shrinks in proportion to the felt.
const SIZE_DIMENSIONS = {
  md: { width: 'clamp(27px, 7cqw, 56px)', height: 'clamp(38px, 10cqw, 80px)', fontSize: 'clamp(11px, 2.5cqw, 20px)' },
  sm: { width: 'clamp(19px, 5cqw, 40px)', height: 'clamp(26px, 7cqw, 56px)', fontSize: 'clamp(8px, 1.75cqw, 14px)' },
}

interface PlayingCardProps {
  card: Card
  /** Picks a cosmetic suit symbol; cards don't otherwise track a real suit. */
  suitIndex: number
  size?: keyof typeof SIZE_DIMENSIONS
}

export function PlayingCard({ card, suitIndex, size = 'md' }: PlayingCardProps) {
  const suit = suitSymbolForIndex(suitIndex)
  const isRed = suit === '♥' || suit === '♦'

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-slate-300 bg-white font-semibold shadow-md ${
        isRed ? 'text-red-600' : 'text-slate-900'
      }`}
      style={SIZE_DIMENSIONS[size]}
    >
      <span>{card.rank}</span>
      <span>{suit}</span>
    </div>
  )
}

export function HiddenCard({ size = 'md' }: { size?: keyof typeof SIZE_DIMENSIONS }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl border border-dashed border-slate-500 text-slate-500"
      style={SIZE_DIMENSIONS[size]}
    >
      ?
    </div>
  )
}
