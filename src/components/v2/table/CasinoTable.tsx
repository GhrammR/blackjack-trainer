import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { DifficultyLevel } from '../../../lib/trueCountDrill'
import { DealerChipTray, TRAY_W } from './DealerChipTray'
import { DealingShoe } from './DealingShoe'
import { DiscardRack } from './DiscardRack'
import { TableSeat } from './TableSeat'

const REFERENCE_TABLE_WIDTH = 1500 // width ceiling — a sanity cap on very wide/4K viewports. The common case is
                                    // governed by height instead: see the wrapper's aspect-ratio/max-height sizing
                                    // below, which fills whatever height its flex-1 parent slot gives it.

// Floor on the shoe/rack scale below — at REFERENCE_TABLE_WIDTH=1500 as the
// unreachable ceiling, the table's typical rendered width (usually a few
// hundred px, governed by height not width) puts the raw ratio around
// 0.2-0.45 in normal play, which shrinks DiscardRack's tick-mark labels
// (7px native) and card-stack detail below legibility. PlayingCard already
// has its own floor via clamp(); this gives the shoe/rack the same floor,
// unlike PlayingCard's continuous CSS clamp this is a JS step at the floor
// value, since these two components compute pixel geometry, not a CSS size.
const MIN_GLYPH_SCALE = 0.65

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

  return Math.max(MIN_GLYPH_SCALE, Math.min(1, width / REFERENCE_TABLE_WIDTH))
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

const RAIL_PX = 24                    // rail (padded leather bumper) thickness
const WOOD_EDGE_PX = 11               // visible thickness of the wood dealer-edge strip — deliberately much
                                       // thinner than RAIL_PX (~2x difference), not a scaled-down bumper.
const CORNER_RADIUS_FRAC = 0.07       // top-corner fillet, as a fraction of the box (scales with table size)
// The leather bumper doesn't end exactly at the top corner — per the
// reference photos, it rounds the corner and continues a short distance
// along the flat top before stopping, with the wood dealer edge filling
// the middle. Dealer area (wood + chip tray/shoe) ≈ 7/8 of the top edge's
// straight run; the two leather extensions together ≈ the remaining 1/8
// (so each extension ≈ 1/16 of that span). WOOD_START_FRAC is where the
// wood strip (and the leather extension's end point / seam line) sits.
const TOP_STRAIGHT_SPAN = 1 - 2 * CORNER_RADIUS_FRAC
const LEATHER_EXTENSION_FRAC = TOP_STRAIGHT_SPAN / 16
const WOOD_START_FRAC = CORNER_RADIUS_FRAC + LEATHER_EXTENSION_FRAC
// Tray-to-edge span: the exact horizontal distance from the chip tray's
// real edge (not its center — traySpanPosition() below subtracts the
// tray's own half-width) out to each side's table corner target
// (CORNER_RADIUS_FRAC on the left, CORNER_FRAC on the right). "1/3 of the
// way" or "1/2 of the way" are fractions of THIS span, computed exactly by
// traySpanPosition() — not eyeballed guesses at a raw felt-percentage.
const CORNER_FRAC = 1 - CORNER_RADIUS_FRAC
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

// Padded leather bumper — ONE FLAT, UNIFORM COLOR across the entire
// surface. Every earlier attempt at this (a broad dark-to-gray fade, then
// a "highlight band + shadow band" structure) still produced a visible
// light side and dark side, which reads as a cast shadow rather than a
// leather material — so this is deliberately a single solid color with NO
// gradient, highlight, or shadow layered onto the cushion body at all.
const RAIL_BG = '#1c1512'

// Wood dealer edge — a genuinely different MATERIAL from the leather
// bumper (warm brown wood tones + a subtle grain texture), not a thinner
// slice of the same dark cushion gradient. Flush/flat shading (a soft top
// highlight, no raised-object drop-shadow) so it reads as an inset cabinet
// edge rather than a rod sitting on top of the felt.
const WOOD_EDGE_BG = [
  'repeating-linear-gradient(90deg, rgba(0,0,0,0.12) 0px, transparent 1.5px, transparent 5px, rgba(0,0,0,0.08) 6px, transparent 9px)',
  'linear-gradient(180deg, #9a7248 0%, #7a5535 55%, #5c3f22 100%)',
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
 * i=0 → RIGHTMOST (t=ARC_MIN·π), i=N-1 → LEFTMOST (t=ARC_MAX·π) — matching
 * real-table seat numbering: Seat 1 is the dealer's left (first base),
 * which in this top-down player-facing view is the RIGHT side of the felt;
 * seats count up leftward from there (highest number = third base, dealer's
 * right). Every mode's seatLabels/seatContents are already indexed in
 * seat-number order (index 0 = "Seat 1"), so this index→position mapping
 * is the only place the numbering convention lives — no mode file needed
 * to change. (Previously i=0 was leftmost, i.e. Seat 1 rendered on the
 * dealer's right — backwards from the real convention; confirmed via grep
 * that no grading/dealing logic anywhere depends on screen position, only
 * array index, so this flip is purely visual.)
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
    const t = Math.PI * (ARC_MIN + (ARC_MAX - ARC_MIN) * (i / (n - 1)))
    const leftPct = 50 + 50 * SEAT_SCALE_X * Math.cos(t)
    const topPct = baseTopPct + curveDepthPct * SEAT_INSET_Y * Math.sin(t)
    return { leftPct, topPct, zIndex: Math.round(topPct) }
  })
}

