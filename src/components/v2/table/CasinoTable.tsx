import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { DifficultyLevel } from '../../../lib/trueCountDrill'
import { DealingShoe } from './DealingShoe'
import { DiscardRack } from './DiscardRack'
import { TableSeat } from './TableSeat'

const REFERENCE_TABLE_WIDTH = 1500 // width ceiling — a sanity cap on very wide/4K viewports. The common case is
                                    // governed by height instead: see the wrapper's aspect-ratio/max-height sizing
                                    // below, which fills whatever height its flex-1 parent slot gives it.

/**
 * Tracks this table's own rendered width so the shoe/rack (built from
 * absolute pixel offsets, not CSS) can scale in proportion to the felt
 * itself — same instinct as PlayingCard's cqw clamp, just done in JS
 * because these two components compute pixel geometry, not just apply a size class.
 */
function useTableScale(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(REFERENCE_TABLE_WIDTH)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  return Math.min(1, width / REFERENCE_TABLE_WIDTH)
}

// ─── Felt color presets ────────────────────────────────────────────────────────
// Swap these stop values to change the table color scheme.
// 'green' is the default; 'blue' matches real blue-layout tables.

export type FeltColor = 'green' | 'blue'

const FELT_COLORS: Record<FeltColor, { center: string; mid: string; edge: string }> = {
  green: { center: '#165230', mid: '#0d3320', edge: '#071910' },
  blue:  { center: '#173870', mid: '#0e2348', edge: '#071220' },
}

// ─── Geometry constants ────────────────────────────────────────────────────────
// Shape: a true capital-D — traced from a real training-table reference photo
// (references/20260627_170137.jpg). Straight sides run down from the flat dealer
// edge for STRAIGHT_SIDE_FRACTION of the table's height, THEN curve into the
// rounded player-side bottom — not a continuous ellipse (which can't express a
// straight run and reads as a curve ending in points at the top corners). See
// the dShapePath()/arcPositions() comments below and DECISIONS.md.
// Rail: 24 px dark bumper cushion.

const RAIL_PX = 24                    // rail thickness
const CORNER_RADIUS_FRAC = 0.07       // top-corner fillet, as a fraction of the box (scales with table size)
const STRAIGHT_SIDE_FRACTION = 0.10   // sides run straight for this fraction of height before curving — subtle,
                                       // just a hint before the curve begins (a real table's straight run is nearly
                                       // imperceptible, not a pronounced segment) —
                                       // shared by dShapePath() (the clip shape) and arcPositions() (seat
                                       // positions) so the two can never drift out of sync with each other.
const SEAT_INSET_Y = 0.85             // how deep into the curved portion seats sit (margin before the felt's outer edge)
const SEAT_SCALE_X = 0.72             // seat-curve x-radius as fraction of table x-radius
const ARC_MIN = 0.06                  // rightmost seat: t = ARC_MIN × π
const ARC_MAX = 0.94                  // leftmost seat:  t = ARC_MAX × π — safe close to the true 0/π extremes now,
                                       // since every t in [0,π] stays within the curved bottom portion (sin(t) ≥ 0),
                                       // never climbing into the straight-side zone the way a continuous ellipse would.

const TABLE_ASPECT_RATIO = 1.75       // width ÷ height of the table box. A shorter straight-side run means less of
                                       // the box is "spent" on straight sides, so a slightly shallower box (vs. the
                                       // previous 1.65) still reads as a well-proportioned curve.

// Dark padded bumper rail — near-black leather cushion with top-surface highlight
// and deep shadow at the outer/bottom edge to suggest a convex cross-section.
const RAIL_BG = [
  'radial-gradient(ellipse at 50% -20%, rgba(110,110,110,0.45) 0%, transparent 42%)',
  'radial-gradient(ellipse at 50% 140%, rgba(0,0,0,0.82) 0%, transparent 46%)',
  'linear-gradient(180deg, #262626 0%, #141414 35%, #080808 100%)',
].join(', ')

