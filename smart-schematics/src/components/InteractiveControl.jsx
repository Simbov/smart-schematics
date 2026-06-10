import React from 'react'
import { getElectricalDef } from '../lib/components/electrical'
import { getHydraulicDef } from '../lib/components/hydraulic'
import { getCustomDef } from '../lib/components/custom'
import { MOMENTARY_TYPES, TOGGLE_TYPES, PLC_INPUT_TYPES } from '../lib/simulation/electricalSim'
import { MANUAL_DCV_TYPES } from '../lib/simulation/hydraulicSim'

function getAnyDef(type) { return getElectricalDef(type) || getHydraulicDef(type) || getCustomDef(type) }

// True for any component whose state the user can change via the floating control.
// `simParams` (optional) lets mode-switchable types opt out: an analogue PLC
// input has no binary state to toggle.
export function isControllable(type, simParams) {
  if (PLC_INPUT_TYPES.has(type) && simParams?.mode === 'Analogue') return false
  return TOGGLE_TYPES.has(type) || MOMENTARY_TYPES.has(type) || MANUAL_DCV_TYPES.has(type)
}

// Describe what the control should show and how it behaves for a given type/state.
function describe(type, interactiveState, dcvPosition, initialPos) {
  const ist = interactiveState?.state
  if (MOMENTARY_TYPES.has(type)) {
    return { label: 'Hold', active: ist === 'pressed', momentary: true }
  }
  if (type === 'plc_output' || type === 'plc_digital_output' || type === 'plc_pwm_output') {
    const on = ist === 'closed'
    return { label: on ? 'On' : 'Off', active: on }
  }
  if (type === 'plc_input' || type === 'plc_digital_input') {
    const high = ist === 'closed'
    return { label: high ? 'High' : 'Low', active: high }
  }
  if (type === 'switch_spdt') {
    const effective = ist ?? initialPos ?? 'NO'
    const pos = effective === 'NC' ? 'NC' : 'NO'
    return { label: pos, active: pos === 'NC', cycle: true }
  }
  if (type === 'switch_nc' || type === 'circuit_breaker') {
    const closed = ist !== 'open'
    return { label: closed ? 'Closed' : 'Open', active: closed }
  }
  if (TOGGLE_TYPES.has(type)) {
    const closed = ist === 'closed'
    return { label: closed ? 'Closed' : 'Open', active: closed }
  }
  if (MANUAL_DCV_TYPES.has(type)) {
    const pos = (dcvPosition ?? '').toString()
    return { label: pos ? pos.toUpperCase() : '—', active: true, cycle: true }
  }
  return null
}

// A small floating pill rendered above a selected interactive component.
// Clicking it changes the component's state (toggle / cycle / press-and-hold)
// without selecting or dragging the component itself. Counter-scaled by 1/zoom
// so it stays a constant on-screen size at any zoom level.
export default function InteractiveControl({
  component,
  zoom,
  interactiveState,
  dcvPosition,
  onToggle,
  onPress,
}) {
  const def = getAnyDef(component.type)
  const info = describe(component.type, interactiveState, dcvPosition, component.simParams?.position)
  if (!def || !info) return null

  const w = def.width || 40
  const h = def.height || 20
  const rot = (((component.rotation || 0) % 360) + 360) % 360
  const sideways = rot === 90 || rot === 270
  const hh = (sideways ? w : h) / 2

  // World coords of the component's top edge; the control is then offset upward
  // in screen pixels via the counter-scaled inner group.
  const topY = component.y - hh

  const ph = 18
  const pw = Math.max(40, info.label.length * 7 + 18)
  const gap = 10 // screen px between the symbol and the pill

  const bg = info.momentary
    ? (info.active ? '#16a34a' : '#475569')
    : info.cycle
      ? '#2563eb'
      : (info.active ? '#16a34a' : '#64748b')

  const handlers = info.momentary
    ? { onMouseDown: e => { e.stopPropagation(); onPress?.() } }
    : { onMouseDown: e => { e.stopPropagation(); onToggle?.() } }

  return (
    <g transform={`translate(${component.x}, ${topY}) scale(${1 / zoom})`} style={{ cursor: 'pointer' }}>
      {/* Pointer triangle aiming at the symbol */}
      <path
        d={`M ${-4} ${-gap} L ${4} ${-gap} L 0 ${-gap + 5} Z`}
        fill={bg}
        style={{ pointerEvents: 'none' }}
      />
      {/* Pill */}
      <rect
        x={-pw / 2}
        y={-gap - ph}
        width={pw}
        height={ph}
        rx={ph / 2}
        fill={bg}
        stroke="rgba(255,255,255,0.85)"
        strokeWidth="1"
        {...handlers}
        onClick={e => e.stopPropagation()}
      />
      <text
        x={0}
        y={-gap - ph / 2 + 3}
        textAnchor="middle"
        fontSize="9"
        fontWeight="600"
        fill="#ffffff"
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {info.label}
      </text>
    </g>
  )
}
