// ISO 1219 hydraulic symbols — all use stroke="currentColor", origin at (0,0)
import React from 'react'
import { manifoldDrawing } from '../manifold'
import { valveConfig, valveRouting, valvePins, valvePositionKeys, valveDefaultPosition } from '../valveBuilder'

const SW = 1.5

// ── Power & Sources ──────────────────────────────────────────────────────────

export function HydPumpFixedSymbol() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {/* Circle body */}
      <circle cx={0} cy={0} r={16} />
      {/* Arrow pointing outward (outlet at top) */}
      <line x1={0} y1={0} x2={0} y2={-14} />
      <polyline points="-5,-9 0,-14 5,-9" />
      {/* Inlet line at bottom */}
      <line x1={0} y1={16} x2={0} y2={20} />
      {/* Outlet line at top */}
      <line x1={0} y1={-16} x2={0} y2={-20} />
    </g>
  )
}

export function HydPumpVariableSymbol() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={0} cy={0} r={16} />
      <line x1={0} y1={0} x2={0} y2={-14} />
      <polyline points="-5,-9 0,-14 5,-9" />
      {/* Variable arrow diagonal */}
      <line x1={-18} y1={10} x2={18} y2={-10} strokeWidth={SW * 0.9} />
      <polyline points="13,-13 18,-10 15,-5" />
      <line x1={0} y1={16} x2={0} y2={20} />
      <line x1={0} y1={-16} x2={0} y2={-20} />
    </g>
  )
}

export function HydMotorFixedSymbol() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={0} cy={0} r={16} />
      {/* Arrow pointing inward (inlet at top) */}
      <line x1={0} y1={-14} x2={0} y2={0} />
      <polyline points="-5,-5 0,0 5,-5" />
      <line x1={0} y1={16} x2={0} y2={20} />
      <line x1={0} y1={-16} x2={0} y2={-20} />
    </g>
  )
}

export function HydMotorVariableSymbol() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={0} cy={0} r={16} />
      <line x1={0} y1={-14} x2={0} y2={0} />
      <polyline points="-5,-5 0,0 5,-5" />
      <line x1={-18} y1={10} x2={18} y2={-10} strokeWidth={SW * 0.9} />
      <polyline points="13,-13 18,-10 15,-5" />
      <line x1={0} y1={16} x2={0} y2={20} />
      <line x1={0} y1={-16} x2={0} y2={-20} />
    </g>
  )
}

export function HydReservoirSymbol() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {/* Tank open top with walls */}
      <line x1={-18} y1={-8} x2={-18} y2={12} />
      <line x1={-18} y1={12} x2={18} y2={12} />
      <line x1={18} y1={12} x2={18} y2={-8} />
      {/* Fluid level */}
      <line x1={-18} y1={4} x2={18} y2={4} strokeDasharray="3,2" />
      {/* Inlet/outlet stubs */}
      <line x1={-8} y1={-14} x2={-8} y2={-8} />
      <line x1={8} y1={-14} x2={8} y2={-8} />
    </g>
  )
}

export function HydAccumulatorSymbol() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {/* Oval body */}
      <ellipse cx={0} cy={-6} rx={12} ry={18} />
      {/* Gas/fluid divider */}
      <line x1={-12} y1={-6} x2={12} y2={-6} />
      {/* Gas hatching (top half) */}
      <line x1={-8} y1={-18} x2={8} y2={-8} strokeWidth={1} />
      <line x1={-4} y1={-22} x2={8} y2={-14} strokeWidth={1} />
      {/* Port stub */}
      <line x1={0} y1={12} x2={0} y2={24} />
    </g>
  )
}

// ── Actuators ────────────────────────────────────────────────────────────────

// Piston/rod travel from the simulated extension (0–100). `rest` is the % that
// maps to no displacement (0 for spring-return single-acting, 50 for the
// centred double/steering rod); `travel` is the on-canvas swing in either
// direction. A short CSS transition makes the stroke read as motion.
function cylDx(extension, rest, travel) {
  if (extension == null) return 0
  const e = Math.max(0, Math.min(100, extension))
  return ((e - rest) / 100) * travel
}
const ROD_MOVE = { transition: 'transform 0.18s linear' }

export function HydCylinderSingleSymbol({ state = {} }) {
  const dx = cylDx(state.extension, 0, 12)
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {/* Barrel */}
      <rect x={-24} y={-10} width={32} height={20} />
      {/* End cap */}
      <line x1={-24} y1={-12} x2={-24} y2={12} strokeWidth={SW * 1.5} />
      {/* Port */}
      <line x1={-28} y1={0} x2={-24} y2={0} />
      {/* Piston + rod — slides out with extension */}
      <g transform={`translate(${dx},0)`} style={ROD_MOVE}>
        <line x1={-4} y1={-8} x2={-4} y2={8} />
        <line x1={8} y1={0} x2={26} y2={0} />
      </g>
    </g>
  )
}

