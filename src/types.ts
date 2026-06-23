export type Rank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A'

export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades'

export interface Card {
  rank: Rank
  suit?: Suit
}

export interface HandValue {
  total: number
  /** True if an ace is being counted as 11 without busting. */
  soft: boolean
}
