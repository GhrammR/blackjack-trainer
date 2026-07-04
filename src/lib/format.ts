/** Formats a number with an explicit leading sign, e.g. "+3" or "-2". */
export function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

/** True only for a complete signed integer (e.g. "-5", "3") — rejects "", "-", and other partial/invalid entries so a bare sign toggle can't be submitted as NaN. */
export function isValidSignedInt(value: string): boolean {
  return /^-?\d+$/.test(value.trim())
}

/** Formats a duration in milliseconds as seconds with 2 decimal places, e.g. "12.34s". */
export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`
}

/** Formats a ms-per-card pace as cards/sec, e.g. "2.38 cards/sec" — always labeled so it reads as a rate, not a raw time. */
export function formatPace(msPerCard: number): string {
  return `${(1000 / msPerCard).toFixed(2)} cards/sec`
}