/**
 * A capital-D outline as an SVG path, in fractional (0-1) coordinates —
 * meant to be used with `clipPathUnits="objectBoundingBox"` so the exact
 * same path string correctly clips both the (larger) rail box and the
 * (smaller, inset) felt box without any separate scaling math: straight
 * across the top, rounded top corners, straight DOWN each side to depth
 * `d`, then a half-ellipse bottom curve (center (0.5, d), rx=0.5, ry=1-d)
 * back up to the other side's straight segment.
 */
function dShapePath(r: number, d: number): string {
  return [
    `M ${r},0`,
    `L ${1 - r},0`,
    `A ${r} ${r} 0 0 1 1,${r}`,
    `L 1,${d}`,
    `A 0.5 ${1 - d} 0 0 1 0,${d}`,
    `L 0,${r}`,
    `A ${r} ${r} 0 0 1 ${r},0`,
    'Z',
  ].join(' ')
}

/**
 * Positions for N seats fanned along the player arc — the curved bottom
 * portion of the D only (from depth STRAIGHT_SIDE_FRACTION down to the
 * full height), never the straight-side zone above it.
 *
 * Parametric half-ellipse, center (50%, STRAIGHT_SIDE_FRACTION·100%):
 *   x(t) = 50 + 50·SEAT_SCALE_X·cos(t)
 *   y(t) = STRAIGHT_SIDE_FRACTION·100 + (100 − STRAIGHT_SIDE_FRACTION·100)·SEAT_INSET_Y·sin(t)
 *
 * i=0 → leftmost (t=ARC_MAX·π), i=N-1 → rightmost (t=ARC_MIN·π).
 * N=1 snaps to t=π/2 (dead center, deepest point of the curve).
 * zIndex increases with topPct so nearer seats render in front of corner seats.
 */
