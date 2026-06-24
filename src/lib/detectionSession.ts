import type { Action, Card } from '../types'
import { createShoe, shuffle } from './shoe'
import { hiLoValue, trueCount } from './counting'
import { resolveDealerHand, resolvePlayerHand } from './handResolution'
import { COUNTER_PROFILES, FLAT_PROFILE, type DetectionDifficulty, computeBet } from './playerProfiles'

/**
 * Generates one counter-detection review session (v2 step 8): a single
 * simulated player — either a flat bettor or a counter at the chosen
 * difficulty tier, 50/50 — plays through a shoe, and the engine records
 * everything an observer would need to judge whether they're counting.
 *
 * Full hand + dealer resolution with correct hole-card exposure timing:
 * the hole card is dealt (and the shoe position advances) before the
 * player acts, but its VALUE isn't added to the running count until it's
 * revealed after the player's decisions are locked in — matching real
 * table timing and finally addressing the step-3 TODO this deferred.
 * Decks-remaining tracks physical shoe depletion (including the
 * not-yet-counted hole card), which is a distinct, real thing from the
 * running count itself only reflecting known card values.
 *
 * The dealer always plays out their hand to completion, even if the
 * player busted — see CLAUDE.md §11 for why.
 */

export const SESSION_ROUNDS = 25

/**
 * 25 rounds need more cards than a 1-2 deck shoe reliably has (an average
 * round consumes ~5-6 cards). Detection sessions use at least this many
 * decks regardless of the user's shared shoe-size setting, so a session
 * isn't cut short before a bet-spread pattern can read clearly.
 */
export const MIN_DECKS_FOR_SESSION = 4

/** Stop dealing further rounds once fewer than this many cards remain in the shoe. */
const SHOE_SAFETY_MARGIN = 20

export interface RoundRecord {
  roundNumber: number
  trueCountAtBet: number
  bet: number
  isCoverBet: boolean
  isElevatedBet: boolean
  initialPlayerHand: Card[]
  finalPlayerHand: Card[]
  dealerUpcard: Card
  situationKey: string
  basicAction: Action
  actions: Action[]
  deviated: boolean
  deviationType: 'index' | 'cover' | null
  playerBusted: boolean
}

export interface DetectionSession {
  isCounting: boolean
  profileName: string
  difficulty: DetectionDifficulty
  rounds: RoundRecord[]
}

/** Deals a session from an already-built shoe — split out from generateDetectionSession so tests can supply a hand-built shoe and assert exact counting/timing behavior. */
export function dealSession(shoe: Card[], difficulty: DetectionDifficulty, random: () => number = Math.random): DetectionSession {
  const isCounting = random() < 0.5
  const profile = isCounting ? COUNTER_PROFILES[difficulty] : FLAT_PROFILE

  let position = 0
  let count = 0
  const rounds: RoundRecord[] = []

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

  for (let roundNumber = 1; roundNumber <= SESSION_ROUNDS; roundNumber++) {
    if (shoe.length - position < SHOE_SAFETY_MARGIN) break

    const trueCountAtBet = trueCount(count, (shoe.length - position) / 52)
    const { units: bet, isCoverBet, isElevatedBet } = computeBet(profile, trueCountAtBet, random)

    const initialPlayerHand = [drawAndCount(), drawAndCount()]
    const dealerUpcard = drawAndCount()
    const holeCard = draw() // dealt now (shoe depletes), but not counted until revealed below

    const trueCountAtDecision = trueCount(count, (shoe.length - position) / 52)
    const playerResult = resolvePlayerHand(initialPlayerHand, dealerUpcard, profile, trueCountAtDecision, drawAndCount, random)

    count += hiLoValue(holeCard.rank) // hole card revealed
    resolveDealerHand(dealerUpcard, holeCard, drawAndCount)

    rounds.push({
      roundNumber,
      trueCountAtBet,
      bet,
      isCoverBet,
      isElevatedBet,
      initialPlayerHand,
      finalPlayerHand: playerResult.cards,
      dealerUpcard,
      situationKey: playerResult.situationKey,
      basicAction: playerResult.basicAction,
      actions: playerResult.actions,
      deviated: playerResult.deviated,
      deviationType: playerResult.deviationType,
      playerBusted: playerResult.busted,
    })
  }

  return { isCounting, profileName: profile.name, difficulty, rounds }
}

export function generateDetectionSession(
  numDecks: number,
  difficulty: DetectionDifficulty,
  random: () => number = Math.random,
): DetectionSession {
  const shoe = shuffle(createShoe(Math.max(numDecks, MIN_DECKS_FOR_SESSION)), random)
  return dealSession(shoe, difficulty, random)
}
