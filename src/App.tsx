import { useEffect, useState } from 'react'
import { BasicStrategyMode } from './components/v2/modes/BasicStrategyMode'
import { RunningCountMode, type RunningCountShoeState } from './components/v2/modes/RunningCountMode'
import { TrueCountMode } from './components/v2/modes/TrueCountMode'
import { ShoeCountdownMode } from './components/v2/modes/ShoeCountdownMode'
import { IndexPlayMode } from './components/v2/modes/IndexPlayMode'
import { CounterDetectionMode } from './components/v2/modes/CounterDetectionMode'
import { TableScanMode } from './components/v2/modes/TableScanMode'
import { EvidenceFlaggingMode } from './components/v2/modes/EvidenceFlaggingMode'
import { EvasionMode } from './components/v2/modes/EvasionMode'
import { LivePlayMode } from './components/v2/modes/LivePlayMode'
import { TwoBetsMode } from './components/v2/modes/TwoBetsMode'
import { CasinoTable } from './components/v2/table/CasinoTable'
import { Lobby, type ModeId } from './components/Lobby'
import { ModeSwitcher } from './components/ModeSwitcher'
import { Modal } from './components/Modal'
import { GlobalSettingsModal } from './components/GlobalSettingsModal'
import { TrainingSessionRecord } from './components/TrainingSessionRecord'
import { StrategyHeatmapSection } from './components/StrategyHeatmapSection'
import { IndexPlayHeatmapSection } from './components/IndexPlayHeatmapSection'
import { TwoBetsCategorySection } from './components/TwoBetsCategorySection'
import { GuidesView } from './components/GuidesView'
import { SECTION_LABEL } from './components/theme'
import {
  COUNTING_STORAGE_KEY,
  type CountingModeKey,
  type CountingProgress,
  clearState,
  loadCountingState,
  loadState,
  resetBankroll,
  resetCountingMode,
  resetCountingProgress,
  saveCountingState,
} from './lib/persistence'
import { lifetimeAccuracy } from './lib/mastery'
import { createShoe, shuffle } from './lib/shoe'
import type { RuleConfig } from './lib/strategy'

type ActiveOverlay = 'settings' | 'guides' | 'overview' | null

/**
 * Rule badge shown in the header for whichever mode is active — makes the
 * active rule set explicit per mode. 3:2 stays fixed app-wide. Deck size,
 * soft-17 rule, surrender mode, and DAS now all come from the live
 * `RuleConfig` (strategy.ts) for Basic Strategy and Live Play, which deal
 * from — and grade against — the real Settings shoe-size/soft17/surrender/
 * DAS combination. Index Plays is the one mode still pinned to a fixed
 * `{ numDecks: 6, soft17Rule: 'H17', surrenderMode: 'none', das: true }`
 * (its rule surface is deliberately untouched — see IndexPlayMode.tsx), so
 * its badge shows that fixed config rather than the live settings.
 */
const FIXED_RULE_MODES: ReadonlySet<ModeId> = new Set(['indexPlays'])
const FIXED_RULES: RuleConfig = { numDecks: 6, soft17Rule: 'H17', surrenderMode: 'none', das: true }

function ruleBadgeText(rules: RuleConfig): string {
  return `${rules.numDecks}D · ${rules.soft17Rule} · ${rules.das ? 'DAS' : 'No DAS'} · 3:2 · Surrender: ${rules.surrenderMode === 'late' ? 'late' : 'off'}`
}

