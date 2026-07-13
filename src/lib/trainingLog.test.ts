import { describe, expect, it } from 'vitest'
import type { CountingState, PersistedState } from './persistence'
import { buildTrainingLogText, captureSessionBaseline, type SessionBaseline } from './trainingLog'

function emptyV1(): PersistedState {
  return { stats: {}, handsPlayed: 0, currentStreak: 0, bestStreak: 0 }
}

function statsWith(attempts: number, correct: number): PersistedState['stats'] {
  return { 'hard-16-vs-10': { key: 'hard-16-vs-10', attempts, correct, lastSeen: 0, recentResults: [] } }
}

function emptyCountingState(): CountingState {
  return {
    settings: { numDecks: 6, seatCount: 4, dealSpeed: 'medium', soft17Rule: 'H17', surrenderMode: 'none', das: true, startingBankroll: 1000 },
    bankroll: 1000,
    progress: {
      runningCount: { roundsPlayed: 0, roundsCorrect: 0 },
      trueCount: { roundsPlayed: 0, goodEstimates: 0, correctMath: 0 },
      shoeCountdown: {
        fullCountdown: { personalBests: {}, totals: {}, attempts: 0, correct: 0 },
        missingCards: { personalBests: {}, totals: {}, attempts: 0, correct: 0 },
      },
      detection: { sessionsPlayed: 0, sessionsCorrect: 0 },
      tableScan: { sessionsPlayed: 0, sessionsCorrect: 0 },
      evidence: { sessionsPlayed: 0, sessionsCorrect: 0 },
      evasion: { sessionsPlayed: 0, bestEdgeCapturedPct: null, lowestHeat: null },
      indexPlays: { attempts: 0, correct: 0, perDeviation: {} },
      livePlay: {
        playAttempts: 0, playCorrect: 0, countAttempts: 0, countCorrect: 0,
        trueCountAttempts: 0, trueCountCorrect: 0, betAttempts: 0, betCorrect: 0,
      },
    },
  }
}

describe('buildTrainingLogText — no baseline (lifetime fallback)', () => {
  it('shows the lifetime-totals header and reports lifetime numbers when nothing has been touched but strategy', () => {
    const v1: PersistedState = { stats: statsWith(20, 18), handsPlayed: 20, currentStreak: 5, bestStreak: 8 }
    const counting = emptyCountingState()

    const text = buildTrainingLogText(v1, counting, null)
    expect(text).toContain('Training Log — lifetime totals (no session started)')
    expect(text).toMatch(/Basic Strategy\n-+\n/)
    expect(text).toContain('  what: practicing correct hit/stand/double/split/surrender decisions for every hand')
    expect(text).toContain('  - hands: 20')
    expect(text).toContain('  - correct: 18')
    expect(text).toContain('  - accuracy: 90.0%')
    expect(text).toContain('  - current streak: 5')
    expect(text).toContain('  - best streak: 8')
    // Untouched modes are absent.
    expect(text).not.toContain('Running Count')
    expect(text).not.toContain('Live Play')
  })

  it('reports "No activity recorded yet." when literally nothing has been played', () => {
    const text = buildTrainingLogText(emptyV1(), emptyCountingState(), null)
    expect(text).toContain('Training Log — lifetime totals (no session started)')
    expect(text).toContain('No activity recorded yet.')
  })
})

describe('buildTrainingLogText — mode blocks are header + bulleted stats, blank-line separated', () => {
  it('separates two active modes with a blank line and gives each its own dashed header', () => {
    const now = emptyCountingState()
    now.progress.runningCount = { roundsPlayed: 5, roundsCorrect: 4 }
    const v1: PersistedState = { stats: statsWith(10, 9), handsPlayed: 10, currentStreak: 1, bestStreak: 1 }

    const text = buildTrainingLogText(v1, now, null)
    expect(text).toContain('\n\nRunning Count\n')
    expect(text).toMatch(/Running Count\n-+\n/)
    expect(text).toContain('  what: tracking the Hi-Lo running count live across a multi-seat table')
    expect(text).toContain('  - rounds: 5')
  })

  it('excludes the header line when includeHeader is false, but keeps the bulleted block structure', () => {
    const v1: PersistedState = { stats: statsWith(10, 9), handsPlayed: 10, currentStreak: 1, bestStreak: 1 }
    const text = buildTrainingLogText(v1, emptyCountingState(), null, { includeHeader: false })
    expect(text).not.toContain('Training Log —')
    expect(text).toMatch(/^Basic Strategy\n-+\n/)
  })
})