export function HydCylinderDoubleSymbol({ state = {} }) {
  const dx = cylDx(state.extension, 50, 12)
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {/* Barrel */}
      <rect x={-22} y={-10} width={44} height={20} />
      {/* End caps */}
      <line x1={-22} y1={-12} x2={-22} y2={12} strokeWidth={SW * 1.5} />
      <line x1={22} y1={-12} x2={22} y2={12} strokeWidth={SW * 1.5} />
      {/* Port stubs (fixed to the barrel) */}
      <line x1={-26} y1={0} x2={-22} y2={0} />
      <line x1={22} y1={0} x2={26} y2={0} />
      {/* Piston + single rod (exits right) — slides with extension */}
      <g transform={`translate(${dx},0)`} style={ROD_MOVE}>
        <line x1={0} y1={-8} x2={0} y2={8} />
        <line x1={0} y1={0} x2={30} y2={0} />
      </g>
    </g>
  )
}

// Double-acting through-rod (steering) cylinder: the rod passes fully through
// both end caps and exits on both sides, ports on the barrel underside. Rest at
// mid-stroke; the rigid rod slides left/right with the simulated extension.
export function HydCylinderSteeringSymbol({ state = {} }) {
  const dx = cylDx(state.extension, 50, 10)
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {/* Barrel */}
      <rect x={-22} y={-10} width={44} height={20} />
      {/* End caps */}
      <line x1={-22} y1={-12} x2={-22} y2={12} strokeWidth={SW * 1.5} />
      <line x1={22} y1={-12} x2={22} y2={12} strokeWidth={SW * 1.5} />
      {/* Ports A (left) / B (right) on the barrel underside */}
      <line x1={-16} y1={10} x2={-16} y2={16} />
      <line x1={16} y1={10} x2={16} y2={16} />
      {/* Through-rod + piston — rigid, slides with extension */}
      <g transform={`translate(${dx},0)`} style={ROD_MOVE}>
        <line x1={-32} y1={0} x2={32} y2={0} />
        <line x1={0} y1={-8} x2={0} y2={8} strokeWidth={SW * 1.4} />
      </g>
    </g>
  )
}

export function HydCylinderTelescopicSymbol({ state = {} }) {
  const dx = cylDx(state.extension, 0, 10)
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {/* Stage 1 (largest) */}
      <rect x={-24} y={-10} width={20} height={20} />
      {/* Stage 2 */}
      <rect x={-14} y={-7} width={14} height={14} />
      {/* Port */}
      <line x1={-28} y1={0} x2={-24} y2={0} />
      {/* Stage 3 (smallest) + rod tip — extends with the simulated stroke */}
      <g transform={`translate(${dx},0)`} style={ROD_MOVE}>
        <rect x={-6} y={-4} width={20} height={8} />
        <line x1={14} y1={0} x2={26} y2={0} />
      </g>
    </g>
  )
}

// ── Valves – Directional ──────────────────────────────────────────────────────

// Shared DCV geometry. Each spool envelope is a 30×30 square (±ENV); internal
// port columns sit at ±PCOL; port stubs run from the box edge (±ENV) out to the
// pin row (±PINY). Bodies tile envelopes horizontally with the default (rest)
// envelope centred on the origin so its ports align with the pins in hydraulic.js.
const ENV = 15
const PCOL = 10
const PINY = 20
const AY = ENV - 4 // flow-arrow vertical extent — inset from the envelope edge

// Spool slide: the envelope block translates horizontally so the active
// envelope (whose centre sits at world-x `cx` at rest) lines up with the fixed
// ports at x=0 — mimicking the spool physically shifting between positions.
function spoolStyle(cx) {
  return { transform: `translate(${-(cx || 0)}px, 0px)`, transition: 'transform 0.3s ease' }
}

// Flow line with a solid arrowhead whose tip is exactly at (x2,y2).
// The shaft stops at the arrowhead base so the line never pokes through the tip.
const HEAD = 5      // arrowhead length
const HALFW = 2.4   // arrowhead half-width
function FlowArrow({ x1, y1, x2, y2 }) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  const ca = Math.cos(a), sa = Math.sin(a)
  const bx = x2 - HEAD * ca, by = y2 - HEAD * sa            // base of the head
  const px = -sa, py = ca                                   // unit perpendicular
  return (
    <>
      <line x1={x1} y1={y1} x2={bx} y2={by} />
      <polygon
        points={`${x2},${y2} ${bx + HALFW * px},${by + HALFW * py} ${bx - HALFW * px},${by - HALFW * py}`}
        fill="currentColor"
        stroke="none"
      />
    </>
  )
}

// Blocked port inside an envelope: short stub from the edge with a perpendicular cap
function BlockedT({ x, top }) {
  const yEnd = top ? -6 : 6
  const yEdge = top ? -ENV : ENV
  return (
    <>
      <line x1={x} y1={yEdge} x2={x} y2={yEnd} />
      <line x1={x - 4} y1={yEnd} x2={x + 4} y2={yEnd} />
    </>
  )
}

