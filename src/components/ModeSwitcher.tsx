import type { ModeId } from './Lobby'

interface ModeSwitcherProps {
  currentMode: ModeId | null
  onChange: (mode: ModeId) => void
}

// Same 4 groupings Lobby.tsx's sections use, and the same "flat <select> for
// a 10-item mode-adjacent list" pattern already proven in this codebase by
// GlobalSettingsModal.tsx's per-mode reset dropdown — native, mobile-friendly,
// no new widget to build or risk.
const MODE_GROUPS: { label: string; modes: { id: ModeId; label: string }[] }[] = [
  {
    label: 'Basic Strategy',
    modes: [
      { id: 'strategy', label: 'Strategy Trainer' },
      { id: 'twoBets', label: 'Two Bets in a Circle' },
    ],
  },
  {
    label: 'Counting Fundamentals',
    modes: [
      { id: 'runningCount', label: 'Running Count' },
      { id: 'trueCount', label: 'True Count' },
      { id: 'shoeCountdown', label: 'Shoe Countdown' },
      { id: 'indexPlays', label: 'Index Plays' },
    ],
  },
  {
    label: 'Surveillance & Detection',
    modes: [
      { id: 'counterDetection', label: 'Counter Detection' },
      { id: 'tableScan', label: 'Table Scan' },
      { id: 'evidenceFlagging', label: 'Evidence Flagging' },
      { id: 'evasion', label: 'Evasion' },
    ],
  },
  { label: 'Capstone', modes: [{ id: 'livePlay', label: 'Live Play' }] },
]

/** Always-visible compact mode switcher, inlined into the header row. The reset-on-switch behavior is disclosed via the native title tooltip rather than a visible line, to avoid spending a whole extra chrome row on it. */
export function ModeSwitcher({ currentMode, onChange }: ModeSwitcherProps) {
  return (
    <select
      value={currentMode ?? ''}
      onChange={(e) => onChange(e.target.value as ModeId)}
      title="Changing modes resets the current hand/round — your stats and scores are kept."
      className="w-full rounded bg-slate-800 px-2 py-0.5 text-xs text-white sm:text-sm"
    >
      {currentMode === null && (
        <option value="" disabled>
          Select a mode…
        </option>
      )}
      {MODE_GROUPS.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.modes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
