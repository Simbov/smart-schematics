import React, { memo } from 'react'
import { routeWire } from '../lib/wireUtils'

const WireInProgress = memo(function WireInProgress({ wirePoints, ghostPoint, snapTarget }) {
  if (wirePoints.length === 0 && !ghostPoint) return null

  const lastPt = wirePoints.length > 0 ? wirePoints[wirePoints.length - 1] : null
  // Endpoint: prefer snap target position, fall back to raw grid position
  const endPt = snapTarget ? { x: snapTarget.x, y: snapTarget.y } : ghostPoint

  // Path for already-committed segments
  let placedPath = ''
  if (wirePoints.length >= 2) {
    placedPath = `M ${wirePoints[0].x},${wirePoints[0].y}`
    for (let i = 1; i < wirePoints.length; i++) {
      placedPath += ` L ${wirePoints[i].x},${wirePoints[i].y}`
    }
  }

  // Rubber-band from last committed point to cursor/snap
  let ghostPath = ''
  if (endPt && lastPt) {
    const route = routeWire(lastPt, endPt)
    if (route.length >= 2) {
      ghostPath = `M ${route[0].x},${route[0].y}`
      for (let i = 1; i < route.length; i++) {
        ghostPath += ` L ${route[i].x},${route[i].y}`
      }
    }
  }

  const isSnapping = snapTarget && snapTarget.type !== 'grid'
  const snapColor = snapTarget?.type === 'wire' ? '#10b981' : '#2563eb' // green for wire, blue for pin

  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* Start dot */}
      {wirePoints.length > 0 && (
        <circle cx={wirePoints[0].x} cy={wirePoints[0].y} r={3} fill="#2563eb" />
      )}

      {/* Committed segments */}
      {placedPath && (
        <path
          d={placedPath}
          stroke="var(--wire-color)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Ghost rubber-band (dashed) */}
      {ghostPath && (
        <path
          d={ghostPath}
          stroke={isSnapping ? snapColor : '#2563eb'}
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="5,3"
          strokeLinecap="round"
          opacity="0.7"
        />
      )}

      {/* Snap indicator at target */}
      {isSnapping && endPt && (
        snapTarget.type === 'pin' ? (
          // Circle for pin snap
          <circle
            cx={endPt.x}
            cy={endPt.y}
            r={7}
            fill="rgba(37,99,235,0.15)"
            stroke="#2563eb"
            strokeWidth="1.5"
          />
        ) : (
          // Square for wire snap (T-junction)
          <rect
            x={endPt.x - 5}
            y={endPt.y - 5}
            width={10}
            height={10}
            fill="rgba(16,185,129,0.15)"
            stroke="#10b981"
            strokeWidth="1.5"
          />
        )
      )}
    </g>
  )
})

export default WireInProgress
