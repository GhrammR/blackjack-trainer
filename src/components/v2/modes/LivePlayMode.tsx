import { useEffect, useState } from 'react'
import type { Action, Card } from '../../../types'
import { handValue, isBlackjack, isBust } from '../../../lib/cards'
import { trueCount } from '../../../lib/counting'
import { isValidSignedInt } from '../../../lib/format'
import {
  type DealerResolution,
  type LivePlaySessionState,
  type LiveRound,
  type PlayHand,
  BET_TIERS,
  correctBetUnits,
  dealRound,
  decide,
  decksRemaining,
  handOutcome,
  isRoundOver,
  legalActions,
  needsReshuffle,
  netUnitsForRound,
  resolveDealer,
  startLivePlaySession,
} from '../../../lib/livePlaySession'
import { HiddenCard, PlayingCard } from '../../PlayingCard'
import { ActionButtons } from '../../ActionButtons'
import { ShoeRack } from '../../ShoeRack'
import { SignedNumberInput } from '../../SignedNumberInput'
import {
  ERROR_TEXT,
  PRIMARY_BUTTON,
  PRIMARY_BUTTON_LG,
  SECTION_LABEL,
  SUCCESS_TEXT,
} from '../../theme'
import { CasinoTable } from '../table/CasinoTable'

// ── Chip stack (same sizing as all other detection/evasion modes) ──────────────

const CHIP_SIZE = 22
const CHIP_OFFSET = 11
const CHIP_MAX = 10

// Colors keyed by BET_TIERS values [1, 2, 4, 6, 8]
const TIER_CHIP_COLOR: Record<number, string> = {
  1: '#94a3b8',  // slate  — 1 unit
  2: '#f87171',  // red    — 2 units
  4: '#60a5fa',  // blue   — 4 units
  6: '#fb923c',  // orange — 6 units
  8: '#fbbf24',  // gold   — 8 units
}

function tierChipColor(units: number): string {
  return TIER_CHIP_COLOR[units] ?? '#94a3b8'
}


// ── Hand group (one hand within the user's seat) ───────────────────────────────
// Local copy — not extracted as a shared component (consistent with convention).

const OUTCOME_LABELS: Record<string, string> = {
  win: 'Win', lose: 'Lose', push: 'Push', bust: 'Bust', surrendered: 'Surrender',
}
const OUTCOME_COLORS: Record<string, string> = {
  win: SUCCESS_TEXT, lose: ERROR_TEXT, push: 'text-slate-400',
  bust: ERROR_TEXT, surrendered: 'text-slate-400',
}

function inProgressStatus(hand: PlayHand): string | null {
  if (!hand.done) return null
  if (hand.surrendered) return 'Surrendered'
  if (isBust(hand.cards)) return 'Bust'
  if (isBlackjack(hand.cards)) return 'Blackjack!'
  return 'Stood'
}

