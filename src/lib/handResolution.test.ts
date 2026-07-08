import { describe, expect, it } from 'vitest'
import type { Card, Rank } from '../types'
import { resolveDealerHand, resolvePlayerHand, resolvePlayerHandWithAction } from './handResolution'
import { COUNTER_PROFILES, FLAT_PROFILE } from './playerProfiles'

const c = (rank: Rank): Card => ({ rank })

function queueDrawer(cards: Card[]): () => Card {
  const queue = [...cards]
  return () => {
    const next = queue.shift()
    if (!next) throw new Error('drawCard called more times than expected')
    return next
  }
}

describe('resolvePlayerHand', () => {
  it('plays basic strategy straight when no index play is indicated', () => {
    const result = resolvePlayerHand([c('10'), c('6')], c('9'), COUNTER_PROFILES.beginner, 0, queueDrawer([c('5')]))
    expect(result.basicAction).toBe('Hit') // hard 16 vs 9
    expect(result.initialAction).toBe('Hit')
    expect(result.deviated).toBe(false)
    expect(result.deviationType).toBeNull()
    expect(result.actions).toEqual(['Hit', 'Stand']) // 16 -> draw 5 -> 21 -> Stand
    expect(result.cards).toEqual([c('10'), c('6'), c('5')])
  })

  it('applies an index-play deviation when indicated and the compliance roll succeeds', () => {
    const drawCard = () => {
      throw new Error('should not draw — Stand never draws')
    }
    const result = resolvePlayerHand([c('10'), c('6')], c('10'), COUNTER_PROFILES.beginner, 0, drawCard, () => 0)
    expect(result.situationKey).toBe('hard-16-vs-10')
    expect(result.basicAction).toBe('Hit')
    expect(result.initialAction).toBe('Stand')
    expect(result.deviated).toBe(true)
    expect(result.deviationType).toBe('index')
  })

  it('does not apply the deviation when the compliance roll fails, even though one is indicated', () => {
    // intermediate has deviationComplianceRate 0.7; force the roll to fail, falling back to basic strategy (Hit, which draws).
    const result = resolvePlayerHand([c('10'), c('6')], c('10'), COUNTER_PROFILES.intermediate, 0, queueDrawer([c('5')]), () => 0.99)
    expect(result.initialAction).toBe('Hit')
    expect(result.deviated).toBe(false)
    expect(result.deviationType).toBeNull()
  })

  it('applies a Hit<->Stand cover deviation when nothing is indicated and the cover roll succeeds', () => {
    const result = resolvePlayerHand([c('10'), c('3')], c('2'), COUNTER_PROFILES.expert, 0, queueDrawer([c('8')]), () => 0)
    expect(result.basicAction).toBe('Stand') // hard 13 vs 2
    expect(result.initialAction).toBe('Hit')
    expect(result.deviated).toBe(true)
    expect(result.deviationType).toBe('cover')
  })

  it('never deviates for a flat (non-counting) profile, even at a high true count', () => {
    const result = resolvePlayerHand([c('10'), c('6')], c('10'), FLAT_PROFILE, 5, queueDrawer([c('5')]), () => 0)
    expect(result.initialAction).toBe('Hit')
    expect(result.deviated).toBe(false)
  })

  it('doubles by drawing exactly one card and stopping', () => {
    const result = resolvePlayerHand([c('6'), c('5')], c('6'), FLAT_PROFILE, 0, queueDrawer([c('9')]))
    expect(result.basicAction).toBe('Double') // hard 11 vs anything
    expect(result.initialAction).toBe('Double')
    expect(result.cards).toEqual([c('6'), c('5'), c('9')])
    expect(result.actions).toEqual(['Double'])
  })

  it('plays a dealt pair via the hard/soft total, not the pairs table (no player-side split)', () => {
    const result = resolvePlayerHand([c('8'), c('8')], c('10'), FLAT_PROFILE, 0, queueDrawer([c('5')]))
    expect(result.situationKey).toBe('hard-16-vs-10')
    expect(result.basicAction).toBe('Hit') // not "Split"
  })

  it('stops hitting on bust without consulting strategy again', () => {
    const result = resolvePlayerHand([c('10'), c('6')], c('9'), FLAT_PROFILE, 0, queueDrawer([c('K')]))
    expect(result.busted).toBe(true)
    expect(result.cards).toEqual([c('10'), c('6'), c('K')])
  })
})

