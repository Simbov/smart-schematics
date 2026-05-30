// Hydraulic simulation engine — Phase 11
//
// Flow-routing model (not CFD). Key concepts:
//   • Pump generates pressure + flow when connected in circuit
//   • Wires are "hydraulic lines"; their net state tracks pressure & flow rate
//   • DCV position (left/center/right) determines which port pairs conduct
//   • Relief valve clamps line pressure and routes overflow to tank
//   • Cylinder position (0–100 %) advances based on net flow into port A vs B
//   • Hydraulic motor produces rotation state when flow passes through
//
// Called every simulation tick by simulationStore.runHydTick().

// ── Component type sets ────────────────────────────────────────────────────────

// DCVs that can be manually shifted by clicking during simulation
export const MANUAL_DCV_TYPES = new Set([
  'hyd_dcv_4_2',
  'hyd_dcv_4_3_open',
  'hyd_dcv_4_3_closed',
  'hyd_dcv_2_2',
  'hyd_dcv_3_2',
])

export const HYD_SOURCE_TYPES = new Set([
  'hyd_pump_fixed',
  'hyd_pump_variable',
])

export const HYD_ACTUATOR_TYPES = new Set([
  'hyd_cylinder_single',
  'hyd_cylinder_double',
  'hyd_cylinder_telescopic',
  'hyd_motor_fixed',
  'hyd_motor_variable',
])

export const HYD_VALVE_TYPES = new Set([
  'hyd_dcv_4_2',
  'hyd_dcv_4_3_open',
  'hyd_dcv_4_3_closed',
  'hyd_dcv_2_2',
  'hyd_dcv_3_2',
  'hyd_relief_valve',
  'hyd_sequence_valve',
  'hyd_pressure_reducing',
  'hyd_counterbalance',
  'hyd_check_valve',
  'hyd_pilot_check',
  'hyd_flow_control',
  'hyd_flow_divider',
  'hyd_shuttle_valve',
])

export const ALL_HYD_TYPES = new Set([
  ...HYD_SOURCE_TYPES,
  ...HYD_ACTUATOR_TYPES,
  ...HYD_VALVE_TYPES,
  'hyd_reservoir',
  'hyd_accumulator',
  'hyd_filter',
  'hyd_heat_exchanger',
  'hyd_pressure_gauge',
  'hyd_flow_meter',
  'hyd_temperature_gauge',
  'hyd_junction',
  'hyd_port',
])

// ── DCV flow routing tables ───────────────────────────────────────────────────

export const DCV_ROUTING = {
  hyd_dcv_4_2: {
    a: [['P', 'B'], ['A', 'T']],
    b: [['P', 'A'], ['B', 'T']],
  },
  hyd_dcv_4_3_open: {
    a:      [['P', 'B'], ['A', 'T']],
    center: [['P', 'T'], ['A', 'T'], ['B', 'T']],
    b:      [['P', 'A'], ['B', 'T']],
  },
  hyd_dcv_4_3_closed: {
    a:      [['P', 'B'], ['A', 'T']],
    center: [],
    b:      [['P', 'A'], ['B', 'T']],
  },
  hyd_dcv_2_2: {
    open:   [['P', 'A']],
    closed: [],
  },
  hyd_dcv_3_2: {
    a: [['P', 'A']],
    b: [['T', 'A']],
  },
}

// ── Default DCV positions ─────────────────────────────────────────────────────

export function defaultDCVPosition(type) {
  switch (type) {
    case 'hyd_dcv_4_3_open':
    case 'hyd_dcv_4_3_closed':
      return 'center'
    case 'hyd_dcv_2_2':
      return 'closed'
    case 'hyd_dcv_3_2':
      return 'b'
    default:
      return 'b'
  }
}

// ── Union-Find ────────────────────────────────────────────────────────────────

class UF {
  constructor() { this.p = {} }
  _init(k) { if (!(k in this.p)) this.p[k] = k }
  find(k) {
    this._init(k)
    if (this.p[k] !== k) this.p[k] = this.find(this.p[k])
    return this.p[k]
  }
  union(a, b) {
    const ra = this.find(a), rb = this.find(b)
    if (ra !== rb) this.p[rb] = ra
  }
}

const ptKey = (x, y) => `${Math.round(x)},${Math.round(y)}`

// ── Conducting pin pairs per component type ───────────────────────────────────

