import React from 'react'

export default function GridOverlay({ panX, panY, zoom, gridSize }) {
  if (zoom < 0.4) return null

  const step = gridSize * zoom
  const offsetX = ((panX % step) + step) % step
  const offsetY = ((panY % step) + step) % step
  const r = zoom > 1 ? 1.2 : 0.8

  return (
    <g style={{ pointerEvents: 'none' }}>
      <defs>
        <pattern
          id="grid-dot-pattern"
          x={offsetX}
          y={offsetY}
          width={step}
          height={step}
          patternUnits="userSpaceOnUse"
        >
          <circle cx={0} cy={0} r={r} fill="var(--grid-dot)" />
        </pattern>
      </defs>
      <rect x={0} y={0} width="100%" height="100%" fill="url(#grid-dot-pattern)" />
    </g>
  )
}