// Return spring (axial zigzag) from body edge `x` extending by `dir` (±1)
function ReturnSpring({ x, dir }) {
  const pts = [[x, 0], [x + dir * 3, -6], [x + dir * 7, 6], [x + dir * 11, -6], [x + dir * 14, 0]]
  return <polyline points={pts.map(p => p.join(',')).join(' ')} strokeWidth={1.2} />
}

// Actuator at body edge `x`, extending by `dir` (±1).
// variant: 'solenoid' (box + diagonal), 'manual' (hand lever), 'pilot' (plain box)
function Actuator({ x, dir, variant = 'solenoid' }) {
  const ax = x + dir * 4 // inner edge of actuator
  const connector = <line x1={x} y1={0} x2={ax} y2={0} />
  if (variant === 'manual') {
    const tipx = ax + dir * 9, tipy = -13
    return (
      <g>
        {connector}
        <line x1={ax} y1={0} x2={tipx} y2={tipy} />
        <circle cx={tipx} cy={tipy} r={2.6} fill="currentColor" stroke="none" />
      </g>
    )
  }
  const bx = dir < 0 ? ax - 14 : ax
  return (
    <g>
      {connector}
      <rect x={bx} y={-7} width={14} height={14} />
      {variant === 'solenoid' && <line x1={bx} y1={7} x2={bx + 14} y2={-7} />}
    </g>
  )
}

// 4/2 DCV: envelope 'a' (crossed) left, default 'b' (parallel) centred
export function HydDCV42Symbol({ params = {}, state = {} }) {
  const act = params.actuation || 'solenoid'
  const cx = { a: -30, b: 0 }[state.position] ?? 0
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {/* sliding spool: both envelopes shift so the active one reaches the ports */}
      <g style={spoolStyle(cx)}>
        {/* envelope 'a' (crossed: P→B, A→T) */}
        <rect x={-45} y={-ENV} width={30} height={30} />
        <FlowArrow x1={-40} y1={AY} x2={-20} y2={-AY} />
        <FlowArrow x1={-40} y1={-AY} x2={-20} y2={AY} />
        {/* envelope 'b' (parallel: P→A, B→T) — default, centred */}
        <rect x={-ENV} y={-ENV} width={30} height={30} />
        <FlowArrow x1={-PCOL} y1={AY} x2={-PCOL} y2={-AY} />
        <FlowArrow x1={PCOL} y1={-AY} x2={PCOL} y2={AY} />
        {/* actuator (selects 'a') + return spring (holds 'b') — ride with the spool */}
        <Actuator x={-45} dir={-1} variant={act} />
        <ReturnSpring x={ENV} dir={1} />
      </g>
      {/* port stubs (P,A left col; B,T right col) — fixed to the housing */}
      <line x1={-PCOL} y1={ENV} x2={-PCOL} y2={PINY} />
      <line x1={-PCOL} y1={-ENV} x2={-PCOL} y2={-PINY} />
      <line x1={PCOL} y1={ENV} x2={PCOL} y2={PINY} />
      <line x1={PCOL} y1={-ENV} x2={PCOL} y2={-PINY} />
    </g>
  )
}

// 4/3 DCV open-centre: 'a' (crossed) left, open-centre default centred, 'b' (parallel) right
export function HydDCV43OpenSymbol({ params = {}, state = {} }) {
  const act = params.actuation || 'solenoid'
  const cx = { a: -30, center: 0, b: 30 }[state.position] ?? 0
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {/* sliding spool: three envelopes shift so the active one reaches the ports */}
      <g style={spoolStyle(cx)}>
        {/* envelope 'a' (crossed) at cx=-30 */}
        <rect x={-45} y={-ENV} width={30} height={30} />
        <FlowArrow x1={-40} y1={AY} x2={-20} y2={-AY} />
        <FlowArrow x1={-40} y1={-AY} x2={-20} y2={AY} />
        {/* centre envelope: open centre (all ports interconnected) */}
        <rect x={-ENV} y={-ENV} width={30} height={30} />
        <line x1={-PCOL} y1={-ENV} x2={-PCOL} y2={0} />
        <line x1={PCOL} y1={-ENV} x2={PCOL} y2={0} />
        <line x1={-PCOL} y1={ENV} x2={-PCOL} y2={0} />
        <line x1={PCOL} y1={ENV} x2={PCOL} y2={0} />
        <line x1={-PCOL} y1={0} x2={PCOL} y2={0} />
        {/* envelope 'b' (parallel) at cx=30 */}
        <rect x={ENV} y={-ENV} width={30} height={30} />
        <FlowArrow x1={20} y1={AY} x2={20} y2={-AY} />
        <FlowArrow x1={40} y1={-AY} x2={40} y2={AY} />
        {/* dual actuators + centring springs — ride with the spool */}
        <ReturnSpring x={-45} dir={-1} />
        <Actuator x={-59} dir={-1} variant={act} />
        <ReturnSpring x={45} dir={1} />
        <Actuator x={59} dir={1} variant={act} />
      </g>
      {/* port stubs on centre envelope — fixed to the housing */}
      <line x1={-PCOL} y1={ENV} x2={-PCOL} y2={PINY} />
      <line x1={-PCOL} y1={-ENV} x2={-PCOL} y2={-PINY} />
      <line x1={PCOL} y1={ENV} x2={PCOL} y2={PINY} />
      <line x1={PCOL} y1={-ENV} x2={PCOL} y2={-PINY} />
    </g>
  )
}

