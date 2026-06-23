import type { DifficultyLevel } from '../lib/trueCountDrill'
import { tickMarks } from '../lib/trueCountDrill'

const TRAY_HEIGHT_PX = 240
const TRAY_WIDTH_PX = 84
const RULER_WIDTH_PX = 24

interface TrayWithTicksProps {
  fillFraction: number
  totalDecks: number
  difficulty: DifficultyLevel
}

/** Shared tray + calibration-tick rendering, used by both the real drill tray and the scale reference. */
function TrayWithTicks({ fillFraction, totalDecks, difficulty }: TrayWithTicksProps) {
  const clamped = Math.max(0, Math.min(1, fillFraction))
  const ticks = tickMarks(totalDecks, difficulty)

  return (
    <div className="flex items-end gap-1">
      <div
        className="relative overflow-hidden rounded-b-md border border-slate-600 bg-slate-900"
        style={{ width: TRAY_WIDTH_PX, height: TRAY_HEIGHT_PX }}
      >
        <div
          className="absolute inset-x-0 bottom-0 border-t border-amber-200/60"
          style={{
            height: `${clamped * 100}%`,
            backgroundImage: 'repeating-linear-gradient(to top, #f5f1e6 0px, #f5f1e6 3px, #cbbf9a 3px, #cbbf9a 4px)',
          }}
        />
        {ticks.map((tick, i) => (
          <div
            key={i}
            className={tick.label ? 'absolute inset-x-0 border-t border-slate-300/80' : 'absolute inset-x-0 border-t border-slate-400/40'}
            style={{ bottom: `${tick.fraction * 100}%` }}
          />
        ))}
      </div>
      <div className="relative" style={{ height: TRAY_HEIGHT_PX, width: RULER_WIDTH_PX }}>
        {ticks
          .filter((tick) => tick.label)
          .map((tick, i) => (
            <span
              key={i}
              className="absolute -translate-y-1/2 text-[10px] text-slate-400"
              style={{ bottom: `${tick.fraction * 100}%` }}
            >
              {tick.label}
            </span>
          ))}
      </div>
    </div>
  )
}

interface DeckEstimateTrayProps {
  /** 0-1, fraction of the shoe already discarded. Never shown as a number — read it visually. */
  fillFraction: number
  totalDecks: number
  difficulty: DifficultyLevel
}

export function DeckEstimateTray({ fillFraction, totalDecks, difficulty }: DeckEstimateTrayProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm text-slate-400">
        Shoe: {totalDecks} deck{totalDecks > 1 ? 's' : ''} total
      </p>
      <TrayWithTicks fillFraction={fillFraction} totalDecks={totalDecks} difficulty={difficulty} />
      <p className="max-w-[12rem] text-center text-xs text-slate-500">Discard tray — estimate how many decks have been played</p>
    </div>
  )
}

interface DeckScaleReferenceProps {
  totalDecks: number
}

/** Always full (beginner) tick density and an empty tray — a study aid, not tied to the drill's difficulty. */
export function DeckScaleReference({ totalDecks }: DeckScaleReferenceProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm text-slate-400">
        Scale reference — {totalDecks} deck{totalDecks > 1 ? 's' : ''} shoe
      </p>
      <TrayWithTicks fillFraction={0} totalDecks={totalDecks} difficulty="beginner" />
      <p className="max-w-[12rem] text-center text-xs text-slate-500">
        Study these lines, then start a scenario — marks may be sparser during the real drill
      </p>
    </div>
  )
}
