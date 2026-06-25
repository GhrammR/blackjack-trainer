import type { ReactNode } from 'react'
import { FELT_PANEL } from './theme'

interface TableFeltProps {
  dealer: ReactNode
  seats: ReactNode
}

/**
 * The "seat-frame" treatment from step 11 — an abstract felt panel framing a
 * dealer area and a row of seat content below it. Deliberately used only
 * where a single hand-vs-dealer view reads naturally as a table (Strategy
 * Trainer, Index Plays, Live Play) — Table Scan's dense per-seat sparkline
 * layout is a separate, intentionally compact design and stays as-is. See
 * DECISIONS.md.
 */
export function TableFelt({ dealer, seats }: TableFeltProps) {
  return (
    <div className={FELT_PANEL}>
      <div className="flex flex-col items-center gap-2">{dealer}</div>
      <div className="mt-6 flex flex-wrap justify-center gap-4">{seats}</div>
    </div>
  )
}
