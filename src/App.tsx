import { useState } from 'react'
import { StrategyTrainer } from './components/StrategyTrainer'
import { CardCountingTrainer } from './components/CardCountingTrainer'

type Tab = 'strategy' | 'counting'

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-4 py-2 font-medium transition ${
        active ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

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
