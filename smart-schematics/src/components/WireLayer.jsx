import React, { memo, useMemo, useRef, useEffect } from 'react'
import { findWireCrossings } from '../lib/wireUtils'
import useSimulationStore from '../store/simulationStore'

const BRIDGE_R = 4

function buildWirePath(wire, crossings) {
  const pts = wire.points
  if (pts.length < 2) return ''

  const bySegment = {}
  for (const c of crossings) {
    ;(bySegment[c.segIdx] = bySegment[c.segIdx] || []).push(c)
  }

  let d = `M ${pts[0].x},${pts[0].y}`

  for (let i = 0; i < pts.length - 1; i++) {
    const { x: x1, y: y1 } = pts[i]
    const { x: x2, y: y2 } = pts[i + 1]
    const segCrossings = bySegment[i] || []

    if (segCrossings.length === 0) {
      d += ` L ${x2},${y2}`
      continue
    }

    const isHoriz = y1 === y2
    const sorted = [...segCrossings].sort((a, b) =>
      isHoriz ? a.x - b.x : a.y - b.y
    )

    for (const c of sorted) {
      if (isHoriz) {
        const dir = x2 >= x1 ? 1 : -1
        d += ` L ${c.x - dir * BRIDGE_R},${y1}`
        d += ` A ${BRIDGE_R},${BRIDGE_R} 0 0,${dir > 0 ? 1 : 0} ${c.x + dir * BRIDGE_R},${y1}`
      } else {
        const dir = y2 >= y1 ? 1 : -1
        d += ` L ${x1},${c.y - dir * BRIDGE_R}`
        d += ` A ${BRIDGE_R},${BRIDGE_R} 0 0,${dir > 0 ? 0 : 1} ${x1},${c.y + dir * BRIDGE_R}`
      }
    }
    d += ` L ${x2},${y2}`
  }

  return d
}

const WirePath = memo(function WirePath({ wire, crossings, selected, onClick, wireMode }) {
  const d = useMemo(() => buildWirePath(wire, crossings), [wire, crossings])

  const dasharray =
    wire.style === 'dashed' ? '8,4' : wire.style === 'dotted' ? '2,4' : undefined
  const sw = (wire.weight || 1) * 1.5

  return (
    <>
      {/* Fat invisible hit area. In wire mode it must not capture clicks —
          otherwise it selects the existing wire instead of letting the canvas
          place/junction a new wire onto it (the canvas snaps to wires itself). */}
      <path
        d={d}
        stroke="transparent"
        strokeWidth={Math.max(sw, 8)}
        fill="none"
        onMouseDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onClick?.(e) }}
        style={{ cursor: 'pointer', pointerEvents: wireMode ? 'none' : 'auto' }}
      />
      {/* Visible wire */}
      <path
        id={`wire-vis-${wire.id}`}
        d={d}
        stroke={selected ? '#2563eb' : (wire.color || 'var(--wire-color)')}
        strokeWidth={sw}
        strokeDasharray={dasharray}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ pointerEvents: 'none' }}
      />
      {/* Flow animation overlay — driven by RAF loop via id */}
      <path
        id={`wire-flow-${wire.id}`}
        d={d}
        stroke="rgba(255,210,40,0)"
        strokeWidth={sw + 2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="butt"
        strokeDasharray="4,16"
        strokeDashoffset="0"
        style={{ pointerEvents: 'none' }}
      />
    </>
  )
})

// RAF animation loop that writes directly to SVG DOM — no React state
function useFlowAnimation(wires, isRunning) {
  const rafRef = useRef(null)

  useEffect(() => {
    if (!isRunning) {
      cancelAnimationFrame(rafRef.current)
      for (const wire of wires) {
        const el = document.getElementById(`wire-flow-${wire.id}`)
        if (el) el.setAttribute('stroke', 'rgba(255,210,40,0)')
      }
      return
    }

    // Offset computed directly from RAF timestamp — no accumulated state,
    // so no flash on start and both wire/component layers stay in sync.
    function frame(ts) {
      const { wireStates, speed } = useSimulationStore.getState()
      const period = 20
      for (const wire of wires) {
        const el = document.getElementById(`wire-flow-${wire.id}`)
        if (!el) continue
        const ws = wireStates[wire.id]
        if (ws && ws.current > 1e-6) {
          const offset = -(ts * 0.01 * (speed ?? 1) * ws.dir) % period
          el.setAttribute('stroke', 'rgba(255,210,40,0.92)')
          el.setAttribute('stroke-dashoffset', String(offset))
        } else {
          el.setAttribute('stroke', 'rgba(255,210,40,0)')
        }
      }

      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isRunning, wires])
}

export default function WireLayer({ wires, junctions, selectedIds, onWireClick, isRunning, wireMode }) {
  useFlowAnimation(wires, isRunning)

  return (
    <g>
      {wires.map((wire, i) => {
        const laterWires = wires.slice(i + 1)
        const crossings = wires.length <= 500 ? findWireCrossings(wire, laterWires) : []
        return (
          <WirePath
            key={wire.id}
            wire={wire}
            crossings={crossings}
            selected={selectedIds.includes(wire.id)}
            onClick={() => onWireClick?.(wire.id)}
            wireMode={wireMode}
          />
        )
      })}

      {junctions.map(j => (
        <circle
          key={j.id}
          cx={j.x}
          cy={j.y}
          r={3.5}
          fill="var(--wire-color)"
          style={{ pointerEvents: 'none' }}
        />
      ))}
    </g>
  )
}
