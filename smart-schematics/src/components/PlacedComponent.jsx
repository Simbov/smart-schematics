import React, { memo } from 'react'
import { ELECTRICAL_SYMBOL_MAP } from '../lib/symbols/electrical'
import { HYDRAULIC_SYMBOL_MAP } from '../lib/symbols/HydraulicSymbols'
import { getElectricalDef } from '../lib/components/electrical'
import { getHydraulicDef } from '../lib/components/hydraulic'
import { getCustomDef } from '../lib/components/custom'
import CustomSymbol from '../lib/symbols/CustomSymbol'
import { INTERACTIVE_TYPES } from '../lib/simulation/electricalSim'
import { MANUAL_DCV_TYPES } from '../lib/simulation/hydraulicSim'
import { formatSI } from '../lib/simulation/parseValue'

const SYMBOL_MAP_ALL = { ...ELECTRICAL_SYMBOL_MAP, ...HYDRAULIC_SYMBOL_MAP }

function getAnyDef(type) { return getElectricalDef(type) || getHydraulicDef(type) || getCustomDef(type) }

function getDisplayValue(component) {
  const def = getAnyDef(component.type)
  const primaryEntry = def?.simParams && Object.entries(def.simParams).find(([, p]) => p.primary)
  if (primaryEntry) {
    const [key, paramDef] = primaryEntry
    const val = component.simParams?.[key]
    if (val != null && val !== '') return formatSI(Number(val), paramDef.unit ?? '')
  }
  return component.value
}

// Glow overlay for active loads
function GlowOverlay({ type, simState }) {
  if (!simState?.on) return null
  switch (type) {
    case 'led': return (
      <circle cx={0} cy={0} r={14} fill="rgba(255,200,0,0.25)"
        stroke="rgba(255,200,0,0.5)" strokeWidth="1"
        style={{ pointerEvents: 'none' }} />
    )
    case 'lamp': return (
      <circle cx={0} cy={0} r={12} fill="rgba(255,220,60,0.3)"
        stroke="rgba(255,220,60,0.6)" strokeWidth="1.5"
        style={{ pointerEvents: 'none' }} />
    )
    case 'buzzer':
    case 'speaker': return (
      <circle cx={0} cy={0} r={10} fill="rgba(120,160,255,0.2)"
        stroke="rgba(120,160,255,0.5)" strokeWidth="1"
        style={{ pointerEvents: 'none' }} />
    )
    case 'motor': return (
      <circle cx={0} cy={0} r={14} fill="rgba(60,200,120,0.2)"
        stroke="rgba(60,200,120,0.5)" strokeWidth="1.5"
        style={{ pointerEvents: 'none' }} />
    )
    case 'solenoid':
    case 'relay_coil':
    case 'contactor_coil': return (
      <rect x={-16} y={-8} width={32} height={16}
        fill="rgba(255,140,0,0.18)" stroke="rgba(255,140,0,0.45)" strokeWidth="1"
        rx={3} style={{ pointerEvents: 'none' }} />
    )
    default: return null
  }
}

// Cylinder extension fill — blue progress bar inside the barrel
function CylinderExtensionOverlay({ type, extension }) {
  const ext = Math.max(0, Math.min(100, extension ?? 0))
  if (type === 'hyd_cylinder_single') {
    // Barrel interior approx x=-23 to x=7 (30 units wide)
    return (
      <rect
        x={-23} y={-9} width={(ext / 100) * 30} height={18}
        fill="rgba(37,99,235,0.18)" stroke="none"
        style={{ pointerEvents: 'none' }}
      />
    )
  }
  if (type === 'hyd_cylinder_double' || type === 'hyd_cylinder_telescopic') {
    // Barrel interior approx x=-21 to x=21 (42 units wide)
    return (
      <rect
        x={-21} y={-9} width={(ext / 100) * 42} height={18}
        fill="rgba(37,99,235,0.18)" stroke="none"
        style={{ pointerEvents: 'none' }}
      />
    )
  }
  return null
}


function getSymbolState(type, simState, interactiveState, hydSimState, simParams) {
  const ist = interactiveState?.state
  switch (type) {
    case 'switch_no':
    case 'limit_switch':
    case 'proximity_switch':
    case 'pressure_switch':
    case 'temperature_switch':
      return { closed: ist === 'closed' }
    case 'switch_nc':
    case 'circuit_breaker':
      return { closed: ist !== 'open' }
    case 'switch_spdt':
      return { position: ist || simParams?.position || 'NO' }
    case 'pushbutton_no':
    case 'pushbutton_nc':
      return { pressed: ist === 'pressed' }
    case 'plc_digital_output':
    case 'plc_pwm_output':
      return { on: ist === 'closed' }
    default:
      // Directional valves slide their spool to the active envelope.
      if (MANUAL_DCV_TYPES.has(type)) return { position: hydSimState?.position }
      return simState ?? {}
  }
}

