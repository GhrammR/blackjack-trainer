import { useState } from 'react'
import type { Action } from '../types'
import { resolveHardTotals, resolveSoftTotals, resolvePairs, type RuleConfig, type Soft17Rule, type SurrenderMode } from '../lib/strategy'
import { SHOE_SIZE_OPTIONS } from '../lib/shoe'
import { INDEX_PLAYS } from '../lib/indexPlays'
import { hiLoValue, MIN_DECKS_REMAINING } from '../lib/counting'
import { EV_BET_RAMP } from '../lib/livePlaySession'
import { PAGE_WRAPPER, SECTION_LABEL } from './theme'

/**
 * Reference guides — the interactive Strategy Chart, Illustrious 18, and
 * how-to-count content. Every table below reads its values directly from
 * the same engine data the drills grade against (`strategy.ts`'s
 * resolveHardTotals/resolveSoftTotals/resolvePairs, `indexPlays.ts`'s
 * INDEX_PLAYS, `counting.ts`'s hiLoValue, `livePlaySession.ts`'s
 * EV_BET_RAMP) — nothing here is a hand-retyped copy that could drift from
 * the grader. The `rules` prop is the current live RuleConfig, used only
 * to SEED the Strategy Chart section's own local rule state (see
 * `StrategyChartSection`) — the chart's selectors are independent of the
 * app's real training settings so the user can browse any of the 12
 * sourced combinations without changing what they train under.
 */

const DEALER_COLUMNS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'] as const

const ACTION_STYLE: Record<Action, string> = {
  Hit: 'bg-red-950/70 text-red-300',
  Stand: 'bg-slate-700 text-slate-200',
  Double: 'bg-amber-900/70 text-amber-200',
  Split: 'bg-sky-950/70 text-sky-300',
  Surrender: 'bg-violet-950/70 text-violet-300',
}

const ACTION_ABBREV: Record<Action, string> = {
  Hit: 'H',
  Stand: 'S',
  Double: 'D',
  Split: 'P',
  Surrender: 'R',
}

// Shared table styling tokens — every table in this view uses the same grid
// language (border weight, header separation, cell sizing) so the strategy
// charts, Illustrious 18, and bet-ramp table all read consistently.
const CELL_BORDER = 'border border-slate-700/70'
const HEADER_CELL = `${CELL_BORDER} border-b-2 border-b-slate-500 bg-slate-800 px-2 py-1.5 text-center text-xs font-semibold text-slate-300`
const HEADER_ROW_LABEL_CORNER =
  'sticky left-0 z-20 w-16 border border-slate-700/70 border-b-2 border-b-slate-500 border-r-2 border-r-slate-500 bg-slate-800'

function ActionCell({ action }: { action: Action }) {
  return (
    <td className={`w-11 ${CELL_BORDER} px-1 py-1.5 text-center text-xs font-semibold ${ACTION_STYLE[action]}`}>
      {ACTION_ABBREV[action]}
    </td>
  )
}

function ActionLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-400">
      {(Object.keys(ACTION_ABBREV) as Action[]).map((action) => (
        <span key={action} className="flex items-center gap-1.5">
          <span className={`inline-block h-4 w-4 rounded ${ACTION_STYLE[action]}`} />
          {ACTION_ABBREV[action]} = {action}
        </span>
      ))}
    </div>
  )
}

/**
 * One scrollable table with a sticky, visually separated row-label column
 * (dealer upcards run across the top, player hands down the left side) —
 * keeps the row you're reading in view while scrolling horizontally on a
 * phone, and the heavier border under the header row / right of the label
 * column makes it easy to find e.g. "16 vs 10" by scanning to the
 * intersection without losing track of either axis.
 */
