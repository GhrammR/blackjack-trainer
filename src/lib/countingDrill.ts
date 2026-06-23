import type { Card } from '../types'

export interface DealtRound {
  /** Each seat's 2 cards. */
  seatCards: Card[][]
  /** [upcard, holeCard]. Revealed simultaneously for this drill — see CLAUDE.md §11. */
  dealerCards: Card[]
  /** Cards in real casino deal order: one card round-robin to each seat then the dealer, twice. */
  dealOrder: Card[]
}

export function cardsPerRound(seatCount: number): number {
  return seatCount * 2 + 2
}

/**
 * Deals one round from `shoe` starting at `position`: round-robin one card to
 * each seat then the dealer, repeated twice (matching how a table is really
 * dealt). Returns the round plus the shoe position to resume from.
 */
export function dealRound(shoe: Card[], position: number, seatCount: number): { round: DealtRound; nextPosition: number } {
  const seatCards: Card[][] = Array.from({ length: seatCount }, () => [])
  const dealerCards: Card[] = []
  const dealOrder: Card[] = []
  let pos = position

  for (let pass = 0; pass < 2; pass++) {
    for (let seat = 0; seat < seatCount; seat++) {
      const card = shoe[pos]
      pos += 1
      seatCards[seat].push(card)
      dealOrder.push(card)
    }
    const dealerCard = shoe[pos]
    pos += 1
    dealerCards.push(dealerCard)
    dealOrder.push(dealerCard)
  }

  return { round: { seatCards, dealerCards, dealOrder }, nextPosition: pos }
}

export type DealSlot = { type: 'seat'; seat: number; cardIndex: number } | { type: 'dealer'; cardIndex: number }

/** Which seat (or the dealer) a given dealOrder index belongs to, matching dealRound's deal order. */
export function cardSlotAt(index: number, seatCount: number): DealSlot {
  const perPass = seatCount + 1
  const pass = Math.floor(index / perPass)
  const slot = index % perPass
  if (slot < seatCount) return { type: 'seat', seat: slot, cardIndex: pass }
  return { type: 'dealer', cardIndex: pass }
}
