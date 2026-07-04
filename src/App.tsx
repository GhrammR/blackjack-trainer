import { useEffect, useState } from 'react'
import { BasicStrategyMode } from './components/v2/modes/BasicStrategyMode'
import { RunningCountMode } from './components/v2/modes/RunningCountMode'
import { TrueCountMode } from './components/v2/modes/TrueCountMode'
import { ShoeCountdownMode } from './components/v2/modes/ShoeCountdownMode'
import { IndexPlayMode } from './components/v2/modes/IndexPlayMode'
import { CounterDetectionMode } from './components/v2/modes/CounterDetectionMode'
import { TableScanMode } from './components/v2/modes/TableScanMode'
import { EvidenceFlaggingMode } from './components/v2/modes/EvidenceFlaggingMode'
import { EvasionMode } from './components/v2/modes/EvasionMode'
import { LivePlayMode } from './components/v2/modes/LivePlayMode'
import { Lobby, type ModeId } from './components/Lobby'
import { GlobalSettingsModal } from './components/GlobalSettingsModal'
import { TrainingSessionRecord } from './components/TrainingSessionRecord'
import {
  type CountingModeKey,
  type CountingProgress,
  clearState,
  loadCountingState,
  loadState,
  resetCountingMode,
  resetCountingProgress,
  saveCountingState,
} from './lib/persistence'
import { lifetimeAccuracy } from './lib/mastery'

function App() {
  const [currentMode, setCurrentMode] = useState<ModeId | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [strategyResetKey, setStrategyResetKey] = useState(0)
  const [counting, setCounting] = useState(() => loadCountingState())

  useEffect(() => {
    saveCountingState(counting)
  }, [counting])

  function handleProgressChange(progress: CountingProgress) {
    setCounting((prev) => ({ ...prev, progress }))
  }

  function handleResetStrategy() {
    clearState()
    setStrategyResetKey((k) => k + 1)
  }

  function handleResetCounting() {
    setCounting((prev) => resetCountingProgress(prev))
  }

  function handleResetCountingMode(mode: CountingModeKey) {
    setCounting((prev) => resetCountingMode(prev, mode))
  }

  function handleResetAll() {
    handleResetStrategy()
    handleResetCounting()
  }

  const v1State = loadState()
  const strategySnapshot = {
    handsPlayed: v1State.handsPlayed,
    currentStreak: v1State.currentStreak,
    lifetimeAccuracy: lifetimeAccuracy(v1State.stats).accuracy,
  }

  const { settings, progress } = counting

  function renderMode() {
    switch (currentMode) {
      case 'strategy':
        return <BasicStrategyMode key={strategyResetKey} />
      case 'runningCount':
        return (
          <RunningCountMode
            numDecks={settings.numDecks}
            seatCount={settings.seatCount}
            cardsPerSecond={settings.cardsPerSecond}
            initialProgress={progress.runningCount}
            onProgressChange={(runningCount) =>
              handleProgressChange({ ...progress, runningCount })
            }
            isPaused={settingsOpen}
          />
        )
      case 'trueCount':
        return (
          <TrueCountMode
            numDecks={settings.numDecks}
            initialProgress={progress.trueCount}
            onProgressChange={(trueCount) => handleProgressChange({ ...progress, trueCount })}
          />
        )
      case 'shoeCountdown':
        return (
          <ShoeCountdownMode
            numDecks={settings.numDecks}
            initialProgress={progress.shoeCountdown}
            onProgressChange={(shoeCountdown) => handleProgressChange({ ...progress, shoeCountdown })}
            isPaused={settingsOpen}
          />
        )
      case 'indexPlays':
        return (
          <IndexPlayMode
            initialProgress={progress.indexPlays}
            onProgressChange={(indexPlays) => handleProgressChange({ ...progress, indexPlays })}
          />
        )
      case 'counterDetection':
        return (
          <CounterDetectionMode
            numDecks={settings.numDecks}
            initialProgress={progress.detection}
            onProgressChange={(detection) => handleProgressChange({ ...progress, detection })}
          />
        )
      case 'tableScan':
        return (
          <TableScanMode
            numDecks={settings.numDecks}
            seatCount={settings.seatCount}
            initialProgress={progress.tableScan}
            onProgressChange={(tableScan) => handleProgressChange({ ...progress, tableScan })}
          />
        )
      case 'evidenceFlagging':
        return (
          <EvidenceFlaggingMode
            numDecks={settings.numDecks}
            initialProgress={progress.evidence}
            onProgressChange={(evidence) => handleProgressChange({ ...progress, evidence })}
          />
        )
      case 'evasion':
        return (
          <EvasionMode
            numDecks={settings.numDecks}
            initialProgress={progress.evasion}
            onProgressChange={(evasion) => handleProgressChange({ ...progress, evasion })}
          />
        )
      case 'livePlay':
        return (
          <LivePlayMode
            numDecks={settings.numDecks}
            initialProgress={progress.livePlay}
            onProgressChange={(livePlay) => handleProgressChange({ ...progress, livePlay })}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="flex items-center gap-2 border-b border-slate-800 px-2 py-3 sm:px-4 sm:py-4">
        <div className="flex w-16 shrink-0 justify-start sm:w-28">
          {currentMode !== null && (
            <button
              type="button"
              onClick={() => setCurrentMode(null)}
              className="rounded-md bg-slate-800 px-2 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 sm:px-3 sm:text-sm"
            >
              ← Back
            </button>
          )}
        </div>
        <h1 className="flex-1 truncate text-center text-lg font-semibold tracking-tight sm:text-3xl">
          Double Down
        </h1>
        <div className="flex w-16 shrink-0 justify-end sm:w-28">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-md bg-slate-800 px-2 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 sm:px-3 sm:text-sm"
          >
            ⚙ Settings
          </button>
        </div>
      </header>

      {currentMode === null ? (
        <Lobby
          strategySnapshot={strategySnapshot}
          countingProgress={progress}
          numDecks={settings.numDecks}
          onEnter={setCurrentMode}
        />
      ) : (
        renderMode()
      )}

      <TrainingSessionRecord />

      {settingsOpen && (
        <GlobalSettingsModal
          onClose={() => setSettingsOpen(false)}
          countingSettings={counting.settings}
          onCountingSettingsChange={(settings) => setCounting((prev) => ({ ...prev, settings }))}
          countingProgress={counting.progress}
          strategySnapshot={strategySnapshot}
          onResetStrategy={handleResetStrategy}
          onResetCounting={handleResetCounting}
          onResetCountingMode={handleResetCountingMode}
          onResetAll={handleResetAll}
        />
      )}
    </div>
  )
}

export default App
