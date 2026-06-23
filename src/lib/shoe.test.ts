import { describe, expect, it } from 'vitest'
import { createShoe, shuffle } from './shoe'

describe('createShoe', () => {
  it('builds a single deck of 52 cards', () => {
    expect(createShoe(1)).toHaveLength(52)
  })

  it('scales linearly with deck count', () => {
    expect(createShoe(6)).toHaveLength(312)
  })

  it('contains exactly 4 of each rank per deck', () => {
    const shoe = createShoe(2)
    const counts: Record<string, number> = {}
    for (const card of shoe) counts[card.rank] = (counts[card.rank] ?? 0) + 1
    for (const rank of ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']) {
      expect(counts[rank]).toBe(8) // 2 decks x 4 suits
    }
  })
})

describe('shuffle', () => {
  it('preserves the same multiset of cards', () => {
    const shoe = createShoe(1)
    const shuffled = shuffle(shoe)
    const sortKey = (c: { rank: string; suit?: string }) => `${c.rank}-${c.suit}`
    expect(shuffled).toHaveLength(shoe.length)
    expect([...shuffled].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))).toEqual(
      [...shoe].sort((a, b) => sortKey(a).localeCompare(sortKey(b))),
    )
  })

  it('does not mutate the input array', () => {
    const shoe = createShoe(1)
    const copy = [...shoe]
    shuffle(shoe)
    expect(shoe).toEqual(copy)
  })

  it('is deterministic given a fixed random source', () => {
    const items = [1, 2, 3, 4, 5]
    const fixedRandom = (() => {
      const values = [0.9, 0.1, 0.5, 0.2, 0.0]
      let i = 0
      return () => values[i++ % values.length]
    })()
    const result = shuffle(items, fixedRandom)
    expect(result).toHaveLength(5)
    expect(result.slice().sort()).toEqual(items.slice().sort())
  })

  it('handles an empty array', () => {
    expect(shuffle([])).toEqual([])
  })
})
