import type { ReactNode } from 'react'
import type { DifficultyLevel } from '../../../lib/trueCountDrill'
import { DealingShoe } from './DealingShoe'
import { DiscardRack } from './DiscardRack'
import { TableSeat } from './TableSeat'

// ─── Felt color presets ────────────────────────────────────────────────────────
// Swap these stop values to change the table color scheme.
// 'green' is the default; 'blue' matches real blue-layout tables.

export type FeltColor = 'green' | 'blue'

const FELT_COLORS: Record<FeltColor, { center: string; mid: string; edge: string; glow: string }> = {
  green: { center: '#165230', mid: '#0d3320', edge: '#071910', glow: 'rgba(22,82,48,0.18)' },
  blue:  { center: '#173870', mid: '#0e2348', edge: '#071220', glow: 'rgba(23,56,112,0.18)' },
}

// ─── Geometry constants ────────────────────────────────────────────────────────
// Shape: 3:1 aspect ratio (very wide, shallow D) approximates real table proportions.
// Rail: 24 px dark bumper cushion. CORNER_RADIUS fillets the two sharp top corners.

const RAIL_PX = 24          // rail thickness
const CORNER_RADIUS = 110   // px — large fillet matches real-table rail rounding
const SEAT_SCALE_X = 0.72   // seat-curve x-radius as fraction of table x-radius
const SEAT_SCALE_Y = 0.78   // seat-curve y-radius as fraction of table height
const ARC_MIN = 0.23        // rightmost seat: t = ARC_MIN × π  (narrowed from 0.18 for 800px table)
const ARC_MAX = 0.77        // leftmost seat:  t = ARC_MAX × π  (narrowed from 0.82)

// Dark padded bumper rail — near-black leather cushion with top-surface highlight
// and deep shadow at the outer/bottom edge to suggest a convex cross-section.
const RAIL_BG = [
  'radial-gradient(ellipse at 50% -20%, rgba(110,110,110,0.45) 0%, transparent 42%)',
  'radial-gradient(ellipse at 50% 140%, rgba(0,0,0,0.82) 0%, transparent 46%)',
  'linear-gradient(180deg, #262626 0%, #141414 35%, #080808 100%)',
].join(', ')

/**
 * Positions for N seats fanned along the player arc.
 *
 * Parametric ellipse centered at (50%, 0%) — midpoint of the flat top edge.
 *   x(t) = 50 + 50·SEAT_SCALE_X·cos(t)    (% of inner-felt width)
 *   y(t) = SEAT_SCALE_Y·sin(t)·100          (% of inner-felt height)
 *
 * i=0 → leftmost (t=ARC_MAX·π), i=N-1 → rightmost (t=ARC_MIN·π).
 * N=1 snaps to t=π/2 (dead center bottom).
 * zIndex increases with topPct so nearer seats render in front of corner seats.
 */
function arcPositions(n: number): { leftPct: number; topPct: number; zIndex: number }[] {
  if (n === 0) return []
  if (n === 1) {
    const topPct = SEAT_SCALE_Y * 100
    return [{ leftPct: 50, topPct, zIndex: Math.round(topPct) }]
  }
  return Array.from({ length: n }, (_, i) => {
    const t = Math.PI * (ARC_MAX - (ARC_MAX - ARC_MIN) * (i / (n - 1)))
    const leftPct = 50 + 50 * SEAT_SCALE_X * Math.cos(t)
    const topPct = SEAT_SCALE_Y * Math.sin(t) * 100
    return { leftPct, topPct, zIndex: Math.round(topPct) }
  })
}

interface CasinoTableProps {
  /** Content rendered in the center dealer zone (cards, labels, etc.) */
  dealerSlot: ReactNode
  /** One entry per seat. Each is wrapped in a TableSeat automatically. */
  seatContents: ReactNode[]
  /** Optional label per seat (e.g. "You", "Seat 3") */
  seatLabels?: (string | undefined)[]
  /** Which seat index is currently active. Defaults to all active. */
  activeSeatIndex?: number
  /** Which seat gets the user highlight ring. Defaults to 0. */
  userSeatIndex?: number
  totalDecks?: number
  /** Decks remaining for ShoeRack. Defaults to totalDecks (full/decorative). */
  decksRemaining?: number
  /** DiscardRack fill fraction 0–1. Defaults to 0. */
  discardFraction?: number
  /** Calibration tick marks on the discard rack (True Count drill). Defaults to no ticks. */
  discardDifficulty?: DifficultyLevel
  /** Felt color preset. Defaults to 'green'. */
  feltColor?: FeltColor
}

/**
 * The shared D-shaped felt-table shell for all Double Down 2.0 modes.
 *
 * Shape: 3:1 wide/shallow half-ellipse (clip-path), flat dealer edge at the
 * top, gentle curved player arc at the bottom. Concentric clip-path divs give
 * the wood bumper rail (outer) and felt surface (inner).
 *
 * Layout:
 *   flat top edge → dealer zone: DiscardRack | dealerSlot | ShoeRack
 *   curved arc    → N seats positioned via arcPositions()
 */
