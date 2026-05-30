import React from 'react'
import useSimulationStore from '../store/simulationStore'
import useSchematicStore from '../store/schematicStore'

function fmtVal(v, unit) {
  const abs = Math.abs(v)
  if (abs === 0) return `0 ${unit}`
  if (abs >= 1e3)  return `${(v / 1e3).toPrecision(3)} k${unit}`
  if (abs >= 1)    return `${v.toPrecision(3)} ${unit}`
  if (abs >= 1e-3) return `${(v * 1e3).toPrecision(3)} m${unit}`
  if (abs >= 1e-6) return `${(v * 1e6).toPrecision(3)} µ${unit}`
  return `${v.toPrecision(3)} ${unit}`
}

export default function MeasurementOverlay({ wires, components, zoom }) {
  const showCurrentValues = useSchematicStore(s => s.settings.showCurrentValues)
  const isRunning = useSimulationStore(s => s.isRunning)
  const wireStates = useSimulationStore(s => s.wireStates)
  const componentStates = useSimulationStore(s => s.componentStates)

  if (!showCurrentValues || !isRunning) return null

  const fontSize = Math.max(6, 9 / zoom)
  const pad = fontSize * 0.35
  const r = fontSize * 0.4

  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* Wire labels */}
      {wires.map(wire => {
        const ws = wireStates[wire.id]
        if (!ws) return null
        const pts = wire.points
        if (pts.length < 2) return null
        // midpoint of the wire
        const mid = Math.floor((pts.length - 1) / 2)
        const mx = (pts[mid].x + pts[mid + 1].x) / 2
        const my = (pts[mid].y + pts[mid + 1].y) / 2

        const lines = []
        lines.push(fmtVal(ws.voltage, 'V'))
        if (Math.abs(ws.current) > 1e-3) lines.push(fmtVal(ws.current, 'A'))
        const text = lines.join('  ')

        const charW = fontSize * 0.55
        const textW = text.length * charW
        const boxW = textW + pad * 2
        const boxH = fontSize + pad * 2

        return (
          <g key={wire.id} transform={`translate(${mx},${my})`}>
            <rect
              x={-boxW / 2}
              y={-boxH / 2}
              width={boxW}
              height={boxH}
              rx={r}
              ry={r}
              fill="rgba(0,0,0,0.65)"
            />
            <text
              x={0}
              y={fontSize * 0.35}
              textAnchor="middle"
              fontSize={fontSize}
              fill="#fff"
              fontFamily="monospace"
            >
              {text}
            </text>
          </g>
        )
      })}

      {/* Component labels */}
      {components.map(comp => {
        const cs = componentStates[comp.id]
        if (!cs) return null
        if (Math.abs(cs.P ?? 0) < 0.001 && Math.abs(cs.I ?? 0) < 0.001) return null

        const parts = []
        if (cs.V != null && Math.abs(cs.V) > 1e-6) parts.push(fmtVal(cs.V, 'V'))
        if (cs.I != null && Math.abs(cs.I) > 1e-4) parts.push(fmtVal(cs.I, 'A'))
        if (cs.P != null && Math.abs(cs.P) > 1e-3) parts.push(fmtVal(cs.P, 'W'))
        if (parts.length === 0) return null

        const text = parts.join('  ')
        const charW = fontSize * 0.55
        const textW = text.length * charW
        const boxW = textW + pad * 2
        const boxH = fontSize + pad * 2
        const labelY = comp.y + 20 + boxH / 2

        return (
          <g key={comp.id} transform={`translate(${comp.x},${labelY})`}>
            <rect
              x={-boxW / 2}
              y={-boxH / 2}
              width={boxW}
              height={boxH}
              rx={r}
              ry={r}
              fill="rgba(20,100,20,0.75)"
            />
            <text
              x={0}
              y={fontSize * 0.35}
              textAnchor="middle"
              fontSize={fontSize}
              fill="#cfc"
              fontFamily="monospace"
            >
              {text}
            </text>
          </g>
        )
      })}
    </g>
  )
}