describe('buildTrainingLogText — with a session baseline', () => {
  it('reports only the delta since the baseline, not lifetime totals, with correct accuracy math', () => {
    const baselineV1: PersistedState = { stats: statsWith(20, 18), handsPlayed: 20, currentStreak: 3, bestStreak: 3 }
    const baselineCounting = emptyCountingState()
    const baseline = captureSessionBaseline(baselineV1, baselineCounting)

    // Session: 10 more hands, 8 more correct (lifetime now 30/26).
    const nowV1: PersistedState = { stats: statsWith(30, 26), handsPlayed: 30, currentStreak: 7, bestStreak: 7 }
    const nowCounting = emptyCountingState()
    nowCounting.progress.runningCount = { roundsPlayed: 5, roundsCorrect: 4 }

    const text = buildTrainingLogText(nowV1, nowCounting, baseline)
    expect(text).toContain('Training Log — since session start')
    // Session deltas: 10 hands, 8 correct (30-20, 26-18) -> 80.0%
    expect(text).toContain('  - hands: 10')
    expect(text).toContain('  - correct: 8')
    expect(text).toContain('  - accuracy: 80.0%')
    expect(text).toContain('  - current streak: 7')
    expect(text).toContain('  - best streak: 7')
    expect(text).toContain('  - rounds: 5')
  })

  it('excludes a mode from the export if it has lifetime history but nothing happened this session', () => {
    const baselineCounting = emptyCountingState()
    baselineCounting.progress.runningCount = { roundsPlayed: 50, roundsCorrect: 45 }
    const baseline = captureSessionBaseline(emptyV1(), baselineCounting)

    // Same numbers now — no session activity in Running Count.
    const text = buildTrainingLogText(emptyV1(), baselineCounting, baseline)
    expect(text).not.toContain('Running Count')
  })
})

describe('buildTrainingLogText — Shoe Countdown (best AND average pace/time)', () => {
  it('Full Countdown is included whenever attempts increased, showing accuracy plus per-deck-size best AND average pace/time', () => {
    const baselineCounting = emptyCountingState()
    baselineCounting.progress.shoeCountdown.fullCountdown = {
      personalBests: { 6: { ms: 130000, cards: 260 } },
      totals: { 6: { ms: 130000, cards: 260, runs: 1 } },
      attempts: 3,
      correct: 2,
    }
    const baseline = captureSessionBaseline(emptyV1(), baselineCounting)

    const now = emptyCountingState()
    now.progress.shoeCountdown.fullCountdown = {
      personalBests: { 6: { ms: 123500, cards: 260 } },
      // Two runs this lifetime total: the 130000ms baseline run plus a new 123500ms run -> 253500ms / 2 = 126750ms avg time; 253500/520 cards = 487.5 ms/card.
      totals: { 6: { ms: 253500, cards: 520, runs: 2 } },
      attempts: 5,
      correct: 4,
    }

    const text = buildTrainingLogText(emptyV1(), now, baseline)
    expect(text).toMatch(/Shoe Countdown \(Full Countdown\)\n-+\n/)
    expect(text).toContain('  - attempts: 2')
    expect(text).toContain('  - correct: 2')
    expect(text).toContain('  - accuracy: 100.0%')
    // 123500ms over 260 cards -> 475.0 ms/card -> 2.11 cards/sec
    expect(text).toContain('  - best pace/time: 6-deck: 2.11 cards/sec (123.50s)')
    // 487.5 ms/card -> 2.05 cards/sec; average time 126750ms -> 126.75s
    expect(text).toContain('  - average pace/time: 6-deck: 2.05 cards/sec (126.75s)')
  })

  it('Full Countdown does not appear when its attempts did not increase this session', () => {
    const baselineCounting = emptyCountingState()
    baselineCounting.progress.shoeCountdown.fullCountdown = {
      personalBests: { 6: { ms: 123500, cards: 260 } },
      totals: { 6: { ms: 123500, cards: 260, runs: 1 } },
      attempts: 5,
      correct: 4,
    }
    const baseline = captureSessionBaseline(emptyV1(), baselineCounting)

    const unchanged = emptyCountingState()
    unchanged.progress.shoeCountdown.fullCountdown = {
      personalBests: { 6: { ms: 123500, cards: 260 } },
      totals: { 6: { ms: 123500, cards: 260, runs: 1 } },
      attempts: 5,
      correct: 4,
    }
    expect(buildTrainingLogText(emptyV1(), unchanged, baseline)).not.toContain('Full Countdown')
  })

  it('Missing Cards is included whenever attempts increased, showing accuracy plus best and average pace/time', () => {
    const baselineCounting = emptyCountingState()
    baselineCounting.progress.shoeCountdown.missingCards = {
      personalBests: { 1: { ms: 40000, cards: 51 } },
      totals: { 1: { ms: 40000, cards: 51, runs: 1 } },
      attempts: 3,
      correct: 2,
    }
    const baseline = captureSessionBaseline(emptyV1(), baselineCounting)

    const now = emptyCountingState()
    now.progress.shoeCountdown.missingCards = {
      personalBests: { 1: { ms: 32000, cards: 52 } },
      totals: { 1: { ms: 72000, cards: 103, runs: 2 } },
      attempts: 5,
      correct: 4,
    }

    const text = buildTrainingLogText(emptyV1(), now, baseline)
    expect(text).toMatch(/Shoe Countdown \(Missing Cards\)\n-+\n/)
    expect(text).toContain('  - attempts: 2')
    // 32000ms over 52 cards -> 615.38 ms/card -> 1.63 cards/sec
    expect(text).toContain('1-deck: 1.63 cards/sec (32.00s)')
    // average: 72000ms/103 cards -> 699.03 ms/card -> 1.43 cards/sec; 72000/2 runs -> 36.00s
    expect(text).toContain('  - average pace/time: 1-deck: 1.43 cards/sec (36.00s)')
  })

  it('shows "—" for average pace/time when there is no lifetime totals history yet', () => {
    const now = emptyCountingState()
    now.progress.shoeCountdown.fullCountdown = {
      personalBests: {},
      totals: {},
      attempts: 1,
      correct: 0,
    }
    const text = buildTrainingLogText(emptyV1(), now, null)
    expect(text).toContain('  - average pace/time: —')
  })

  it('never includes "(new this session)" flagging for any personal best', () => {
    const baselineCounting = emptyCountingState()
    baselineCounting.progress.shoeCountdown.fullCountdown = {
      personalBests: { 6: { ms: 130000, cards: 260 } },
      totals: { 6: { ms: 130000, cards: 260, runs: 1 } },
      attempts: 3,
      correct: 2,
    }
    const baseline = captureSessionBaseline(emptyV1(), baselineCounting)

    const now = emptyCountingState()
    now.progress.shoeCountdown.fullCountdown = {
      personalBests: { 6: { ms: 123500, cards: 260 } },
      totals: { 6: { ms: 253500, cards: 520, runs: 2 } },
      attempts: 5,
      correct: 4,
    }

    const text = buildTrainingLogText(emptyV1(), now, baseline)
    expect(text).not.toContain('new this session')
  })
})