// 4/3 DCV closed-centre: 'a' (crossed) left, all-ports-blocked default centred, 'b' (parallel) right
export function HydDCV43ClosedSymbol({ params = {}, state = {} }) {
  const act = params.actuation || 'solenoid'
  const cx = { a: -30, center: 0, b: 30 }[state.position] ?? 0
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {/* sliding spool: three envelopes shift so the active one reaches the ports */}
      <g style={spoolStyle(cx)}>
        {/* envelope 'a' (crossed) at cx=-30 */}
        <rect x={-45} y={-ENV} width={30} height={30} />
        <FlowArrow x1={-40} y1={AY} x2={-20} y2={-AY} />
        <FlowArrow x1={-40} y1={-AY} x2={-20} y2={AY} />
        {/* centre envelope: closed centre (all ports blocked) */}
        <rect x={-ENV} y={-ENV} width={30} height={30} />
        <BlockedT x={-PCOL} top />
        <BlockedT x={PCOL} top />
        <BlockedT x={-PCOL} top={false} />
        <BlockedT x={PCOL} top={false} />
        {/* envelope 'b' (parallel) at cx=30 */}
        <rect x={ENV} y={-ENV} width={30} height={30} />
        <FlowArrow x1={20} y1={AY} x2={20} y2={-AY} />
        <FlowArrow x1={40} y1={-AY} x2={40} y2={AY} />
        {/* dual actuators + centring springs — ride with the spool */}
        <ReturnSpring x={-45} dir={-1} />
        <Actuator x={-59} dir={-1} variant={act} />
        <ReturnSpring x={45} dir={1} />
        <Actuator x={59} dir={1} variant={act} />
      </g>
      {/* port stubs on centre envelope — fixed to the housing */}
      <line x1={-PCOL} y1={ENV} x2={-PCOL} y2={PINY} />
      <line x1={-PCOL} y1={-ENV} x2={-PCOL} y2={-PINY} />
      <line x1={PCOL} y1={ENV} x2={PCOL} y2={PINY} />
      <line x1={PCOL} y1={-ENV} x2={PCOL} y2={-PINY} />
    </g>
  )
}

// 2/2 DCV: 'open' (P→A) envelope left, 'closed' (blocked) default centred
export function HydDCV22Symbol({ params = {}, state = {} }) {
  const act = params.actuation || 'solenoid'
  const cx = { open: -30, closed: 0 }[state.position] ?? 0
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {/* sliding spool: both envelopes shift so the active one reaches the ports */}
      <g style={spoolStyle(cx)}>
        {/* envelope 'open' (P→A) at cx=-30 */}
        <rect x={-45} y={-ENV} width={30} height={30} />
        <FlowArrow x1={-30} y1={AY} x2={-30} y2={-AY} />
        {/* default 'closed' envelope (blocked), centred */}
        <rect x={-ENV} y={-ENV} width={30} height={30} />
        <BlockedT x={0} top />
        <BlockedT x={0} top={false} />
        {/* actuator (selects 'open') + return spring (holds 'closed') — ride with the spool */}
        <Actuator x={-45} dir={-1} variant={act} />
        <ReturnSpring x={ENV} dir={1} />
      </g>
      {/* port stubs (single column) — fixed to the housing */}
      <line x1={0} y1={ENV} x2={0} y2={PINY} />
      <line x1={0} y1={-ENV} x2={0} y2={-PINY} />
    </g>
  )
}

// 3/2 DCV: 'a' (P→A) envelope left, default 'b' (T→A) centred. A is the single top port.
export function HydDCV32Symbol({ params = {}, state = {} }) {
  const act = params.actuation || 'solenoid'
  const cx = { a: -30, b: 0 }[state.position] ?? 0
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {/* sliding spool: both envelopes shift so the active one reaches the ports */}
      <g style={spoolStyle(cx)}>
        {/* envelope 'a' (P→A, T blocked) at cx=-30 */}
        <rect x={-45} y={-ENV} width={30} height={30} />
        <FlowArrow x1={-40} y1={AY} x2={-30} y2={-AY} />
        <BlockedT x={-20} top={false} />
        {/* default 'b' envelope (T→A, P blocked), centred */}
        <rect x={-ENV} y={-ENV} width={30} height={30} />
        <FlowArrow x1={PCOL} y1={AY} x2={0} y2={-AY} />
        <BlockedT x={-PCOL} top={false} />
        {/* actuator (selects 'a') + return spring (holds 'b') — ride with the spool */}
        <Actuator x={-45} dir={-1} variant={act} />
        <ReturnSpring x={ENV} dir={1} />
      </g>
      {/* port stubs: P,T bottom; A top centre — fixed to the housing */}
      <line x1={-PCOL} y1={ENV} x2={-PCOL} y2={PINY} />
      <line x1={PCOL} y1={ENV} x2={PCOL} y2={PINY} />
      <line x1={0} y1={-ENV} x2={0} y2={-PINY} />
    </g>
  )
}

