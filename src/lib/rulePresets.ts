import type { Soft17Rule, SurrenderMode } from './strategy'

/**
 * Named, one-click regional rule configurations for the Settings panel.
 * Each `config` sets all four rule axes at once (numDecks, soft17Rule,
 * surrenderMode, das) — no engine changes, these only set existing
 * `CountingSettings` fields.
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
 * - "Atlantic City": 6D/S17/DAS/late-surrender is the standard $25+-minimum
 *   AC package (confirmed for Borgata, Hard Rock — described as "the full
 *   package," the AC reference rules). Lower-limit AC tables vary.
 */
export interface RulePresetConfig {
  numDecks: number
  soft17Rule: Soft17Rule
  surrenderMode: SurrenderMode
  das: boolean
}

export interface RulePreset {
  label: string
  subtitle: string
  config: RulePresetConfig
}

export const RULE_PRESETS: RulePreset[] = [
  {
    label: 'Washington & Vegas Strip',
    subtitle: 'Representative — confirmed for WA tribal casinos and standard Strip floor games specifically, not a broader regional claim; individual casinos vary, especially DAS',
    config: { numDecks: 6, soft17Rule: 'H17', surrenderMode: 'none', das: true },
  },
  {
    label: 'Atlantic City',
    subtitle: 'Representative — the standard $25+ AC ruleset; lower-limit tables vary',
    config: { numDecks: 6, soft17Rule: 'S17', surrenderMode: 'late', das: true },
  },
]

/** Whether `settings`' four rule axes exactly match a given preset's config. Used to highlight the active preset. */
export function presetMatches(preset: RulePreset, settings: RulePresetConfig): boolean {
  return (
    preset.config.numDecks === settings.numDecks &&
    preset.config.soft17Rule === settings.soft17Rule &&
    preset.config.surrenderMode === settings.surrenderMode &&
    preset.config.das === settings.das
  )
}
