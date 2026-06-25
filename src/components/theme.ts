/**
 * Shared visual tokens for step 11's presentation pass (slice A). Pulled out
 * of the ad-hoc but already-consistent className strings every drill had
 * been repeating independently — consolidation, not new design. The rest of
 * the app's dark-slate chrome is untouched; FELT_PANEL is the one new,
 * deliberately confined accent (see DECISIONS.md).
 */

export const PAGE_WRAPPER = 'flex w-full max-w-3xl flex-col items-center gap-6 px-4 py-10'

export const FELT_PANEL =
  'rounded-2xl border border-emerald-900/40 bg-gradient-to-b from-emerald-950/50 to-emerald-900/20 p-6 shadow-inner'

export const SECTION_LABEL = 'text-sm uppercase tracking-wide text-slate-400'

export const PRIMARY_BUTTON_LG =
  'rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40'

export const PRIMARY_BUTTON =
  'rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40'

export const SECONDARY_BUTTON =
  'rounded-md bg-slate-700 px-4 py-2 font-medium text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40'

export const SUCCESS_TEXT = 'text-emerald-400'
export const ERROR_TEXT = 'text-red-400'
export const NEUTRAL_TEXT = 'text-slate-400'
