import { useEffect, useState } from 'react'
import type { Action } from '../../../types'
import { handValue } from '../../../lib/cards'
import {
  type DealtRound,
  type EvasionPlayState,
  type EvasionRoundRecord,
  type EvasionSessionState,
  beginPlay,
  currentTrueCount,
  dealRound,
  finalizeRound,
  hasRoundsRemaining,
  hitOneCard,
  standPlay,
  startEvasionSession,
} from '../../../lib/evasionSession'
import { finalizeRounds, scoreSession } from '../../../lib/evasionScoring'
import { isEvidenceRound } from '../../../lib/evidenceGrading'
import { HiddenCard, PlayingCard } from '../../PlayingCard'
import { SECTION_LABEL, PRIMARY_BUTTON, PRIMARY_BUTTON_LG, SECONDARY_BUTTON, SUCCESS_TEXT } from '../../theme'
import { CasinoTable } from '../table/CasinoTable'

// ── Bet options ────────────────────────────────────────────────────────────────

const BET_OPTIONS = [1, 2, 3, 5, 8, 12] as const

// ── Chip stack ─────────────────────────────────────────────────────────────────
// Same sizing as CounterDetectionMode / EvidenceFlaggingMode / TableScanMode.

const CHIP_SIZE = 22
const CHIP_OFFSET = 11
const CHIP_MAX = 10

const CHIP_COLOR: Record<number, string> = {
  1:  '#94a3b8',  // slate  — minimum bet
  2:  '#f87171',  // red
  3:  '#4ade80',  // green
  4:  '#60a5fa',  // blue
  5:  '#a78bfa',  // violet
  6:  '#fb923c',  // orange
  7:  '#f472b6',  // pink
  8:  '#fbbf24',  // gold
  12: '#e2e8f0',  // near-white — max bet tier
}

function resolveChipColor(units: number): string {
  if (units >= 12) return CHIP_COLOR[12]
  return CHIP_COLOR[Math.min(Math.max(units, 1), 8)]
}

function ChipStack({ units }: { units: number }) {
  const count = Math.min(Math.max(units, 1), CHIP_MAX)
  const color = resolveChipColor(units)
  const stackH = CHIP_SIZE + (count - 1) * CHIP_OFFSET

  return (
    <div style={{ position: 'relative', width: CHIP_SIZE + 2, height: stackH, flexShrink: 0 }}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            bottom: i * CHIP_OFFSET,
            width: CHIP_SIZE,
            height: CHIP_SIZE,
            borderRadius: '50%',
            background: color,
            border: '1.5px solid rgba(255,255,255,0.40)',
            boxShadow: [
              `inset 0 0 0 4px ${color}`,
              'inset 0 0 0 7px rgba(255,255,255,0.28)',
              '0 1px 3px rgba(0,0,0,0.60)',
            ].join(', '),
          }}
        />
      ))}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