export function CasinoTable({
  dealerSlot,
  seatContents,
  seatLabels = [],
  activeSeatIndex,
  userSeatIndex = 0,
  totalDecks = 6,
  decksRemaining,
  discardFraction = 0,
  discardDifficulty,
  feltColor = 'green',
}: CasinoTableProps) {
  const decksFill = decksRemaining ?? totalDecks
  const positions = arcPositions(seatContents.length)
  const { center, mid, edge, glow } = FELT_COLORS[feltColor]

  const feltBg = [
    'repeating-linear-gradient(78deg, transparent 0px, transparent 2px, rgba(0,0,0,0.055) 2px, rgba(0,0,0,0.055) 3px)',
    `radial-gradient(ellipse at 50% 15%, ${center} 0%, ${mid} 52%, ${edge} 100%)`,
  ].join(', ')

  return (
    // Outermost: positions the ambient glow and the table together.
    // The glow div uses transform:scale so its gradient visually extends beyond the
    // table bounds without disturbing layout or the drop-shadow filter on the table.
    <div className="mx-auto w-full max-w-[800px]" style={{ position: 'relative' }}>
      {/* Ambient glow — dim radial halo behind the table, like a light over the felt */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          transform: 'scale(1.25, 1.9)',
          background: `radial-gradient(ellipse at 50% 38%, ${glow} 0%, transparent 60%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Table shell — drop-shadow traces D-shape alpha channel */}
      <div
        style={{
          position: 'relative',
          aspectRatio: '2.0 / 1',
          filter: 'drop-shadow(0 22px 55px rgba(0,0,0,0.85))',
        }}
      >
        {/* Corner-rounding wrapper: clips the two sharp top corners where the
            flat dealer edge meets the curved arc. overflow:hidden here means the
            ellipse clip-path on the rail div only handles the bottom curve;
            the top corners are already rounded by border-radius before it sees them. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: `${CORNER_RADIUS}px ${CORNER_RADIUS}px 0 0`,
            overflow: 'hidden',
          }}
        >
          {/* Dark padded bumper rail */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              clipPath: 'ellipse(50% 100% at 50% 0%)',
              background: RAIL_BG,
            }}
          >
            {/* Felt surface — inset RAIL_PX inside the rail */}
            <div
              style={{
                position: 'absolute',
                top: RAIL_PX,
                right: RAIL_PX,
                bottom: RAIL_PX,
                left: RAIL_PX,
                clipPath: 'ellipse(50% 100% at 50% 0%)',
                background: feltBg,
                boxShadow: 'inset 0 14px 36px rgba(0,0,0,0.80), inset 0 0 90px rgba(0,0,0,0.30)',
              }}
            >
              {/* Arc text — lower felt, concentric with the player arc.
                  ViewBox 1000×345 matches felt ~2.9:1 ratio (preserveAspectRatio=none
                  so viewBox coords map proportionally to screen pixels).
                  All arcs: sweep=1 (clockwise left→right, bowing DOWN toward player).
                  Radii from three-point circle formula; bow/chord ≈12% on each line
                  so they read as truly parallel arcs following the same curvature.
                  Line order top→bottom mirrors the reference table layout.
                  Verified S17: STAND (not hit). */}
              <svg
                viewBox="0 0 1000 345"
                preserveAspectRatio="xMidYMid slice"
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                }}
              >
                <defs>
                  {/*
                    Three truly concentric arcs sharing the player-arc's circle center
                    at (500, −153.5) in viewBox coords (same center as the table ellipse,
                    above the felt). All sweep=1 → clockwise left→right → ∪ shape (smile):
                    endpoints are HIGHER, center dips DOWN toward the player.

                    Player arc (seat positions): r≈422, endpoints (197,144)↔(803,144),
                    center-bottom (500,269). Lines 1–3 use inset radii of 355/390/422.

                    Line 1: r=355, endpoints y=36,  center y=201  (bow=165u)
                    Line 2: r=390, endpoints y=96,  center y=236  (bow=140u)
                    Line 3: r=422, endpoints y=144, center y=269  (bow=125u) ← player arc
                  */}
                  <path id="feltArc1" d="M 200,36 A 355,355 0 0 0 800,36" />
                  <path id="feltArc2" d="M 200,96 A 390,390 0 0 0 800,96" />
                  <path id="feltArc3" d="M 197,144 A 422,422 0 0 0 803,144" />
                </defs>
                <text
                  fill="rgba(255,255,255,0.16)"
                  fontFamily="Georgia, 'Times New Roman', serif"
                  fontSize="26"
                  letterSpacing="5"
                  textAnchor="middle"
                >
                  <textPath href="#feltArc1" startOffset="50%">
                    BLACKJACK PAYS 3 TO 2
                  </textPath>
                </text>
                <text
                  fill="rgba(255,255,255,0.12)"
                  fontFamily="Georgia, 'Times New Roman', serif"
                  fontSize="16"
                  letterSpacing="3"
                  textAnchor="middle"
                >
                  <textPath href="#feltArc2" startOffset="50%">
                    DEALER MUST STAND ON SOFT 17
                  </textPath>
                </text>
                <text
                  fill="rgba(255,255,255,0.12)"
                  fontFamily="Georgia, 'Times New Roman', serif"
                  fontSize="19"
                  letterSpacing="4"
                  textAnchor="middle"
                >
                  <textPath href="#feltArc3" startOffset="50%">
                    INSURANCE PAYS 2 TO 1
                  </textPath>
                </text>
              </svg>

              {/* Dealer zone — centered on the flat top edge */}
              <div
                style={{
                  position: 'absolute',
                  top: 14,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                }}
              >
                <DiscardRack fillFraction={discardFraction} totalDecks={totalDecks} difficulty={discardDifficulty} />
                <div
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
                >
                  {dealerSlot}
                </div>
                <DealingShoe decksRemaining={decksFill} totalDecks={totalDecks} />
              </div>

              {/* Seats fanned along the inset arc */}
              {positions.map(({ leftPct, topPct, zIndex }, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex,
                  }}
                >
                  <TableSeat
                    label={seatLabels[i]}
                    isActive={activeSeatIndex === undefined || activeSeatIndex === i}
                    isUser={i === userSeatIndex}
                  >
                    {seatContents[i]}
                  </TableSeat>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
