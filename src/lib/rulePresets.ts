import type { Soft17Rule, SurrenderMode } from './strategy'

/**
 * Named, one-click regional rule configurations for the Settings panel.
 * Each `config` sets all five rule axes at once (numDecks, soft17Rule,
 * surrenderMode, das, maxSplitHands) — no engine changes, these only set
 * existing `CountingSettings` fields.
 *
 * SOURCING (do not loosen without re-verifying — these are factual claims
 * about what real casinos run, not arbitrary chart combinations):
 *
 * - "Washington & Vegas Strip": 6D/H17/no-surrender, independently confirmed
 *   for BOTH regions —
 *     WA: H17 confirmed across WA tribal casinos per the WA Gambling
 *     Commission's posted table rules. DAS varies by property — most run
 *     DAS, but at least one documented exception exists (Muckleshoot:
 *     8-deck H17, no DAS, called out as unusual for a shoe game).
 *     Vegas Strip: H17/no-surrender is the standard *floor* game — two
 *     current sources agree "assume a casino's game hits soft 17 unless
 *     otherwise noted" for the typical 6-deck shoe game ($15-50 min).
 *     Stand-on-soft-17 6-deck games exist but are the *high-limit* variant
 *     ($50-500 min, specific named casinos), the reverse of what's typical.
 *   Deliberately NOT widened to a broader "West Coast"/"Western US"/
 *   "Nevada" label — checked and rejected:
 *     Nevada outside the Strip diverges: Reno/northern NV mostly runs
 *     single-deck H17 with doubling restricted to hard 10/11 only (not this
 *     config); Vegas double-deck games vary on both soft-17 and DAS with no
 *     consistent pattern ("the only thing in common is surrender is never
 *     available" — Las Vegas Advisor).
 *     California: current house-banked blackjack rules are under active
 *     regulatory litigation (court injunction, May 2026); the one CA game
 *     found sourced is a modified variant (California No Bust Blackjack),
 *     not comparable to standard blackjack.
 *     Oregon: no reliable current source found — not claimed.
 *   So the label claims exactly WA + the Vegas Strip, no more.
 *   maxSplitHands: 4 — per an internal Squaxin Island Tribal Gaming
 *   Regulatory Agency training manual (rev. 5-11-19) documenting that
 *   casino's own posted 6-deck-shoe rules: split to 4 hands, no re-split
 *   Aces, cannot hit split Aces. AUTHORITATIVE FOR RULES ONLY, not for
 *   strategy cells — chart data stays machine-extracted from WoO's
 *   calculator (see strategy.ts). The document is dated 2019 (7 years old
 *   as of this writing); the double-deck ruleset in particular should be
 *   re-confirmed as current before being treated as authoritative for a new
 *   pass.
 * - "Atlantic City": 6D/S17/DAS/late-surrender is the standard $25+-minimum
 *   AC package (confirmed for Borgata, Hard Rock — described as "the full
 *   package," the AC reference rules). Lower-limit AC tables vary.
 *   maxSplitHands: 4 — not independently sourced for AC specifically; kept
 *   at the same default as the 6-deck shoe-game norm elsewhere in this file,
 *   consistent with (not contradicted by) any source consulted so far.
 * - "Double Deck · H17, No DAS": 2D/H17/no-DAS/no-surrender, maxSplitHands: 2
 *   — same tribal gaming training manual as above, its double-deck rule
 *   entry: H17, no DAS, double any two cards, split to 2 hands only, no
 *   re-split Aces, cannot hit split Aces, no surrender, 3:2.
 *
 * LABELING ASYMMETRY — deliberate, not sloppy: the two 6-deck presets are
 * labeled by REGION ("Washington & Vegas Strip", "Atlantic City") because
 * each rests on a researched regional claim — H17 confirmed near-universal
 * across WA tribal casinos plus the standard Vegas Strip floor game
 * (independent sources for each), and the standard $25+ AC package
 * (confirmed for Borgata, Hard Rock). The double-deck preset is instead
 * labeled by RULESET ("Double Deck · H17, No DAS"), not by casino or
 * region, because it rests on a single source — one property's internal
 * training manual, 7 years old, never cross-checked against a second
 * casino or a public regulator source the way the 6-deck rules were.
 * Naming it for a state or casino would generalize one property to a
 * region — exactly the overclaiming this file has avoided everywhere
 * else. All three labels now name the game type (6-Deck / Double Deck)
 * for consistency, so the asymmetry that remains is specifically about
 * WHAT they're named after (region vs. ruleset), not about polish.
 */
export interface RulePresetConfig {
  numDecks: number
  soft17Rule: Soft17Rule
  surrenderMode: SurrenderMode
  das: boolean
  maxSplitHands: number
}

export interface RulePreset {
  label: string
  subtitle: string
  config: RulePresetConfig
}

export const RULE_PRESETS: RulePreset[] = [
  {
    label: 'Washington & Vegas Strip · 6-Deck',
    subtitle: 'Representative — confirmed for WA tribal casinos and standard Strip floor games specifically, not a broader regional claim; individual casinos vary, especially DAS',
    config: { numDecks: 6, soft17Rule: 'H17', surrenderMode: 'none', das: true, maxSplitHands: 4 },
  },
  {
    label: 'Atlantic City · 6-Deck',
    subtitle: 'Representative — the standard $25+ AC ruleset; lower-limit tables vary',
    config: { numDecks: 6, soft17Rule: 'S17', surrenderMode: 'late', das: true, maxSplitHands: 4 },
  },
  {
    label: 'Double Deck · H17, No DAS',
    subtitle: 'Representative double-deck shoe game — split capped at 2 hands, no resplit Aces; individual casinos vary',
    config: { numDecks: 2, soft17Rule: 'H17', surrenderMode: 'none', das: false, maxSplitHands: 2 },
  },
]

/** Whether `settings`' five rule axes exactly match a given preset's config. Used to highlight the active preset. */
export function presetMatches(preset: RulePreset, settings: RulePresetConfig): boolean {
  return (
    preset.config.numDecks === settings.numDecks &&
    preset.config.soft17Rule === settings.soft17Rule &&
    preset.config.surrenderMode === settings.surrenderMode &&
    preset.config.das === settings.das &&
    preset.config.maxSplitHands === settings.maxSplitHands
  )
}
