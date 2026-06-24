import { useState } from 'react'
import { TabButton } from './TabButton'
import { RunningCountDrill } from './RunningCountDrill'
import { TrueCountDrill } from './TrueCountDrill'
import { ShoeCountdownDrill } from './ShoeCountdownDrill'
import { DetectionDrill } from './DetectionDrill'
import { TableScanDrill } from './TableScanDrill'
import type { CountingProgress, CountingSettings } from '../lib/persistence'

type DrillTab = 'running' | 'true' | 'countdown' | 'detection' | 'tableScan'

interface CardCountingTrainerProps {
  settings: CountingSettings
  progress: CountingProgress
  onProgressChange: (progress: CountingProgress) => void
  isPaused: boolean
}

export function CardCountingTrainer({ settings, progress, onProgressChange, isPaused }: CardCountingTrainerProps) {
  const [tab, setTab] = useState<DrillTab>('running')

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
        <TabButton active={tab === 'detection'} onClick={() => setTab('detection')}>
          Counter Detection
        </TabButton>
        <TabButton active={tab === 'tableScan'} onClick={() => setTab('tableScan')}>
          Table Scan
        </TabButton>
      </nav>
      {tab === 'running' && (
        <RunningCountDrill
          numDecks={settings.numDecks}
          seatCount={settings.seatCount}
          cardsPerSecond={settings.cardsPerSecond}
          initialProgress={progress.runningCount}
          onProgressChange={(runningCount) => onProgressChange({ ...progress, runningCount })}
          isPaused={isPaused}
        />
      )}
      {tab === 'true' && (
        <TrueCountDrill
          numDecks={settings.numDecks}
          initialProgress={progress.trueCount}
          onProgressChange={(trueCount) => onProgressChange({ ...progress, trueCount })}
        />
      )}
      {tab === 'countdown' && (
        <ShoeCountdownDrill
          numDecks={settings.numDecks}
          personalBests={progress.shoeCountdown.personalBests}
          onPersonalBestsChange={(personalBests) => onProgressChange({ ...progress, shoeCountdown: { personalBests } })}
          isPaused={isPaused}
        />
      )}
      {tab === 'detection' && (
        <DetectionDrill
          numDecks={settings.numDecks}
          initialProgress={progress.detection}
          onProgressChange={(detection) => onProgressChange({ ...progress, detection })}
        />
      )}
      {tab === 'tableScan' && (
        <TableScanDrill
          numDecks={settings.numDecks}
          seatCount={settings.seatCount}
          initialProgress={progress.tableScan}
          onProgressChange={(tableScan) => onProgressChange({ ...progress, tableScan })}
        />
      )}
    </div>
  )
}
