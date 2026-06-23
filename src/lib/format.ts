/** Formats a number with an explicit leading sign, e.g. "+3" or "-2". */
export function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

/** Formats a duration in milliseconds as seconds with 2 decimal places, e.g. "12.34s". */
export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`
}
