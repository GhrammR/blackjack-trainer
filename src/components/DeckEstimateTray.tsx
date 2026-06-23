const TRAY_HEIGHT_PX = 240
const TRAY_WIDTH_PX = 84

interface DeckEstimateTrayProps {
  /** 0-1, fraction of the shoe already discarded. Never shown as a number — read it visually. */
  fillFraction: number
  totalDecks: number
}

export function DeckEstimateTray({ fillFraction, totalDecks }: DeckEstimateTrayProps) {
  const clamped = Math.max(0, Math.min(1, fillFraction))

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm text-slate-400">
        Shoe: {totalDecks} deck{totalDecks > 1 ? 's' : ''} total
      </p>
      <div
        className="relative overflow-hidden rounded-b-md border border-slate-600 bg-slate-900"
        style={{ width: TRAY_WIDTH_PX, height: TRAY_HEIGHT_PX }}
      >
        <div
          className="absolute inset-x-0 bottom-0 border-t border-amber-200/60"
          style={{
            height: `${clamped * 100}%`,
            backgroundImage:
              'repeating-linear-gradient(to top, #f5f1e6 0px, #f5f1e6 3px, #cbbf9a 3px, #cbbf9a 4px)',
          }}
        />
      </div>
      <p className="max-w-[10rem] text-center text-xs text-slate-500">Discard tray — estimate how many decks have been played</p>
    </div>
  )
}
