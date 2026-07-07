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
import { CasinoTable } from './components/v2/table/CasinoTable'
import { Lobby, type ModeId } from './components/Lobby'
import { ModeSwitcher } from './components/ModeSwitcher'
import { Modal } from './components/Modal'
import { GlobalSettingsModal } from './components/GlobalSettingsModal'
import { TrainingSessionRecord } from './components/TrainingSessionRecord'
import { StrategyHeatmapSection } from './components/StrategyHeatmapSection'
import { IndexPlayHeatmapSection } from './components/IndexPlayHeatmapSection'
import { GuidesView } from './components/GuidesView'
import { SECTION_LABEL } from './components/theme'
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

type ActiveOverlay = 'settings' | 'guides' | 'overview' | null

function App() {
  const [currentMode, setCurrentMode] = useState<ModeId | null>(null)
  // Single overlay state (not independent booleans) so at most one modal is
  // ever mounted — avoids an Escape-key ambiguity a three-booleans model
  // would have. Starts on 'overview' so first load shows the mode picker.
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>('overview')
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

  function handleEnterMode(mode: ModeId) {
    setCurrentMode(mode)
    setActiveOverlay(null)
  }

  const v1State = loadState()
  const strategySnapshot = {
    handsPlayed: v1State.handsPlayed,
    currentStreak: v1State.currentStreak,
    lifetimeAccuracy: lifetimeAccuracy(v1State.stats).accuracy,
  }

  const { settings, progress } = counting

  // Only the two timer/keydown-driven modes need this — an overlay sitting
  // on top of a running Shoe Countdown must pause its stopwatch AND its
  // window-level Space/Enter shortcut, or the shoe could silently advance
  // underneath the overlay.
  const isPaused = activeOverlay !== null

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
            isPaused={isPaused}
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
            isPaused={isPaused}
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
    <div className="flex min-h-screen flex-col bg-slate-900 text-white">
      {/* The "must fit one screen" shell: header + whichever mode is active.
          Fixed to 100dvh (not min-height) so this region's own height never
          depends on what's below it — the flex-1/min-h-0 mode-content area
          gets exactly (100dvh - header's real height), purely from flex
          layout, no JS measurement. overflow-y-auto is a safety net for a
          HUD that genuinely can't shrink enough (degrades to an internal
          scrollbar) rather than clipping content; it doesn't engage in the
          ordinary case. Anything below this shell (heatmap, training log)
          lives in normal page flow and is reached by scrolling past it. */}
      <div className="flex h-[100dvh] flex-col overflow-y-auto">
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-800 px-2 py-1 sm:px-4 sm:py-1.5">
          <h1 className="shrink-0 truncate text-sm font-semibold tracking-tight sm:text-lg">
            Double Down
          </h1>
          {/* Mode switcher lives inline in the header — folding it in here
              (rather than its own row below) removes an entire chrome row
              from the mode-content area's height budget. */}
          <div className="min-w-[140px] flex-1">
            <ModeSwitcher currentMode={currentMode} onChange={handleEnterMode} />
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveOverlay('overview')}
              className="rounded-md bg-slate-800 px-1.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-700 sm:px-2.5"
            >
              📊 Progress
            </button>
            <button
              type="button"
              onClick={() => setActiveOverlay('guides')}
              className="rounded-md bg-slate-800 px-1.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-700 sm:px-2.5"
            >
              📖 Guides
            </button>
            <button
              type="button"
              onClick={() => setActiveOverlay('settings')}
              className="rounded-md bg-slate-800 px-1.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-700 sm:px-2.5"
            >
              ⚙ Settings
            </button>
          </div>
        </header>

        {/* Persistent table/play area. currentMode === null shows a neutral,
            empty table (CasinoTable's own defaults handle every prop except
            dealerSlot/seatContents) rather than a full-page Lobby. */}
        <div className="flex flex-1 min-h-0">
          {currentMode === null ? (
            <div className="flex h-full w-full flex-col items-center gap-2 px-2 py-2">
              <div
                className="flex w-full flex-1 min-h-0 items-center justify-center"
                style={{ containerType: 'size' }}
              >
                <CasinoTable dealerSlot={<p className={SECTION_LABEL}>Dealer</p>} seatContents={[]} />
              </div>
            </div>
          ) : (
            renderMode()
          )}
        </div>
      </div>

      {currentMode === 'strategy' && <StrategyHeatmapSection />}
      {currentMode === 'indexPlays' && <IndexPlayHeatmapSection />}
      <TrainingSessionRecord />

      {activeOverlay === 'overview' && (
        <Modal title="Progress" onClose={() => setActiveOverlay(null)}>
          <Lobby
            strategySnapshot={strategySnapshot}
            countingProgress={progress}
            numDecks={settings.numDecks}
            onEnter={handleEnterMode}
          />
        </Modal>
      )}

      {activeOverlay === 'guides' && (
        <Modal title="Guides" onClose={() => setActiveOverlay(null)}>
          <GuidesView />
        </Modal>
      )}

      {activeOverlay === 'settings' && (
        <GlobalSettingsModal
          onClose={() => setActiveOverlay(null)}
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
