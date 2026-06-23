import { useState } from 'react'
import { StrategyTrainer } from './components/StrategyTrainer'
import { CardCountingTrainer } from './components/CardCountingTrainer'
import { TabButton } from './components/TabButton'

type Tab = 'strategy' | 'counting'

function App() {
  const [tab, setTab] = useState<Tab>('strategy')

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <h1 className="pt-10 text-center text-4xl font-semibold">Double Down</h1>
      <nav className="mt-6 flex justify-center gap-2">
        <TabButton active={tab === 'strategy'} onClick={() => setTab('strategy')}>
          Strategy Trainer
        </TabButton>
        <TabButton active={tab === 'counting'} onClick={() => setTab('counting')}>
          Card Counting
        </TabButton>
      </nav>
      {tab === 'strategy' ? <StrategyTrainer /> : <CardCountingTrainer />}
    </div>
  )
}

export default App