// Parametric DCV "valve builder" (issue #20) — one configurable directional
// valve covering 2/3 positions × 2/3/4 ports with a selectable centre condition,
// replacing the need for a separate symbol per combination. Each position is an
// envelope; the spool slides so the active envelope lines up with the fixed
// ports. Flow paths + blocked ports are derived from valveRouting().
function valveCellPorts(ports, cx) {
  const top = -AY, bot = AY
  if (ports === 2) return { P: { x: cx, y: bot, top: false }, A: { x: cx, y: top, top: true } }
  if (ports === 3) return {
    P: { x: cx - PCOL, y: bot, top: false }, T: { x: cx + PCOL, y: bot, top: false },
    A: { x: cx, y: top, top: true },
  }
  return {
    P: { x: cx - PCOL, y: bot, top: false }, T: { x: cx + PCOL, y: bot, top: false },
    A: { x: cx - PCOL, y: top, top: true }, B: { x: cx + PCOL, y: top, top: true },
  }
}

export function HydDCVCustomSymbol({ params = {}, state = {} }) {
  const act = params.actuation || 'solenoid'
  const cfg = valveConfig(params)
  const routes = valveRouting(cfg)
  const keys = valvePositionKeys(cfg)
  const centres = keys.length === 3 ? [-30, 0, 30] : [-30, 0]
  const activeIdx = Math.max(0, keys.indexOf(state.position ?? valveDefaultPosition(cfg)))
  const cx = centres[activeIdx] ?? 0

  const renderCell = (key, centre) => {
    const pos = valveCellPorts(cfg.ports, centre)
    const pairs = routes[key] || []
    const used = new Set()
    const arrows = pairs.map(([a, b], i) => {
      used.add(a); used.add(b)
      return <FlowArrow key={`a${i}`} x1={pos[a].x} y1={pos[a].y} x2={pos[b].x} y2={pos[b].y} />
    })
    const blocked = Object.entries(pos)
      .filter(([id]) => !used.has(id))
      .map(([id, p]) => <BlockedT key={`x${id}`} x={p.x} top={p.top} />)
    return (
      <g key={key}>
        <rect x={centre - ENV} y={-ENV} width={30} height={30} />
        {arrows}{blocked}
      </g>
    )
  }

  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <g style={spoolStyle(cx)}>
        {keys.map((k, i) => renderCell(k, centres[i]))}
        {/* Actuator(s) + centring/return spring ride with the spool */}
        <Actuator x={centres[0] - ENV} dir={-1} variant={act} />
        {keys.length === 3
          ? <><ReturnSpring x={centres[0] - ENV} dir={-1} />
              <Actuator x={centres[centres.length - 1] + ENV} dir={1} variant={act} />
              <ReturnSpring x={centres[centres.length - 1] + ENV} dir={1} /></>
          : <ReturnSpring x={centres[centres.length - 1] + ENV} dir={1} />}
      </g>
      {/* Fixed port stubs on the housing (default cell, centred at 0) */}
      {valvePins(cfg.ports).map(pin => {
        const top = pin.relY < 0
        return <line key={pin.id} x1={pin.relX} y1={top ? -ENV : ENV} x2={pin.relX} y2={top ? -PINY : PINY} />
      })}
    </g>
  )
}

// ── Valves – Pressure ─────────────────────────────────────────────────────────