function App() {
  const [currentMode, setCurrentMode] = useState<ModeId | null>(null)
  // Single overlay state (not independent booleans) so at most one modal is
  // ever mounted — avoids an Escape-key ambiguity a three-booleans model
  // would have. Starts on 'overview' so first load shows the mode picker.
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>('overview')
  const [strategyResetKey, setStrategyResetKey] = useState(0)
  const [counting, setCounting] = useState(() => loadCountingState())
  // Lifted out of RunningCountMode so a Card Counting sub-tab switch away
  // from Running Count and back doesn't remount the drill and silently
  // reset the shoe/running count mid-shoe — see RunningCountMode.tsx.
  const [runningCountShoe, setRunningCountShoe] = useState<RunningCountShoeState>(() => ({
    shoe: shuffle(createShoe(loadCountingState().settings.numDecks)),
    position: 0,
    sessionCount: 0,
  }))

  useEffect(() => {
    saveCountingState(counting)
  }, [counting])

  /**
   * Cross-tab sync: whenever ANOTHER tab of this app writes to the shared
   * `counting` localStorage key, pick up its change here too.
   *
   * ROOT CAUSE this fixes (found while diagnosing the Index Plays
   * attempts-flicker/undercounting bug): every `onProgressChange`/
   * `onBankrollChange`/settings-change handler built its next value by
   * spreading THIS tab's own in-memory `counting`/`progress` — e.g.
   * `handleProgressChange({ ...progress, indexPlays })`. Within a single
   * tab that's harmless (nothing else changes `progress` between
   * renders). But with a SECOND tab of this same app open (confirmed live
   * via two Playwright pages sharing one origin/localStorage — plausible
   * in practice, e.g. the app left open in another window), the second
   * tab's `progress` is a separate in-memory snapshot frozen since IT
   * loaded. Any state change in that second tab — even something totally
   * unrelated, like toggling a setting, or Running Count's own deal timer
   * ticking — re-saved ITS stale copy of `progress.indexPlays` over
   * whatever the first tab had just written, because every save writes
   * the ENTIRE `counting` object to one shared key. That's the
   * oscillation: tab A increments attempts and saves; tab B's unrelated
   * activity re-saves its frozen-at-mount attempts count right back over
   * it — repeating every time either tab's state changes, which is
   * exactly the "flashes, then reappears" pattern (and why the Session
   * Report's delta-from-baseline calculation only ever saw 1 attempt: the
   * baseline-to-current delta kept getting clobbered back toward zero).
   *
   * The `storage` event only fires in OTHER tabs, never the one that made
   * the write, so this can't self-trigger a loop — and unlike re-reading
   * localStorage synchronously inside every update (tried first; broke
   * under React 18 StrictMode's double-invoked updater functions, and
   * raced with this tab's own not-yet-flushed writes), this keeps every
   * write a plain, race-free `(prev) => ({ ...prev, ... })` and only pulls
   * in a genuinely external change, exactly when the browser says one
   * happened.
   */
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === COUNTING_STORAGE_KEY) setCounting(loadCountingState())
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  function handleProgressChange<K extends keyof CountingProgress>(mode: K, value: CountingProgress[K]) {
    setCounting((prev) => ({ ...prev, progress: { ...prev.progress, [mode]: value } }))
  }

  // Bankroll (chip wager system) — shared by Basic Strategy and Live Play,
  // settled once per round at the outcome (see livePlaySession.ts's
  // roundPayout). Lifted here, like every other cross-mode value, so it
  // persists across mode switches.
  function handleBankrollChange(bankroll: number) {
    setCounting((prev) => ({ ...prev, bankroll }))
  }

  function handleResetBankroll() {
    setCounting((prev) => resetBankroll(prev))
  }

  function freshRunningCountShoe(): RunningCountShoeState {
    return { shoe: shuffle(createShoe(counting.settings.numDecks)), position: 0, sessionCount: 0 }
  }

  function handleResetStrategy() {
    clearState()
    setStrategyResetKey((k) => k + 1)
  }

  function handleResetCounting() {
    setCounting((prev) => resetCountingProgress(prev))
    setRunningCountShoe(freshRunningCountShoe())
  }

  function handleResetCountingMode(mode: CountingModeKey) {
    setCounting((prev) => resetCountingMode(prev, mode))
    if (mode === 'runningCount') setRunningCountShoe(freshRunningCountShoe())
  }

  function handleResetAll() {
    handleResetStrategy()
    handleResetCounting()
  }

  function handleEnterMode(mode: ModeId) {
    setCurrentMode(mode)
    setActiveOverlay(null)
  }

  const v1State = loadState()
  const strategySnapshot = {
    handsPlayed: v1State.handsPlayed,
    currentStreak: v1State.currentStreak,
    lifetimeAccuracy: lifetimeAccuracy(v1State.stats).accuracy,
  }

  const { settings, progress } = counting
  const rules: RuleConfig = {
    numDecks: settings.numDecks,
    soft17Rule: settings.soft17Rule,
    surrenderMode: settings.surrenderMode,
    das: settings.das,
    maxSplitHands: settings.maxSplitHands,
  }

  // Only the two timer/keydown-driven modes need this — an overlay sitting
  // on top of a running Shoe Countdown must pause its stopwatch AND its
  // window-level Space/Enter shortcut, or the shoe could silently advance
  // underneath the overlay.
  const isPaused = activeOverlay !== null

  function renderMode() {
    switch (currentMode) {
      case 'strategy':
        return (
          <BasicStrategyMode
            key={strategyResetKey}
            rules={rules}
            bankroll={counting.bankroll}
            onBankrollChange={handleBankrollChange}
            onResetBankroll={handleResetBankroll}
          />
        )
      case 'runningCount':
        return (
          <RunningCountMode
            numDecks={settings.numDecks}
            seatCount={settings.seatCount}
            dealSpeed={settings.dealSpeed}
            initialProgress={progress.runningCount}
            onProgressChange={(runningCount) => handleProgressChange('runningCount', runningCount)}
            isPaused={isPaused}
            shoeState={runningCountShoe}
            onShoeStateChange={setRunningCountShoe}
          />
        )
      case 'trueCount':
        return (
          <TrueCountMode
            numDecks={settings.numDecks}
            initialProgress={progress.trueCount}
            onProgressChange={(trueCount) => handleProgressChange('trueCount', trueCount)}
          />
        )
      case 'shoeCountdown':
        return (
          <ShoeCountdownMode
            numDecks={settings.numDecks}
            initialProgress={progress.shoeCountdown}
            onProgressChange={(shoeCountdown) => handleProgressChange('shoeCountdown', shoeCountdown)}
            isPaused={isPaused}
          />
        )
      case 'indexPlays':
        return (
          <IndexPlayMode
            initialProgress={progress.indexPlays}
            onProgressChange={(indexPlays) => handleProgressChange('indexPlays', indexPlays)}
          />
        )
      case 'counterDetection':
        return (
          <CounterDetectionMode
            numDecks={settings.numDecks}
            initialProgress={progress.detection}
            onProgressChange={(detection) => handleProgressChange('detection', detection)}
          />
        )
      case 'tableScan':
        return (
          <TableScanMode
            numDecks={settings.numDecks}
            seatCount={settings.seatCount}
            initialProgress={progress.tableScan}
            onProgressChange={(tableScan) => handleProgressChange('tableScan', tableScan)}
          />
        )
      case 'evidenceFlagging':
        return (
          <EvidenceFlaggingMode
            numDecks={settings.numDecks}
            initialProgress={progress.evidence}
            onProgressChange={(evidence) => handleProgressChange('evidence', evidence)}
          />
        )
      case 'evasion':
        return (
          <EvasionMode
            numDecks={settings.numDecks}
            initialProgress={progress.evasion}
            onProgressChange={(evasion) => handleProgressChange('evasion', evasion)}
          />
        )
      case 'twoBets':
        return (
          <TwoBetsMode
            rules={rules}
            initialProgress={progress.twoBets}
            onProgressChange={(twoBets) => handleProgressChange('twoBets', twoBets)}
          />
        )
      case 'livePlay':
        return (
          <LivePlayMode
            numDecks={settings.numDecks}
            rules={rules}
            bankroll={counting.bankroll}
            onBankrollChange={handleBankrollChange}
            onResetBankroll={handleResetBankroll}
            initialProgress={progress.livePlay}
            onProgressChange={(livePlay) => handleProgressChange('livePlay', livePlay)}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-white">
      {/* The "must fit one screen" shell: header + whichever mode is active.
          Fixed to 100dvh (not min-height) so this region's own height never
          depends on what's below it — the flex-1/min-h-0 mode-content area
          gets exactly (100dvh - header's real height), purely from flex
          layout, no JS measurement. overflow-y-auto is a safety net for a
          HUD that genuinely can't shrink enough (degrades to an internal
          scrollbar) rather than clipping content; it doesn't engage in the
          ordinary case. Anything below this shell (heatmap, training log)
          lives in normal page flow and is reached by scrolling past it. */}
      <div className="flex h-[100dvh] flex-col overflow-y-auto">
        {/* Header padding/gaps trimmed (py-1/sm:py-1.5 -> py-0.5/sm:py-1,
            button/select py-1 -> py-0.5) as part of the fixed per-mode
            overhead reduction — see the mode-wrapper's gap-1/py-1 change
            below. Together these free up real table height universally,
            not just in one mode. */}
        <header className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-slate-800 px-2 py-0.5 sm:px-4 sm:py-1">
          <h1 className="shrink-0 truncate text-sm font-semibold tracking-tight sm:text-lg">
            Double Down
          </h1>
          {/* Mode switcher lives inline in the header — folding it in here
              (rather than its own row below) removes an entire chrome row
              from the mode-content area's height budget. */}
          <div className="min-w-[140px] flex-1">
            <ModeSwitcher currentMode={currentMode} onChange={handleEnterMode} />
          </div>
          {/* Rule badge — same header row (not a new one), so it doesn't eat
              into the mode-content area's carefully-tuned height budget (see
              theme.ts's HUD_HEIGHT). Hidden below sm: on a narrow phone
              viewport it would otherwise force the already-wrapping header
              row even taller; the rules are still one tap away in Guides. */}
          {currentMode !== null && (
            <span className="hidden shrink-0 rounded-md bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400 sm:inline-block">
              {ruleBadgeText(
                FIXED_RULE_MODES.has(currentMode)
                  ? FIXED_RULES
                  : { numDecks: counting.settings.numDecks, soft17Rule: counting.settings.soft17Rule, surrenderMode: counting.settings.surrenderMode, das: counting.settings.das },
              )}
            </span>
          )}
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveOverlay('overview')}
              className="rounded-md bg-slate-800 px-1.5 py-0.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 sm:px-2.5"
            >
              📊 Progress
            </button>
            <button
              type="button"
              onClick={() => setActiveOverlay('guides')}
              className="rounded-md bg-slate-800 px-1.5 py-0.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 sm:px-2.5"
            >
              📖 Guides
            </button>
            <button
              type="button"
              onClick={() => setActiveOverlay('settings')}
              className="rounded-md bg-slate-800 px-1.5 py-0.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 sm:px-2.5"
            >
              ⚙ Settings
            </button>
            <a
              href="https://github.com/GhrammR/blackjack-trainer"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View source on GitHub"
              title="View source on GitHub"
              className="flex items-center rounded-md bg-slate-800 p-1 text-slate-300 transition hover:bg-slate-700 sm:p-1.5"
            >
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
                  0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
                  -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
                  .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
                  -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0
                  1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82
                  1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01
                  1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>
              </svg>
            </a>
          </div>
        </header>

        {/* Persistent table/play area. currentMode === null shows a neutral,
            empty table (CasinoTable's own defaults handle every prop except
            dealerSlot/seatContents) rather than a full-page Lobby. */}
        <div className="flex flex-1 min-h-0">
          {currentMode === null ? (
            <div className="flex h-full w-full flex-col items-center gap-1 px-2 py-1">
              <div
                className="flex w-full flex-1 min-h-0 items-center justify-center"
                style={{ containerType: 'size' }}
              >
                <CasinoTable dealerSlot={<p className={SECTION_LABEL}>Dealer</p>} seatContents={[]} />
              </div>
            </div>
          ) : (
            renderMode()
          )}
        </div>
      </div>

      {currentMode === 'strategy' && <StrategyHeatmapSection />}
      {currentMode === 'indexPlays' && <IndexPlayHeatmapSection />}
      {currentMode === 'twoBets' && <TwoBetsCategorySection />}
      <TrainingSessionRecord />

      {activeOverlay === 'overview' && (
        <Modal title="Progress" onClose={() => setActiveOverlay(null)}>
          <Lobby
            strategySnapshot={strategySnapshot}
            countingProgress={progress}
            numDecks={settings.numDecks}
            onEnter={handleEnterMode}
          />
        </Modal>
      )}

      {activeOverlay === 'guides' && (
        <Modal title="Guides" onClose={() => setActiveOverlay(null)}>
          <GuidesView rules={rules} />
        </Modal>
      )}

      {activeOverlay === 'settings' && (
        <GlobalSettingsModal
          onClose={() => setActiveOverlay(null)}
          countingSettings={counting.settings}
          onCountingSettingsChange={(settings) => setCounting((prev) => ({ ...prev, settings }))}
          countingProgress={counting.progress}
          bankroll={counting.bankroll}
          onResetBankroll={handleResetBankroll}
          strategySnapshot={strategySnapshot}
          onResetStrategy={handleResetStrategy}
          onResetCounting={handleResetCounting}
          onResetCountingMode={handleResetCountingMode}
          onResetAll={handleResetAll}
        />
      )}
    </div>
  )
}

export default App
