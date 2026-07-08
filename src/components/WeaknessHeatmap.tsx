import { DEALER_KEYS, HARD_TOTALS, PAIR_RANKS, SOFT_TOTALS } from '../lib/handGenerator'
import { type Stats, getStat, recentAccuracy } from '../lib/adaptiveEngine'
import { categoryMastery } from '../lib/mastery'
import { heatColor } from '../lib/heatColor'
import type { Category } from '../types'

function Cell({ situationKey, stats }: { situationKey: string; stats: Stats }) {
  const stat = getStat(stats, situationKey)
  const seen = stat.attempts > 0
  const accuracy = recentAccuracy(stat)

  return (
    <div
      title={`${situationKey}: ${seen ? `${Math.round(accuracy * 100)}% recent accuracy` : 'not seen yet'}`}
      className="flex h-7 w-9 items-center justify-center rounded text-[10px] font-medium text-white"
      style={{ backgroundColor: heatColor(accuracy, seen) }}
    >
      {seen ? Math.round(accuracy * 100) : '–'}
    </div>
  )
}

interface CategoryGridProps {
  title: string
  category: Category
  rows: (string | number)[]
  prefix: 'hard' | 'soft' | 'pair'
  stats: Stats
}

function CategoryGrid({ title, category, rows, prefix, stats }: CategoryGridProps) {
  const mastery = categoryMastery(stats, category)

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h3>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
            mastery.isStrong ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
          }`}
        >
          {mastery.isStrong ? 'Strong' : 'Needs work'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="w-9" />
              {DEALER_KEYS.map((d) => (
                <th key={d} className="px-0.5 text-xs font-normal text-slate-400">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row}>
                <td className="pr-1 text-right text-xs text-slate-400">{row}</td>
                {DEALER_KEYS.map((d) => (
                  <td key={d} className="p-0.5">
                    <Cell situationKey={`${prefix}-${row}-vs-${d}`} stats={stats} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface WeaknessHeatmapProps {
  stats: Stats
}

export function WeaknessHeatmap({ stats }: WeaknessHeatmapProps) {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-6 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
      <h2 className="text-center text-lg font-semibold text-white">Weakness Heatmap</h2>
      <CategoryGrid title="Hard totals" category="hard" rows={HARD_TOTALS} prefix="hard" stats={stats} />
      <CategoryGrid title="Soft totals" category="soft" rows={SOFT_TOTALS} prefix="soft" stats={stats} />
      <CategoryGrid title="Pairs" category="pairs" rows={PAIR_RANKS} prefix="pair" stats={stats} />
    </div>
  )
}
