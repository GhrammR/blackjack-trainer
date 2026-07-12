import { SHOE_SIZE_OPTIONS } from '../lib/shoe'
import type { CountingProgress, CountingSettings } from '../lib/persistence'
import { formatPace, formatSeconds } from '../lib/format'
import { DEAL_SPEEDS, DEAL_SPEED_LABELS, type DealSpeed } from '../lib/dealSpeed'

const SEAT_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6] as const

interface CountingSettingsPanelProps {
  settings: CountingSettings
  onSettingsChange: (settings: CountingSettings) => void
  progress: CountingProgress
  bankroll: number
  onResetBankroll: () => void
}

function accuracyLabel(correct: number, attempts: number): string {
  if (attempts === 0) return '—'
  return `${Math.round((correct / attempts) * 100)}%`
}

export function CountingSettingsPanel({ settings, onSettingsChange, progress, bankroll, onResetBankroll }: CountingSettingsPanelProps) {
  const fullCountdownBests = Object.entries(progress.shoeCountdown.fullCountdown.personalBests)
    .map(([decks, best]) => [Number(decks), best] as const)
    .sort((a, b) => a[0] - b[0])
  const missingCardsBests = Object.entries(progress.shoeCountdown.missingCards.personalBests)
    .map(([decks, best]) => [Number(decks), best] as const)
    .sort((a, b) => a[0] - b[0])
  const fullCountdown = progress.shoeCountdown.fullCountdown
  const missingCards = progress.shoeCountdown.missingCards

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
          Seats (Running Count, Table Scan)
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
          Dealer pace (Running Count)
          <select
            value={settings.dealSpeed}
            onChange={(e) => onSettingsChange({ ...settings, dealSpeed: e.target.value as DealSpeed })}
            className="rounded bg-slate-800 px-2 py-1 text-white"
          >
            {DEAL_SPEEDS.map((s) => (
              <option key={s} value={s}>
                {DEAL_SPEED_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2 text-slate-300">
          Dealer soft 17 (Basic Strategy, Live Play)
          <select
            value={settings.soft17Rule}
            onChange={(e) => onSettingsChange({ ...settings, soft17Rule: e.target.value as CountingSettings['soft17Rule'] })}
            className="rounded bg-slate-800 px-2 py-1 text-white"
          >
            <option value="H17">Hits (H17)</option>
            <option value="S17">Stands (S17)</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-2 text-slate-300">
          Surrender (Basic Strategy, Live Play)
          <select
            value={settings.surrenderMode}
            onChange={(e) => onSettingsChange({ ...settings, surrenderMode: e.target.value as CountingSettings['surrenderMode'] })}
            className="rounded bg-slate-800 px-2 py-1 text-white"
          >
            <option value="none">Off</option>
            <option value="late">Late</option>
          </select>
        </label>
        <div className="flex items-center justify-between gap-2 text-slate-300">
          Counting system
          <span className="text-slate-500">Hi-Lo</span>
        </div>
      </section>

      <section className="flex w-full flex-col gap-3 rounded-lg bg-slate-800/50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Chip Wager (Basic Strategy, Live Play)</h2>
        <p className="text-sm text-slate-300">
          Current bankroll: <span className="font-semibold text-white">${bankroll.toFixed(0)}</span>
        </p>
        <label className="flex items-center justify-between gap-2 text-slate-300">
          Starting bankroll
          <input
            type="number"
            min={0}
            step={50}
            value={settings.startingBankroll}
            onChange={(e) => {
              const value = Number(e.target.value)
              if (Number.isFinite(value) && value >= 0) onSettingsChange({ ...settings, startingBankroll: value })
            }}
            className="w-24 rounded bg-slate-800 px-2 py-1 text-right text-white"
          />
        </label>
        <p className="text-xs text-slate-500">
          Takes effect the next time you reset the bankroll below — it doesn't change your current chips.
        </p>
        <button
          type="button"
          onClick={onResetBankroll}
          className="self-start rounded-md bg-red-900/60 px-4 py-1.5 text-sm font-medium text-red-200 transition hover:bg-red-900"
        >
          Reset Bankroll to ${settings.startingBankroll}
        </button>
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
          <p>
            Shoe Countdown — Full Countdown: {fullCountdown.attempts} attempts ·{' '}
            {accuracyLabel(fullCountdown.correct, fullCountdown.attempts)} correct
          </p>
          {fullCountdownBests.length === 0 ? (
            <p className="text-slate-500">No runs yet.</p>
          ) : (
            <ul className="ml-4 list-disc">
              {fullCountdownBests.map(([decks, best]) => (
                <li key={decks}>
                  {decks} deck{decks > 1 ? 's' : ''}: {formatPace(best.ms / best.cards)} ({formatSeconds(best.ms)})
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="text-sm text-slate-300">
          <p>
            Shoe Countdown — Missing Cards: {missingCards.attempts} attempts ·{' '}
            {accuracyLabel(missingCards.correct, missingCards.attempts)} correct
          </p>
          {missingCardsBests.length === 0 ? (
            <p className="text-slate-500">No runs yet.</p>
          ) : (
            <ul className="ml-4 list-disc">
              {missingCardsBests.map(([decks, best]) => (
                <li key={decks}>
                  {decks} deck{decks > 1 ? 's' : ''}: {formatPace(best.ms / best.cards)} ({formatSeconds(best.ms)})
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
