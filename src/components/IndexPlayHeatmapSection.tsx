import { useEffect, useState } from 'react'
import { loadCountingState } from '../lib/persistence'
import { IndexPlayHeatmap } from './IndexPlayHeatmap'

const POLL_MS = 1000

/**
 * Always-below-the-fold weakness chart for Index Plays, mirroring
 * StrategyHeatmapSection's self-polling pattern exactly (no props, reads
 * its own state on an interval) so it doesn't compete with the
 * table/HUD for the fixed-height "must fit one screen" budget in
 * App.tsx. Reads from the v2 counting storage key, not v1's — Index Play's
 * per-deviation stats live in `CountingProgress.indexPlays.perDeviation`.
 */
export function IndexPlayHeatmapSection() {
  const [perDeviation, setPerDeviation] = useState(() => loadCountingState().progress.indexPlays.perDeviation)

  useEffect(() => {
    const id = setInterval(() => setPerDeviation(loadCountingState().progress.indexPlays.perDeviation), POLL_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-4">
      <IndexPlayHeatmap perDeviation={perDeviation} />
    </div>
  )
}
