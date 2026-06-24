import { useEffect, useState } from 'react'
import { TabButton } from './TabButton'
import { RunningCountDrill } from './RunningCountDrill'
import { TrueCountDrill } from './TrueCountDrill'
import { ShoeCountdownDrill } from './ShoeCountdownDrill'
import { CountingSettingsPanel } from './CountingSettingsPanel'
import {
  type CountingProgress,
  type CountingSettings,
  loadCountingState,
  resetCountingProgress,
  saveCountingState,
} from '../lib/persistence'

type DrillTab = 'running' | 'true' | 'countdown' | 'settings'

export function CardCountingTrainer() {
  const [tab, setTab] = useState<DrillTab>('running')
  const [persisted] = useState(() => loadCountingState())
  const [settings, setSettings] = useState<CountingSettings>(persisted.settings)
  const [progress, setProgress] = useState<CountingProgress>(persisted.progress)

  useEffect(() => {
    saveCountingState({ settings, progress })
  }, [settings, progress])

  function handleResetProgress() {
    setProgress(resetCountingProgress({ settings, progress }).progress)
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="mt-6 max-w-md text-center text-sm text-slate-400">
        Trained from the surveillance side, not the player's: you're counting tables down from the observer's seat —
        across multiple hands at once, estimating deck depth without being handed the number — the way casino
        surveillance actually works a shoe, not how a player works one.
      </p>
      <nav className="mt-4 flex flex-wrap justify-center gap-2">
        <TabButton active={tab === 'running'} onClick={() => setTab('running')}>
          Running Count
        </TabButton>
        <TabButton active={tab === 'true'} onClick={() => setTab('true')}>
          True Count
        </TabButton>
        <TabButton active={tab === 'countdown'} onClick={() => setTab('countdown')}>
          Shoe Countdown
        </TabButton>
        <TabButton active={tab === 'settings'} onClick={() => setTab('settings')}>
          Settings
        </TabButton>
      </nav>
      {tab === 'running' && (
        <RunningCountDrill
          numDecks={settings.numDecks}
          seatCount={settings.seatCount}
          cardsPerSecond={settings.cardsPerSecond}
          initialProgress={progress.runningCount}
          onProgressChange={(runningCount) => setProgress((prev) => ({ ...prev, runningCount }))}
        />
      )}
      {tab === 'true' && (
        <TrueCountDrill
          numDecks={settings.numDecks}
          initialProgress={progress.trueCount}
          onProgressChange={(trueCount) => setProgress((prev) => ({ ...prev, trueCount }))}
        />
      )}
      {tab === 'countdown' && (
        <ShoeCountdownDrill
          numDecks={settings.numDecks}
          personalBests={progress.shoeCountdown.personalBests}
          onPersonalBestsChange={(personalBests) =>
            setProgress((prev) => ({ ...prev, shoeCountdown: { personalBests } }))
          }
        />
      )}
      {tab === 'settings' && (
        <CountingSettingsPanel
          settings={settings}
          onSettingsChange={setSettings}
          progress={progress}
          onResetProgress={handleResetProgress}
        />
      )}
    </div>
  )
}
