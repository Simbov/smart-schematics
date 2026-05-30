import React from 'react'

// Title block position and size in world units
export const TB = { x: 0, y: 500, w: 800, h: 100 }

const LEFT_W = 460
const RIGHT_W = TB.w - LEFT_W  // 340
const ROW_H = TB.h / 3         // ~33.3

const CELLS = [
  { field: 'title',         label: 'TITLE',      cx: 0,                         cy: 0,         cw: LEFT_W,            ch: TB.h,   valFontSize: 16, bold: true },
  { field: 'company',       label: 'COMPANY',    cx: LEFT_W,                    cy: 0,         cw: RIGHT_W,           ch: ROW_H,  valFontSize: 11 },
  { field: 'author',        label: 'DRAWN BY',   cx: LEFT_W,                    cy: ROW_H,     cw: RIGHT_W / 2,       ch: ROW_H,  valFontSize: 10 },
  { field: 'date',          label: 'DATE',       cx: LEFT_W + RIGHT_W / 2,      cy: ROW_H,     cw: RIGHT_W / 2,       ch: ROW_H,  valFontSize: 10 },
  { field: 'drawingNumber', label: 'DRAWING NO', cx: LEFT_W,                    cy: ROW_H * 2, cw: RIGHT_W - 80,      ch: ROW_H,  valFontSize: 10 },
  { field: 'revision',      label: 'REV',        cx: LEFT_W + RIGHT_W - 80,     cy: ROW_H * 2, cw: 80,                ch: ROW_H,  valFontSize: 12, bold: true },
]

export default function TitleBlock({ titleBlock, onEditField, zoom = 1 }) {
  if (!titleBlock?.visible) return null

  const sw = 1 / zoom

  return (
    <g style={{ color: 'var(--component-color)' }}>
      {/* Outer border */}
      <rect
        x={TB.x}
        y={TB.y}
        width={TB.w}
        height={TB.h}
        fill="var(--canvas-bg)"
        stroke="currentColor"
        strokeWidth={sw * 2}
      />

      {CELLS.map(cell => {
        const ax = TB.x + cell.cx
        const ay = TB.y + cell.cy
        const value = titleBlock[cell.field] || ''

        return (
          <g
            key={cell.field}
            style={{ cursor: 'text' }}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation()
              onEditField?.(cell.field, ax + 4, ay + cell.ch / 2, value)
            }}
          >
            {/* Cell border */}
            <rect
              x={ax}
              y={ay}
              width={cell.cw}
              height={cell.ch}
              fill="transparent"
              stroke="currentColor"
              strokeWidth={sw * 0.8}
            />
            {/* Hover highlight */}
            <rect
              x={ax}
              y={ay}
              width={cell.cw}
              height={cell.ch}
              fill="transparent"
              className="title-block-cell-hover"
              style={{ transition: 'fill 0.1s' }}
              onMouseEnter={e => { e.currentTarget.setAttribute('fill', 'rgba(37,99,235,0.05)') }}
              onMouseLeave={e => { e.currentTarget.setAttribute('fill', 'transparent') }}
            />
            {/* Field label (small, top-left) */}
            <text
              x={ax + 3}
              y={ay + 7}
              fontSize={6}
              fill="currentColor"
              opacity={0.45}
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {cell.label}
            </text>
            {/* Field value */}
            <text
              x={ax + (cell.field === 'title' ? 8 : 4)}
              y={ay + cell.ch / 2 + cell.valFontSize / 3}
              fontSize={cell.valFontSize}
              fontWeight={cell.bold ? 'bold' : 'normal'}
              fill="currentColor"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {value}
            </text>
          </g>
        )
      })}
    </g>
  )
}
