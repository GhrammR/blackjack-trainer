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

export type Action = 'Hit' | 'Stand' | 'Double' | 'Split' | 'Surrender'

/** Dealer upcard / pair rank, bucketed: 10/J/Q/K share '10'. */
export type DealerUpcardKey = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'A'

export type PairRankKey = DealerUpcardKey

export type Category = 'hard' | 'soft' | 'pairs'
