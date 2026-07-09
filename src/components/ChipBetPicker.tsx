import { PRIMARY_BUTTON, ERROR_TEXT } from './theme'

/**
 * Real-dollar chip wager, deliberately SEPARATE from Live Play's existing
 * bet-tier picker (BET_TIERS/correctBetUnits in livePlaySession.ts, used in
 * LivePlayMode's betting phase) — that picker grades abstract "units"
 * against EV-correctness for the count; this one wagers real dollars from
 * the bankroll and isn't graded at all. Flat betting only for now (a fixed
 * preset list, not count-driven) — see livePlaySession.ts's handPayout/
 * roundPayout for the payout math this bet amount eventually feeds.
 * Shared by BasicStrategyMode and LivePlayMode so the bet-placement UI is
 * identical in both.
 */
export const BET_PRESETS = [10, 25, 50, 100]

interface ChipBetPickerProps {
  bankroll: number
  onBet: (amount: number) => void
  onResetBankroll: () => void
}

export function ChipBetPicker({ bankroll, onBet, onResetBankroll }: ChipBetPickerProps) {
  const affordable = BET_PRESETS.filter((amount) => amount <= bankroll)

  if (affordable.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className={`text-sm font-medium ${ERROR_TEXT}`}>You're out of chips.</p>
        <button type="button" onClick={onResetBankroll} className={PRIMARY_BUTTON}>
          Reset Bankroll
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm text-slate-400">Place your bet:</p>
      <div className="flex flex-wrap justify-center gap-2">
        {affordable.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => onBet(amount)}
            className="rounded-lg border-2 border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:border-emerald-600 hover:bg-slate-700"
          >
            ${amount}
          </button>
        ))}
      </div>
    </div>
  )
}
