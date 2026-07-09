/**
 * Card-dealing pace for timed auto-deal drills (currently only Running
 * Count — see RunningCountMode.tsx). Three presets modeled on realistic
 * dealer pace rather than an arbitrary cards/sec slider: a relaxed/new
 * dealer or a full table deals slower, a brisk experienced or heads-up
 * dealer deals faster.
 */
export type DealSpeed = 'slow' | 'medium' | 'fast'

export const DEAL_SPEEDS: DealSpeed[] = ['slow', 'medium', 'fast']

export const DEAL_SPEED_MS_PER_CARD: Record<DealSpeed, number> = {
  slow: 1500,
  medium: 1000,
  fast: 650,
}

export const DEAL_SPEED_LABELS: Record<DealSpeed, string> = {
  slow: 'Slow (~1.5s/card — relaxed dealer, crowded table)',
  medium: 'Medium (~1s/card — steady dealer)',
  fast: 'Fast (~0.65s/card — brisk, heads-up)',
}