describe('resolvePlayerHandWithAction — the user-driven mirror used by the evasion drill (step 8 slice 4)', () => {
  it('classifies a chosen action matching basic strategy as no deviation', () => {
    const result = resolvePlayerHandWithAction([c('10'), c('6')], c('9'), 0, 'Hit', queueDrawer([c('5')]))
    expect(result.basicAction).toBe('Hit') // hard 16 vs 9
    expect(result.initialAction).toBe('Hit')
    expect(result.deviated).toBe(false)
    expect(result.deviationType).toBeNull()
  })

  it('classifies a chosen action matching the indicated index play as "index"', () => {
    const drawCard = () => {
      throw new Error('should not draw — Stand never draws')
    }
    const result = resolvePlayerHandWithAction([c('10'), c('6')], c('10'), 0, 'Stand', drawCard)
    expect(result.situationKey).toBe('hard-16-vs-10') // index play: Stand at TC>=0
    expect(result.basicAction).toBe('Hit')
    expect(result.initialAction).toBe('Stand')
    expect(result.deviated).toBe(true)
    expect(result.deviationType).toBe('index')
  })

  it('classifies a chosen action that deviates from basic strategy without matching an indicated play as "cover"', () => {
    // hard 13 vs 2 -> basic Stand; nothing indicated at TC 0; user chooses Hit anyway.
    const result = resolvePlayerHandWithAction([c('10'), c('3')], c('2'), 0, 'Hit', queueDrawer([c('8')]))
    expect(result.basicAction).toBe('Stand')
    expect(result.initialAction).toBe('Hit')
    expect(result.deviated).toBe(true)
    expect(result.deviationType).toBe('cover')
  })

  it('classifies a chosen action that diverges from both basic strategy and an indicated play as "cover", not "index"', () => {
    // hard 16 vs 10 -> basic Hit, index says Stand at TC>=0; user instead chooses Double (neither).
    const result = resolvePlayerHandWithAction([c('10'), c('6')], c('10'), 0, 'Double', queueDrawer([c('5')]))
    expect(result.basicAction).toBe('Hit')
    expect(result.initialAction).toBe('Double')
    expect(result.deviated).toBe(true)
    expect(result.deviationType).toBe('cover')
  })

  it('still resolves subsequent cards via plain basic strategy after a Hit, same as the profile-driven path', () => {
    const result = resolvePlayerHandWithAction([c('10'), c('6')], c('9'), 0, 'Hit', queueDrawer([c('5')]))
    expect(result.actions).toEqual(['Hit', 'Stand']) // 16 -> draw 5 -> 21 -> Stand
    expect(result.cards).toEqual([c('10'), c('6'), c('5')])
  })

  it('doubles by drawing exactly one card and stopping', () => {
    const result = resolvePlayerHandWithAction([c('6'), c('5')], c('6'), 0, 'Double', queueDrawer([c('9')]))
    expect(result.cards).toEqual([c('6'), c('5'), c('9')])
    expect(result.actions).toEqual(['Double'])
  })
})

describe('resolveDealerHand', () => {
  it('hits until reaching 17 or more', () => {
    const result = resolveDealerHand(c('10'), c('6'), queueDrawer([c('5')]))
    expect(result.cards).toEqual([c('10'), c('6'), c('5')])
    expect(result.busted).toBe(false)
  })

  it('hits a soft 17 (H17 rule set) and stops once it reaches soft 21', () => {
    // A,6 = soft 17 (ace as 11). Drawing a 4: 11+6+4=21, still soft (ace still
    // usable as 11) and >=18, so this is the single-card case that stops.
    const result = resolveDealerHand(c('A'), c('6'), queueDrawer([c('4')]))
    expect(result.cards).toEqual([c('A'), c('6'), c('4')])
    expect(result.busted).toBe(false)
  })

  it('stops on a hard 17, never hitting', () => {
    const result = resolveDealerHand(c('10'), c('7'), () => {
      throw new Error('should not draw on a hard 17')
    })
    expect(result.cards).toEqual([c('10'), c('7')])
    expect(result.busted).toBe(false)
  })

  it('a soft 17 that demotes to a low hard total keeps hitting until 17+', () => {
    // A,6 = soft 17. Drawing a 5: 11+6+5=22 busts with the ace at 11, so it
    // demotes to 1+6+5=12 (hard 12) — still below 17, so H17 means the
    // dealer draws AGAIN rather than stopping at the first post-hit total.
    // Drawing a 6 next: 12+6=18, hard, stop.
    const result = resolveDealerHand(c('A'), c('6'), queueDrawer([c('5'), c('6')]))
    expect(result.cards).toEqual([c('A'), c('6'), c('5'), c('6')])
    expect(result.busted).toBe(false)
  })

  it('busts when a hit pushes the total over 21', () => {
    const result = resolveDealerHand(c('10'), c('6'), queueDrawer([c('K')]))
    expect(result.busted).toBe(true)
  })
})