// Normally-closed pressure-relief valve drawn as a ball poppet seated on a
// conical (triangle) seat, held shut by a bias spring. P (inlet) is at the
// bottom, T (tank) at the top. When the sim cracks it (`state.relieving`) the
// ball lifts off its seat and a flow arrow shows P→T.
export function HydReliefValveSymbol({ state = {} }) {
  const relieving = !!state.relieving
  const ballY = relieving ? -7 : -2        // lifts up off the seat when cracking
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {/* Body */}
      <rect x={-12} y={-16} width={24} height={32} />
      {/* Conical seat (triangle) at the inlet, apex up where the ball sits */}
      <path d="M-6,8 L0,1 L6,8" />
      {/* Inlet feed from P up to the seat */}
      <line x1={0} y1={16} x2={0} y2={8} />
      {/* Ball poppet (lifts when relieving) */}
      <circle cx={0} cy={ballY} r={4} fill={relieving ? 'currentColor' : 'none'} fillOpacity={relieving ? 0.18 : 0} />
      {/* Bias spring above the ball, pressed down onto the seat */}
      <path d="M-4,-15 L4,-13 L-4,-11 L4,-9 L-4,-7" strokeWidth={1.2} />
      {/* Flow arrow P→T while cracking */}
      {relieving && (
        <>
          <line x1={0} y1={6} x2={0} y2={-12} stroke="currentColor" strokeWidth={1.1} />
          <polygon points="0,-13 -2.6,-8 2.6,-8" fill="currentColor" stroke="none" />
        </>
      )}
      {/* External pilot reference line */}
      <line x1={-12} y1={12} x2={-16} y2={12} strokeDasharray="2,2" />
      <line x1={-16} y1={12} x2={-16} y2={-12} strokeDasharray="2,2" />
      <line x1={-16} y1={-12} x2={-12} y2={-12} strokeDasharray="2,2" />
      {/* Port stubs: P bottom, T top */}
      <line x1={0} y1={-16} x2={0} y2={-20} />
      <line x1={0} y1={16} x2={0} y2={20} />
    </g>
  )
}

export function HydSequenceValveSymbol() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <rect x={-12} y={-16} width={24} height={32} />
      <line x1={0} y1={12} x2={0} y2={-8} />
      <polygon points="0,-8 -3,-2 3,-2" fill="currentColor" stroke="none" />
      <path d="M12,-14 Q14,-10 12,-6 Q14,-2 12,2 Q14,6 12,10 Q14,14 12,16" strokeWidth={1.2} />
      {/* External pilot */}
      <line x1={-12} y1={8} x2={-18} y2={8} />
      <line x1={-18} y1={8} x2={-18} y2={20} />
      <line x1={0} y1={-16} x2={0} y2={-20} />
      <line x1={0} y1={16} x2={0} y2={20} />
    </g>
  )
}

export function HydPressureReducingSymbol() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <rect x={-12} y={-16} width={24} height={32} />
      {/* Arrow reversed: normally open, closes on downstream pressure */}
      <line x1={0} y1={-12} x2={0} y2={8} />
      <polygon points="0,8 -3,2 3,2" fill="currentColor" stroke="none" />
      <path d="M12,-14 Q14,-10 12,-6 Q14,-2 12,2 Q14,6 12,10 Q14,14 12,16" strokeWidth={1.2} />
      {/* External drain and pilot */}
      <line x1={-12} y1={-8} x2={-18} y2={-8} />
      <line x1={0} y1={-16} x2={0} y2={-20} />
      <line x1={0} y1={16} x2={0} y2={20} />
    </g>
  )
}

export function HydCounterbalanceSymbol() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <rect x={-12} y={-16} width={24} height={32} />
      <line x1={0} y1={12} x2={0} y2={-8} />
      <polygon points="0,-8 -3,-2 3,-2" fill="currentColor" stroke="none" />
      <path d="M12,-14 Q14,-10 12,-6 Q14,-2 12,2 Q14,6 12,10 Q14,14 12,16" strokeWidth={1.2} />
      {/* External pilot port X */}
      <line x1={14} y1={0} x2={18} y2={0} strokeDasharray="2,2" />
      <line x1={0} y1={-16} x2={0} y2={-20} />
      <line x1={0} y1={16} x2={0} y2={20} />
    </g>
  )
}

// ── Valves – Flow ─────────────────────────────────────────────────────────────

// Check (non-return) valve drawn as a ball on a conical (triangle) seat. The
// seat mouth faces the inlet A (left); the ball rests just downstream of the
// throat, sealing reverse flow B→A. Forward flow A→B pushes the ball off the
// seat — when the sim has forward flow (`state.flowing`) the ball lifts clear.
export function HydCheckValveSymbol({ state = {} }) {
  const flowing = !!state.flowing
  const ballCx = flowing ? 5 : 2.5         // ball lifts toward the outlet under forward flow
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {/* Inlet A (free-flow side) */}
      <line x1={-14} y1={0} x2={-6} y2={0} />
      {/* Conical seat — throat (x=1) faces the inlet; the ball seals it from the
          outlet side, so forward flow A→B pushes the ball clear. */}
      <path d="M-6,-7 L1,0 L-6,7" />
      {/* Ball poppet */}
      <circle cx={ballCx} cy={0} r={4.5} fill={flowing ? 'currentColor' : 'none'} fillOpacity={flowing ? 0.18 : 0} />
      {/* Outlet B */}
      <line x1={ballCx + 4.5} y1={0} x2={14} y2={0} style={ROD_MOVE} />
      {/* Allowed-flow direction arrowhead on the inlet line (points A → B) */}
      <polygon points="-7,0 -11,-3 -11,3" fill="currentColor" stroke="none" />
    </g>
  )
}

