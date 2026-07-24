import { useEffect, useState } from 'react'
import { loadCountingState } from '../lib/persistence'
import { SECTION_LABEL } from './theme'

const POLL_MS = 1000

const CATEGORY_LABELS = {
  hardDouble: 'Hard Doubles',
  softDouble: 'Soft Doubles',
  split: 'Splits',
} as const

function pct(correct: number, attempts: number): string {
  return attempts === 0 ? '—' : `${Math.round((correct / attempts) * 100)}%`
}

/**
 * Always-below-the-fold per-category breakdown for Two Bets in a Circle,
 * mirroring IndexPlayHeatmapSection.tsx's self-polling pattern exactly (no
 * props, reads its own state on an interval) so it doesn't compete with the
 * table/HUD for the fixed-height "must fit one screen" budget in App.tsx.
 * Three simple rows, not a full heatmap grid — there are only 3 categories
 * here, not 14+ situations, so a heatmap component would be overkill.
 */
export function TwoBetsCategorySection() {
  const [perCategory, setPerCategory] = useState(() => loadCountingState().progress.twoBets.perCategory)

  useEffect(() => {
    const id = setInterval(() => setPerCategory(loadCountingState().progress.twoBets.perCategory), POLL_MS)
    return () => clearInterval(id)
  }, [])

  const categories = Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[]

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-4">
      <p className={SECTION_LABEL}>Two Bets in a Circle — by category</p>
      <div className="flex flex-col gap-1 rounded-lg bg-slate-800/50 p-4">
        {categories.map((category) => {
          const stat = perCategory[category]
          return (
            <div key={category} className="flex items-center justify-between text-sm text-slate-300">
              <span>{CATEGORY_LABELS[category]}</span>
              <span className="text-slate-400">
                {stat.attempts === 0 ? 'Not started' : `${stat.attempts} attempts · ${pct(stat.correct, stat.attempts)} correct`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
