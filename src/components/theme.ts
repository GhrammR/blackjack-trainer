/**
 * Shared visual tokens for step 11's presentation pass (slice A). Pulled out
 * of the ad-hoc but already-consistent className strings every drill had
 * been repeating independently — consolidation, not new design. The rest of
 * the app's dark-slate chrome is untouched; FELT_PANEL is the one new,
 * deliberately confined accent (see DECISIONS.md).
 */

export const PAGE_WRAPPER = 'flex w-full max-w-3xl flex-col items-center gap-6 px-4 py-4'

export const FELT_PANEL =
  'rounded-2xl border border-emerald-900/40 bg-gradient-to-b from-emerald-950/50 to-emerald-900/20 p-6 shadow-inner'

export const SECTION_LABEL = 'text-xs sm:text-sm uppercase tracking-wide text-slate-400'

export const PRIMARY_BUTTON_LG =
  'rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40'

export const PRIMARY_BUTTON =
  'rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40'

export const SECONDARY_BUTTON =
  'rounded-md bg-slate-700 px-4 py-2.5 font-medium text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40'

export const SUCCESS_TEXT = 'text-emerald-400'
export const ERROR_TEXT = 'text-red-400'
export const NEUTRAL_TEXT = 'text-slate-400'

/**
 * Fixed height (px) reserved for the HUD region below the table, PER MODE —
 * not one shared constant. A single global reserve sized to the tallest
 * mode's tallest state (Basic Strategy's multi-miss roundComplete, ~402px)
 * shrank every OTHER mode's table to match that worst case too, which made
 * the table too small to play at a short real-world window (measured
 * 352×201 at innerHeight 730 under the old single-460 scheme).
 *
 * Each value below is that mode's own ROUTINE working-state max — not its
 * absolute rarest-possible state — measured live (Playwright, driving each
 * mode through its real phases) at innerHeight 730. Reserving the literal
 * worst case per mode was tried and rejected: Basic Strategy's own worst
 * case (a split hand with several misses, ~402px) reserved at that size
 * still left a small table (422×241) — barely better than the global
 * scheme, because that state is rare, not routine.
 *
 * So instead: reserve the common case, and let the RARE tall state (Basic
 * Strategy's multi-miss list) or the INHERENTLY UNBOUNDED state (Counter
 * Detection's and Evidence Flagging's full round-review list — routine,
 * but open-ended by design, the same way Table Scan's scan grid already
 * self-caps at maxHeight 440) scroll INSIDE the fixed HUD box via the
 * `overflow-y: auto` every mode's HUD wrapper already carries, instead of
 * being reserved for. The table still never resizes — only the rare/
 * unbounded content occasionally grows an internal scrollbar.
 *
 * Table size this produces at innerHeight 730 (vs. the 352×201 baseline):
 * strategy 772×441, runningCount 842×481, indexPlays 702×401,
 * shoeCountdown 719×411, counterDetection/evidenceFlagging 632×361,
 * trueCount 562×321, evasion 544×311, livePlay 492×281 (count-check's
 * ShoeRack shows every hand, so that's livePlay's routine max, not a rare
 * spike). tableScan stays 352×201 — its own self-capped scan grid alone
 * needs ~460px at this window height; fixing that is a separate, later
 * change to that mode's own grid layout, not this sizing scheme.
 */
export const HUD_HEIGHT = {
  strategy: 220,
  trueCount: 340,
  livePlay: 380,
  indexPlays: 260,
  evasion: 350,
  counterDetection: 300,
  evidenceFlagging: 300,
  tableScan: 460,
  runningCount: 180,
  shoeCountdown: 250,
} as const
