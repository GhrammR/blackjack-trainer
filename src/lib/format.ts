/** Formats a number with an explicit leading sign, e.g. "+3" or "-2". */
export function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}
