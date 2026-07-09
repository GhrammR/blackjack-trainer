import { describe, expect, it } from 'vitest'
import type { CountingState, PersistedState } from './persistence'
import { buildTrainingLogText, captureSessionBaseline, type SessionBaseline } from './trainingLog'

function emptyV1(): PersistedState {
  return { stats: {}, handsPlayed: 0, currentStreak: 0 }
}

function statsWith(attempts: number, correct: number): PersistedState['stats'] {
  return { 'hard-16-vs-10': { key: 'hard-16-vs-10', attempts, correct, lastSeen: 0, recentResults: [] } }
}

function emptyCountingState(): CountingState {
  return {
    settings: { numDecks: 6, seatCount: 4, dealSpeed: 'medium', lateSurrender: false },
    progress: {
      runningCount: { roundsPlayed: 0, roundsCorrect: 0 },
      trueCount: { roundsPlayed: 0, goodEstimates: 0, correctMath: 0 },
      shoeCountdown: {
        fullCountdown: { personalBests: {}, attempts: 0, correct: 0 },
        missingCards: { personalBests: {}, attempts: 0, correct: 0 },
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
    const v1: PersistedState = { stats: statsWith(20, 18), handsPlayed: 20, currentStreak: 5 }
    const counting = emptyCountingState()

    const text = buildTrainingLogText(v1, counting, null)
    expect(text).toContain('Training Log — lifetime totals (no session started)')
    expect(text).toContain(
      'Basic Strategy — practicing correct hit/stand/double/split/surrender decisions for every hand — hands: 20, correct: 18, accuracy: 90.0%, current streak: 5',
    )
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

describe('buildTrainingLogText — with a session baseline', () => {
  it('reports only the delta since the baseline, not lifetime totals, with correct accuracy math', () => {
    const baselineV1: PersistedState = { stats: statsWith(20, 18), handsPlayed: 20, currentStreak: 3 }
    const baselineCounting = emptyCountingState()
    const baseline = captureSessionBaseline(baselineV1, baselineCounting)

    // Session: 10 more hands, 8 more correct (lifetime now 30/26).
    const nowV1: PersistedState = { stats: statsWith(30, 26), handsPlayed: 30, currentStreak: 7 }
    const nowCounting = emptyCountingState()
    nowCounting.progress.runningCount = { roundsPlayed: 5, roundsCorrect: 4 }

    const text = buildTrainingLogText(nowV1, nowCounting, baseline)
    expect(text).toContain('Training Log — since session start')
    // Session deltas: 10 hands, 8 correct (30-20, 26-18) -> 80.0%
    expect(text).toContain(
      'Basic Strategy — practicing correct hit/stand/double/split/surrender decisions for every hand — hands: 10, correct: 8, accuracy: 80.0%, current streak: 7',
    )
    expect(text).toContain(
      'Running Count — tracking the Hi-Lo running count live across a multi-seat table — rounds: 5, correct: 4, accuracy: 80.0%',
    )
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

describe('buildTrainingLogText — Shoe Countdown (unified format, both formats report attempts + pace + time)', () => {
  it('Full Countdown is included whenever attempts increased, showing accuracy plus per-deck-size best pace/time', () => {
    const baselineCounting = emptyCountingState()
    baselineCounting.progress.shoeCountdown.fullCountdown = {
      personalBests: { 6: { ms: 130000, cards: 260 } },
      attempts: 3,
      correct: 2,
    }
    const baseline = captureSessionBaseline(emptyV1(), baselineCounting)

    const now = emptyCountingState()
    now.progress.shoeCountdown.fullCountdown = {
      personalBests: { 6: { ms: 123500, cards: 260 } },
      attempts: 5,
      correct: 4,
    }

    const text = buildTrainingLogText(emptyV1(), now, baseline)
    expect(text).toContain(
      'Shoe Countdown (Full Countdown) — speed-counting down a fixed-length deal (longer at bigger shoe sizes, never a zero answer) as fast as possible — attempts: 2, correct: 2, accuracy: 100.0%',
    )
    // 123500ms over 260 cards -> 475.0 ms/card -> 2.11 cards/sec
    expect(text).toContain('best pace/time: 6-deck: 2.11 cards/sec (123.50s)')
  })

  it('Full Countdown does not appear when its attempts did not increase this session', () => {
    const baselineCounting = emptyCountingState()
    baselineCounting.progress.shoeCountdown.fullCountdown = {
      personalBests: { 6: { ms: 123500, cards: 260 } },
      attempts: 5,
      correct: 4,
    }
    const baseline = captureSessionBaseline(emptyV1(), baselineCounting)

    const unchanged = emptyCountingState()
    unchanged.progress.shoeCountdown.fullCountdown = {
      personalBests: { 6: { ms: 123500, cards: 260 } },
      attempts: 5,
      correct: 4,
    }
    expect(buildTrainingLogText(emptyV1(), unchanged, baseline)).not.toContain('Full Countdown')
  })

  it('Missing Cards is included whenever attempts increased, showing accuracy plus best pace and time', () => {
    const baselineCounting = emptyCountingState()
    baselineCounting.progress.shoeCountdown.missingCards = {
      personalBests: { 1: { ms: 40000, cards: 51 } },
      attempts: 3,
      correct: 2,
    }
    const baseline = captureSessionBaseline(emptyV1(), baselineCounting)

    const now = emptyCountingState()
    now.progress.shoeCountdown.missingCards = {
      personalBests: { 1: { ms: 32000, cards: 52 } },
      attempts: 5,
      correct: 4,
    }

    const text = buildTrainingLogText(emptyV1(), now, baseline)
    expect(text).toContain(
      "Shoe Countdown (Missing Cards) — counting down a shoe with cards secretly removed, to find what's missing — attempts: 2, correct: 2, accuracy: 100.0%",
    )
    // 32000ms over 52 cards -> 615.38 ms/card -> 1.63 cards/sec
    expect(text).toContain('1-deck: 1.63 cards/sec (32.00s)')
  })

  it('never includes "(new this session)" flagging for any personal best', () => {
    const baselineCounting = emptyCountingState()
    baselineCounting.progress.shoeCountdown.fullCountdown = {
      personalBests: { 6: { ms: 130000, cards: 260 } },
      attempts: 3,
      correct: 2,
    }
    const baseline = captureSessionBaseline(emptyV1(), baselineCounting)

    const now = emptyCountingState()
    now.progress.shoeCountdown.fullCountdown = {
      personalBests: { 6: { ms: 123500, cards: 260 } },
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
    expect(text).toContain(
      "Evasion — playing the counter's seat directly to see how bet sizing and deviations read to a detector — sessions: 1, best edge captured: 65%, lowest heat: 1",
    )
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
    expect(text).toContain(
      'Live Play — playing full hands while keeping the running count, true count, and bet sizing live — plays: 20/18 (90.0%), count: 75.0%, true count: 50.0%, bet sizing: 80.0%',
    )
  })
})

describe('captureSessionBaseline', () => {
  it('snapshots the current lifetime strategy accuracy and full counting progress', () => {
    const v1: PersistedState = { stats: statsWith(10, 9), handsPlayed: 10, currentStreak: 2 }
    const counting = emptyCountingState()
    counting.progress.indexPlays = { attempts: 4, correct: 3, perDeviation: {} }

    const baseline: SessionBaseline = captureSessionBaseline(v1, counting)
    expect(baseline.strategy).toEqual({ attempts: 10, correct: 9 })
    expect(baseline.counting.indexPlays).toEqual({ attempts: 4, correct: 3, perDeviation: {} })
  })
})
