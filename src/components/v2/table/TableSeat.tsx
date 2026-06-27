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
      className={`flex flex-col items-center gap-2 rounded-xl p-3 transition-opacity ${
        isActive ? 'opacity-100' : 'opacity-40'
      } ${isUser ? 'ring-2 ring-emerald-400/60 ring-offset-1 ring-offset-transparent' : ''}`}
    >
      {label && (
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200/70">{label}</p>
      )}
      {children}
    </div>
  )
}
