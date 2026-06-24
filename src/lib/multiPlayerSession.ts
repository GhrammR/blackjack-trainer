import type { Card } from '../types'
import { createShoe, shuffle } from './shoe'
import { hiLoValue, trueCount } from './counting'
import { resolveDealerHand, resolvePlayerHand } from './handResolution'
import { COUNTER_PROFILES, FLAT_PROFILE, type DetectionDifficulty, computeBet } from './playerProfiles'
import { type RoundRecord, MIN_DECKS_FOR_SESSION, SESSION_ROUNDS } from './detectionSession'

/**
 * Counter-detection, table-scan mode (v2 step 8 slice 2): N seats are dealt
 * in parallel off one shared shoe, and exactly one of them is a counter at
 * the chosen difficulty (the rest are flat bettors) — the user's job is to
 * pick which seat. Reuses slice 1's per-player engine completely unchanged
 * (`PlayerProfile`, `computeBet`, `resolvePlayerHand`, `resolveDealerHand`);
 * this module is purely the orchestration layer that deals N hands a round
 * instead of one and shares a single running/true count across all seats,
 * since they're all watching the same physical shoe deplete.
 *
 * Seats act in seat order each round, same as a real table — so a seat's
 * `trueCountAtDecision` reflects any cards already drawn by earlier seats
 * in hands resolved earlier in that same round, not just the count as of
 * the original bet.
 */

/** Safety margin scales with seat count: each extra seat needs roughly one more deck's worth of headroom per round. */
const SHOE_SAFETY_MARGIN_PER_SEAT = 20

export interface MultiPlayerRoundRecord {
  roundNumber: number
  seats: RoundRecord[]
}

export interface MultiPlayerSession {
  seatCount: number
  counterSeatIndex: number
  difficulty: DetectionDifficulty
  rounds: MultiPlayerRoundRecord[]
}

/** Deals a table-scan session from an already-built shoe — split out so tests can supply a hand-built shoe, matching detectionSession.ts's pattern. */
export function dealMultiPlayerSession(
  shoe: Card[],
  seatCount: number,
  difficulty: DetectionDifficulty,
  random: () => number = Math.random,
): MultiPlayerSession {
  const counterSeatIndex = Math.floor(random() * seatCount)
  const profiles = Array.from({ length: seatCount }, (_, i) =>
    i === counterSeatIndex ? COUNTER_PROFILES[difficulty] : FLAT_PROFILE,
  )

  let position = 0
  let count = 0
  const rounds: MultiPlayerRoundRecord[] = []

  function draw(): Card {
    const card = shoe[position]
    position += 1
    return card
  }
  function drawAndCount(): Card {
    const card = draw()
    count += hiLoValue(card.rank)
    return card
  }

  const safetyMargin = SHOE_SAFETY_MARGIN_PER_SEAT * seatCount

  for (let roundNumber = 1; roundNumber <= SESSION_ROUNDS; roundNumber++) {
    if (shoe.length - position < safetyMargin) break

    const trueCountAtBet = trueCount(count, (shoe.length - position) / 52)
    const bets = profiles.map((profile) => computeBet(profile, trueCountAtBet, random))

    // Round-robin deal, matching a real table: first card to every seat, then second card to every seat.
    const hands: Card[][] = profiles.map(() => [])
    for (let c = 0; c < 2; c++) {
      for (let s = 0; s < seatCount; s++) {
        hands[s].push(drawAndCount())
      }
    }

    const dealerUpcard = drawAndCount()
    const holeCard = draw() // dealt now (shoe depletes), but not counted until revealed below

    const seatRecords: RoundRecord[] = profiles.map((profile, s) => {
      const trueCountAtDecision = trueCount(count, (shoe.length - position) / 52)
      const result = resolvePlayerHand(hands[s], dealerUpcard, profile, trueCountAtDecision, drawAndCount, random)
      return {
        roundNumber,
        trueCountAtBet,
        bet: bets[s].units,
        isCoverBet: bets[s].isCoverBet,
        isElevatedBet: bets[s].isElevatedBet,
        initialPlayerHand: hands[s],
        finalPlayerHand: result.cards,
        dealerUpcard,
        situationKey: result.situationKey,
        basicAction: result.basicAction,
        actions: result.actions,
        deviated: result.deviated,
        deviationType: result.deviationType,
        playerBusted: result.busted,
      }
    })

    count += hiLoValue(holeCard.rank) // hole card revealed
    resolveDealerHand(dealerUpcard, holeCard, drawAndCount)

    rounds.push({ roundNumber, seats: seatRecords })
  }

  return { seatCount, counterSeatIndex, difficulty, rounds }
}

export function generateMultiPlayerSession(
  numDecks: number,
  seatCount: number,
  difficulty: DetectionDifficulty,
  random: () => number = Math.random,
): MultiPlayerSession {
  const requiredDecks = Math.max(numDecks, MIN_DECKS_FOR_SESSION + seatCount * 2)
  const shoe = shuffle(createShoe(requiredDecks), random)
  return dealMultiPlayerSession(shoe, seatCount, difficulty, random)
}
