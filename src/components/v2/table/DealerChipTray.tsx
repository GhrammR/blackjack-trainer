import type { ReactNode } from 'react'

interface DealerChipTrayProps {
  /** Uniform scale applied to the whole glyph, 0-1 — same convention as DealingShoe/DiscardRack. */
  scale?: number
}

/**
 * Decorative dealer chip rack, filled with a specific realistic
 * denomination arrangement — low chips flanking the outside edges, high
 * value in the center, matching how a real rack is filled:
 *   White ($1) · White · Red ($5) · Red · Green ($25) · Black ($100) ·
 *   Purple ($500) · Green · Red · Red · White · White
 * (12 columns, mirrored except for the Black/Purple pair at center — Black
 * sits just left of center, Purple is the true center column). Every
 * column except Purple is two 10-stacks with a clear lammer between them;
 * Purple is a single 10-stack (a real table wouldn't hold two full stacks
 * of $500s) — same bottom-aligned slot height as every other column, so it
 * just has more visible headroom above it. Static/decorative — no
 * game-state binding (see DECISIONS.md's chip-tray recommendation). Width
 * AND height come from this content; TRAY_W is exported so CasinoTable.tsx
 * can position other equipment relative to the tray's real edge, not a
 * guess.
 */
const PURPLE_INDEX = 6
const DENOMINATIONS = [
  '#f8fafc', // white — $1
  '#f8fafc',
  '#dc2626', // red — $5
  '#dc2626',
  '#16a34a', // green — $25
  '#18181b', // black — $100
  '#7c3aed', // purple — $500 (single stack — see PURPLE_INDEX)
  '#16a34a',
  '#dc2626',
  '#dc2626',
  '#f8fafc',
  '#f8fafc',
]

const SLOT_W = 18
const FRAME_PX = 4
const CHIP_W = 15
const CHIP_H = 3.5
// Each column (except Purple) = two stacks of 10 chips with a clear LAMMER
// (marker/spacer chip) between them — the real way dealer racks group
// chips into countable-at-a-glance stacks of 10.
const CHIPS_PER_STACK = 10
const LAMMER_H = 6
const DOUBLE_STACK_H = CHIPS_PER_STACK * CHIP_H + LAMMER_H + CHIPS_PER_STACK * CHIP_H + 2
const SINGLE_STACK_H = CHIPS_PER_STACK * CHIP_H + 2
// Extra headroom (~5 chips tall) above the stacks, extending the tray's
// bottom edge further down toward the table center/dealer cards — the
// rack visibly has room for more than what's currently racked.
const EXTRA_HEADROOM = 5 * CHIP_H
const SLOT_H = DOUBLE_STACK_H + EXTRA_HEADROOM

export const TRAY_W = SLOT_W * DENOMINATIONS.length + FRAME_PX * 2
const TRAY_H = SLOT_H + FRAME_PX * 2 + 6

export function DealerChipTray({ scale = 1 }: DealerChipTrayProps): ReactNode {
  return (
    <div style={{ position: 'relative', width: TRAY_W * scale, height: TRAY_H * scale }}>
      <div style={{ position: 'relative', width: TRAY_W, height: TRAY_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {/* Wood frame — same material family as CasinoTable's dealer-edge wood, for consistency */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 3,
            background: 'linear-gradient(180deg, #8a6238 0%, #6b4a28 55%, #4a3018 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,220,180,0.20), 0 3px 6px rgba(0,0,0,0.55)',
          }}
        >
          {/* Felt-lined interior well */}
          <div
            style={{
              position: 'absolute',
              top: FRAME_PX,
              left: FRAME_PX,
              right: FRAME_PX,
              bottom: FRAME_PX,
              borderRadius: 2,
              background: 'linear-gradient(180deg, #0f3a35 0%, #0a2521 100%)',
              boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.75)',
              display: 'flex',
            }}
          >
            {DENOMINATIONS.map((color, i) => {
              const isPurple = i === PURPLE_INDEX
              return (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    width: SLOT_W,
                    height: '100%',
                    borderRight: i < DENOMINATIONS.length - 1 ? '1px solid rgba(0,0,0,0.5)' : undefined,
                    display: 'flex',
                    // Stacks align to the dealer-edge side (top of this tray,
                    // near the wood rail), leaving the empty headroom on the
                    // OTHER side — toward the table center, where a real
                    // dealer actually works chips from. See EXTRA_HEADROOM above.
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    paddingTop: 2,
                  }}
                >
                  <div style={{ position: 'relative', width: CHIP_W, height: isPurple ? SINGLE_STACK_H : DOUBLE_STACK_H }}>
                    {/* Bottom stack of 10 */}
                    {Array.from({ length: CHIPS_PER_STACK }, (_, j) => (
                      <div
                        key={`bottom-${j}`}
                        style={{
                          position: 'absolute',
                          bottom: j * CHIP_H,
                          left: 0,
                          width: CHIP_W,
                          height: CHIP_H + 1.5,
                          borderRadius: '50%',
                          background: color,
                          border: '1px solid rgba(255,255,255,0.30)',
                          boxShadow: `inset 0 0 0 2px ${color}, inset 0 0 0 3px rgba(255,255,255,0.20), 0 1px 1px rgba(0,0,0,0.4)`,
                        }}
                      />
                    ))}
                    {!isPurple && (
                      <>
                        {/* Clear lammer — a transparent marker chip separating the two 10-stacks */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: CHIPS_PER_STACK * CHIP_H,
                            left: -1,
                            width: CHIP_W + 2,
                            height: LAMMER_H,
                            borderRadius: '50%',
                            background: 'rgba(200,230,255,0.28)',
                            border: '1px solid rgba(255,255,255,0.55)',
                            boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.20), 0 1px 2px rgba(0,0,0,0.5)',
                          }}
                        />
                        {/* Top stack of 10 */}
                        {Array.from({ length: CHIPS_PER_STACK }, (_, j) => (
                          <div
                            key={`top-${j}`}
                            style={{
                              position: 'absolute',
                              bottom: CHIPS_PER_STACK * CHIP_H + LAMMER_H + j * CHIP_H,
                              left: 0,
                              width: CHIP_W,
                              height: CHIP_H + 1.5,
                              borderRadius: '50%',
                              background: color,
                              border: '1px solid rgba(255,255,255,0.30)',
                              boxShadow: `inset 0 0 0 2px ${color}, inset 0 0 0 3px rgba(255,255,255,0.20), 0 1px 1px rgba(0,0,0,0.4)`,
                            }}
                          />
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
