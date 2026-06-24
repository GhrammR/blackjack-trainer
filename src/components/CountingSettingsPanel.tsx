import { SHOE_SIZE_OPTIONS } from '../lib/shoe'
import type { CountingProgress, CountingSettings } from '../lib/persistence'
import { formatSeconds } from '../lib/format'

const SEAT_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6] as const
const SPEED_OPTIONS = [1, 2, 3, 4] as const

interface CountingSettingsPanelProps {
  settings: CountingSettings
  onSettingsChange: (settings: CountingSettings) => void
  progress: CountingProgress
}

function accuracyLabel(correct: number, attempts: number): string {
  if (attempts === 0) return '—'
  return `${Math.round((correct / attempts) * 100)}%`
}

export function CountingSettingsPanel({ settings, onSettingsChange, progress }: CountingSettingsPanelProps) {
  const personalBestEntries = Object.entries(progress.shoeCountdown.personalBests)
    .map(([decks, ms]) => [Number(decks), ms] as const)
    .sort((a, b) => a[0] - b[0])

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <section className="flex w-full flex-col gap-3 rounded-lg bg-slate-800/50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Settings</h2>
        <label className="flex items-center justify-between gap-2 text-slate-300">
          Shoe size
          <select
            value={settings.numDecks}
            onChange={(e) => onSettingsChange({ ...settings, numDecks: Number(e.target.value) })}
            className="rounded bg-slate-800 px-2 py-1 text-white"
          >
            {SHOE_SIZE_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} deck{d > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2 text-slate-300">
          Seats (Running Count)
          <select
            value={settings.seatCount}
            onChange={(e) => onSettingsChange({ ...settings, seatCount: Number(e.target.value) })}
            className="rounded bg-slate-800 px-2 py-1 text-white"
          >
            {SEAT_COUNT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s} seat{s > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2 text-slate-300">
          Speed (Running Count)
          <select
            value={settings.cardsPerSecond}
            onChange={(e) => onSettingsChange({ ...settings, cardsPerSecond: Number(e.target.value) })}
            className="rounded bg-slate-800 px-2 py-1 text-white"
          >
            {SPEED_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s} cards/sec
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center justify-between gap-2 text-slate-300">
          Counting system
          <span className="text-slate-500">Hi-Lo</span>
        </div>
      </section>

      <section className="flex w-full flex-col gap-2 rounded-lg bg-slate-800/50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Progress</h2>
        <p className="text-sm text-slate-300">
          Running Count: {progress.runningCount.roundsPlayed} rounds ·{' '}
          {accuracyLabel(progress.runningCount.roundsCorrect, progress.runningCount.roundsPlayed)} accuracy
        </p>
        <p className="text-sm text-slate-300">
          True Count: {progress.trueCount.roundsPlayed} scenarios ·{' '}
          {accuracyLabel(progress.trueCount.goodEstimates, progress.trueCount.roundsPlayed)} good estimates ·{' '}
          {accuracyLabel(progress.trueCount.correctMath, progress.trueCount.roundsPlayed)} correct math
        </p>
        <div className="text-sm text-slate-300">
          <p>Shoe Countdown personal bests:</p>
          {personalBestEntries.length === 0 ? (
            <p className="text-slate-500">No runs yet.</p>
          ) : (
            <ul className="ml-4 list-disc">
              {personalBestEntries.map(([decks, ms]) => (
                <li key={decks}>
                  {decks} deck{decks > 1 ? 's' : ''}: {formatSeconds(ms)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
