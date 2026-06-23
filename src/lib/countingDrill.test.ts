import { describe, expect, it } from 'vitest'
import { cardSlotAt, cardsPerRound, dealRound } from './countingDrill'
import { createShoe } from './shoe'

describe('cardsPerRound', () => {
  it('is two cards per seat plus two for the dealer', () => {
    expect(cardsPerRound(4)).toBe(10)
    expect(cardsPerRound(1)).toBe(4)
  })
})

describe('dealRound', () => {
  it('deals exactly 2 cards to each seat and 2 to the dealer', () => {
    const shoe = createShoe(1)
    const { round } = dealRound(shoe, 0, 4)
    expect(round.seatCards).toHaveLength(4)
    for (const seat of round.seatCards) expect(seat).toHaveLength(2)
    expect(round.dealerCards).toHaveLength(2)
  })

  it('advances the shoe position by exactly the cards used', () => {
    const shoe = createShoe(1)
    const { nextPosition } = dealRound(shoe, 5, 4)
    expect(nextPosition).toBe(5 + 4 * 2 + 2)
  })

  it('deals in round-robin order: each seat once, then the dealer, twice', () => {
    const shoe = createShoe(1)
    const { round } = dealRound(shoe, 0, 3)
    // seat0c1, seat1c1, seat2c1, dealerUp, seat0c2, seat1c2, seat2c2, dealerHole
    expect(round.dealOrder).toEqual([
      round.seatCards[0][0],
      round.seatCards[1][0],
      round.seatCards[2][0],
      round.dealerCards[0],
      round.seatCards[0][1],
      round.seatCards[1][1],
      round.seatCards[2][1],
      round.dealerCards[1],
    ])
  })

  it('draws from the shoe in order without skipping or repeating cards', () => {
    const shoe = createShoe(1)
    const { round } = dealRound(shoe, 0, 4)
    expect(round.dealOrder).toEqual(shoe.slice(0, 10))
  })

  it('continues from a non-zero starting position', () => {
    const shoe = createShoe(1)
    const { round } = dealRound(shoe, 10, 4)
    expect(round.dealOrder).toEqual(shoe.slice(10, 20))
  })
})

describe('cardSlotAt', () => {
  it('maps the first pass to each seat in order, then the dealer', () => {
    expect(cardSlotAt(0, 3)).toEqual({ type: 'seat', seat: 0, cardIndex: 0 })
    expect(cardSlotAt(1, 3)).toEqual({ type: 'seat', seat: 1, cardIndex: 0 })
    expect(cardSlotAt(2, 3)).toEqual({ type: 'seat', seat: 2, cardIndex: 0 })
    expect(cardSlotAt(3, 3)).toEqual({ type: 'dealer', cardIndex: 0 })
  })

  it('maps the second pass to each seat again, then the dealer', () => {
    expect(cardSlotAt(4, 3)).toEqual({ type: 'seat', seat: 0, cardIndex: 1 })
    expect(cardSlotAt(5, 3)).toEqual({ type: 'seat', seat: 1, cardIndex: 1 })
    expect(cardSlotAt(6, 3)).toEqual({ type: 'seat', seat: 2, cardIndex: 1 })
    expect(cardSlotAt(7, 3)).toEqual({ type: 'dealer', cardIndex: 1 })
  })

  it('agrees with dealRound about which card goes where', () => {
    const shoe = createShoe(1)
    const { round } = dealRound(shoe, 0, 4)
    for (let i = 0; i < round.dealOrder.length; i++) {
      const slot = cardSlotAt(i, 4)
      const expectedCard = slot.type === 'seat' ? round.seatCards[slot.seat][slot.cardIndex] : round.dealerCards[slot.cardIndex]
      expect(round.dealOrder[i]).toBe(expectedCard)
    }
  })
})