export function HydPilotCheckSymbol() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <line x1={-18} y1={0} x2={18} y2={0} />
      <circle cx={2} cy={0} r={5} />
      <line x1={-3} y1={-8} x2={-3} y2={8} />
      <polygon points="-10,0 -6,-3 -6,3" fill="currentColor" stroke="none" />
      {/* Pilot line */}
      <line x1={0} y1={5} x2={0} y2={16} strokeDasharray="2,2" />
      <polygon points="0,16 -3,11 3,11" fill="currentColor" stroke="none" />
    </g>
  )
}

export function HydFlowControlSymbol() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {/* Orifice symbol: two lines with restriction */}
      <line x1={-14} y1={0} x2={-6} y2={0} />
      <line x1={6} y1={0} x2={14} y2={0} />
      {/* Throttle arc */}
      <path d="M-6,-2 Q0,6 6,-2" />
      <path d="M-6,2 Q0,-6 6,2" />
      {/* Adjustment arrow */}
      <line x1={-10} y1={-10} x2={10} y2={10} />
      <polygon points="10,10 5,8 8,5" fill="currentColor" stroke="none" />
    </g>
  )
}

export function HydFlowDividerSymbol() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {/* Inlet */}
      <line x1={0} y1={-20} x2={0} y2={-4} />
      {/* Split */}
      <line x1={0} y1={-4} x2={-14} y2={8} />
      <line x1={0} y1={-4} x2={14} y2={8} />
      {/* Outlets */}
      <line x1={-14} y1={8} x2={-14} y2={20} />
      <line x1={14} y1={8} x2={14} y2={20} />
      {/* Node dot */}
      <circle cx={0} cy={-4} r={2} fill="currentColor" stroke="none" />
    </g>
  )
}

export function HydShuttleValveSymbol({ state = {} }) {
  // OR (shuttle) valve — a ball in a chamber with two inlets (A, B) and a common
  // outlet (Y). The ball seats against whichever inlet has the lower pressure, so
  // the higher-pressure inlet connects to the outlet. When the sim knows which
  // side is selected, the ball sits against the opposite seat; otherwise centred.
  const sel = state.select   // 'A' | 'B' | undefined
  const ballCx = sel === 'A' ? 4.5 : sel === 'B' ? -4.5 : 0
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {/* Inlet ports */}
      <line x1={-18} y1={0} x2={-9} y2={0} />
      <line x1={9} y1={0} x2={18} y2={0} />
      {/* Chamber — a clean capsule whose rounded ends are the two seats */}
      <rect x={-9} y={-7} width={18} height={14} rx={7} ry={7} />
      {/* Shuttle ball */}
      <circle cx={ballCx} cy={0} r={4.5} fill="currentColor" fillOpacity={0.18} />
      {/* Common outlet (Y, top) */}
      <line x1={0} y1={-7} x2={0} y2={-15} />
    </g>
  )
}

// ── Conditioning ──────────────────────────────────────────────────────────────

export function HydFilterSymbol() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {/* Body */}
      <rect x={-12} y={-16} width={24} height={32} />
      {/* Filter element (dashed lines inside) */}
      <line x1={-8} y1={-10} x2={8} y2={-10} strokeDasharray="2,2" />
      <line x1={-8} y1={-4} x2={8} y2={-4} strokeDasharray="2,2" />
      <line x1={-8} y1={2} x2={8} y2={2} strokeDasharray="2,2" />
      <line x1={-8} y1={8} x2={8} y2={8} strokeDasharray="2,2" />
      {/* Port stubs */}
      <line x1={0} y1={-16} x2={0} y2={-20} />
      <line x1={0} y1={16} x2={0} y2={20} />
    </g>
  )
}

export function HydHeatExchangerSymbol() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {/* Rectangle body */}
      <rect x={-16} y={-12} width={32} height={24} />
      {/* Wavy line through center */}
      <path d="M-12,0 Q-8,-6 -4,0 Q0,6 4,0 Q8,-6 12,0" />
      {/* Port stubs */}
      <line x1={-18} y1={0} x2={-16} y2={0} />
      <line x1={16} y1={0} x2={18} y2={0} />
    </g>
  )
}

export function HydPressureGaugeSymbol() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={0} cy={-4} r={12} />
      {/* Needle */}
      <line x1={0} y1={-4} x2={6} y2={-12} strokeWidth={1.2} />
      {/* Scale ticks */}
      <line x1={-10} y1={-6} x2={-8} y2={-4} strokeWidth={1} />
      <line x1={10} y1={-6} x2={8} y2={-4} strokeWidth={1} />
      <line x1={0} y1={-16} x2={0} y2={-14} strokeWidth={1} />
      {/* Port */}
      <line x1={0} y1={8} x2={0} y2={14} />
    </g>
  )
}

