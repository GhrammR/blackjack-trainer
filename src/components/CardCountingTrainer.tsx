import { useState } from 'react'
import { TabButton } from './TabButton'
import { RunningCountDrill } from './RunningCountDrill'
import { TrueCountDrill } from './TrueCountDrill'
import { ShoeCountdownDrill } from './ShoeCountdownDrill'

type DrillTab = 'running' | 'true' | 'countdown'

export function CardCountingTrainer() {
  const [tab, setTab] = useState<DrillTab>('running')

  return (
    <div className="flex flex-col items-center gap-2">
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
      </nav>
      {tab === 'running' && <RunningCountDrill />}
      {tab === 'true' && <TrueCountDrill />}
      {tab === 'countdown' && <ShoeCountdownDrill />}
    </div>
  )
}
