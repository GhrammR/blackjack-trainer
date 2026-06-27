import { useEffect, useState } from 'react'
import { BasicStrategyMode } from './components/v2/modes/BasicStrategyMode'
import { CardCountingTrainer } from './components/CardCountingTrainer'
import { LivePlayDrill } from './components/LivePlayDrill'
import { TabButton } from './components/TabButton'
import { GlobalSettingsModal } from './components/GlobalSettingsModal'
import {
  type CountingProgress,
  clearState,
  loadCountingState,
  loadState,
  resetCountingProgress,
  saveCountingState,
} from './lib/persistence'
import { lifetimeAccuracy } from './lib/mastery'

type Tab = 'strategy' | 'counting' | 'livePlay'

function App() {
  const [tab, setTab] = useState<Tab>('strategy')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [strategyResetKey, setStrategyResetKey] = useState(0)
  const [counting, setCounting] = useState(() => loadCountingState())

  useEffect(() => {
    saveCountingState(counting)
  }, [counting])

  function handleProgressChange(progress: CountingProgress) {
    setCounting((prev) => ({ ...prev, progress }))
  }

  function handleLivePlayProgressChange(livePlay: CountingProgress['livePlay']) {
    setCounting((prev) => ({ ...prev, progress: { ...prev.progress, livePlay } }))
  }

  function handleResetStrategy() {
    clearState()
    setStrategyResetKey((k) => k + 1)
  }

  function handleResetCounting() {
    setCounting((prev) => resetCountingProgress(prev))
  }

  function handleResetAll() {
    handleResetStrategy()
    handleResetCounting()
  }

  const strategySnapshot = (() => {
    const persisted = loadState()
    return {
      handsPlayed: persisted.handsPlayed,
      currentStreak: persisted.currentStreak,
      lifetimeAccuracy: lifetimeAccuracy(persisted.stats).accuracy,
    }
  })()

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="relative border-b border-slate-800 pb-6 pt-10">
        <h1 className="text-center text-4xl font-semibold tracking-tight">Double Down</h1>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="absolute right-4 top-4 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700"
        >
          ⚙ Settings
        </button>
      </header>
      <nav className="mt-6 flex justify-center gap-2">
        <TabButton active={tab === 'strategy'} onClick={() => setTab('strategy')}>
          Strategy Trainer
        </TabButton>
        <TabButton active={tab === 'counting'} onClick={() => setTab('counting')}>
          Card Counting
        </TabButton>
        <TabButton active={tab === 'livePlay'} onClick={() => setTab('livePlay')}>
          Live Play
        </TabButton>
      </nav>
      {tab === 'strategy' && <BasicStrategyMode key={strategyResetKey} />}
      {tab === 'counting' && (
        <CardCountingTrainer
          settings={counting.settings}
          progress={counting.progress}
          onProgressChange={handleProgressChange}
          isPaused={settingsOpen}
        />
      )}
      {tab === 'livePlay' && (
        <LivePlayDrill
          numDecks={counting.settings.numDecks}
          initialProgress={counting.progress.livePlay}
          onProgressChange={handleLivePlayProgressChange}
        />
      )}
      {settingsOpen && (
        <GlobalSettingsModal
          onClose={() => setSettingsOpen(false)}
          countingSettings={counting.settings}
          onCountingSettingsChange={(settings) => setCounting((prev) => ({ ...prev, settings }))}
          countingProgress={counting.progress}
          strategySnapshot={strategySnapshot}
          onResetStrategy={handleResetStrategy}
          onResetCounting={handleResetCounting}
          onResetAll={handleResetAll}
        />
      )}
    </div>
  )
}

export default App
