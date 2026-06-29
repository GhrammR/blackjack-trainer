import { useState } from 'react'
import { TabButton } from './TabButton'
import { RunningCountMode } from './v2/modes/RunningCountMode'
import { TrueCountMode } from './v2/modes/TrueCountMode'
import { ShoeCountdownMode } from './v2/modes/ShoeCountdownMode'
import { CounterDetectionMode } from './v2/modes/CounterDetectionMode'
import { TableScanMode } from './v2/modes/TableScanMode'
import { EvidenceFlaggingMode } from './v2/modes/EvidenceFlaggingMode'
import { EvasionMode } from './v2/modes/EvasionMode'
import { IndexPlayMode } from './v2/modes/IndexPlayMode'
import type { CountingProgress, CountingSettings } from '../lib/persistence'

type DrillTab = 'running' | 'true' | 'countdown' | 'detection' | 'tableScan' | 'evidence' | 'evasion' | 'indexPlays'

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
        <TabButton active={tab === 'evidence'} onClick={() => setTab('evidence')}>
          Evidence Flagging
        </TabButton>
        <TabButton active={tab === 'evasion'} onClick={() => setTab('evasion')}>
          Evasion
        </TabButton>
        <TabButton active={tab === 'indexPlays'} onClick={() => setTab('indexPlays')}>
          Index Plays
        </TabButton>
      </nav>
      {tab === 'running' && (
        <RunningCountMode
          numDecks={settings.numDecks}
          seatCount={settings.seatCount}
          cardsPerSecond={settings.cardsPerSecond}
          initialProgress={progress.runningCount}
          onProgressChange={(runningCount) => onProgressChange({ ...progress, runningCount })}
          isPaused={isPaused}
        />
      )}
      {tab === 'true' && (
        <TrueCountMode
          numDecks={settings.numDecks}
          initialProgress={progress.trueCount}
          onProgressChange={(trueCount) => onProgressChange({ ...progress, trueCount })}
        />
      )}
      {tab === 'countdown' && (
        <ShoeCountdownMode
          numDecks={settings.numDecks}
          personalBests={progress.shoeCountdown.personalBests}
          onPersonalBestsChange={(personalBests) => onProgressChange({ ...progress, shoeCountdown: { personalBests } })}
          isPaused={isPaused}
        />
      )}
      {tab === 'detection' && (
        <CounterDetectionMode
          numDecks={settings.numDecks}
          initialProgress={progress.detection}
          onProgressChange={(detection) => onProgressChange({ ...progress, detection })}
        />
      )}
      {tab === 'tableScan' && (
        <TableScanMode
          numDecks={settings.numDecks}
          seatCount={settings.seatCount}
          initialProgress={progress.tableScan}
          onProgressChange={(tableScan) => onProgressChange({ ...progress, tableScan })}
        />
      )}
      {tab === 'evidence' && (
        <EvidenceFlaggingMode
          numDecks={settings.numDecks}
          initialProgress={progress.evidence}
          onProgressChange={(evidence) => onProgressChange({ ...progress, evidence })}
        />
      )}
      {tab === 'evasion' && (
        <EvasionMode
          numDecks={settings.numDecks}
          initialProgress={progress.evasion}
          onProgressChange={(evasion) => onProgressChange({ ...progress, evasion })}
        />
      )}
      {tab === 'indexPlays' && (
        <IndexPlayMode
          initialProgress={progress.indexPlays}
          onProgressChange={(indexPlays) => onProgressChange({ ...progress, indexPlays })}
        />
      )}
    </div>
  )
}
