import type { RoundRecord } from './detectionSession'

/**
 * Ground truth + grading for the evidence-flagging drill (v2 step 8 slice 3).
 *
 * A round counts as "evidence" — something a real surveillance review would
 * flag — if it shows a genuine, uncamouflaged count-driven tell: either the
 * bet jumped to an elevated step because the true count crossed the
 * player's threshold (`isElevatedBet`), or the player took a real
 * count-driven strategy deviation (`deviationType === 'index'`). Cover bets
 * and cover deviations are deliberately excluded: they're the player's own
 * camouflage, designed to not look like a tell, so flagging them would be a
 * false positive in real surveillance terms too — confirmed with the user.
 *
 * Takes the minimal structural shape rather than the full `RoundRecord` so
 * the evasion drill's own round records (step 8 slice 4, which has no
 * `PlayerProfile` and therefore no `isCoverBet`/`bet` fields shaped exactly
 * like `RoundRecord`'s) can reuse this same classifier unchanged.
 */
export function isEvidenceRound(round: { isElevatedBet: boolean; deviationType: 'index' | 'cover' | null }): boolean {
  return round.isElevatedBet || round.deviationType === 'index'
}

export interface FlagGrade {
  evidenceRoundNumbers: number[]
  truePositives: number[]
  falsePositives: number[]
  falseNegatives: number[]
  /** Of the rounds flagged, what fraction were real evidence. null when nothing was flagged. */
  precision: number | null
  /** Of the real evidence rounds, what fraction got flagged. null when there was no evidence at all. */
  recall: number | null
}

/** Grades a set of user-flagged round numbers against a session's rounds. */
export function gradeFlags(rounds: RoundRecord[], flaggedRoundNumbers: Set<number>): FlagGrade {
  const evidenceRoundNumbers = rounds.filter(isEvidenceRound).map((r) => r.roundNumber)
  const evidenceSet = new Set(evidenceRoundNumbers)

  const truePositives = evidenceRoundNumbers.filter((n) => flaggedRoundNumbers.has(n))
  const falsePositives = [...flaggedRoundNumbers].filter((n) => !evidenceSet.has(n))
  const falseNegatives = evidenceRoundNumbers.filter((n) => !flaggedRoundNumbers.has(n))

  const flaggedCount = flaggedRoundNumbers.size
  const precision = flaggedCount === 0 ? null : truePositives.length / flaggedCount
  const recall = evidenceRoundNumbers.length === 0 ? null : truePositives.length / evidenceRoundNumbers.length

  return { evidenceRoundNumbers, truePositives, falsePositives, falseNegatives, precision, recall }
}