function StrategyTable({
  title,
  rowLabel,
  rows,
}: {
  title: string
  rowLabel: (key: string) => string
  rows: Record<string, Record<string, Action>>
}) {
  const rowKeys = Object.keys(rows)
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      <div className="overflow-x-auto rounded border border-slate-700">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className={HEADER_ROW_LABEL_CORNER} />
              {DEALER_COLUMNS.map((d) => (
                <th key={d} className={`w-11 ${HEADER_CELL}`}>
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowKeys.map((key, i) => (
              <tr key={key}>
                <th
                  className={`sticky left-0 z-10 w-16 whitespace-nowrap border border-slate-700/70 border-r-2 border-r-slate-500 px-2 py-1.5 text-left text-xs font-semibold text-slate-300 ${
                    i % 2 === 0 ? 'bg-slate-800' : 'bg-slate-800/60'
                  }`}
                >
                  {rowLabel(key)}
                </th>
                {DEALER_COLUMNS.map((d) => (
                  <ActionCell key={d} action={rows[key][d]} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Same dropdown treatment as CountingSettingsPanel.tsx's own rule selectors — visual
// consistency between "the rules you train under" and "the rules you're browsing".
const RULE_SELECT_CLASS = 'rounded bg-slate-800 px-2 py-1 text-white'

type ChartTab = 'hard' | 'soft' | 'pairs'
const CHART_TABS: { id: ChartTab; label: string }[] = [
  { id: 'hard', label: 'Hard Totals' },
  { id: 'soft', label: 'Soft Totals' },
  { id: 'pairs', label: 'Pairs' },
]

/**
 * Interactive reference chart (Pass 2) — browses any of the 12 sourced
 * rule combinations independently of the app's real training settings.
 * `chartRules` is local state, seeded from the live `rules` prop on mount
 * only (so the chart opens showing what the user is currently training
 * under) but never written back — changing a selector here can't alter
 * `CountingSettings`/localStorage. Tabbed (not stacked) so only one
 * 10-column table's horizontal scroll region is ever on screen at once —
 * see StrategyTable's own comment on why that matters on a phone.
 */
function StrategyChartSection({ rules }: { rules: RuleConfig }) {
  const [chartRules, setChartRules] = useState<RuleConfig>(rules)
  const [tab, setTab] = useState<ChartTab>('hard')

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Strategy Chart</h2>
        <p className="text-sm text-slate-400">
          Browse the correct chart for any rule combination — read directly from{' '}
          <code>strategy.ts</code>'s resolvers, not a separate copy. These selectors only change what's
          shown here; they don't affect your training rules (change those in Settings). Rows are your
          hand, columns are the dealer's upcard — find your row, find the column, read the intersection.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Decks
          <select
            value={chartRules.numDecks}
            onChange={(e) => setChartRules((r) => ({ ...r, numDecks: Number(e.target.value) }))}
            className={RULE_SELECT_CLASS}
          >
            {SHOE_SIZE_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} deck{d > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Soft 17
          <select
            value={chartRules.soft17Rule}
            onChange={(e) => setChartRules((r) => ({ ...r, soft17Rule: e.target.value as Soft17Rule }))}
            className={RULE_SELECT_CLASS}
          >
            <option value="H17">Hits (H17)</option>
            <option value="S17">Stands (S17)</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Surrender
          <select
            value={chartRules.surrenderMode}
            onChange={(e) => setChartRules((r) => ({ ...r, surrenderMode: e.target.value as SurrenderMode }))}
            className={RULE_SELECT_CLASS}
          >
            <option value="none">Off</option>
            <option value="late">Late</option>
          </select>
        </label>
      </div>

      <ActionLegend />

      <div className="flex gap-1 border-b border-slate-700">
        {CHART_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t px-3 py-1.5 text-sm font-medium transition ${
              tab === t.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'hard' && (
        <StrategyTable
          title="Hard Totals"
          rowLabel={(k) => k}
          rows={resolveHardTotals(chartRules) as unknown as Record<string, Record<string, Action>>}
        />
      )}
      {tab === 'soft' && (
        <StrategyTable
          title="Soft Totals (with an Ace)"
          rowLabel={(k) => `A,${Number(k) - 11}`}
          rows={resolveSoftTotals(chartRules) as unknown as Record<string, Record<string, Action>>}
        />
      )}
      {tab === 'pairs' && (
        <StrategyTable
          title="Pairs"
          rowLabel={(k) => `${k},${k}`}
          rows={resolvePairs(chartRules) as unknown as Record<string, Record<string, Action>>}
        />
      )}
    </section>
  )
}

function formatSituation(situationKey: string): string {
  const [category, total, , dealer] = situationKey.split('-')
  return `${category[0].toUpperCase()}${category.slice(1)} ${total} vs ${dealer}`
}

function IllustriousEighteenSection() {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Illustrious 18</h2>
        <p className="text-sm text-slate-400">
          Count-driven deviations from basic strategy — the plays this app's Index Play drill and
          detection engines actually check against (<code>indexPlays.ts</code>'s <code>INDEX_PLAYS</code>).
        </p>
      </div>
      <div className="overflow-x-auto rounded border border-slate-700">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className={`${HEADER_CELL} text-left`}>Situation</th>
              <th className={`${HEADER_CELL} text-left`}>Count</th>
              <th className={`${HEADER_CELL} text-left`}>Deviate to</th>
            </tr>
          </thead>
          <tbody>
            {INDEX_PLAYS.map((play, i) => (
              <tr key={play.situationKey} className={i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/40'}>
                <td className={`whitespace-nowrap ${CELL_BORDER} px-3 py-1.5 text-slate-200`}>
                  {formatSituation(play.situationKey)}
                </td>
                <td className={`whitespace-nowrap ${CELL_BORDER} px-3 py-1.5 text-slate-400`}>
                  {play.direction === 'aboveOrEqual' ? `TC ≥ ${play.threshold}` : `TC < ${play.threshold}`}
                </td>
                <td className={`whitespace-nowrap ${CELL_BORDER} px-3 py-1.5 font-semibold ${ACTION_STYLE[play.deviateTo]}`}>
                  {play.deviateTo}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="max-w-xl text-xs text-slate-500">
        This is 14 plays, not 18 — the real Illustrious 18 has two Split-based entries (10,10 vs 5
        and vs 6) this app can't represent, since it never models player-side Split outside Live
        Play, and one entry (11 vs Ace, Double at TC≥+1) that's a genuine no-op here because this
        app's chart always Doubles hard 11 regardless of the dealer's upcard. Rather than hand-add
        those four to this table (which would then not match what the app actually grades), this
        list shows exactly the 14 the engine checks.
      </p>
    </section>
  )
}

function CountingBasicsSection() {
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const
  const plusOne = ranks.filter((r) => hiLoValue(r) === 1)
  const zero = ranks.filter((r) => hiLoValue(r) === 0)
  const minusOne = ranks.filter((r) => hiLoValue(r) === -1)

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-white">How to Count — Basics</h2>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold text-slate-200">The running count</h3>
        <p className="text-sm text-slate-300">
          Hi-Lo is the counting system this app uses everywhere. Every card you see has a value; keep
          a running total in your head as cards are dealt — that's your <strong>running count</strong>.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-slate-200">Card values</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded border border-red-900/50 bg-red-950/30 p-3 text-center">
            <p className="text-lg font-bold text-red-300">+1</p>
            <p className="text-xs text-red-200/80">{plusOne.join(', ')}</p>
          </div>
          <div className="rounded border border-slate-700 bg-slate-800/50 p-3 text-center">
            <p className="text-lg font-bold text-slate-300">0</p>
            <p className="text-xs text-slate-400">{zero.join(', ')}</p>
          </div>
          <div className="rounded border border-sky-900/50 bg-sky-950/30 p-3 text-center">
            <p className="text-lg font-bold text-sky-300">−1</p>
            <p className="text-xs text-sky-200/80">{minusOne.join(', ')}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold text-slate-200">Reading the count</h3>
        <p className="text-sm text-slate-300">
          A higher running count means more low cards have already come out, so the remaining shoe is
          richer in tens and aces — good for the player. A full, freshly-shuffled shoe always nets to
          exactly 0, since Hi-Lo is balanced (every value below cancels one above). Practice this with
          the Running Count drill.
        </p>
      </div>
    </section>
  )
}

function CountingAdvancedSection() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-white">How to Count — Advanced</h2>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold text-slate-200">True count</h3>
        <p className="text-sm text-slate-300">
          The running count alone isn't enough once a shoe has more than one deck — a count of +6
          means very different things with 5 decks left versus half a deck left. Converting to a{' '}
          <strong>true count</strong> normalizes for that:
        </p>
        <p className="rounded border border-slate-700 bg-slate-800/50 p-3 text-center font-mono text-sm text-slate-100">
          true count = running count ÷ decks remaining
        </p>
        <p className="text-xs text-slate-500">(rounded to the nearest whole number)</p>
        <p className="text-sm text-slate-300">
          Below about {MIN_DECKS_REMAINING} of a deck remaining, the count swings too wildly to
          estimate meaningfully, so decks-remaining is never treated as less than{' '}
          {MIN_DECKS_REMAINING} of a deck in that formula. Practice deck estimation and the
          conversion itself with the True Count drill.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-slate-200">Bet sizing by count</h3>
        <p className="text-sm text-slate-300">
          True count also drives bet sizing — the higher the count, the more the odds favor you, so
          the more you bet. This app's EV-optimal bet ramp (used in Live Play):
        </p>
        <div className="overflow-x-auto rounded border border-slate-700">
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                <th className={`${HEADER_CELL} text-left`}>True count</th>
                <th className={`${HEADER_CELL} text-left`}>Bet (units)</th>
              </tr>
            </thead>
            <tbody>
              {EV_BET_RAMP.map((step, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/40'}>
                  <td className={`whitespace-nowrap ${CELL_BORDER} px-3 py-1.5 text-slate-200`}>
                    {step.minTrueCount === -Infinity ? 'any' : `TC ≥ ${step.minTrueCount}`}
                  </td>
                  <td className={`whitespace-nowrap ${CELL_BORDER} px-3 py-1.5 text-slate-200`}>{step.units}u</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export function GuidesView({ rules }: { rules: RuleConfig }) {
  return (
    <div className={`${PAGE_WRAPPER} pb-12`}>
      <p className={SECTION_LABEL}>Guides &amp; Reference</p>
      <StrategyChartSection rules={rules} />
      <IllustriousEighteenSection />
      <CountingBasicsSection />
      <CountingAdvancedSection />
    </div>
  )
}
