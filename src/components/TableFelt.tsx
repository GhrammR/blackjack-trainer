import type { ReactNode } from 'react'

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
    <div
      className="rounded-2xl p-2 shadow-xl"
      style={{
        background: 'linear-gradient(145deg, #7a4f28 0%, #4a2e12 40%, #7a4f28 100%)',
      }}
    >
      <div
        className="rounded-xl p-6"
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, #1d7048 0%, #145535 55%, #0b3520 100%)',
          boxShadow: 'inset 0 3px 24px rgba(0,0,0,0.55), inset 0 0 48px rgba(0,0,0,0.3)',
        }}
      >
        <div className="flex flex-col items-center gap-2">{dealer}</div>
        <div className="mt-6 flex flex-wrap justify-center gap-4">{seats}</div>
      </div>
    </div>
  )
}
