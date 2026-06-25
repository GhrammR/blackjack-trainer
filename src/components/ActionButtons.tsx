import type { Action } from '../types'

const ALL_ACTIONS: Action[] = ['Hit', 'Stand', 'Double', 'Split', 'Surrender']

interface ActionButtonsProps {
  onSelect: (action: Action) => void
  disabled?: boolean
  /** Which actions to show as buttons. Defaults to all five (v1's Strategy Trainer and Index Plays drill always grade a hand's first decision, where every action is on the table). The Live Play drill (step 10) passes a narrower, legality-restricted set for decisions after the first. */
  actions?: Action[]
}

export function ActionButtons({ onSelect, disabled = false, actions = ALL_ACTIONS }: ActionButtonsProps) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {actions.map((action) => (
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