const PlacedComponent = memo(function PlacedComponent({
  component,
  selected,
  onClick,
  onMouseDown,
  showPins = false,
  simState,
  interactiveState,
  hydSimState,
  isRunning = false,
  labelSide = 'top',
}) {
  const isCustom = component.type.startsWith('custom_')
  const SymbolComponent = isCustom ? null : (SYMBOL_MAP_ALL[component.type] || null)
  const def = getAnyDef(component.type)
  if (!isCustom && !SymbolComponent) return null
  if (isCustom && !def) return null

  const w = def?.width || 40
  const h = def?.height || 20

  // Rotate/flip apply only to the symbol body; the labels stay upright (see below).
  const bodyTransforms = []
  if (component.rotation) bodyTransforms.push(`rotate(${component.rotation})`)
  if (component.flipH) bodyTransforms.push('scale(-1, 1)')
  if (component.flipV) bodyTransforms.push('scale(1, -1)')

  // Labels are placed relative to the component's on-screen bounding box, which
  // swaps width/height at 90°/270°. This keeps them clear of the (often wide)
  // symbol at any rotation and reads upright rather than rotating/mirroring with
  // the body.
  const rot = (((component.rotation || 0) % 360) + 360) % 360
  const sideways = rot === 90 || rot === 270
  const hw = (sideways ? h : w) / 2
  const hh = (sideways ? w : h) / 2
  const nudgeX = component.labelOffset?.x ?? 0

  // Place a label on a given side of the symbol, kept upright. The designator
  // side is chosen upstream to dodge wires; the value sits opposite.
  const labelPos = side => {
    switch (side) {
      case 'bottom': return { x: nudgeX, y: hh + 14, anchor: 'middle' }
      case 'right':  return { x: hw + 6, y: 3, anchor: 'start' }
      case 'left':   return { x: -(hw) - 6, y: 3, anchor: 'end' }
      case 'top':
      default:       return { x: nudgeX, y: -(hh) - 6, anchor: 'middle' }
    }
  }
  const designatorPos = labelPos(labelSide)
  const valuePos = labelPos(labelSide === 'bottom' ? 'top' : 'bottom')

  return (
    <g
      transform={`translate(${component.x}, ${component.y})`}
      onMouseDown={e => { e.stopPropagation(); onMouseDown?.(e) }}
      onClick={e => { e.stopPropagation(); onClick?.(e) }}
      style={{ cursor: 'pointer', pointerEvents: showPins ? 'none' : 'auto' }}
    >
      {/* Rotated / flipped symbol body */}
      <g transform={bodyTransforms.join(' ') || undefined}>
        {selected && (
          <rect
            x={-w / 2 - 5}
            y={-h / 2 - 5}
            width={w + 10}
            height={h + 10}
            fill="rgba(37,99,235,0.08)"
            stroke="#2563eb"
            strokeWidth="1"
            strokeDasharray="4,2"
            rx="3"
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* Glow for active loads */}
        <GlowOverlay type={component.type} simState={simState} />

        {/* Cylinder extension fill */}
        {isRunning && hydSimState?.extension != null && (
          <CylinderExtensionOverlay type={component.type} extension={hydSimState.extension} />
        )}

        {/* Invisible hit area */}
        <rect
          x={-w / 2 - 4}
          y={-h / 2 - 4}
          width={w + 8}
          height={h + 8}
          fill="transparent"
          stroke="none"
        />

        {/* Symbol */}
        <g style={{ color: isRunning && simState?.on ? 'var(--sim-active-color, #f59e0b)' : 'var(--component-color)' }}>
          {isCustom
            ? <CustomSymbol svgPathData={def.svgPathData} />
            : <SymbolComponent state={getSymbolState(component.type, simState, interactiveState, hydSimState, component.simParams)} params={component.simParams || {}} />
          }
        </g>

        {/* Pin dots — shown in wire mode */}
        {showPins && def?.pins.map(pin => (
          <circle
            key={pin.id}
            cx={pin.relX}
            cy={pin.relY}
            r={3}
            fill="rgba(37,99,235,0.6)"
            stroke="#2563eb"
            strokeWidth="0.5"
            style={{ pointerEvents: 'none' }}
          />
        ))}
      </g>

      {/* Upright labels — positioned outside the rotation so text stays readable,
          and on a side chosen to avoid wires running through them. */}
      {component.designator && (
        <text
          x={designatorPos.x}
          y={designatorPos.y}
          textAnchor={designatorPos.anchor}
          fontSize="8"
          fill="var(--component-color)"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {component.designator}
        </text>
      )}

      {getDisplayValue(component) && (
        <text
          x={valuePos.x}
          y={valuePos.y}
          textAnchor={valuePos.anchor}
          fontSize="7"
          fill="var(--component-color)"
          opacity="0.65"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {getDisplayValue(component)}
        </text>
      )}
    </g>
  )
})

export default PlacedComponent
