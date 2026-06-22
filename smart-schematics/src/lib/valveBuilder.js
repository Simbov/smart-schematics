// Parametric directional-control-valve "builder" (issue #20). Instead of a fixed
// list of valve types (4/2, 4/3-open, 4/3-closed, 3/2, 2/2…) one configurable
// component covers the family: choose the number of working ports and the number
// of switching positions, plus the centre condition for 3-position valves.
//
//   config = { ports: 2|3|4, positions: 2|3, centerPosition }
//   centerPosition ∈ 'closed' | 'open' | 'tandem' | 'float'  (3-position only)
//
// Pure model: pin layout, flow routing per position, and position cycling. The
// SVG envelope drawing lives in HydraulicSymbols.jsx (next to the shared spool
// helpers); this file owns everything the store + simulator need.

export const VALVE_PORT_OPTIONS = [2, 3, 4]
export const VALVE_POSITION_OPTIONS = [2, 3]
export const VALVE_CENTRES = ['closed', 'open', 'tandem', 'float']

const PCOL = 10   // port column offset (matches the DCV symbol grid)
const PINY = 20

export function clampPorts(n) {
  const v = Math.round(Number(n) || 0)
  return VALVE_PORT_OPTIONS.includes(v) ? v : 4
}
export function clampPositions(n) {
  const v = Math.round(Number(n) || 0)
  return VALVE_POSITION_OPTIONS.includes(v) ? v : 3
}

export function valveConfig(simParams = {}) {
  return {
    ports: clampPorts(simParams.ports ?? 4),
    positions: clampPositions(simParams.positions ?? 3),
    centerPosition: VALVE_CENTRES.includes(simParams.centerPosition) ? simParams.centerPosition : 'closed',
  }
}

// Pin specs ({ id, relX, relY, direction, label }) for the given port count.
// Pressure (P) and tank (T) on the bottom edge; work ports (A, B) on top.
export function valvePins(ports) {
  const p = clampPorts(ports)
  if (p === 2) {
    return [
      { id: 'P', relX: 0, relY: PINY, direction: 'S', label: 'P' },
      { id: 'A', relX: 0, relY: -PINY, direction: 'N', label: 'A' },
    ]
  }
  if (p === 3) {
    return [
      { id: 'P', relX: -PCOL, relY: PINY, direction: 'S', label: 'P' },
      { id: 'T', relX: PCOL, relY: PINY, direction: 'S', label: 'T' },
      { id: 'A', relX: 0, relY: -PINY, direction: 'N', label: 'A' },
    ]
  }
  return [
    { id: 'P', relX: -PCOL, relY: PINY, direction: 'S', label: 'P' },
    { id: 'T', relX: PCOL, relY: PINY, direction: 'S', label: 'T' },
    { id: 'A', relX: -PCOL, relY: -PINY, direction: 'N', label: 'A' },
    { id: 'B', relX: PCOL, relY: -PINY, direction: 'N', label: 'B' },
  ]
}

// Ordered position keys for cycling (left → centre → right).
export function valvePositionKeys(config) {
  const { positions } = valveConfig(config)
  return positions === 3 ? ['a', 'center', 'b'] : ['a', 'b']
}

// The neutral/at-rest position: the spring-centred middle for 3-position valves,
// otherwise the 'b' (right) envelope.
export function valveDefaultPosition(config) {
  return valveConfig(config).positions === 3 ? 'center' : 'b'
}

function centreRouting(ports, centre) {
  if (ports === 4) {
    switch (centre) {
      case 'open':   return [['P', 'T'], ['A', 'T'], ['B', 'T']]
      case 'tandem': return [['P', 'T']]
      case 'float':  return [['A', 'T'], ['B', 'T']]
      case 'closed':
      default:       return []
    }
  }
  if (ports === 3) {
    return centre === 'open' ? [['P', 'A'], ['T', 'A']] : []
  }
  return centre === 'open' ? [['P', 'A']] : []
}

// Conducting pin pairs for the whole valve, keyed by position.
export function valveRouting(config) {
  const { ports, positions, centerPosition } = valveConfig(config)
  let routes
  if (ports === 4) {
    routes = { a: [['P', 'B'], ['A', 'T']], b: [['P', 'A'], ['B', 'T']] }
  } else if (ports === 3) {
    routes = { a: [['P', 'A']], b: [['T', 'A']] }
  } else {
    routes = { a: [['P', 'A']], b: [] }
  }
  if (positions === 3) routes.center = centreRouting(ports, centerPosition)
  return routes
}

// Conducting pairs for the valve at a specific position (used by the simulator).
export function valveConductingPairs(config, position) {
  const routes = valveRouting(config)
  const pos = position ?? valveDefaultPosition(config)
  return routes[pos] || []
}
