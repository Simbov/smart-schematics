// HydraulicFlowLayer — Phase 11
//
// Animated flow dots on hydraulic lines. Uses moving filled circles coloured by pressure:
//   red  (#dc2626) — high-pressure working lines
//   blue (#2563eb) — return / low-pressure lines
//
// IMPORTANT: No React state in animation. RAF loop reads hydWireNetStates via
// useSimulationStore.getState() and writes directly to SVG element attributes —
// same pattern as WireLayer.useFlowAnimation.

import React, { useEffect, useRef, memo } from 'react'
import useSimulationStore from '../store/simulationStore'

const DOTS_PER_WIRE = 3
const DOT_RADIUS = 3
const DOT_SPEED = 12  // world-units per second at speed=1x

// Compute total wire length in world units
function wireLength(points) {
  let len = 0
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x
    const dy = points[i + 1].y - points[i].y
    len += Math.sqrt(dx * dx + dy * dy)
  }
  return len
}

// Map a scalar offset (world units, clamped by total length) to a (cx,cy) on the polyline
function offsetToPos(points, offset, totalLen) {
  if (totalLen <= 0 || points.length < 2) return { cx: points[0]?.x ?? 0, cy: points[0]?.y ?? 0 }
  let remaining = ((offset % totalLen) + totalLen) % totalLen
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x
    const dy = points[i + 1].y - points[i].y
    const segLen = Math.sqrt(dx * dx + dy * dy)
    if (remaining <= segLen || i === points.length - 2) {
      const t = segLen > 0 ? remaining / segLen : 0
      return { cx: points[i].x + dx * t, cy: points[i].y + dy * t }
    }
    remaining -= segLen
  }
  return { cx: points[points.length - 1].x, cy: points[points.length - 1].y }
}

// Pre-rendered dot placeholders for a single wire
const HydWireDots = memo(function HydWireDots({ wireId }) {
  return (
    <g id={`hyd-wire-${wireId}`} style={{ pointerEvents: 'none' }}>
      {Array.from({ length: DOTS_PER_WIRE }, (_, i) => (
        <circle
          key={i}
          id={`hyd-dot-${wireId}-${i}`}
          r={DOT_RADIUS}
          cx={-9999}
          cy={-9999}
          fill="transparent"
        />
      ))}
    </g>
  )
})

function useHydFlowAnimation(wires, isRunning) {
  const rafRef = useRef(null)
  // per-wire dot offsets: { [wireId]: number[] }
  const offsetsRef = useRef({})

  useEffect(() => {
    if (!isRunning) {
      cancelAnimationFrame(rafRef.current)
      wires.forEach(w => {
        for (let i = 0; i < DOTS_PER_WIRE; i++) {
          const el = document.getElementById(`hyd-dot-${w.id}-${i}`)
          if (el) {
            el.setAttribute('cx', '-9999')
            el.setAttribute('cy', '-9999')
            el.setAttribute('fill', 'transparent')
          }
        }
      })
      return
    }

    // Pre-compute wire lengths once per isRunning change
    const wireLengths = {}
    wires.forEach(w => { wireLengths[w.id] = wireLength(w.points) })

    // Initialise dot offsets evenly distributed along each wire
    wires.forEach(w => {
      if (!offsetsRef.current[w.id]) {
        const len = wireLengths[w.id]
        offsetsRef.current[w.id] = Array.from(
          { length: DOTS_PER_WIRE },
          (_, i) => (i / DOTS_PER_WIRE) * len,
        )
      }
    })

    let lastTs = null

    function loop(ts) {
      const dt = Math.min((lastTs != null ? ts - lastTs : 16), 50) / 1000  // seconds
      lastTs = ts

      const { hydWireNetStates, speed } = useSimulationStore.getState()

      wires.forEach(wire => {
        const netState = hydWireNetStates[wire.id]
        const energized = netState?.energized ?? false
        const len = wireLengths[wire.id] ?? 0

        if (!energized || len < 1) {
          for (let i = 0; i < DOTS_PER_WIRE; i++) {
            const el = document.getElementById(`hyd-dot-${wire.id}-${i}`)
            if (el) {
              el.setAttribute('cx', '-9999')
              el.setAttribute('cy', '-9999')
              el.setAttribute('fill', 'transparent')
            }
          }
          return
        }

        const color = netState.type === 'working' ? '#dc2626' : '#2563eb'
        const advance = DOT_SPEED * (speed ?? 1) * dt

        // Advance offsets and position dots
        const offsets = (offsetsRef.current[wire.id] ??= Array.from(
          { length: DOTS_PER_WIRE },
          (_, i) => (i / DOTS_PER_WIRE) * len,
        ))

        for (let i = 0; i < DOTS_PER_WIRE; i++) {
          offsets[i] = (offsets[i] + advance) % len
          const { cx, cy } = offsetToPos(wire.points, offsets[i], len)
          const el = document.getElementById(`hyd-dot-${wire.id}-${i}`)
          if (el) {
            el.setAttribute('cx', String(cx))
            el.setAttribute('cy', String(cy))
            el.setAttribute('fill', color)
          }
        }
      })

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isRunning, wires])
}

export default function HydraulicFlowLayer({ wires, isRunning }) {
  useHydFlowAnimation(wires, isRunning)
  return (
    <g>
      {wires.map(w => (
        <HydWireDots key={w.id} wireId={w.id} />
      ))}
    </g>
  )
}
