import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { DifficultyLevel } from '../../../lib/trueCountDrill'
import { DealingShoe } from './DealingShoe'
import { DiscardRack } from './DiscardRack'
import { TableSeat } from './TableSeat'

const REFERENCE_TABLE_WIDTH = 1500 // width ceiling used by the wrapper's width formula below — raised from 1100
                                    // after diagnosing it as the actual binding constraint on ordinary/large desktop
                                    // screens (confirmed: at 1920x1080 the height budget computed 1155px but was
                                    // being truncated to the old 1100px cap). Kept comfortably above what the height
                                    // formula computes on typical screens so height governs in the common case; still
                                    // acts as a sanity ceiling on very tall/4K viewports.

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

// A fixed pixel "chrome overhead" guess (previously 420px) was wrong on short
// windows because it bundled two very different things into one number: the
// header + mode-switch row above the table (independently measurable — it's
// literally where the table's own wrapper starts) and the HUD/action-button
// area below the table (not directly measurable here, since it's rendered by
// whichever mode is active, in a different file). Splitting them out: the
// first part no longer needs to be guessed at all.
const HUD_RESERVE_PX = 230 // space reserved below the table for the HUD/action buttons — measured
                            // directly against Basic Strategy (the worst case: progress panel + 5
                            // buttons including Surrender, re-measured at 214px after tightening
                            // ProgressPanel/HUD spacing) plus a ~16px margin, not a blind guess
                            // bundling in the header/mode-row too.

/**
 * Measures the real, stable height of the chrome above the table (header +
 * mode-switch row), so the table's size budget doesn't depend on scroll
 * position. `getBoundingClientRect().top` alone is VIEWPORT-relative — it
 * shrinks as the page scrolls down (the table visually approaches the top
 * of the screen), which would make the table balloon in size while
 * scrolling, then shrink back once scrolled to the top. Adding
 * `window.scrollY` converts it to a DOCUMENT-relative position instead —
 * i.e. the chrome's actual rendered height — which stays constant
 * regardless of scroll, since the chrome itself doesn't move or resize
 * when the page scrolls.
 */
function useAvailableTableHeight(ref: React.RefObject<HTMLDivElement | null>): number {
  const [availableHeight, setAvailableHeight] = useState(600)

  useEffect(() => {
    function measure() {
      const el = ref.current
      if (!el) return
      const chromeHeight = el.getBoundingClientRect().top + window.scrollY
      const available = window.innerHeight - chromeHeight - HUD_RESERVE_PX
      setAvailableHeight(Math.max(200, available))
    }
    measure()
    window.addEventListener('resize', measure)
    const id = setInterval(measure, 500) // catches layout shifts from mode switches, not just window resizes
    return () => {
      window.removeEventListener('resize', measure)
      clearInterval(id)
    }
  }, [ref])

  return availableHeight
}

// ─── Felt color presets ────────────────────────────────────────────────────────
// Swap these stop values to change the table color scheme.
// 'green' is the default; 'blue' matches real blue-layout tables.

export type FeltColor = 'green' | 'blue'

const FELT_COLORS: Record<FeltColor, { center: string; mid: string; edge: string; glow: string }> = {
  green: { center: '#165230', mid: '#0d3320', edge: '#071910', glow: 'rgba(22,82,48,0.18)' },
  blue:  { center: '#173870', mid: '#0e2348', edge: '#071220', glow: 'rgba(23,56,112,0.18)' },
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
  const { center, mid, edge, glow } = FELT_COLORS[feltColor]
  const wrapperRef = useRef<HTMLDivElement>(null)
  const scale = useTableScale(wrapperRef)
  const availableHeight = useAvailableTableHeight(wrapperRef)
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
        so cards shrink in proportion to the table's own rendered width, not the viewport. */
    <div
      ref={wrapperRef}
      className="mx-auto"
      style={{
        position: 'relative',
        containerType: 'inline-size',
        // Bounded by whichever is smallest: 100% of the parent, the width ceiling, or
        // a width derived from the REAL measured available height (availableHeight —
        // see useAvailableTableHeight, which reads the table's actual on-screen
        // position rather than guessing the chrome above it) so the table's rendered
        // HEIGHT never pushes the HUD/buttons below the viewport.
        width: `min(100%, ${REFERENCE_TABLE_WIDTH}px, ${(availableHeight * TABLE_ASPECT_RATIO).toFixed(1)}px)`,
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
          aspectRatio: `${TABLE_ASPECT_RATIO} / 1`,
          filter: 'drop-shadow(0 22px 55px rgba(0,0,0,0.85))',
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
          {/* Felt surface — inset RAIL_PX inside the rail */}
          <div
            style={{
              position: 'absolute',
              top: RAIL_PX,
              right: RAIL_PX,
              bottom: RAIL_PX,
              left: RAIL_PX,
              clipPath: `url(#${feltClipId})`,
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


