import type { ReactNode } from 'react'

interface DealingShoeProps {
  decksRemaining: number
  totalDecks?: number
  /** Uniform scale applied to the whole glyph, 0-1. Lets CasinoTable shrink this in proportion to its own rendered width on narrow screens without touching the pixel geometry below. Defaults to 1 (native size, matches every pre-mobile-fix render). */
  scale?: number
}

const SHOE_W = 52
const SHOE_H = 90
const SLOT_W = 36
const SLOT_H = 64
const SLOT_TOP = 10

export function DealingShoe({ decksRemaining, totalDecks = 6, scale = 1 }: DealingShoeProps): ReactNode {
  const fill = Math.max(0, Math.min(1, decksRemaining / totalDecks))
  const slotLeft = (SHOE_W - SLOT_W) / 2
  const stackH = fill > 0 ? Math.max(4, Math.round(fill * SLOT_H)) : 0

  return (
    <div style={{ position: 'relative', width: SHOE_W * scale, height: SHOE_H * scale }}>
    <div style={{ position: 'relative', width: SHOE_W, height: SHOE_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
      {/* Outer housing — dark matte with slight bevel highlights */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '6px 6px 4px 4px',
          background: 'linear-gradient(145deg, #232323 0%, #0c0c0c 55%, #1c1c1c 100%)',
          boxShadow:
            '2px 4px 14px rgba(0,0,0,0.85), inset 1px 1px 0 rgba(255,255,255,0.07), inset -1px 0 0 rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Recessed card slot */}
        <div
          style={{
            position: 'absolute',
            top: SLOT_TOP,
            left: slotLeft,
            width: SLOT_W,
            height: SLOT_H,
            background: '#060606',
            borderRadius: '3px 3px 2px 2px',
            boxShadow: 'inset 0 3px 10px rgba(0,0,0,0.95)',
            overflow: 'hidden',
          }}
        >
          {/* Card stack — cream/ivory striped, fills from bottom */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 1,
              right: 1,
              height: stackH,
              background:
                'repeating-linear-gradient(0deg, #f4ede0 0px, #f4ede0 1.5px, #d8cbb4 1.5px, #d8cbb4 2.5px, #eee5d2 2.5px, #eee5d2 4px)',
              borderRadius: '1px 1px 0 0',
            }}
          >
            {stackH > 3 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: 'rgba(255,255,255,0.68)',
                  borderRadius: '1px 1px 0 0',
                }}
              />
            )}
          </div>
        </div>

        {/* Card delivery slot — narrow gap where next card slides out */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 11,
            right: 11,
            height: 5,
            background: '#020202',
            borderRadius: 2,
            boxShadow: 'inset 0 1px 4px rgba(0,0,0,1)',
          }}
        />

        {/* Left-edge bevel highlight */}
        <div
          style={{
            position: 'absolute',
            top: 5,
            bottom: 5,
            left: 0,
            width: 3,
            background: 'linear-gradient(to right, rgba(255,255,255,0.05), transparent)',
            borderRadius: '6px 0 0 4px',
          }}
        />

        {/* Top-edge highlight */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 5,
            right: 5,
            height: 2,
            background: 'rgba(255,255,255,0.09)',
            borderRadius: '6px 6px 0 0',
          }}
        />
      </div>
    </div>
    </div>
  )
}
