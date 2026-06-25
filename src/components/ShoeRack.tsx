/**
 * Step 11's shoe-rack visual — pairs with the True Count drill's existing
 * discard tray (DeckEstimateTray.tsx) per the original spec's step 11
 * callout. Deliberately simpler than DeckEstimateTray: no tick marks or
 * difficulty tiers, since this isn't an estimation drill — decksRemaining is
 * already a known, displayed number wherever this is used (e.g. Live Play's
 * count-check phase), so the rack is purely a visual restatement of a value
 * the caller already computed, not a new guess to make.
 */

const RACK_HEIGHT_PX = 128
const RACK_WIDTH_PX = 48

interface ShoeRackProps {
  decksRemaining: number
  totalDecks: number
}

export function ShoeRack({ decksRemaining, totalDecks }: ShoeRackProps) {
  const fillFraction = Math.max(0, Math.min(1, decksRemaining / totalDecks))

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative overflow-hidden rounded-t-md border border-slate-600 bg-slate-900"
        style={{ width: RACK_WIDTH_PX, height: RACK_HEIGHT_PX }}
      >
        <div
          className="absolute inset-x-0 bottom-0 border-t border-amber-200/60"
          style={{
            height: `${fillFraction * 100}%`,
            backgroundImage: 'repeating-linear-gradient(to top, #f5f1e6 0px, #f5f1e6 3px, #cbbf9a 3px, #cbbf9a 4px)',
          }}
        />
      </div>
      <p className="text-sm text-slate-400">
        Shoe: <span className="font-semibold text-white">{decksRemaining.toFixed(1)}</span> / {totalDecks} decks
        remaining
      </p>
    </div>
  )
}
