import { useEffect, useState } from 'react'
import { loadState } from '../lib/persistence'
import { WeaknessHeatmap } from './WeaknessHeatmap'

const POLL_MS = 1000

/**
 * Always-below-the-fold weakness heatmap for Basic Strategy, moved out of
 * `BasicStrategyMode.tsx` so it doesn't compete with the table/HUD for the
 * fixed-height "must fit one screen" budget in `App.tsx`. Self-contained
 * and self-polling (no props), same pattern as `TrainingSessionRecord.tsx` —
 * that component already reads `stats` this way independently of
 * `BasicStrategyMode`'s own local state, so this reuses a proven approach
 * rather than lifting state up.
 */
export function StrategyHeatmapSection() {
  const [stats, setStats] = useState(() => loadState().stats)

  useEffect(() => {
    const id = setInterval(() => setStats(loadState().stats), POLL_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-4">
      <WeaknessHeatmap stats={stats} />
    </div>
  )
}
