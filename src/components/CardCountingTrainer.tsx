import { useState } from 'react'
import { TabButton } from './TabButton'
import { RunningCountDrill } from './RunningCountDrill'
import { TrueCountDrill } from './TrueCountDrill'

type DrillTab = 'running' | 'true'

export function CardCountingTrainer() {
  const [tab, setTab] = useState<DrillTab>('running')

  return (
    <div className="flex flex-col items-center gap-2">
      <nav className="mt-4 flex justify-center gap-2">
        <TabButton active={tab === 'running'} onClick={() => setTab('running')}>
          Running Count
        </TabButton>
        <TabButton active={tab === 'true'} onClick={() => setTab('true')}>
          True Count
        </TabButton>
      </nav>
      {tab === 'running' ? <RunningCountDrill /> : <TrueCountDrill />}
    </div>
  )
}