describe('buildTrainingLogText — Evasion (edge/heat, not accuracy)', () => {
  it('reports the best edge captured and lowest heat, with no "new this session" flagging', () => {
    const baselineCounting = emptyCountingState()
    baselineCounting.progress.evasion = { sessionsPlayed: 2, bestEdgeCapturedPct: 50, lowestHeat: 3 }
    const baseline = captureSessionBaseline(emptyV1(), baselineCounting)

    const now = emptyCountingState()
    now.progress.evasion = { sessionsPlayed: 3, bestEdgeCapturedPct: 65, lowestHeat: 1 }

    const text = buildTrainingLogText(emptyV1(), now, baseline)
    expect(text).toMatch(/Evasion\n-+\n/)
    expect(text).toContain('  what: playing the counter\'s seat directly to see how bet sizing and deviations read to a detector')
    expect(text).toContain('  - sessions: 1')
    expect(text).toContain('  - best edge captured: 65%')
    expect(text).toContain('  - lowest heat: 1')
    expect(text).not.toContain('new this session')
  })
})

describe('buildTrainingLogText — Live Play (four independent skills)', () => {
  it('reports all four accuracies from session deltas', () => {
    const now = emptyCountingState()
    now.progress.livePlay = {
      playAttempts: 20, playCorrect: 18, countAttempts: 20, countCorrect: 15,
      trueCountAttempts: 20, trueCountCorrect: 10, betAttempts: 20, betCorrect: 16,
    }
    const text = buildTrainingLogText(emptyV1(), now, null)
    expect(text).toMatch(/Live Play\n-+\n/)
    expect(text).toContain('  - plays: 20/18 (90.0%)')
    expect(text).toContain('  - count: 75.0%')
    expect(text).toContain('  - true count: 50.0%')
    expect(text).toContain('  - bet sizing: 80.0%')
  })
})

describe('captureSessionBaseline', () => {
  it('snapshots the current lifetime strategy accuracy and full counting progress', () => {
    const v1: PersistedState = { stats: statsWith(10, 9), handsPlayed: 10, currentStreak: 2, bestStreak: 4 }
    const counting = emptyCountingState()
    counting.progress.indexPlays = { attempts: 4, correct: 3, perDeviation: {} }

    const baseline: SessionBaseline = captureSessionBaseline(v1, counting)
    expect(baseline.strategy).toEqual({ attempts: 10, correct: 9 })
    expect(baseline.counting.indexPlays).toEqual({ attempts: 4, correct: 3, perDeviation: {} })
  })
})
