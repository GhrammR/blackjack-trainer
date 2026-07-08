import { INDEX_PLAYS } from '../lib/indexPlays'
import { heatColor } from '../lib/heatColor'

function conditionText(play: (typeof INDEX_PLAYS)[number]): string {
  const cmp = play.direction === 'aboveOrEqual' ? '≥' : '<'
  return `TC ${cmp} ${play.threshold} → ${play.deviateTo}`
}

interface IndexPlayHeatmapProps {
  perDeviation: Record<string, { attempts: number; correct: number }>
}

/**
 * The Index Play analog of WeaknessHeatmap: instead of a hard/soft/pairs
 * grid (a decision point is a (total, dealer-upcard) pair), each row here is
 * one of the 14 `INDEX_PLAYS` entries — there's no natural 2D axis to grid
 * them on, so this renders a flat, per-deviation list instead.
 */
export function IndexPlayHeatmap({ perDeviation }: IndexPlayHeatmapProps) {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
      <h2 className="text-center text-lg font-semibold text-white">Index Play Weakness Chart</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="px-1 pb-1 text-left text-xs font-normal text-slate-400">Situation</th>
              <th className="px-1 pb-1 text-left text-xs font-normal text-slate-400">Deviation</th>
              <th className="px-1 pb-1 text-right text-xs font-normal text-slate-400">Attempts</th>
              <th className="px-1 pb-1 text-right text-xs font-normal text-slate-400">Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {INDEX_PLAYS.map((play) => {
              const stat = perDeviation[play.situationKey] ?? { attempts: 0, correct: 0 }
              const seen = stat.attempts > 0
              const accuracy = seen ? stat.correct / stat.attempts : 0
              return (
                <tr key={play.situationKey} className="border-t border-slate-700/60">
                  <td className="px-1 py-1 text-sm text-slate-200">{play.situationKey}</td>
                  <td className="px-1 py-1 text-xs text-slate-400">{conditionText(play)}</td>
                  <td className="px-1 py-1 text-right text-xs text-slate-400">{stat.attempts}</td>
                  <td className="px-1 py-1 text-right">
                    <span
                      title={seen ? `${Math.round(accuracy * 100)}% accuracy` : 'not seen yet'}
                      className="inline-block min-w-[2.5rem] rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                      style={{ backgroundColor: heatColor(accuracy, seen) }}
                    >
                      {seen ? `${Math.round(accuracy * 100)}%` : '–'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