/**
 * Exact position (as a CSS `calc()` string, for use as `left` with a
 * `translateX(-50%)` centering transform) of a point that sits `fraction`
 * of the way along the real tray-to-edge span — from the chip tray's own
 * edge (center 50% minus its half-width, in real rendered pixels) out to
 * `cornerPct` (the felt-percentage corner target on that side).
 *
 * Splits into a pure-percentage term (the corner target is only known as a
 * felt fraction, since felt width is responsive) and a pure-pixel term
 * (the tray's half-width is a known real pixel constant, TRAY_W, already
 * scaled by the caller) — `calc()` combines the two exactly, instead of
 * approximating the tray's width as a felt-percentage guess.
 *
 * direction: +1 for the right side (shoe), -1 for the left side (discard
 * rack) — which way from the tray's center the span runs.
 */
function traySpanPosition(fraction: number, direction: 1 | -1, cornerPct: number, trayHalfWidthPx: number): string {
  const percent = 50 + direction * fraction * Math.abs(cornerPct - 50)
  const px = direction * trayHalfWidthPx * (1 - fraction)
  return `calc(${percent}% + ${px}px)`
}

/**
 * The shoe's rotation, aimed via a real line from the shoe's own position
 * to the ACTUAL Seat 3 coordinate from arcPositions() (index 2 — seats are
 * already indexed in real seat-number order, see arcPositions() above) —
 * not a hardcoded trig guess. x% and y% are converted to comparable real
 * distances via TABLE_ASPECT_RATIO before atan2 (a 1% horizontal move and
 * a 1% vertical move cover different absolute distances on a non-square
 * table). Falls back to the old hand-picked -6° when there's no real Seat
 * 3 to aim at (seatCount < 3). Clamped to a modest ±20° — this is a lean
 * toward Seat 3, not a full point-and-aim, matching the shoe's
 * bottom-center pivot (only the top swings).
 */
