import { STREAK_TARGET } from '../lib/mastery'
import type { LifetimeAccuracy } from '../lib/mastery'

interface ProgressPanelProps {
  currentStreak: number
  lifetime: LifetimeAccuracy
}

export function ProgressPanel({ currentStreak, lifetime }: ProgressPanelProps) {
  const streakPct = Math.min(100, (currentStreak / STREAK_TARGET) * 100)
  const accuracyPct = Math.round(lifetime.accuracy * 100)

  return (
    <div className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-sm uppercase tracking-wide text-slate-400">Perfect streak</span>
          <span className="font-semibold text-white">
            {currentStreak} / {STREAK_TARGET}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${streakPct}%` }} />
        </div>
      </div>

      <div className="flex justify-between text-sm text-slate-300">
        <span>
          Lifetime accuracy: <span className="font-semibold text-white">{accuracyPct}%</span>
        </span>
        <span>
          Hands played: <span className="font-semibold text-white">{lifetime.attempts}</span>
        </span>
      </div>
    </div>
  )
}
