import type { Action } from '../types'

const ACTIONS: Action[] = ['Hit', 'Stand', 'Double', 'Split', 'Surrender']

interface ActionButtonsProps {
  onSelect: (action: Action) => void
  disabled?: boolean
}

export function ActionButtons({ onSelect, disabled = false }: ActionButtonsProps) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {ACTIONS.map((action) => (
        <button
          key={action}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(action)}
          className="rounded-md bg-slate-700 px-4 py-2 font-medium text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {action}
        </button>
      ))}
    </div>
  )
}
