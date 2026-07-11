import type { Action, Category } from '../types'

/**
 * Short, rule-based explanations for a missed decision. Scoped to
 * category + action rather than every individual situation — the
 * reasoning genuinely only varies along those lines, and a per-cell map
 * would mean 150+ near-duplicate strings for no real benefit.
 */
const REASONS: Partial<Record<`${Category}-${Action}`, string>> = {
  'hard-Hit': "Your total is too weak to stand on safely — hitting is your best shot at improving it.",
  'hard-Stand': 'Your total is strong enough to stand on, and risking a bust here costs more than it gains.',
  'hard-Double': 'This total has great odds to make a strong hand off one more card — double to get more money down while the edge is yours.',
  'soft-Hit': "The ace gives you room to draw without busting, and this total alone isn't strong enough to stand on.",
  'soft-Stand': 'This soft total is already strong enough to stand on against this dealer upcard.',
  'soft-Double': 'The ace lets you draw risk-free, and the dealer upcard is weak enough to double for more value.',
  'pairs-Split': 'Splitting turns one mediocre hand into two hands with a better starting point than playing the pair as a single total.',
  'pairs-Stand': 'This pair already makes a strong total — splitting would throw away a sure thing.',
  'pairs-Hit': "This pair isn't worth splitting; treat it as a regular total and hit.",
  'pairs-Double': 'Treated as a total rather than split, this hand has great odds to improve with one more card — double down.',
}

export function reasonFor(category: Category, action: Action): string | null {
  return REASONS[`${category}-${action}`] ?? null
}

/**
 * The three cells where this app's fixed H17 rule set (dealer hits soft
 * 17) genuinely changes the correct play versus the more commonly-known
 * S17 charts — see CLAUDE.md §11's "Hard 11 always Doubles" note and
 * DECISIONS.md's S17→H17 conversion log. Missing one of these specific
 * cells is usually an S17/H17 mix-up rather than an ordinary strategy gap,
 * so it gets its own short explanatory note on top of the normal
 * category+action reason — only shown when the user actually gets ONE OF
 * THESE THREE wrong, not on every double/soft-total miss.
 */
const H17_NOTES: Partial<Record<string, string>> = {
  'soft-19-vs-6': "Under H17 (dealer hits soft 17), double soft 19 vs 6 — the dealer's extra bust risk on soft 17 makes doubling worth it. Under S17 you'd stand.",
  'soft-18-vs-2': "Under H17, double soft 18 vs 2. Under S17 you'd stand.",
  'hard-11-vs-A': "Under H17, double 11 vs Ace. Under S17 you'd hit.",
}

export function h17NoteFor(situationKey: string): string | null {
  return H17_NOTES[situationKey] ?? null
}
