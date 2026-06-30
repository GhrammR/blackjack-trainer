import type { CountingProgress } from '../lib/persistence'
import { SECTION_LABEL } from './theme'

export type ModeId =
  | 'strategy'
  | 'runningCount'
  | 'trueCount'
  | 'shoeCountdown'
  | 'indexPlays'
  | 'counterDetection'
  | 'tableScan'
  | 'evidenceFlagging'
  | 'evasion'
  | 'livePlay'

interface LobbyProps {
  strategySnapshot: { handsPlayed: number; currentStreak: number; lifetimeAccuracy: number }
  countingProgress: CountingProgress
  numDecks: number
  onEnter: (mode: ModeId) => void
}

// ── Stat helpers ───────────────────────────────────────────────────────────────

function pct(n: number, d: number): string {
  return d === 0 ? '—' : `${Math.round((n / d) * 100)}%`
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

// ── Mode card ──────────────────────────────────────────────────────────────────

function ModeCard({
  name,
  description,
  note,
  stat,
  onClick,
}: {
  name: string
  description: string
  note?: string
  stat: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start rounded-lg border border-slate-700 bg-slate-800 p-4 text-left transition hover:border-emerald-800/60 hover:bg-slate-700/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
    >
      <p className="font-semibold text-white">{name}</p>
      <p className="mt-1 text-sm leading-snug text-slate-400">{description}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
      <p className="mt-3 text-xs text-slate-500">{stat}</p>
    </button>
  )
}

// ── Lobby ──────────────────────────────────────────────────────────────────────

export function Lobby({ strategySnapshot, countingProgress: p, numDecks, onEnter }: LobbyProps) {
  const strategyStat =
    strategySnapshot.handsPlayed === 0
      ? 'Not started'
      : `${strategySnapshot.handsPlayed} hands · ${Math.round(strategySnapshot.lifetimeAccuracy * 100)}% accuracy · streak: ${strategySnapshot.currentStreak}`

  const rc = p.runningCount
  const rcStat =
    rc.roundsPlayed === 0
      ? 'Not started'
      : `${rc.roundsPlayed} rounds · ${pct(rc.roundsCorrect, rc.roundsPlayed)} correct`

  const tc = p.trueCount
  const tcStat =
    tc.roundsPlayed === 0
      ? 'Not started'
      : `${tc.roundsPlayed} rounds · estimates: ${pct(tc.goodEstimates, tc.roundsPlayed)} · math: ${pct(tc.correctMath, tc.roundsPlayed)}`

  const scBest = p.shoeCountdown.personalBests[numDecks]
  const scStat = scBest != null ? `Best: ${formatMs(scBest)} · ${numDecks}-deck` : 'No best yet'

  const ip = p.indexPlays
  const ipStat =
    ip.attempts === 0
      ? 'Not started'
      : `${ip.attempts} attempts · ${pct(ip.correct, ip.attempts)} correct`

  const dt = p.detection
  const dtStat =
    dt.sessionsPlayed === 0
      ? 'No sessions yet'
      : `${dt.sessionsPlayed} sessions · ${dt.sessionsCorrect} correct`

  const ts = p.tableScan
  const tsStat =
    ts.sessionsPlayed === 0
      ? 'No sessions yet'
      : `${ts.sessionsPlayed} sessions · ${ts.sessionsCorrect} correct`

  const ev = p.evidence
  const evStat =
    ev.sessionsPlayed === 0
      ? 'No sessions yet'
      : `${ev.sessionsPlayed} sessions · ${ev.sessionsCorrect} correct`

  const ea = p.evasion
  const eaStat =
    ea.sessionsPlayed === 0
      ? 'No sessions yet'
      : [
          `${ea.sessionsPlayed} sessions`,
          ea.bestEdgeCapturedPct !== null
            ? `best edge: ${Math.round(ea.bestEdgeCapturedPct)}%`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')

  const lp = p.livePlay
  const lpStat =
    !lp.handsPlayed
      ? 'Not started'
      : `${lp.handsPlayed} hands · plays: ${pct(lp.playsCorrect, lp.playsAttempted)} · count: ${pct(lp.countCorrect, lp.countAttempts)} · TC: ${pct(lp.trueCountCorrect, lp.trueCountAttempts)}`

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">

      {/* ── Basic Strategy ──────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <p className={SECTION_LABEL}>Basic Strategy</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ModeCard
            name="Strategy Trainer"
            description="Grade your decisions against the verified basic-strategy chart. Adaptive weighting pushes practice toward your weak spots — 150-hand perfect streak is the goal."
            stat={strategyStat}
            onClick={() => onEnter('strategy')}
          />
        </div>
      </section>

      {/* ── Counting Fundamentals ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <p className={SECTION_LABEL}>Counting Fundamentals</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ModeCard
            name="Running Count"
            description="Track the Hi-Lo running count across a live multi-seat table from the observer's seat — not a single stream of flashing cards."
            stat={rcStat}
            onClick={() => onEnter('runningCount')}
          />
          <ModeCard
            name="True Count"
            description="Estimate decks remaining from the discard tray, then convert the running count to a true count. Both steps graded independently."
            stat={tcStat}
            onClick={() => onEnter('trueCount')}
          />
          <ModeCard
            name="Shoe Countdown"
            description="Flip a full shoe to zero as fast as possible. Personal best tracked per deck count. The bridge toward counting live."
            stat={scStat}
            onClick={() => onEnter('shoeCountdown')}
          />
          <ModeCard
            name="Index Plays"
            description="Make count-driven strategy deviations — the Illustrious 18 — when the true count crosses a threshold. Bridges strategy and counting."
            stat={ipStat}
            onClick={() => onEnter('indexPlays')}
          />
        </div>
      </section>

      {/* ── Surveillance & Detection ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <p className={SECTION_LABEL}>Surveillance & Detection</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ModeCard
            name="Counter Detection"
            description="Observe a single player through a shoe and decide: were they counting? Bet spread and index-play deviations are your evidence."
            note="3 difficulty tiers"
            stat={dtStat}
            onClick={() => onEnter('counterDetection')}
          />
          <ModeCard
            name="Table Scan"
            description="One counter, several flat bettors — a full shoe of bets across all seats. Which column is the counter?"
            note="3 difficulty tiers"
            stat={tsStat}
            onClick={() => onEnter('tableScan')}
          />
          <ModeCard
            name="Evidence Flagging"
            description="Flag the individual rounds that are actual tells — a real bet-size spike or a real index deviation, not a cover play. Scored on precision and recall."
            note="3 difficulty tiers"
            stat={evStat}
            onClick={() => onEnter('evidenceFlagging')}
          />
          <ModeCard
            name="Evasion"
            description="Switch sides: play as the counter. Size your bets and choose your deviations to maximize edge while keeping heat low."
            stat={eaStat}
            onClick={() => onEnter('evasion')}
          />
        </div>
      </section>

      {/* ── Live Play (capstone) ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <p className={SECTION_LABEL}>Capstone</p>
        <button
          type="button"
          onClick={() => onEnter('livePlay')}
          className="flex flex-col items-start rounded-xl border border-emerald-900/50 bg-gradient-to-br from-slate-800 to-slate-800/60 p-6 text-left transition hover:border-emerald-700/70 hover:from-slate-700/80 hover:to-slate-700/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          <p className="text-lg font-semibold text-white">Live Play</p>
          <p className="mt-1 text-sm text-slate-300">
            Play live blackjack — basic strategy, running count, true count, and EV bet sizing all
            at once, the way a real player works a table. Four independent skills, one unbroken
            session.
          </p>
          <p className="mt-3 text-xs text-slate-500">{lpStat}</p>
        </button>
      </section>
    </div>
  )
}