function formatSituation(situationKey: string): string {
  const [category, total, , dealer] = situationKey.split('-')
  return `${category[0].toUpperCase()}${category.slice(1)} ${total} vs ${dealer}`
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}%`
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'betting' | 'playing' | 'hitting' | 'roundDone' | 'summary'

interface EvasionProgress {
  sessionsPlayed: number
  bestEdgeCapturedPct: number | null
  lowestHeat: number | null
}

interface EvasionModeProps {
  numDecks: number
  initialProgress: EvasionProgress
  onProgressChange: (progress: EvasionProgress) => void
}

// ── Main component ─────────────────────────────────────────────────────────────

export function EvasionMode({ numDecks, initialProgress, onProgressChange }: EvasionModeProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [session, setSession] = useState<EvasionSessionState | null>(null)
  const [roundNumber, setRoundNumber] = useState(1)
  const [trueCountAtBet, setTrueCountAtBet] = useState(0)
  const [bet, setBet] = useState<(typeof BET_OPTIONS)[number]>(1)
  const [dealt, setDealt] = useState<DealtRound | null>(null)
  const [chosenAction, setChosenAction] = useState<Action | null>(null)
  const [play, setPlay] = useState<EvasionPlayState | null>(null)
  const [rounds, setRounds] = useState<Omit<EvasionRoundRecord, 'isElevatedBet'>[]>([])
  const [lastRecord, setLastRecord] = useState<Omit<EvasionRoundRecord, 'isElevatedBet'> | null>(null)
  const [progress, setProgress] = useState(initialProgress)

  useEffect(() => {
    onProgressChange(progress)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress])

  useEffect(() => {
    setProgress(initialProgress)
  }, [initialProgress])

  // ── Session control ──────────────────────────────────────────────────────────

  function startSession() {
    const newSession = startEvasionSession(numDecks)
    setSession(newSession)
    setRoundNumber(1)
    setRounds([])
    setLastRecord(null)
    setTrueCountAtBet(currentTrueCount(newSession))
    setBet(1)
    setPhase('betting')
  }

  function placeBet() {
    if (!session) return
    const { state: afterDeal, dealt: dealtRound } = dealRound(session)
    setSession(afterDeal)
    setDealt(dealtRound)
    setPhase('playing')
  }

  function finishRound(sessionState: EvasionSessionState, action: Action, finalPlay: EvasionPlayState) {
    if (!dealt) return
    const { state: afterResolve, record } = finalizeRound(
      sessionState, dealt, bet, trueCountAtBet, action, finalPlay, roundNumber,
    )
    setSession(afterResolve)
    setRounds((prev) => [...prev, record])
    setLastRecord(record)
    setChosenAction(null)
    setPlay(null)
    setPhase('roundDone')
  }

  function choosePlay(action: Action) {
    if (!session || !dealt) return
    const { state: afterBegin, play: newPlay } = beginPlay(session, dealt, action)
    setSession(afterBegin)
    if (newPlay.done) {
      finishRound(afterBegin, action, newPlay)
    } else {
      setChosenAction(action)
      setPlay(newPlay)
      setPhase('hitting')
    }
  }

  function hitAgain() {
    if (!session || !play || !chosenAction) return
    const { state: afterHit, play: newPlay } = hitOneCard(session, play)
    setSession(afterHit)
    setPlay(newPlay)
    if (newPlay.done) finishRound(afterHit, chosenAction, newPlay)
  }

  function standNow() {
    if (!session || !play || !chosenAction) return
    finishRound(session, chosenAction, standPlay(play))
  }

  function nextRound() {
    if (!session) return
    const next = roundNumber + 1
    if (!hasRoundsRemaining(session, next)) {
      setPhase('summary')
      return
    }
    setRoundNumber(next)
    setTrueCountAtBet(currentTrueCount(session))
    setBet(1)
    setPhase('betting')
  }

  // ── Scoring ──────────────────────────────────────────────────────────────────

  const finalizedRounds = phase === 'summary' ? finalizeRounds(rounds) : []
  const scorecard = phase === 'summary' ? scoreSession(finalizedRounds) : null

  useEffect(() => {
    if (phase !== 'summary' || !scorecard) return
    setProgress((prev) => ({
      sessionsPlayed: prev.sessionsPlayed + 1,
      bestEdgeCapturedPct:
        scorecard.edgeCapturedPct === null
          ? prev.bestEdgeCapturedPct
          : prev.bestEdgeCapturedPct === null
            ? scorecard.edgeCapturedPct
            : Math.max(prev.bestEdgeCapturedPct, scorecard.edgeCapturedPct),
      lowestHeat:
        prev.lowestHeat === null
          ? scorecard.heat
          : Math.min(prev.lowestHeat, scorecard.heat),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Live heat tally — finalizeRounds computes isElevatedBet from the running
  // min-bet baseline, same logic the summary uses at session end.
  // Without this, isElevatedBet is always false (finalizeRound initializes it
  // to false; it's only set correctly after finalization), so bet-spread heat
  // would never register during the session.
  const liveHeat = finalizeRounds(rounds).filter(isEvidenceRound).length

  // ── Play button logic ────────────────────────────────────────────────────────

  const flip: Action | null =
    dealt?.basicAction === 'Hit' ? 'Stand'
    : dealt?.basicAction === 'Stand' ? 'Hit'
    : null
  const showCoverButton = flip !== null && flip !== dealt?.indicatedAction

  // ── Table content ────────────────────────────────────────────────────────────

  const dealerSlot = (
    <>
      <p className={SECTION_LABEL}>Dealer</p>
      {(phase === 'playing' || phase === 'hitting' || phase === 'roundDone') && dealt && (
        <div className="flex gap-1">
          <PlayingCard card={dealt.dealerUpcard} suitIndex={0} size="sm" />
          <HiddenCard size="sm" />
        </div>
      )}
    </>
  )

  // Seat content: empty pre-deal; cards + chip stack during play / hitting / roundDone.
  const activeHand = phase === 'playing' ? dealt?.initialPlayerHand
    : phase === 'hitting' ? play?.cards
    : phase === 'roundDone' ? lastRecord?.finalPlayerHand
    : null

  const seatContent = activeHand ? (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1">
        {activeHand.map((card, i) => (
          <PlayingCard key={i} card={card} suitIndex={i + 1} size="sm" />
        ))}
      </div>
      {/* Chip stack shows committed bet */}
      <ChipStack units={bet} />
    </div>
  ) : (
    <span />
  )

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full flex-col items-center gap-2 px-2 py-2">
      <div className="flex w-full flex-1 min-h-0 items-center justify-center"
        style={{ containerType: 'size' }}>
        <CasinoTable
          dealerSlot={dealerSlot}
          seatContents={[seatContent]}
          seatLabels={['YOU']}
          userSeatIndex={0}
        />
      </div>

      {/* HUD */}
      <div className="flex w-full max-w-md flex-col items-center gap-4">

        {/* ── IDLE ── */}
        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-4">
            <p className="max-w-md text-center text-sm text-slate-400">
              Play the counter's seat. The true count is shown each round — your job is the
              camouflage decision: bet enough to capture edge without raising the kind of heat
              the other detection modes train observers to spot.
            </p>
            <p className="text-xs text-slate-500">
              Sessions: {progress.sessionsPlayed}
              {progress.bestEdgeCapturedPct !== null && ` · Best edge: ${formatPercent(progress.bestEdgeCapturedPct)}`}
              {progress.lowestHeat !== null && ` · Lowest heat: ${progress.lowestHeat}`}
            </p>
            <button type="button" onClick={startSession} className={PRIMARY_BUTTON_LG}>
              Start session
            </button>
          </div>
        )}

        {/* ── BETTING ── */}
        {phase === 'betting' && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-4 text-sm text-slate-400">
              <span className="text-xs uppercase tracking-wide text-slate-500">Round {roundNumber}</span>
              {rounds.length > 0 && (
                <span>Heat so far: <span className="text-slate-200">{liveHeat} / {rounds.length}</span></span>
              )}
            </div>
            <p className="text-xl text-slate-200">
              True count:{' '}
              <span className="font-semibold text-white">{signed(trueCountAtBet)}</span>
            </p>
            <p className="text-sm text-slate-400">How many units do you bet?</p>
            {/* Chip-style bet picker */}
            <div className="flex flex-wrap justify-center gap-3">
              {BET_OPTIONS.map((units) => {
                const color = resolveChipColor(units)
                const isSelected = bet === units
                const count = Math.min(units, CHIP_MAX)
                const stackH = CHIP_SIZE + (count - 1) * CHIP_OFFSET
                return (
                  <button
                    key={units}
                    type="button"
                    onClick={() => setBet(units)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: isSelected ? `2px solid ${color}` : '2px solid #334155',
                      background: isSelected ? 'rgba(255,255,255,0.06)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'border-color 0.12s, background 0.12s',
                      minWidth: 44,
                    }}
                  >
                    <div style={{ position: 'relative', width: CHIP_SIZE + 2, height: stackH }}>
                      {Array.from({ length: count }, (_, i) => (
                        <div
                          key={i}
                          style={{
                            position: 'absolute',
                            bottom: i * CHIP_OFFSET,
                            width: CHIP_SIZE,
                            height: CHIP_SIZE,
                            borderRadius: '50%',
                            background: color,
                            border: '1.5px solid rgba(255,255,255,0.40)',
                            boxShadow: [
                              `inset 0 0 0 4px ${color}`,
                              'inset 0 0 0 7px rgba(255,255,255,0.28)',
                              '0 1px 3px rgba(0,0,0,0.60)',
                            ].join(', '),
                            opacity: isSelected ? 1 : 0.6,
                          }}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: isSelected ? '#e2e8f0' : '#64748b', fontWeight: 600 }}>
                      {units}u
                    </span>
                  </button>
                )
              })}
            </div>
            <button type="button" onClick={placeBet} className={PRIMARY_BUTTON_LG}>
              Deal ({bet}u)
            </button>
          </div>
        )}

        {/* ── PLAYING ── */}
        {phase === 'playing' && dealt && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-slate-400">
              {formatSituation(dealt.situationKey)} · bet {bet}u · TC {signed(dealt.trueCountAtDecision)}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => choosePlay(dealt.basicAction)}
                className={SECONDARY_BUTTON}
              >
                Play it straight: {dealt.basicAction}
              </button>
              {dealt.indicatedAction && (
                <button
                  type="button"
                  onClick={() => choosePlay(dealt.indicatedAction as Action)}
                  style={{
                    borderRadius: 6,
                    background: '#92400e',
                    padding: '8px 16px',
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Take the count's play: {dealt.indicatedAction}
                </button>
              )}
              {showCoverButton && flip && (
                <button
                  type="button"
                  onClick={() => choosePlay(flip)}
                  style={{
                    borderRadius: 6,
                    background: '#0c4a6e',
                    padding: '8px 16px',
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Cover deviation: {flip}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── HITTING (interactive, Fix 4) ── */}
        {phase === 'hitting' && play && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-slate-400">
              {(() => {
                const { total, soft } = handValue(play.cards)
                return `${soft ? 'Soft' : 'Hard'} ${total}`
              })()} · bet {bet}u
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button type="button" onClick={hitAgain} className={PRIMARY_BUTTON}>
                Hit
              </button>
              <button type="button" onClick={standNow} className={SECONDARY_BUTTON}>
                Stand
              </button>
            </div>
          </div>
        )}

        {/* ── ROUND DONE ── */}
        {phase === 'roundDone' && lastRecord && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-center text-sm text-slate-300">
              Round {lastRecord.roundNumber}: bet {lastRecord.bet}u on{' '}
              {formatSituation(lastRecord.situationKey)}, played{' '}
              {lastRecord.actions.join(' → ')}
              {lastRecord.playerBusted && <span className="text-red-400"> (bust)</span>}.
              {lastRecord.deviated && (
                <span style={{ color: lastRecord.deviationType === 'index' ? '#fcd34d' : '#7dd3fc' }}>
                  {' '}{lastRecord.deviationType === 'index' ? ' Count play.' : ' Cover play.'}
                </span>
              )}
            </p>
            {/* Live heat tally — shown every round so the user tracks their running heat */}
            <p className="text-sm">
              <span className="text-slate-400">Heat so far: </span>
              <span className={liveHeat === 0 ? SUCCESS_TEXT : liveHeat <= 2 ? 'text-amber-400' : 'text-red-400'}>
                {liveHeat}
              </span>
              <span className="text-slate-500"> / {rounds.length} rounds</span>
            </p>
            <button type="button" onClick={nextRound} className={PRIMARY_BUTTON_LG}>
              Next round
            </button>
          </div>
        )}

        {/* ── SUMMARY ── */}
        {phase === 'summary' && scorecard && (
          <div className="flex w-full flex-col items-center gap-4">
            <p className="text-lg font-semibold text-slate-100">
              Session complete — {scorecard.totalRounds} rounds
            </p>
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-slate-200">
                Heat:{' '}
                <span className={`font-semibold ${scorecard.heat === 0 ? SUCCESS_TEXT : scorecard.heat <= 3 ? 'text-amber-400' : 'text-red-400'}`}>
                  {scorecard.heat}
                </span>
                <span className="text-slate-400"> / {scorecard.totalRounds} rounds would read as evidence</span>
              </p>
              <p className="text-slate-200">
                Edge captured:{' '}
                <span className="font-semibold text-white">{formatPercent(scorecard.edgeCapturedPct)}</span>
                <span className="text-slate-400"> of the aggressive uncamouflaged baseline</span>
              </p>
              <p className="max-w-md text-xs text-slate-500">
                0% = no better than flat betting throughout. 100% = matched an obvious counter's
                spread exactly, no camouflage. Lower heat is safer; higher edge is more
                profitable — managing that trade-off is the whole game.
              </p>
            </div>
            <p className="text-xs text-slate-500">
              Sessions: {progress.sessionsPlayed}
              {progress.bestEdgeCapturedPct !== null && ` · Best edge: ${formatPercent(progress.bestEdgeCapturedPct)}`}
              {progress.lowestHeat !== null && ` · Lowest heat: ${progress.lowestHeat}`}
            </p>
            <button
              type="button"
              onClick={() => { setPhase('idle'); setSession(null) }}
              className={PRIMARY_BUTTON}
            >
              Back to start
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
