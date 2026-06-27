import type { ReactNode } from 'react'

interface DiscardRackProps {
  fillFraction: number  // 0–1; 0 = empty, 1 = full shoe played
  totalDecks?: number
}

const TRAY_W = 46
const TRAY_H = 80
const INNER_W = TRAY_W - 8
const INNER_H = TRAY_H - 14

/**
 * Clear-acrylic discard tray. Shows played cards accumulating from the bottom.
 * Decorative (fillFraction=0) in modes without shoe tracking.
 */
export function DiscardRack({ fillFraction }: DiscardRackProps): ReactNode {
  const fill = Math.max(0, Math.min(1, fillFraction))
  const cardH = Math.round(fill * INNER_H)
  const innerLeft = (TRAY_W - INNER_W) / 2

  return (
    <div style={{ position: 'relative', width: TRAY_W, height: TRAY_H }}>
      {/* Outer acrylic shell — faint blue-tint border like clear plastic */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 5,
          border: '1.5px solid rgba(160,205,240,0.22)',
          background:
            'linear-gradient(130deg, rgba(140,185,225,0.07) 0%, rgba(100,155,205,0.03) 100%)',
          boxShadow:
            '1px 3px 10px rgba(0,0,0,0.75), inset 0 0 10px rgba(0,0,0,0.55)',
        }}
      >
        {/* Dark interior well */}
        <div
          style={{
            position: 'absolute',
            top: 5,
            left: innerLeft,
            width: INNER_W,
            bottom: 5,
            background: '#080808',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          {/* Discarded card stack — face-down cards, fills from bottom */}
          {cardH > 0 && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: cardH,
                background:
                  'repeating-linear-gradient(0deg, #b6afa0 0px, #b6afa0 1.5px, #9e9789 1.5px, #9e9789 2.5px, #c4bcac 2.5px, #c4bcac 4px)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: 'rgba(255,255,255,0.22)',
                }}
              />
            </div>
          )}
        </div>

        {/* Acrylic top-edge sheen */}
        <div
          style={{
            position: 'absolute',
            top: 1,
            left: 4,
            right: 4,
            height: 2,
            background: 'linear-gradient(to bottom, rgba(200,230,255,0.16), transparent)',
            borderRadius: '3px 3px 0 0',
          }}
        />

        {/* Acrylic left-wall highlight */}
        <div
          style={{
            position: 'absolute',
            top: 4,
            bottom: 4,
            left: 1,
            width: 2,
            background: 'linear-gradient(to right, rgba(200,230,255,0.10), transparent)',
            borderRadius: '3px 0 0 3px',
          }}
        />
      </div>
    </div>
  )
}
