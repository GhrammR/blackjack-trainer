/**
 * Shared 4-tier green→yellow→orange→red accuracy scale for the weakness
 * charts (Basic Strategy's WeaknessHeatmap and Index Play's heatmap) — kept
 * as one function so both stay visually consistent and can't drift apart.
 * Colors are dark-enough shades (not the brighter 500-level tailwind hues)
 * to keep white cell text readable against the dark theme. Unseen entries
 * stay a neutral gray, outside the accuracy scale entirely.
 */
export function heatColor(accuracy: number, seen: boolean): string {
  if (!seen) return '#334155' // slate-700 — unseen, neutral
  if (accuracy >= 0.85) return '#15803d' // green-700 — good
  if (accuracy >= 0.7) return '#a16207' // yellow-700 — decent, could improve
  if (accuracy >= 0.5) return '#c2410c' // orange-700 — needs work
  return '#b91c1c' // red-700 — bad
}
