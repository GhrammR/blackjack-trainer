import { describe, expect, it } from 'vitest'
import { updatePersonalBest } from './shoeCountdown'

describe('updatePersonalBest', () => {
  it('records a time when there is no existing best', () => {
    expect(updatePersonalBest({}, 6, 45000)).toEqual({ 6: 45000 })
  })

  it('replaces the best when the new time is strictly faster', () => {
    expect(updatePersonalBest({ 6: 45000 }, 6, 40000)).toEqual({ 6: 40000 })
  })

  it('keeps the existing best when the new time is slower', () => {
    expect(updatePersonalBest({ 6: 40000 }, 6, 45000)).toEqual({ 6: 40000 })
  })

  it('keeps the existing best on a tie (not a new record)', () => {
    const bests = { 6: 40000 }
    expect(updatePersonalBest(bests, 6, 40000)).toEqual({ 6: 40000 })
  })

  it('tracks each shoe size independently', () => {
    const bests = updatePersonalBest({ 6: 40000 }, 2, 15000)
    expect(bests).toEqual({ 6: 40000, 2: 15000 })
  })

  it('does not mutate the input object', () => {
    const bests = { 6: 45000 }
    updatePersonalBest(bests, 6, 40000)
    expect(bests).toEqual({ 6: 45000 })
  })
})