export function HydFlowMeterSymbol() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={0} cy={0} r={12} />
      {/* Arrow through circle */}
      <line x1={-8} y1={0} x2={6} y2={0} />
      <polygon points="6,0 2,-3 2,3" fill="currentColor" stroke="none" />
      {/* Port stubs */}
      <line x1={-14} y1={0} x2={-18} y2={0} />
      <line x1={14} y1={0} x2={18} y2={0} />
    </g>
  )
}

export function HydTemperatureGaugeSymbol() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={0} cy={-4} r={12} />
      {/* T symbol inside */}
      <line x1={-5} y1={-8} x2={5} y2={-8} />
      <line x1={0} y1={-8} x2={0} y2={2} />
      {/* Port */}
      <line x1={0} y1={8} x2={0} y2={14} />
    </g>
  )
}

// ── Lines & Connectors ────────────────────────────────────────────────────────

export function HydJunctionSymbol() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <line x1={-10} y1={0} x2={10} y2={0} />
      <line x1={0} y1={0} x2={0} y2={10} />
      <circle cx={0} cy={0} r={2.5} fill="currentColor" stroke="none" />
    </g>
  )
}

export function HydPortSymbol() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {/* Connection stub from pin at origin */}
      <line x1={0} y1={0} x2={0} y2={6} />
      {/* Blanked / test-point cap */}
      <line x1={-5} y1={6} x2={5} y2={6} />
    </g>
  )
}

// Manifold — distribution block with a pressure supply (P) and N work ports
// tapped off a common gallery. Port count comes from simParams.ports and the
// block grows to fit (issue #22).
export function HydManifoldSymbol({ params = {} }) {
  const m = manifoldDrawing(params.ports ?? 4)
  return (
    <g fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {/* Block body */}
      <rect x={m.rect.x} y={m.rect.y} width={m.rect.width} height={m.rect.height} rx={2} />
      {/* Internal common gallery */}
      <line x1={m.gallery.x1} y1={m.gallery.y} x2={m.gallery.x2} y2={m.gallery.y} strokeWidth={SW * 1.5} />
      {/* Pressure supply stub + label */}
      <line x1={m.supply.x1} y1={m.supply.y} x2={m.supply.x2} y2={m.supply.y} />
      <text x={m.rect.x + 4} y={-m.rect.height / 2 - 2} fontSize={7} fill="currentColor" stroke="none">P</text>
      {/* Work-port stubs (gallery → port) + numbers */}
      {m.stubs.map((s, i) => (
        <g key={i}>
          <line x1={s.x} y1={m.gallery.y} x2={s.x} y2={s.y2} />
          <text x={s.x} y={s.y1 - 3} fontSize={6} fill="currentColor" stroke="none" textAnchor="middle">{s.label}</text>
        </g>
      ))}
    </g>
  )
}

export const HYDRAULIC_SYMBOL_MAP = {
  hyd_manifold:         HydManifoldSymbol,
  hyd_pump_fixed:       HydPumpFixedSymbol,
  hyd_pump_variable:    HydPumpVariableSymbol,
  hyd_motor_fixed:      HydMotorFixedSymbol,
  hyd_motor_variable:   HydMotorVariableSymbol,
  hyd_reservoir:        HydReservoirSymbol,
  hyd_accumulator:      HydAccumulatorSymbol,
  hyd_cylinder_single:  HydCylinderSingleSymbol,
  hyd_cylinder_double:  HydCylinderDoubleSymbol,
  hyd_cylinder_telescopic: HydCylinderTelescopicSymbol,
  hyd_cylinder_steering: HydCylinderSteeringSymbol,
  hyd_dcv_4_2:          HydDCV42Symbol,
  hyd_dcv_4_3_open:     HydDCV43OpenSymbol,
  hyd_dcv_4_3_closed:   HydDCV43ClosedSymbol,
  hyd_dcv_2_2:          HydDCV22Symbol,
  hyd_dcv_3_2:          HydDCV32Symbol,
  hyd_dcv_custom:       HydDCVCustomSymbol,
  hyd_relief_valve:     HydReliefValveSymbol,
  hyd_sequence_valve:   HydSequenceValveSymbol,
  hyd_pressure_reducing: HydPressureReducingSymbol,
  hyd_counterbalance:   HydCounterbalanceSymbol,
  hyd_check_valve:      HydCheckValveSymbol,
  hyd_pilot_check:      HydPilotCheckSymbol,
  hyd_flow_control:     HydFlowControlSymbol,
  hyd_flow_divider:     HydFlowDividerSymbol,
  hyd_shuttle_valve:    HydShuttleValveSymbol,
  hyd_filter:           HydFilterSymbol,
  hyd_heat_exchanger:   HydHeatExchangerSymbol,
  hyd_pressure_gauge:   HydPressureGaugeSymbol,
  hyd_flow_meter:       HydFlowMeterSymbol,
  hyd_temperature_gauge: HydTemperatureGaugeSymbol,
  hyd_junction:         HydJunctionSymbol,
  hyd_port:             HydPortSymbol,
}
