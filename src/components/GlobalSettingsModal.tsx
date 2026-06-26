import { useEffect, useState } from 'react'
import type { CountingProgress, CountingSettings } from '../lib/persistence'
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
  strategySnapshot: StrategySnapshot
  onResetStrategy: () => void
  onResetCounting: () => void
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

export function GlobalSettingsModal({
  onClose,
  countingSettings,
  onCountingSettingsChange,
  countingProgress,
  strategySnapshot,
  onResetStrategy,
  onResetCounting,
  onResetAll,
}: GlobalSettingsModalProps) {
  const [confirming, setConfirming] = useState<ConfirmTarget>(null)

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

        <CountingSettingsPanel settings={countingSettings} onSettingsChange={onCountingSettingsChange} progress={countingProgress} />

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
