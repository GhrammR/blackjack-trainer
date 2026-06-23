/**
 * Tracks per-situation accuracy and weights upcoming hands toward weak
 * spots, while still surfacing mastered situations occasionally so they
 * aren't forgotten.
 */

// Tunables.
export const WINDOW_SIZE = 5
export const RECENCY_BOOST = 3
export const BASE_EXPLORATION = 0.5
/** Fraction of picks drawn by weakness weight; the rest are uniform random. */
export const WEIGHTED_SAMPLE_RATIO = 0.7

export interface SituationStat {
  key: string
  attempts: number
  correct: number
  /** Hand index when this situation was last seen, or -1 if never. */
  lastSeen: number
  /** Rolling window of recent results, most recent last, capped at WINDOW_SIZE. */
  recentResults: boolean[]
}

export type Stats = Record<string, SituationStat>

function createStat(key: string): SituationStat {
  return { key, attempts: 0, correct: 0, lastSeen: -1, recentResults: [] }
}

export function getStat(stats: Stats, key: string): SituationStat {
  return stats[key] ?? createStat(key)
}

export function recordResult(stats: Stats, key: string, isCorrect: boolean, handIndex: number): Stats {
  const previous = getStat(stats, key)
  const updated: SituationStat = {
    key,
    attempts: previous.attempts + 1,
    correct: previous.correct + (isCorrect ? 1 : 0),
    lastSeen: handIndex,
    recentResults: [...previous.recentResults, isCorrect].slice(-WINDOW_SIZE),
  }
  return { ...stats, [key]: updated }
}

/** Accuracy over the fixed-size rolling window; unseen attempts count as 0. */
export function recentAccuracy(stat: SituationStat): number {
  const correctInWindow = stat.recentResults.filter(Boolean).length
  return correctInWindow / WINDOW_SIZE
}

/** Higher when recent accuracy is lower; never zero, so every situation can still be sampled. */
export function weaknessScore(stat: SituationStat): number {
  return (1 - recentAccuracy(stat)) * RECENCY_BOOST + BASE_EXPLORATION
}

/**
 * Picks the next situation key: mostly weighted toward weak spots, with a
 * uniform-random floor so mastered situations still recur.
 */
export function selectNextSituation(stats: Stats, allKeys: string[], random: () => number = Math.random): string {
  if (allKeys.length === 0) {
    throw new Error('selectNextSituation requires at least one situation key')
  }

  if (random() >= WEIGHTED_SAMPLE_RATIO) {
    return allKeys[Math.floor(random() * allKeys.length)]
  }

  const weights = allKeys.map((key) => weaknessScore(getStat(stats, key)))
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  let remaining = random() * totalWeight

  for (let i = 0; i < allKeys.length; i++) {
    remaining -= weights[i]
    if (remaining <= 0) return allKeys[i]
  }
  return allKeys[allKeys.length - 1]
}