function getConductingPairs(comp, dcvPositions) {
  const { type } = comp

  if (DCV_ROUTING[type]) {
    const pos = dcvPositions[comp.id] ?? defaultDCVPosition(type)
    return DCV_ROUTING[type][pos] || []
  }

  switch (type) {
    case 'hyd_filter':         return [['IN', 'OUT']]
    case 'hyd_heat_exchanger': return [['IN', 'OUT']]
    case 'hyd_flow_control':   return [['A', 'B']]
    case 'hyd_flow_meter':     return [['IN', 'OUT']]
    case 'hyd_flow_divider':   return [['P', 'A'], ['P', 'B']]
    case 'hyd_shuttle_valve':  return [['A', 'Y'], ['B', 'Y']]
    case 'hyd_junction':       return [['A', 'B'], ['B', 'C'], ['A', 'C']]
    case 'hyd_check_valve':    return [['A', 'B']]  // simplified: bidirectional
    case 'hyd_pilot_check':    return [['A', 'B']]  // simplified: ignore pilot
    case 'hyd_sequence_valve':    return [['P', 'A']]
    case 'hyd_pressure_reducing': return [['P', 'A']]
    case 'hyd_counterbalance':    return [['A', 'B']]
    // Motors conduct (flow-through actuators)
    case 'hyd_motor_fixed':
    case 'hyd_motor_variable': return [['A', 'B']]
    // Cylinders are dead-end: ports are separate chambers
    // Relief valve handled separately (pressure-dependent)
    default: return []
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function runHydraulicSimulation(components, wires, dcvPositions, relayEnergized, cylinderPositions) {
  const hydComps = components.filter(c => ALL_HYD_TYPES.has(c.type))
  if (hydComps.length === 0) return { componentStates: {}, wireNetStates: {} }

  // Step 1: Build Union-Find from wire coordinates only
  const uf = new UF()
  wires.forEach(wire => {
    for (let i = 0; i < wire.points.length - 1; i++) {
      uf.union(
        ptKey(wire.points[i].x, wire.points[i].y),
        ptKey(wire.points[i + 1].x, wire.points[i + 1].y),
      )
    }
  })

  // Map each component pin → its initial wire net canonical key
  const pinNet = {}
  const refreshPinNets = () => {
    components.forEach(comp => {
      ;(comp.pins || []).forEach(pin => {
        pinNet[`${comp.id}.${pin.id}`] = uf.find(ptKey(pin.absX, pin.absY))
      })
    })
  }
  refreshPinNets()

  const getNet = (compId, pinId) => pinNet[`${compId}.${pinId}`]

  // Step 2: Build net adjacency graph through conducting component pairs
  // We do NOT merge into UF here — we keep wires as separate nets so we can
  // classify them as working vs return independently.
  const netAdj = {} // net → Set<net>
  const addEdge = (nA, nB) => {
    if (!nA || !nB || nA === nB) return
    ;(netAdj[nA] ??= new Set()).add(nB)
    ;(netAdj[nB] ??= new Set()).add(nA)
  }

  hydComps.forEach(comp => {
    getConductingPairs(comp, dcvPositions).forEach(([pA, pB]) => {
      addEdge(getNet(comp.id, pA), getNet(comp.id, pB))
    })
  })

  // Step 3: Mark source nets (pump outlets) and tank nets (reservoir pins, pump inlets)
  const tankNets = new Set()
  const pumpOutletNets = new Set()
  const pumpData = {} // outletNet → { pressure, flow }

  hydComps.forEach(comp => {
    if (comp.type === 'hyd_reservoir') {
      ;(comp.pins || []).forEach(pin => {
        const n = getNet(comp.id, pin.id)
        if (n) tankNets.add(n)
      })
    } else if (HYD_SOURCE_TYPES.has(comp.type)) {
      const inNet = getNet(comp.id, 'IN')
      const outNet = getNet(comp.id, 'OUT')
      if (inNet) tankNets.add(inNet)
      if (outNet) {
        pumpOutletNets.add(outNet)
        const disp = comp.simParams?.displacement ?? comp.simParams?.maxDisplacement ?? 18
        const speed = comp.simParams?.speed ?? 1500
        const flow = (disp * speed) / 1000  // L/min
        pumpData[outNet] = { pressure: 200, flow }
      }
    }
  })

  // Step 4: BFS from pump outlets → pressurized nets (stop at tank nets)
  const pressurized = new Set(pumpOutletNets)
  const pQueue = [...pumpOutletNets]
  while (pQueue.length) {
    const cur = pQueue.shift()
    for (const next of (netAdj[cur] || [])) {
      if (!pressurized.has(next) && !tankNets.has(next)) {
        pressurized.add(next)
        pQueue.push(next)
      }
    }
  }

  // Step 4b: Relief valve pass — open P→T if P is pressurized
  // (run before return BFS so return side recognises relief path)
  hydComps.forEach(comp => {
    if (comp.type === 'hyd_relief_valve') {
      const pNet = getNet(comp.id, 'P')
      const tNet = getNet(comp.id, 'T')
      if (pNet && tNet && pressurized.has(pNet)) {
        addEdge(pNet, tNet)
      }
    }
  })

  // Step 5: BFS from tank nets → return nets (stop at pressurized nets)
  const returnNets = new Set(tankNets)
  const rQueue = [...tankNets]
  while (rQueue.length) {
    const cur = rQueue.shift()
    for (const next of (netAdj[cur] || [])) {
      if (!returnNets.has(next) && !pressurized.has(next)) {
        returnNets.add(next)
        rQueue.push(next)
      }
    }
  }

  // Step 6: Compute actuator and component states
  const componentStates = {}
  const TICK_ADVANCE = 2  // % per tick

  hydComps.forEach(comp => {
    const { type, id } = comp

    if (HYD_SOURCE_TYPES.has(type)) {
      const outNet = getNet(id, 'OUT')
      const pd = outNet ? pumpData[outNet] : null
      componentStates[id] = { pumping: true, flow: pd?.flow ?? 0, pressure: pd?.pressure ?? 0 }

    } else if (type === 'hyd_motor_fixed' || type === 'hyd_motor_variable') {
      const nA = getNet(id, 'A')
      const nB = getNet(id, 'B')
      const aP = nA ? pressurized.has(nA) : false
      const bP = nB ? pressurized.has(nB) : false
      const rotating = aP || bP
      componentStates[id] = { rotating, rpm: rotating ? 1500 : 0 }

    } else if (type === 'hyd_cylinder_single') {
      const nA = getNet(id, 'A')
      const aP = nA ? pressurized.has(nA) : false
      const aR = nA ? returnNets.has(nA) : false
      const ext = cylinderPositions[id] ?? 0
      let extending = false, retracting = false
      if (aP && !aR) {
        extending = true
        cylinderPositions[id] = Math.min(100, ext + TICK_ADVANCE)
      } else {
        // Spring return — retract when port A is return or unpressurized
        if (ext > 0) {
          retracting = true
          cylinderPositions[id] = Math.max(0, ext - TICK_ADVANCE)
        }
      }
      componentStates[id] = { extension: cylinderPositions[id] ?? ext, extending, retracting }

    } else if (type === 'hyd_cylinder_double' || type === 'hyd_cylinder_telescopic') {
      const nA = getNet(id, 'A')
      const nB = getNet(id, 'B')
      const aP = nA ? pressurized.has(nA) : false
      const bP = nB ? pressurized.has(nB) : false
      const aR = nA ? returnNets.has(nA) : false
      const bR = nB ? returnNets.has(nB) : false
      const ext = cylinderPositions[id] ?? 50
      let extending = false, retracting = false
      if (aP && !aR && (bR || !bP)) {
        extending = true
        cylinderPositions[id] = Math.min(100, ext + TICK_ADVANCE)
      } else if (bP && !bR && (aR || !aP)) {
        retracting = true
        cylinderPositions[id] = Math.max(0, ext - TICK_ADVANCE)
      }
      componentStates[id] = { extension: cylinderPositions[id] ?? ext, extending, retracting }

    } else if (type === 'hyd_relief_valve') {
      const pNet = getNet(id, 'P')
      const open = pNet ? pressurized.has(pNet) : false
      componentStates[id] = { open }

    } else if (HYD_VALVE_TYPES.has(type)) {
      const pairs = getConductingPairs(comp, dcvPositions)
      componentStates[id] = { open: pairs.length > 0 }

    } else if (type === 'hyd_pressure_gauge') {
      const nA = getNet(id, 'A')
      const press = nA ? pressurized.has(nA) : false
      componentStates[id] = { reading: press ? 200 : 0 }

    } else if (type === 'hyd_flow_meter') {
      const nIN = getNet(id, 'IN')
      const flowing = nIN ? pressurized.has(nIN) : false
      componentStates[id] = { reading: flowing ? 20 : 0 }

    } else if (type === 'hyd_temperature_gauge') {
      const nA = getNet(id, 'A')
      const warm = nA ? pressurized.has(nA) : false
      componentStates[id] = { reading: warm ? 50 : 25 }

    } else if (type === 'hyd_accumulator') {
      const nA = getNet(id, 'A')
      const charged = nA ? pressurized.has(nA) : false
      componentStates[id] = { charged }
    }
  })

  // Step 7: Assign wire net states
  const wireNetStates = {}
  wires.forEach(wire => {
    if (!wire.points.length) {
      wireNetStates[wire.id] = { pressure: 0, flow: 0, type: 'return', energized: false }
      return
    }
    const wNet = uf.find(ptKey(wire.points[0].x, wire.points[0].y))
    const isP = pressurized.has(wNet)
    const isR = returnNets.has(wNet)
    wireNetStates[wire.id] = {
      pressure: isP ? 200 : 0,
      flow: (isP || isR) ? 20 : 0,
      type: isP ? 'working' : 'return',
      energized: isP || isR,
    }
  })

  return { componentStates, wireNetStates }
}
