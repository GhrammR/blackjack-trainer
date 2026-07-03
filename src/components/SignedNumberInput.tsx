import { forwardRef } from 'react'

interface SignedNumberInputProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  autoFocus?: boolean
  className?: string
}

/**
 * Digits-only number input plus a tappable sign toggle. Mobile numeric
 * keypads (type="number"/inputMode="numeric") have no minus key, so typing
 * a negative count is impossible on a phone without this — the toggle sets
 * the sign directly on the string value, independent of the keyboard.
 */
export const SignedNumberInput = forwardRef<HTMLInputElement, SignedNumberInputProps>(
  function SignedNumberInput({ value, onChange, onKeyDown, autoFocus, className }, ref) {
    const isNegative = value.trim().startsWith('-')

    const toggleSign = () => {
      const trimmed = value.trim()
      onChange(isNegative ? trimmed.slice(1) : `-${trimmed}`)
    }

    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleSign}
          aria-label={isNegative ? 'Make positive' : 'Make negative'}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-700 text-lg font-semibold transition hover:bg-slate-600 ${
            isNegative ? 'text-red-400' : 'text-white'
          }`}
        >
          ±
        </button>
        <input
          ref={ref}
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
          className={className ?? 'w-20 rounded bg-slate-800 px-2 py-1 text-center text-white'}
        />
      </span>
    )
  },
)