function arcPositions(n: number): { leftPct: number; topPct: number; zIndex: number }[] {
  if (n === 0) return []
  const baseTopPct = STRAIGHT_SIDE_FRACTION * 100
  const curveDepthPct = 100 - baseTopPct
  if (n === 1) {
    const topPct = baseTopPct + curveDepthPct * SEAT_INSET_Y
    return [{ leftPct: 50, topPct, zIndex: Math.round(topPct) }]
  }
  return Array.from({ length: n }, (_, i) => {
    const t = Math.PI * (ARC_MAX - (ARC_MAX - ARC_MIN) * (i / (n - 1)))
    const leftPct = 50 + 50 * SEAT_SCALE_X * Math.cos(t)
    const topPct = baseTopPct + curveDepthPct * SEAT_INSET_Y * Math.sin(t)
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
 * Shape: a true capital D (see dShapePath()) — flat dealer edge at the top,
 * straight sides running down alongside the dealer, then curving into the
 * rounded player-side bottom. The rail (outer) and felt (inner) are two
 * differently-sized boxes clipped to the same D path.
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
  const { center, mid, edge } = FELT_COLORS[feltColor]
  const wrapperRef = useRef<HTMLDivElement>(null)
  const scale = useTableScale(wrapperRef)
  const clipId = useId()
  const railClipId = `${clipId}-rail`
  const feltClipId = `${clipId}-felt`
  const dPath = dShapePath(CORNER_RADIUS_FRAC, STRAIGHT_SIDE_FRACTION)

  const feltBg = [
    'repeating-linear-gradient(78deg, transparent 0px, transparent 2px, rgba(0,0,0,0.055) 2px, rgba(0,0,0,0.055) 3px)',
    `radial-gradient(ellipse at 50% 15%, ${center} 0%, ${mid} 52%, ${edge} 100%)`,
  ].join(', ')

  return (
    /* Outermost: positions the ambient glow and the table together.
        The glow div uses transform:scale so its gradient visually extends beyond the
        table bounds without disturbing layout or the drop-shadow filter on the table.
        containerType: 'inline-size' makes this the cqw reference for PlayingCard sizing,
        so cards shrink in proportion to the table's own rendered width, not the viewport.

        Sizing is pure CSS: width/height are both 'auto', constrained only by
        maxWidth/maxHeight + aspectRatio. With a definite maxHeight (from the
        flex-1/min-h-0 slot the caller wraps this in), this behaves like
        object-fit: contain — the browser picks the largest box that fits
        the ratio without exceeding either max. No JS height measurement. */
    <div
      ref={wrapperRef}
      className="mx-auto"
      style={{
        position: 'relative',
        containerType: 'inline-size',
        overflow: 'hidden',
        // Ratio-preserving fit within the parent's size-containment box (see the
        // `containerType: 'size'` slot each mode wraps this in). Each axis is the
        // min of: the container's own size in that axis (cqw/cqh), the absolute
        // cap, and the OTHER axis's size converted through the ratio — so
        // whichever axis is actually the binding constraint, the other axis's
        // formula picks the matching ratio-derived term too. This is what makes
        // it behave like `object-fit: contain` without relying on flex-stretch
        // (which can't shrink back once max-width alone has clamped a width).
        width: `min(100cqw, ${REFERENCE_TABLE_WIDTH}px, calc(100cqh * ${TABLE_ASPECT_RATIO}))`,
        height: `min(100cqh, ${(REFERENCE_TABLE_WIDTH / TABLE_ASPECT_RATIO).toFixed(2)}px, calc(100cqw / ${TABLE_ASPECT_RATIO}))`,
      }}
    >
      {/* Hidden defs — one D-shape path, referenced (via objectBoundingBox units, so
          it auto-fits whichever box uses it) by both the rail and the smaller inset
          felt box below, so both are guaranteed the same shape with zero duplicated math. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <clipPath id={railClipId} clipPathUnits="objectBoundingBox">
            <path d={dPath} />
          </clipPath>
          <clipPath id={feltClipId} clipPathUnits="objectBoundingBox">
            <path d={dPath} />
          </clipPath>
        </defs>
      </svg>

      {/* Table shell — fills the already-ratio-correct outer wrapper exactly. No
          drop-shadow filter here: it used to bleed its 55px blur past the D
          shape and then get hard-clipped by the wrapper's own `overflow:
          hidden` rectangle — the actual source of the "glow"/halo around the
          table exterior (blended fine near the bottom corners, where the D's
          curve already reaches close to the wrapper edge leaving little room
          for the cutoff to show; visibly wrong above and on the sides, where
          the gap was bigger). Removed rather than reshaped, since the rail's
          own gradients already read as a raised bumper without it. */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
        }}
      >
        {/* Dark padded bumper rail — the D path itself now handles the rounded top
            corners, so no separate corner-rounding wrapper is needed. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            clipPath: `url(#${railClipId})`,
            background: RAIL_BG,
          }}
        >
          {/* Felt surface — inset RAIL_PX inside the rail. overflow:hidden here
              (seats/labels near the curved edge are already visually clipped by
              clipPath, but clip-path alone doesn't stop them contributing to an
              ancestor's scrollable overflow) so the viewport-fit shell above
              never gets a phantom scrollbar over content nothing ever shows. */}
          <div
            style={{
              position: 'absolute',
              top: RAIL_PX,
              right: RAIL_PX,
              bottom: RAIL_PX,
              left: RAIL_PX,
              clipPath: `url(#${feltClipId})`,
              overflow: 'hidden',
              background: feltBg,
              boxShadow: 'inset 0 14px 36px rgba(0,0,0,0.80), inset 0 0 90px rgba(0,0,0,0.30)',
            }}
          >
              {/* Arc text — upper-middle felt, a small decorative banner (NOT
                  spanning the seat arc — that's a separate, wider curve).
                  ViewBox height is TABLE_ASPECT_RATIO-derived (1000 / 1.75 ≈
                  571.43), matching the felt's REAL rendered aspect ratio —
                  previously this was hardcoded to a 2.9:1 box (1000×345)
                  with preserveAspectRatio="slice", which silently scaled
                  everything up ~66% to cover the (wider) real felt and
                  cropped the sides; that mismatch, not the font-size values,
                  was why the text rendered far bigger than intended. Now
                  that the viewBox's own aspect ratio matches the box it's
                  rendered into, slice/meet/none are all equivalent (no crop,
                  no stretch) and viewBox units map 1:1 to real proportions.
                  All arcs: sweep=1 (clockwise left→right, bowing DOWN toward
                  player), bow/chord ≈12-13% (a shallow "smile", not a deep
                  dish), sized/placed to match the reference photo
                  (references/20260627_170137.jpg): centered in the felt's
                  upper-middle band, spanning roughly half its width.
                  Text reads "DEALER MUST HIT SOFT 17" — matches the actual
                  dealer engine (handResolution.ts) and the strategy chart
                  (strategy.ts), both converted to this app's fixed H17 rule
                  set. Felt, engine, and grading all agree. */}
              <svg
                viewBox={`0 0 1000 ${(1000 / TABLE_ASPECT_RATIO).toFixed(2)}`}
                preserveAspectRatio="xMidYMid meet"
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
                    Three parallel arcs (shared center x=500, increasing radius/depth
                    top→bottom), each via the three-point-circle/sagitta formula:
                    r = (halfChord² + bow²) / (2·bow). All sweep=1 → clockwise
                    left→right → ∪ shape (smile): endpoints are HIGHER, center
                    dips DOWN toward the player. Independent of, and narrower
                    than, the player seat arc (arcPositions() below) — this
                    banner is its own small decorative element, not the same
                    curve the seats sit on.

                    Line 1: halfChord=230, bow=57.5  → r≈489, endpoints y=120, center y=177.5
                    Line 2: halfChord=250, bow=62.5  → r≈531, endpoints y=170, center y=232.5
                    Line 3: halfChord=270, bow=67.5  → r≈574, endpoints y=220, center y=287.5
                  */}
                  <path id="feltArc1" d="M 270,120 A 489,489 0 0 0 730,120" />
                  <path id="feltArc2" d="M 250,170 A 531,531 0 0 0 750,170" />
                  <path id="feltArc3" d="M 230,220 A 574,574 0 0 0 770,220" />
                </defs>
                <text
                  fill="rgba(255,255,255,0.16)"
                  fontFamily="Georgia, 'Times New Roman', serif"
                  fontSize="24"
                  letterSpacing="4"
                  textAnchor="middle"
                >
                  <textPath href="#feltArc1" startOffset="50%">
                    BLACKJACK PAYS 3 TO 2
                  </textPath>
                </text>
                <text
                  fill="rgba(255,255,255,0.12)"
                  fontFamily="Georgia, 'Times New Roman', serif"
                  fontSize="13"
                  letterSpacing="2"
                  textAnchor="middle"
                >
                  <textPath href="#feltArc2" startOffset="50%">
                    DEALER MUST HIT SOFT 17
                  </textPath>
                </text>
                <text
                  fill="rgba(255,255,255,0.12)"
                  fontFamily="Georgia, 'Times New Roman', serif"
                  fontSize="22"
                  letterSpacing="3"
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
                  top: 14 * scale,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16 * scale,
                }}
              >
                <DiscardRack
                  fillFraction={discardFraction}
                  totalDecks={totalDecks}
                  difficulty={discardDifficulty}
                  scale={scale}
                />
                <div
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 * scale }}
                >
                  {dealerSlot}
                </div>
                <DealingShoe decksRemaining={decksFill} totalDecks={totalDecks} scale={scale} />
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
  )
}