function computeShoeTiltDeg(seatPositions: { leftPct: number; topPct: number }[], shoeLeftPct: number): number {
  if (seatPositions.length < 3) return -6
  const seat3 = seatPositions[2]
  const dxPct = seat3.leftPct - shoeLeftPct
  const dyPct = Math.max(seat3.topPct, 1)
  const dxReal = dxPct * TABLE_ASPECT_RATIO
  const angleDeg = Math.atan2(dxReal, dyPct) * (180 / Math.PI)
  return Math.max(-20, Math.min(20, angleDeg))
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
  const trayHalfWidthPx = (TRAY_W / 2) * scale
  const shoeLeft = traySpanPosition(1 / 3, 1, CORNER_FRAC * 100, trayHalfWidthPx)
  const discardLeft = traySpanPosition(1 / 3, -1, CORNER_RADIUS_FRAC * 100, trayHalfWidthPx)
  const shoeLeftPctNum = 50 + (1 / 3) * (CORNER_FRAC * 100 - 50)
  const shoeTiltDeg = computeShoeTiltDeg(positions, shoeLeftPctNum)
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
          {/* Leather bumper corner extensions — per the reference photos, the
              padded leather doesn't end right at the top corner: it rounds
              the corner and continues a short run along the flat top
              (LEATHER_EXTENSION_FRAC on each side) before stopping, full
              RAIL_PX thickness, same leather texture as the curved rail
              beneath. These sit on top of the (uniformly thin-inset) felt
              below, capping it back up to full bumper height in just these
              two zones. */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: `${CORNER_RADIUS_FRAC * 100}%`,
              width: `${LEATHER_EXTENSION_FRAC * 100}%`,
              height: RAIL_PX,
              background: RAIL_BG,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: `${CORNER_RADIUS_FRAC * 100}%`,
              width: `${LEATHER_EXTENSION_FRAC * 100}%`,
              height: RAIL_PX,
              background: RAIL_BG,
            }}
          />
          {/* Wood dealer edge — fills the middle of the flat top (between
              the two leather extensions above), thin (WOOD_EDGE_PX, about
              half RAIL_PX) and a genuinely different material/color, so the
              leather bumper visibly stops (at WOOD_START_FRAC on each side,
              marked by the seam lines below) instead of wrapping into the
              dealer's working area. */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: `${WOOD_START_FRAC * 100}%`,
              right: `${WOOD_START_FRAC * 100}%`,
              height: WOOD_EDGE_PX,
              background: WOOD_EDGE_BG,
              boxShadow: 'inset 0 1px 0 rgba(255,220,180,0.18)',
            }}
          />
          {/* Seam lines — a thin dark groove at each leather-to-wood
              boundary, making the leather bumper's end point explicit
              rather than relying on the color change alone to read as a
              real transition. */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: `calc(${WOOD_START_FRAC * 100}% - 1px)`,
              width: 2,
              height: RAIL_PX,
              background: 'rgba(0,0,0,0.55)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: `calc(${WOOD_START_FRAC * 100}% - 1px)`,
              width: 2,
              height: RAIL_PX,
              background: 'rgba(0,0,0,0.55)',
            }}
          />
          {/* Felt surface — inset RAIL_PX inside the rail on the curved
              player edge, but only WOOD_EDGE_PX at the top (behind the thin
              wood strip; the two leather corner-extension pieces above cap
              it back up to full bumper height in their own zones only).
              overflow:hidden here (seats/labels near the curved edge are
              already visually clipped by clipPath, but clip-path alone
              doesn't stop them contributing to an ancestor's scrollable
              overflow) so the viewport-fit shell above never gets a phantom
              scrollbar over content nothing ever shows. */}
          <div
            style={{
              position: 'absolute',
              top: WOOD_EDGE_PX,
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
                  dish). Text reads "DEALER MUST HIT SOFT 17" — matches the
                  actual dealer engine (handResolution.ts) and the strategy
                  chart (strategy.ts), both converted to this app's fixed
                  H17 rule set. Felt, engine, and grading all agree.

                  Position: pushed DOWN (+70 on every endpoint y, same
                  bow/radius) from the original upper-middle placement, so
                  it sits below the dealer equipment row (which grew when
                  the chip tray widened) and closer to the player seats —
                  a QUICK rough-fit for the current layout, not a precise
                  anchor. A later pass will anchor this properly to a
                  bounded dealer-area container (shoe → dealer hand → rack)
                  instead of these hand-tuned coordinates. */}
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

                    Line 1: halfChord=230, bow=57.5  → r≈489, endpoints y=190, center y=247.5
                    Line 2: halfChord=250, bow=62.5  → r≈531, endpoints y=240, center y=302.5
                    Line 3: halfChord=270, bow=67.5  → r≈574, endpoints y=290, center y=357.5
                  */}
                  <path id="feltArc1" d="M 270,190 A 489,489 0 0 0 730,190" />
                  <path id="feltArc2" d="M 250,240 A 531,531 0 0 0 750,240" />
                  <path id="feltArc3" d="M 230,290 A 574,574 0 0 0 770,290" />
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

              {/* Dealer zone — spans the felt's full width so the discard
                  rack and shoe can be positioned by real geometric targets
                  instead of flex-row order:
                    - Chip tray: centered (unchanged mechanism), pulled up
                      slightly (marginTop) so its taller shape reaches
                      toward the wood dealer edge above.
                    - Discard rack: positioned at exactly 1/3 of the real
                      tray-to-edge span (traySpanPosition(), left side) —
                      from the chip tray's own edge toward the left corner
                      target, not a guess at a felt percentage. Flat/
                      upright, no tilt.
                    - Shoe: positioned at exactly 1/3 of the tray-to-edge
                      span (right side), tilted via computeShoeTiltDeg() —
                      a real atan2 aim from the shoe's own position to the
                      actual Seat 3 coordinate from arcPositions(), not a
                      hardcoded trig guess.
                  Dealer's own hand sits BELOW this row — "in front of" the
                  tray, toward the player side, matching a real table.
                  NOTE for a future pass: a bounded "dealer area" container
                  is planned to hold this whole group (shoe/tray/rack/hand)
                  plus precisely anchor the arc text to it — this layout is
                  written to be compatible with that, not fighting it. */}
              <div style={{ position: 'absolute', top: 14 * scale, left: 0, right: 0 }}>
                <div style={{ position: 'absolute', left: '50%', top: -8 * scale, transform: 'translateX(-50%)' }}>
                  {/* Decorative dealer chip tray — static, not bound to any
                      game/chip-wager state (see DECISIONS.md). */}
                  <DealerChipTray scale={scale} />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    left: discardLeft,
                    top: 0,
                    transform: 'translateX(-50%)',
                  }}
                >
                  <DiscardRack
                    fillFraction={discardFraction}
                    totalDecks={totalDecks}
                    difficulty={discardDifficulty}
                    scale={scale}
                  />
                </div>
                <div style={{ position: 'absolute', left: shoeLeft, top: 0, transform: 'translateX(-50%)' }}>
                  <DealingShoe decksRemaining={decksFill} totalDecks={totalDecks} scale={scale} tiltDeg={shoeTiltDeg} />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: 112 * scale,
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8 * scale,
                  }}
                >
                  {dealerSlot}
                </div>
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


