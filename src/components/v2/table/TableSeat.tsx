import type { ReactNode } from 'react'

interface TableSeatProps {
  children: ReactNode
  label?: string
  isActive?: boolean
  isUser?: boolean
}

/**
 * A single seat position at the CasinoTable. Highlights the user seat with a
 * subtle border and dims inactive seats in multi-player drills.
 */
export function TableSeat({ children, label, isActive = true, isUser = false }: TableSeatProps) {
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-xl p-1.5 transition-opacity @[500px]:gap-2 @[500px]:p-3 ${
        isActive ? 'opacity-100' : 'opacity-40'
      } ${isUser ? 'ring-2 ring-emerald-400/60 ring-offset-1 ring-offset-transparent' : ''}`}
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
