import type { ReactNode } from 'react'

interface TableSeatProps {
  children: ReactNode
  label?: string
  isActive?: boolean
  isUser?: boolean
}

/**
 * A single seat position at the CasinoTable. Dims inactive seats in
 * multi-player drills. (Previously also ring-highlighted the user's own
 * seat, but that border could extend past the felt near the edge of the
 * curve and get visibly clipped — removed rather than repositioned, since
 * the label and card contents already make the user's seat identifiable.)
 */
export function TableSeat({ children, label, isActive = true }: TableSeatProps) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 rounded-xl p-2 transition-opacity @[500px]:gap-3 @[500px]:p-4 ${
        isActive ? 'opacity-100' : 'opacity-40'
      }`}
    >
      {label && (
        <p
          className="whitespace-nowrap font-semibold uppercase tracking-wider text-emerald-200/70"
          style={{ fontSize: 'clamp(8px, 2cqw, 12px)' }}
        >
          {label}
        </p>
      )}
      {children}
    </div>
  )
}
