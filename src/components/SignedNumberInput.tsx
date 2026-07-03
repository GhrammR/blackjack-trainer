import { forwardRef } from 'react'

interface SignedNumberInputProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  autoFocus?: boolean
  className?: string
}

/**
 * Digits-only number input plus a tappable +/− sign control. Mobile numeric
 * keypads (type="number"/inputMode="numeric") have no minus key, so typing
 * a negative count is impossible on a phone without this — the control sets
 * the sign directly on the string value, independent of the keyboard.
 *
 * The active sign is a two-segment control (not a single ambiguous "±"
 * button) so the current state reads at a glance without relying on color:
 * the pressed segment gets a filled, bold, higher-contrast treatment and
 * aria-pressed, while color (red for negative) is only a secondary cue.
 * The signed value itself ("-5") is also always visible in the field.
 */
export const SignedNumberInput = forwardRef<HTMLInputElement, SignedNumberInputProps>(
  function SignedNumberInput({ value, onChange, onKeyDown, autoFocus, className }, ref) {
    const isNegative = value.trim().startsWith('-')

    const setSign = (negative: boolean) => {
      const trimmed = value.trim()
      const digits = trimmed.startsWith('-') ? trimmed.slice(1) : trimmed
      onChange(negative ? `-${digits}` : digits)
    }

    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          role="group"
          aria-label="Sign"
          className="inline-flex overflow-hidden rounded border border-slate-600"
        >
          <button
            type="button"
            onClick={() => setSign(false)}
            aria-pressed={!isNegative}
            className={`px-2.5 py-1.5 text-base font-bold leading-none transition ${
              !isNegative
                ? 'bg-slate-100 text-slate-900'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setSign(true)}
            aria-pressed={isNegative}
            className={`px-2.5 py-1.5 text-base font-bold leading-none transition ${
              isNegative
                ? 'bg-red-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            &minus;
          </button>
        </span>
        <input
          ref={ref}
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
          className={className ?? 'w-20 rounded bg-slate-800 px-2 py-1 text-center text-lg font-semibold text-white'}
        />
      </span>
    )
  },
)
