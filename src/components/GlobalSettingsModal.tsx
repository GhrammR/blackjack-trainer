import { useEffect, useState } from 'react'
import type { CountingModeKey, CountingProgress, CountingSettings } from '../lib/persistence'
import { CountingSettingsPanel } from './CountingSettingsPanel'
import { SECONDARY_BUTTON } from './theme'

export interface StrategySnapshot {
  handsPlayed: number
  currentStreak: number
  lifetimeAccuracy: number
}

interface GlobalSettingsModalProps {
  onClose: () => void
  countingSettings: CountingSettings
  onCountingSettingsChange: (settings: CountingSettings) => void
  countingProgress: CountingProgress
  bankroll: number
  onResetBankroll: () => void
  strategySnapshot: StrategySnapshot
  onResetStrategy: () => void
  onResetCounting: () => void
  onResetCountingMode: (mode: CountingModeKey) => void
  onResetAll: () => void
}

type ConfirmTarget = 'strategy' | 'counting' | 'all' | null

const RESET_COPY: Record<Exclude<ConfirmTarget, null>, { label: string; warning: string }> = {
  strategy: {
    label: 'Reset Strategy Trainer progress',
    warning: 'This clears your hand history, streak, and per-situation accuracy. This cannot be undone.',
  },
  counting: {
    label: 'Reset Card Counting progress',
    warning: 'This clears all counting personal bests and round history. Settings (shoe size, seats, speed) are kept. This cannot be undone.',
  },
  all: {
    label: 'Reset everything',
    warning: 'This clears BOTH Strategy Trainer and Card Counting progress. This cannot be undone.',
  },
}

// ── Per-mode reset (Feature A) ──────────────────────────────────────────────────
// A single mode's stats, independent of the broad Strategy/Counting/All resets
// above. 'strategy' here routes to the same onResetStrategy as the broad reset
// (it's already a single-mode store); every other entry clears just that one
// key of CountingProgress via onResetCountingMode, leaving the other eight
// counting modes and all settings untouched.

type ModeResetTarget = 'strategy' | CountingModeKey

const MODE_RESET_OPTIONS: { key: ModeResetTarget; label: string }[] = [
  { key: 'strategy', label: 'Basic Strategy' },
  { key: 'twoBets', label: 'Two Bets in a Circle' },
  { key: 'runningCount', label: 'Running Count' },
  { key: 'trueCount', label: 'True Count' },
  { key: 'shoeCountdown', label: 'Shoe Countdown' },
  { key: 'indexPlays', label: 'Index Plays' },
  { key: 'detection', label: 'Counter Detection' },
  { key: 'tableScan', label: 'Table Scan' },
  { key: 'evidence', label: 'Evidence Flagging' },
  { key: 'evasion', label: 'Evasion' },
  { key: 'livePlay', label: 'Live Play' },
]

export function GlobalSettingsModal({
  onClose,
  countingSettings,
  onCountingSettingsChange,
  countingProgress,
  bankroll,
  onResetBankroll,
  strategySnapshot,
  onResetStrategy,
  onResetCounting,
  onResetCountingMode,
  onResetAll,
}: GlobalSettingsModalProps) {
  const [confirming, setConfirming] = useState<ConfirmTarget>(null)
  const [selectedMode, setSelectedMode] = useState<ModeResetTarget>('strategy')
  const [confirmingMode, setConfirmingMode] = useState(false)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleConfirm(target: Exclude<ConfirmTarget, null>) {
    if (target === 'strategy') onResetStrategy()
    else if (target === 'counting') onResetCounting()
    else onResetAll()
    setConfirming(null)
  }

  function handleConfirmMode() {
    if (selectedMode === 'strategy') onResetStrategy()
    else onResetCountingMode(selectedMode)
    setConfirmingMode(false)
  }

  const selectedModeLabel = MODE_RESET_OPTIONS.find((m) => m.key === selectedMode)?.label ?? ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col gap-6 overflow-y-auto rounded-lg bg-slate-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        <section className="flex flex-col gap-2 rounded-lg bg-slate-800/50 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Strategy Trainer</h3>
          <p className="text-sm text-slate-300">
            {strategySnapshot.handsPlayed} hands played · {Math.round(strategySnapshot.lifetimeAccuracy * 100)}% lifetime
            accuracy · streak {strategySnapshot.currentStreak}
          </p>
        </section>

        <CountingSettingsPanel
          settings={countingSettings}
          onSettingsChange={onCountingSettingsChange}
          progress={countingProgress}
          bankroll={bankroll}
          onResetBankroll={onResetBankroll}
        />

        <section className="flex flex-col gap-3 rounded-lg bg-slate-800/50 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Reset a single mode</h3>

          {!confirmingMode ? (
            <div className="flex items-center gap-2">
              <select
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value as ModeResetTarget)}
                className="flex-1 rounded bg-slate-800 px-2 py-1.5 text-sm text-white"
              >
                {MODE_RESET_OPTIONS.map(({ key, label }) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setConfirmingMode(true)}
                className="shrink-0 rounded-md bg-red-900/60 px-4 py-1.5 text-sm font-medium text-red-200 transition hover:bg-red-900"
              >
                Reset
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-sm text-red-300">
                This clears only {selectedModeLabel}'s stats — every other mode is untouched. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmMode}
                  className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
                >
                  Confirm
                </button>
                <button type="button" onClick={() => setConfirmingMode(false)} className={SECONDARY_BUTTON}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-lg bg-slate-800/50 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Reset</h3>

          {confirming === null ? (
            <>
              <button
                type="button"
                onClick={() => setConfirming('strategy')}
                className="rounded-md bg-red-900/60 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-900"
              >
                {RESET_COPY.strategy.label}
              </button>
              <button
                type="button"
                onClick={() => setConfirming('counting')}
                className="rounded-md bg-red-900/60 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-900"
              >
                {RESET_COPY.counting.label}
              </button>
              <hr className="border-slate-700" />
              <button
                type="button"
                onClick={() => setConfirming('all')}
                className="rounded-md bg-red-900/60 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-900"
              >
                {RESET_COPY.all.label}
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-sm text-red-300">{RESET_COPY[confirming].warning}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleConfirm(confirming)}
                  className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
                >
                  Confirm
                </button>
                <button type="button" onClick={() => setConfirming(null)} className={SECONDARY_BUTTON}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