function HandGroup({ hand, isActive, outcome }: {
  hand: PlayHand
  isActive: boolean
  outcome: string | null
}) {
  const { total, soft } = handValue(hand.cards)
  const isNatural = isBlackjack(hand.cards)
  const statusText = outcome ? (outcome === 'win' && isNatural ? 'Blackjack!' : OUTCOME_LABELS[outcome]) : inProgressStatus(hand)
  const statusColor = outcome ? OUTCOME_COLORS[outcome] : 'text-slate-500'
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-md p-1 ${isActive ? 'ring-2 ring-blue-500' : ''}`}
      style={{ opacity: hand.done && !outcome ? 0.6 : 1 }}
    >
      <div className="flex gap-1">
        {hand.cards.map((card, i) => (
          <PlayingCard key={i} card={card} suitIndex={i} size="sm" />
        ))}
      </div>
      <p className="text-xs text-slate-400">
        {total}{soft ? ' soft' : ''}
      </p>
      {statusText && (
        <p className={`text-xs font-medium ${statusColor}`}>{statusText}</p>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

function accuracyLabel(correct: number, attempts: number): string {
  return attempts === 0 ? '—' : `${Math.round((correct / attempts) * 100)}%`
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'betting' | 'deciding' | 'roundComplete' | 'countCheck'

interface LastDecision {
  chosenAction: Action
  correctAction: Action
  isCorrect: boolean
}

interface CountFeedback {
  guess: number
  actual: number
  trueCountGuess: number
  trueCountActual: number
}

interface BetFeedback {
  guess: number
  correctUnits: number
  trueCountAtBet: number
}

interface LivePlayProgress {
  playAttempts: number
  playCorrect: number
  countAttempts: number
  countCorrect: number
  trueCountAttempts: number
  trueCountCorrect: number
  betAttempts: number
  betCorrect: number
}

interface LivePlayModeProps {
  numDecks: number
  initialProgress: LivePlayProgress
  onProgressChange: (progress: LivePlayProgress) => void
}

// ── Main component ─────────────────────────────────────────────────────────────

export function LivePlayMode({ numDecks, initialProgress, onProgressChange }: LivePlayModeProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [session, setSession] = useState<LivePlaySessionState | null>(null)
  const [round, setRound] = useState<LiveRound | null>(null)
  const [lastDecision, setLastDecision] = useState<LastDecision | null>(null)
  const [dealerResolution, setDealerResolution] = useState<DealerResolution | null>(null)
  const [countGuess, setCountGuess] = useState('')
  const [trueCountGuess, setTrueCountGuess] = useState('')
  const [countFeedback, setCountFeedback] = useState<CountFeedback | null>(null)
  const [pendingTrueCountForBet, setPendingTrueCountForBet] = useState(0)
  const [betFeedback, setBetFeedback] = useState<BetFeedback | null>(null)
  const [currentBetUnits, setCurrentBetUnits] = useState(1)
  const [netUnits, setNetUnits] = useState(0)
  const [progress, setProgress] = useState(initialProgress)

  useEffect(() => {
    onProgressChange(progress)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress])

  useEffect(() => {
    setProgress(initialProgress)
  }, [initialProgress])

  // ── Session control ──────────────────────────────────────────────────────────

  function start() {
    const newSession = startLivePlaySession(numDecks)
    setSession(newSession)
    setNetUnits(0)
    setPendingTrueCountForBet(0)
    setBetFeedback(null)
    setCountFeedback(null)
    setRound(null)
    setLastDecision(null)
    setDealerResolution(null)
    setPhase('betting')
  }

  function dealNextRound(fromSession: LivePlaySessionState) {
    const active = needsReshuffle(fromSession) ? startLivePlaySession(numDecks) : fromSession
    const { state, round: newRound } = dealRound(active)
    setSession(state)
    setRound(newRound)
    setLastDecision(null)
    setDealerResolution(null)
    setCountGuess('')
    setTrueCountGuess('')
    setCountFeedback(null)
    setBetFeedback(null)

    // A natural blackjack starting hand is already "done" with no decision
    // offered — skip straight to resolving the dealer, same as when a
    // decision finishes the round in `choose()`.
    if (isRoundOver(newRound)) {
      const dealer = resolveDealer(state, newRound)
      setSession(dealer.state)
      setDealerResolution(dealer)
      setNetUnits((prev) =>
        prev + netUnitsForRound(newRound.hands, dealer.dealerCards, dealer.dealerBusted, currentBetUnits)
      )
      setPhase('roundComplete')
    } else {
      setPhase('deciding')
    }
  }

  function choose(action: Action) {
    if (!session || !round) return
    const result = decide(session, round, action)
    setSession(result.state)
    setRound(result.round)
    setLastDecision({
      chosenAction: result.chosenAction,
      correctAction: result.correctAction,
      isCorrect: result.isCorrect,
    })
    setProgress((prev) => ({
      ...prev,
      playAttempts: prev.playAttempts + 1,
      playCorrect: prev.playCorrect + (result.isCorrect ? 1 : 0),
    }))

    if (isRoundOver(result.round)) {
      const dealer = resolveDealer(result.state, result.round)
      setSession(dealer.state)
      setDealerResolution(dealer)
      setNetUnits((prev) =>
        prev + netUnitsForRound(result.round.hands, dealer.dealerCards, dealer.dealerBusted, currentBetUnits)
      )
      setPhase('roundComplete')
    }
  }

  function continueToCountCheck() {
    setPhase('countCheck')
  }

  function submitCount() {
    if (!session) return
    const guess = Number(countGuess)
    const actual = session.count
    const trueCountGuessValue = Number(trueCountGuess)
    const dr = decksRemaining(session)
    const trueCountActual = trueCount(actual, dr)
    setCountFeedback({ guess, actual, trueCountGuess: trueCountGuessValue, trueCountActual })
    setProgress((prev) => ({
      ...prev,
      countAttempts: prev.countAttempts + 1,
      countCorrect: prev.countCorrect + (guess === actual ? 1 : 0),
      trueCountAttempts: prev.trueCountAttempts + 1,
      trueCountCorrect: prev.trueCountCorrect + (trueCountGuessValue === trueCountActual ? 1 : 0),
    }))
  }

  function continueToBetting() {
    if (!countFeedback) return
    setPendingTrueCountForBet(countFeedback.trueCountActual)
    setBetFeedback(null)
    setPhase('betting')
  }

  function chooseBet(units: number) {
    const correctUnits = correctBetUnits(pendingTrueCountForBet)
    setBetFeedback({ guess: units, correctUnits, trueCountAtBet: pendingTrueCountForBet })
    setCurrentBetUnits(units)
    setProgress((prev) => ({
      ...prev,
      betAttempts: prev.betAttempts + 1,
      betCorrect: prev.betCorrect + (units === correctUnits ? 1 : 0),
    }))
  }

  function dealAfterBet() {
    if (!session) return
    dealNextRound(session)
  }

  // ── Table content ────────────────────────────────────────────────────────────
  // Cards on the felt ONLY during deciding and roundComplete — nothing shown
  // during betting or countCheck, per the plan's "cards are live hands only" rule.

  const showCards = phase === 'deciding' || phase === 'roundComplete' || phase === 'countCheck'

  const dealerSlot = (
    <>
      <p className={SECTION_LABEL}>Dealer</p>
      {showCards && round && (
        <>
          <div className="flex gap-1">
            <PlayingCard card={round.dealerUpcard} suitIndex={0} size="sm" />
            {(phase === 'roundComplete' || phase === 'countCheck') && dealerResolution ? (
              dealerResolution.dealerCards.slice(1).map((card: Card, i: number) => (
                <PlayingCard key={i} card={card} suitIndex={i + 1} size="sm" />
              ))
            ) : (
              <HiddenCard size="sm" />
            )}
          </div>
          {(phase === 'roundComplete' || phase === 'countCheck') && dealerResolution && (
            <p className="text-xs text-slate-400">
              {handValue(dealerResolution.dealerCards).total}
              {dealerResolution.dealerBusted ? ' (bust)' : ''}
            </p>
          )}
        </>
      )}
    </>
  )

  // One seat always — split hands rendered inside it, active hand ringed.
  // Done-but-not-yet-resolved hands are dimmed; HandGroup handles it.
  const seatContent = showCards && round ? (
    <div className="flex flex-wrap justify-center gap-2">
      {round.hands.map((hand, i) => (
        <HandGroup
          key={i}
          hand={hand}
          isActive={i === round.activeHandIndex}
          outcome={
            (phase === 'roundComplete' || phase === 'countCheck') && dealerResolution
              ? handOutcome(hand, dealerResolution.dealerCards, dealerResolution.dealerBusted)
              : null
          }
        />
      ))}
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

        {/* Lifetime stats — always visible */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>Play: {accuracyLabel(progress.playCorrect, progress.playAttempts)} ({progress.playAttempts})</span>
          <span>Count: {accuracyLabel(progress.countCorrect, progress.countAttempts)} ({progress.countAttempts})</span>
          <span>TC: {accuracyLabel(progress.trueCountCorrect, progress.trueCountAttempts)} ({progress.trueCountAttempts})</span>
          <span>Bet: {accuracyLabel(progress.betCorrect, progress.betAttempts)} ({progress.betAttempts})</span>
        </div>

        {/* Net units — visible once a session is running */}
        {phase !== 'idle' && (
          <p className="text-xs text-slate-500">
            Net units this session:{' '}
            <span className={netUnits > 0 ? SUCCESS_TEXT : netUnits < 0 ? ERROR_TEXT : 'text-slate-400'}>
              {netUnits > 0 ? '+' : ''}{netUnits.toFixed(1)}
            </span>
          </p>
        )}

        {/* ── IDLE ── */}
        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-3">
            <p className="max-w-md text-center text-sm text-slate-400">
              Play full hands using basic strategy while keeping your own running count in your
              head — nothing shown during play. After each hand you'll be asked for the running
              count and true count, then asked to size your bet for EV before the next deal.
            </p>
            <button type="button" onClick={start} className={PRIMARY_BUTTON_LG}>
              Start playing
            </button>
          </div>
        )}

        {/* ── BETTING — chip picker ── */}
        {phase === 'betting' && !betFeedback && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-xl text-slate-200">
              True count:{' '}
              <span className="font-semibold text-white">{signed(pendingTrueCountForBet)}</span>
            </p>
            <p className="text-sm text-slate-400">Place your bet:</p>
            <div className="flex flex-wrap justify-center gap-3">
              {BET_TIERS.map((units) => {
                const color = tierChipColor(units)
                const count = Math.min(units, CHIP_MAX)
                const stackH = CHIP_SIZE + (count - 1) * CHIP_OFFSET
                return (
                  <button
                    key={units}
                    type="button"
                    onClick={() => chooseBet(units)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '2px solid #334155',
                      background: 'transparent',
                      cursor: 'pointer',
                      minWidth: 44,
                      transition: 'border-color 0.12s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = color }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#334155' }}
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
                          }}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                      {units}u
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── BETTING — feedback after bet placed ── */}
        {phase === 'betting' && betFeedback && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className={`text-lg font-semibold ${betFeedback.guess === betFeedback.correctUnits ? SUCCESS_TEXT : ERROR_TEXT}`}>
              {betFeedback.guess === betFeedback.correctUnits
                ? 'Correct!'
                : `Incorrect — correct bet was ${betFeedback.correctUnits}u`}
            </p>
            <p className="text-slate-300">
              TC {signed(betFeedback.trueCountAtBet)} → {betFeedback.correctUnits}u (you bet {betFeedback.guess}u)
            </p>
            <button type="button" onClick={dealAfterBet} className={PRIMARY_BUTTON_LG}>
              Deal hand
            </button>
          </div>
        )}

        {/* ── DECIDING ── */}
        {phase === 'deciding' && round && (
          <div className="flex flex-col items-center gap-3">
            {lastDecision && (
              <p className={`text-sm font-medium ${lastDecision.isCorrect ? SUCCESS_TEXT : ERROR_TEXT}`}>
                {lastDecision.isCorrect
                  ? 'Correct!'
                  : `Incorrect — correct play was ${lastDecision.correctAction}`}
              </p>
            )}
            {!isRoundOver(round) && (
              <ActionButtons onSelect={choose} actions={legalActions(round)} />
            )}
          </div>
        )}

        {/* ── ROUND COMPLETE ── */}
        {phase === 'roundComplete' && dealerResolution && round && (
          <div className="flex flex-col items-center gap-3">
            {lastDecision && (
              <p className={`text-sm font-medium ${lastDecision.isCorrect ? SUCCESS_TEXT : ERROR_TEXT}`}>
                {lastDecision.isCorrect
                  ? 'Correct!'
                  : `Incorrect — correct play was ${lastDecision.correctAction}`}
              </p>
            )}
            <button type="button" onClick={continueToCountCheck} className={PRIMARY_BUTTON_LG}>
              Continue
            </button>
          </div>
        )}

        {/* ── COUNT CHECK — inputs ── */}
        {phase === 'countCheck' && !countFeedback && session && (
          <div className="flex flex-col items-center gap-3">
            <ShoeRack decksRemaining={decksRemaining(session)} totalDecks={numDecks} />
            <label className="flex items-center gap-2 text-slate-300">
              Running count?
              <SignedNumberInput value={countGuess} onChange={setCountGuess} autoFocus />
            </label>
            <label className="flex items-center gap-2 text-slate-300">
              True count?
              <SignedNumberInput value={trueCountGuess} onChange={setTrueCountGuess} />
            </label>
            <button
              type="button"
              onClick={submitCount}
              disabled={!isValidSignedInt(countGuess) || !isValidSignedInt(trueCountGuess)}
              className={PRIMARY_BUTTON}
            >
              Submit
            </button>
          </div>
        )}

        {/* ── COUNT CHECK — feedback ── */}
        {phase === 'countCheck' && countFeedback && (
          <div className="flex max-w-md flex-col items-center gap-2 text-center">
            <p className={`font-semibold ${countFeedback.guess === countFeedback.actual ? SUCCESS_TEXT : ERROR_TEXT}`}>
              Running count:{' '}
              {countFeedback.guess === countFeedback.actual
                ? 'Correct!'
                : `Off by ${Math.abs(countFeedback.guess - countFeedback.actual)}`}
            </p>
            <p className="text-slate-300">
              RC was{' '}
              <span className="font-semibold text-white">{signed(countFeedback.actual)}</span>
              {countFeedback.guess !== countFeedback.actual && ` (you said ${signed(countFeedback.guess)})`}
            </p>
            <p className={`font-semibold ${countFeedback.trueCountGuess === countFeedback.trueCountActual ? SUCCESS_TEXT : ERROR_TEXT}`}>
              True count:{' '}
              {countFeedback.trueCountGuess === countFeedback.trueCountActual
                ? 'Correct!'
                : `Off by ${Math.abs(countFeedback.trueCountGuess - countFeedback.trueCountActual)}`}
            </p>
            <p className="text-slate-300">
              TC was{' '}
              <span className="font-semibold text-white">{signed(countFeedback.trueCountActual)}</span>
              {countFeedback.trueCountGuess !== countFeedback.trueCountActual &&
                ` (you said ${signed(countFeedback.trueCountGuess)})`}
            </p>
            <button type="button" onClick={continueToBetting} className={`mt-2 ${PRIMARY_BUTTON}`}>
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
