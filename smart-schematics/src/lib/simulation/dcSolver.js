// DC MNA (Modified Nodal Analysis) solver
import { parseValue } from './parseValue.js'

class UnionFind {
  constructor() { this.parent = {}; this.rank = {} }
  find(x) {
    if (!(x in this.parent)) this.parent[x] = x
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x])
    return this.parent[x]
  }
  union(x, y) {
    const px = this.find(x), py = this.find(y)
    if (px === py) return
    const rx = this.rank[px] || 0, ry = this.rank[py] || 0
    if (rx < ry) { this.parent[px] = py }
    else if (rx > ry) { this.parent[py] = px }
    else { this.parent[py] = px; this.rank[px] = rx + 1 }
  }
}

function ptKey(x, y) { return `${Math.round(x)},${Math.round(y)}` }

function buildWireNets(wires) {
  const uf = new UnionFind()
  for (const wire of wires) {
    for (let i = 0; i < wire.points.length - 1; i++) {
      uf.union(
        ptKey(wire.points[i].x, wire.points[i].y),
        ptKey(wire.points[i + 1].x, wire.points[i + 1].y)
      )
    }
  }
  return uf
}

// Gaussian elimination with partial pivoting
function gaussSolve(A, b) {
  const n = b.length
  if (n === 0) return []
  // augment
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    // find pivot
    let maxRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row
    }
    ;[M[col], M[maxRow]] = [M[maxRow], M[col]]
    if (Math.abs(M[col][col]) < 1e-12) continue
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col]
      for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j]
    }
  }
  // back substitute
  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(M[i][i]) < 1e-12) continue
    let sum = M[i][n]
    for (let j = i + 1; j < n; j++) sum -= M[i][j] * x[j]
    x[i] = sum / M[i][i]
  }
  return x
}

export function runDCSimulation(components, wires, interactiveStates = {}) {
  try {
    return _runDCSimulation(components, wires, interactiveStates)
  } catch (e) {
    console.error('[dcSolver] error:', e)
    return {
      nodeVoltages: {},
      componentStates: {},
      wireStates: {},
      relayEnergized: {},
    }
  }
}

function _runDCSimulation(components, wires, interactiveStates) {
  if (!components?.length) {
    return { nodeVoltages: {}, componentStates: {}, wireStates: {}, relayEnergized: {} }
  }

  // Build wire nets
  const uf = buildWireNets(wires || [])

  // Collect all pin nets
  const pinNet = {}  // `${compId}.${pinId}` → netId string
  for (const comp of components) {
    for (const pin of (comp.pins || [])) {
      pinNet[`${comp.id}.${pin.id}`] = uf.find(ptKey(pin.absX, pin.absY))
    }
  }

  // Collect unique nets
  const netSet = new Set(Object.values(pinNet))
  // Also add wire endpoint nets
  for (const wire of (wires || [])) {
    for (const pt of wire.points) netSet.add(uf.find(ptKey(pt.x, pt.y)))
  }
  const nets = [...netSet]

  if (nets.length === 0) {
    return { nodeVoltages: {}, componentStates: {}, wireStates: {}, relayEnergized: {} }
  }

  // --- The internal solve function, called repeatedly for relay feedback ---
  function solve(relayEnergized) {
    // Find ground net
    let groundNet = null
    for (const comp of components) {
      if (comp.type === 'ground') { groundNet = pinNet[`${comp.id}.GND`]; break }
    }
    if (!groundNet) {
      for (const comp of components) {
        if (comp.type === 'battery') { groundNet = pinNet[`${comp.id}.NEG`]; break }
      }
    }
    if (!groundNet) {
      for (const comp of components) {
        if (comp.type === 'vss_rail') { groundNet = pinNet[`${comp.id}.GND`]; break }
      }
    }
    if (!groundNet) groundNet = nets[0]

    // Assign indices to non-ground nets
    const nonGroundNets = nets.filter(n => n !== groundNet)
    const netIdx = {}
    nonGroundNets.forEach((n, i) => { netIdx[n] = i })
    const N = nonGroundNets.length

    if (N === 0) {
      // All nets are ground
      const nodeVoltages = {}
      nets.forEach(n => { nodeVoltages[n] = 0 })
      return { nodeVoltages, vsources: [], N, groundNet, nonGroundNets, netIdx, G: [], b: [], x: [] }
    }

    // Count voltage sources
    const vsourceComps = []
    for (const comp of components) {
      const pn = id => pinNet[`${comp.id}.${id}`]
      if (comp.type === 'battery' && pn('POS') && pn('NEG')) {
        vsourceComps.push({ comp, posNet: pn('POS'), negNet: pn('NEG'), V: comp.simParams?.voltage ?? parseValue(comp.value, 9) })
      } else if (comp.type === 'ac_voltage_source' && pn('A') && pn('B')) {
        vsourceComps.push({ comp, posNet: pn('A'), negNet: pn('B'), V: comp.simParams?.voltage ?? parseValue(comp.value, 12) })
      } else if (comp.type === 'vcc_rail' && pn('PWR')) {
        vsourceComps.push({ comp, posNet: pn('PWR'), negNet: groundNet, V: comp.simParams?.voltage ?? parseValue(comp.value, 5) })
      }
    }
    const M = N + vsourceComps.length

    // Build MNA matrix
    const G = Array.from({ length: M }, () => new Array(M).fill(0))
    const b = new Array(M).fill(0)

    function stamp(netA, netB, g) {
      const a = netA !== groundNet ? netIdx[netA] : -1
      const bk = netB !== groundNet ? netIdx[netB] : -1
      if (a >= 0) G[a][a] += g
      if (bk >= 0) G[bk][bk] += g
      if (a >= 0 && bk >= 0) { G[a][bk] -= g; G[bk][a] -= g }
    }

    function stampResistor(compId, pinA, pinB, R) {
      const nA = pinNet[`${compId}.${pinA}`]
      const nB = pinNet[`${compId}.${pinB}`]
      if (!nA || !nB) return
      stamp(nA, nB, 1 / R)
    }

    function stampCurrentSource(netPos, netNeg, I) {
      const p = netPos !== groundNet ? netIdx[netPos] : -1
      const n = netNeg !== groundNet ? netIdx[netNeg] : -1
      if (p >= 0) b[p] += I
      if (n >= 0) b[n] -= I
    }

    // Stamp voltage sources
    vsourceComps.forEach(({ posNet, negNet, V }, k) => {
      const row = N + k
      const p = posNet !== groundNet ? netIdx[posNet] : -1
      const n = negNet !== groundNet ? netIdx[negNet] : -1
      if (p >= 0) { G[p][row] += 1; G[row][p] += 1 }
      if (n >= 0) { G[n][row] -= 1; G[row][n] -= 1 }
      b[row] = V
    })

    // Stamp all other components
    for (const comp of components) {
      const pn = id => pinNet[`${comp.id}.${id}`]
      const id = comp.id

      switch (comp.type) {
        // Already stamped as vsource above
        case 'battery': case 'ac_voltage_source': case 'vcc_rail': break

        // Current sources
        case 'dc_current_source': {
          const I = comp.simParams?.current ?? parseValue(comp.value, 1)
          const pos = pn('POS'), neg = pn('NEG')
          if (pos && neg) stampCurrentSource(pos, neg, I)
          break
        }

        // Ground refs — already handled
        case 'ground': case 'vss_rail': break

        // Resistive passives
        case 'resistor': case 'variable_resistor': case 'potentiometer':
          stampResistor(id, 'A', 'B', Math.max(1e-3, comp.simParams?.resistance ?? parseValue(comp.value, 1000)))
          break
        case 'fuse': stampResistor(id, 'A', 'B', 0.01); break
        case 'inductor': stampResistor(id, 'A', 'B', 0.001); break
        case 'lamp': stampResistor(id, 'A', 'B', 10); break
        case 'buzzer': case 'speaker': stampResistor(id, 'A', 'B', 8); break
        case 'motor': case 'generator': stampResistor(id, 'A', 'B', 5); break
        case 'solenoid': stampResistor(id, 'A', 'B', 50); break
        case 'relay_coil': case 'contactor_coil': stampResistor(id, 'A1', 'A2', 200); break
        case 'ammeter': stampResistor(id, 'A', 'B', 0.001); break
        case 'voltmeter': case 'wattmeter': stampResistor(id, 'A', 'B', 1e9); break
        case 'capacitor': stampResistor(id, 'A', 'B', 1e9); break
        case 'electrolytic_capacitor': {
          const a = pn('A') || pn('POS')
          const bPin = pn('B') || pn('NEG')
          if (a && bPin) stamp(a, bPin, 1e-9)
          break
        }

        // Switches
        case 'switch_no': case 'limit_switch': case 'proximity_switch':
        case 'pressure_switch': case 'temperature_switch': {
          if (interactiveStates[id]?.state === 'closed') stampResistor(id, 'A', 'B', 0.001)
          break
        }
        case 'switch_nc': case 'circuit_breaker': {
          if (interactiveStates[id]?.state !== 'open') stampResistor(id, 'A', 'B', 0.001)
          break
        }
        case 'switch_spdt': {
          // Honor the configured initial Position (simParams.position) until the
          // user toggles the switch, which writes an override into interactiveStates.
          const pos = interactiveStates[id]?.state || comp.simParams?.position || 'NO'
          if (pos === 'NO') {
            const com = pn('COM'), no = pn('NO')
            if (com && no) stamp(com, no, 1 / 0.001)
          } else {
            const com = pn('COM'), nc = pn('NC')
            if (com && nc) stamp(com, nc, 1 / 0.001)
          }
          break
        }
        case 'pushbutton_no': {
          if (interactiveStates[id]?.state === 'pressed') stampResistor(id, 'A', 'B', 0.001)
          break
        }
        case 'pushbutton_nc': {
          if (interactiveStates[id]?.state !== 'pressed') stampResistor(id, 'A', 'B', 0.001)
          break
        }
        case 'relay_contact_no': case 'contactor_no': {
          if (relayEnergized[comp.designator]) {
            const c = pn('C'), no = pn('NO')
            if (c && no) stamp(c, no, 1 / 0.001)
          }
          break
        }
        case 'relay_contact_nc': case 'contactor_nc': {
          if (!relayEnergized[comp.designator]) {
            const c = pn('C'), nc = pn('NC')
            if (c && nc) stamp(c, nc, 1 / 0.001)
          }
          break
        }
        case 'relay_contact_spdt': {
          const c = pn('C')
          if (relayEnergized[comp.designator]) {
            const no = pn('NO')
            if (c && no) stamp(c, no, 1 / 0.001)
          } else {
            const nc = pn('NC')
            if (c && nc) stamp(c, nc, 1 / 0.001)
          }
          break
        }

        // Diodes/LEDs — piecewise linear companion model (off initially, refined in NR loop)
        case 'led': case 'diode': case 'zener_diode': case 'photodiode': {
          const nA = pn('A'), nK = pn('K')
          if (!nA || !nK) break
          // Start as off (high-R), Newton-Raphson iterations will correct
          stamp(nA, nK, 1e-6)
          break
        }

        default: break
      }
    }

    // Solve initial pass
    if (M === 0) return { nodeVoltages: {}, vsources: [], N: 0, groundNet, nonGroundNets, netIdx, G, b, x: [] }
    const xInit = gaussSolve(G, b)

    // Extract initial node voltages
    const nodeVoltages = {}
    nodeVoltages[groundNet] = 0
    nonGroundNets.forEach((n, i) => { nodeVoltages[n] = xInit[i] ?? 0 })

    // Newton-Raphson for diodes/LEDs (3 iterations)
    let xFinal = xInit
    for (let iter = 0; iter < 3; iter++) {
      // Re-zero matrix and re-stamp
      for (let i = 0; i < M; i++) { G[i].fill(0); b[i] = 0 }

      // Re-stamp voltage sources
      vsourceComps.forEach(({ posNet, negNet, V }, k) => {
        const row = N + k
        const p = posNet !== groundNet ? netIdx[posNet] : -1
        const n = negNet !== groundNet ? netIdx[negNet] : -1
        if (p >= 0) { G[p][row] += 1; G[row][p] += 1 }
        if (n >= 0) { G[n][row] -= 1; G[row][n] -= 1 }
        b[row] = V
      })

      // Re-stamp everything, using nodeVoltages for nonlinear devices
      for (const comp of components) {
        const pn = id => pinNet[`${comp.id}.${id}`]
        const cid = comp.id

        switch (comp.type) {
          case 'battery': case 'ac_voltage_source': case 'vcc_rail': break
          case 'dc_current_source': {
            const I = comp.simParams?.current ?? parseValue(comp.value, 1)
            const pos = pn('POS'), neg = pn('NEG')
            if (pos && neg) stampCurrentSource(pos, neg, I)
            break
          }
          case 'ground': case 'vss_rail': break
          case 'resistor': case 'variable_resistor': case 'potentiometer':
            stampResistor(cid, 'A', 'B', Math.max(1e-3, comp.simParams?.resistance ?? parseValue(comp.value, 1000))); break
          case 'fuse': stampResistor(cid, 'A', 'B', 0.01); break
          case 'inductor': stampResistor(cid, 'A', 'B', 0.001); break
          case 'lamp': stampResistor(cid, 'A', 'B', 10); break
          case 'buzzer': case 'speaker': stampResistor(cid, 'A', 'B', 8); break
          case 'motor': case 'generator': stampResistor(cid, 'A', 'B', 5); break
          case 'solenoid': stampResistor(cid, 'A', 'B', 50); break
          case 'relay_coil': case 'contactor_coil': stampResistor(cid, 'A1', 'A2', 200); break
          case 'ammeter': stampResistor(cid, 'A', 'B', 0.001); break
          case 'voltmeter': case 'wattmeter': stampResistor(cid, 'A', 'B', 1e9); break
          case 'capacitor': stampResistor(cid, 'A', 'B', 1e9); break
          case 'electrolytic_capacitor': {
            const a = pn('A') || pn('POS')
            const bPin = pn('B') || pn('NEG')
            if (a && bPin) stamp(a, bPin, 1e-9)
            break
          }
          case 'switch_no': case 'limit_switch': case 'proximity_switch':
          case 'pressure_switch': case 'temperature_switch':
            if (interactiveStates[cid]?.state === 'closed') stampResistor(cid, 'A', 'B', 0.001); break
          case 'switch_nc': case 'circuit_breaker':
            if (interactiveStates[cid]?.state !== 'open') stampResistor(cid, 'A', 'B', 0.001); break
          case 'switch_spdt': {
            const spos = interactiveStates[cid]?.state || comp.simParams?.position || 'NO'
            if (spos === 'NO') { const c = pn('COM'), n = pn('NO'); if (c && n) stamp(c, n, 1000) }
            else { const c = pn('COM'), n = pn('NC'); if (c && n) stamp(c, n, 1000) }
            break
          }
          case 'pushbutton_no':
            if (interactiveStates[cid]?.state === 'pressed') stampResistor(cid, 'A', 'B', 0.001); break
          case 'pushbutton_nc':
            if (interactiveStates[cid]?.state !== 'pressed') stampResistor(cid, 'A', 'B', 0.001); break
          case 'relay_contact_no': case 'contactor_no':
            if (relayEnergized[comp.designator]) { const c = pn('C'), n = pn('NO'); if (c && n) stamp(c, n, 1000) }
            break
          case 'relay_contact_nc': case 'contactor_nc':
            if (!relayEnergized[comp.designator]) { const c = pn('C'), n = pn('NC'); if (c && n) stamp(c, n, 1000) }
            break
          case 'relay_contact_spdt': {
            const c = pn('C')
            if (relayEnergized[comp.designator]) { const n = pn('NO'); if (c && n) stamp(c, n, 1000) }
            else { const n = pn('NC'); if (c && n) stamp(c, n, 1000) }
            break
          }

          // Piecewise linear diode model
          case 'led': case 'diode': case 'zener_diode': case 'photodiode': {
            const Vf = comp.type === 'led' ? 1.8 : 0.6
            const Ron = 10
            const nA = pn('A'), nK = pn('K')
            if (!nA || !nK) break
            const Va = nodeVoltages[nA] ?? 0
            const Vk = nodeVoltages[nK] ?? 0
            const Vd = Va - Vk
            if (Vd > Vf * 0.5) {
              // Forward biased: stamp conductance + current source (companion)
              const G_on = 1 / Ron
              const I_eq = Vf / Ron
              stamp(nA, nK, G_on)
              // Current source to represent forward voltage offset
              const p = nA !== groundNet ? netIdx[nA] : -1
              const n = nK !== groundNet ? netIdx[nK] : -1
              if (p >= 0) b[p] -= I_eq
              if (n >= 0) b[n] += I_eq
            } else {
              // Reverse biased or off
              stamp(nA, nK, 1e-6)
            }
            break
          }
          default: break
        }
      }

      xFinal = gaussSolve(G, b)
      nonGroundNets.forEach((n, i) => { nodeVoltages[n] = xFinal[i] ?? 0 })
    }

    return { nodeVoltages, vsources: vsourceComps, N, groundNet, nonGroundNets, netIdx, G, b, x: xFinal }
  }

  // Initial solve with no relay energized
  let relayEnergized = {}
  let solveResult = solve(relayEnergized)
  const nodeVoltages = { ...solveResult.nodeVoltages }

  // Relay feedback loop
  for (let pass = 0; pass < 5; pass++) {
    const newRelayEnergized = {}
    for (const comp of components) {
      if (comp.type !== 'relay_coil' && comp.type !== 'contactor_coil') continue
      const nA1 = pinNet[`${comp.id}.A1`]
      const nA2 = pinNet[`${comp.id}.A2`]
      if (!nA1 || !nA2) continue
      const Va1 = nodeVoltages[nA1] ?? 0
      const Va2 = nodeVoltages[nA2] ?? 0
      const Vcoil = Math.abs(Va1 - Va2)
      const Icoil = Vcoil / 200
      newRelayEnergized[comp.designator] = Icoil > 0.005
    }
    const changed = Object.keys(newRelayEnergized).some(k => newRelayEnergized[k] !== relayEnergized[k])
    relayEnergized = newRelayEnergized
    if (!changed) break
    solveResult = solve(relayEnergized)
    Object.assign(nodeVoltages, solveResult.nodeVoltages)
  }

  // Compute component states
  const componentStates = {}
  for (const comp of components) {
    const pn = id => pinNet[`${comp.id}.${id}`]
    const V = id => nodeVoltages[pn(id)] ?? 0

    let compV = 0, compI = 0, compP = 0, on = false

    switch (comp.type) {
      case 'battery': {
        const vsIdx = solveResult.vsources?.findIndex(vs => vs.comp.id === comp.id) ?? -1
        compV = V('POS') - V('NEG')
        compI = vsIdx >= 0 ? (solveResult.x?.[solveResult.N + vsIdx] ?? 0) : 0
        compP = compV * compI
        on = Math.abs(compI) > 1e-6
        break
      }
      case 'ac_voltage_source': {
        const vsIdx = solveResult.vsources?.findIndex(vs => vs.comp.id === comp.id) ?? -1
        compV = V('A') - V('B')
        compI = vsIdx >= 0 ? (solveResult.x?.[solveResult.N + vsIdx] ?? 0) : 0
        compP = compV * compI; on = Math.abs(compI) > 1e-6; break
      }
      case 'vcc_rail': {
        const vsIdx = solveResult.vsources?.findIndex(vs => vs.comp.id === comp.id) ?? -1
        compV = V('PWR')
        compI = vsIdx >= 0 ? (solveResult.x?.[solveResult.N + vsIdx] ?? 0) : 0
        compP = compV * compI; on = Math.abs(compI) > 1e-6; break
      }
      case 'dc_current_source':
        compI = comp.simParams?.current ?? parseValue(comp.value, 1)
        compV = V('POS') - V('NEG')
        compP = compV * compI; on = true; break

      case 'resistor': case 'variable_resistor': case 'potentiometer': {
        const R = Math.max(1e-3, comp.simParams?.resistance ?? parseValue(comp.value, 1000))
        compV = V('A') - V('B'); compI = Math.abs(compV) / R; compP = compI * compI * R; on = compI > 1e-4; break
      }
      case 'fuse': compV = V('A') - V('B'); compI = Math.abs(compV) / 0.01; compP = compI * compI * 0.01; break
      case 'inductor': compV = V('A') - V('B'); compI = Math.abs(compV) / 0.001; compP = compI * compI * 0.001; break
      case 'lamp': compV = V('A') - V('B'); compI = Math.abs(compV) / 10; compP = compI * compI * 10; on = compI > 1e-3; break
      case 'buzzer': case 'speaker': compV = V('A') - V('B'); compI = Math.abs(compV) / 8; compP = compI * compI * 8; on = compI > 1e-3; break
      case 'motor': case 'generator': compV = V('A') - V('B'); compI = Math.abs(compV) / 5; compP = compI * compI * 5; on = compI > 1e-3; break
      case 'solenoid': compV = V('A') - V('B'); compI = Math.abs(compV) / 50; compP = compI * compI * 50; on = compI > 1e-3; break
      case 'relay_coil': case 'contactor_coil':
        compV = V('A1') - V('A2'); compI = Math.abs(compV) / 200; compP = compI * compI * 200
        on = relayEnergized[comp.designator] ?? false; break
      case 'ammeter': compV = V('A') - V('B'); compI = Math.abs(compV) / 0.001; compP = compI * compI * 0.001; break
      case 'voltmeter': case 'wattmeter': compV = V('A') - V('B'); compI = Math.abs(compV) / 1e9; compP = compI * compI * 1e9; break
      case 'capacitor': compV = V('A') - V('B'); compI = Math.abs(compV) / 1e9; compP = compI * compI * 1e9; break
      case 'electrolytic_capacitor': {
        const pa = pn('A') ? 'A' : 'POS'
        const pb = pn('B') ? 'B' : 'NEG'
        compV = V(pa) - V(pb); compI = Math.abs(compV) / 1e9; compP = compI * compI * 1e9; break
      }
      case 'led': case 'diode': case 'zener_diode': case 'photodiode': {
        const Vf = comp.type === 'led' ? 1.8 : 0.6
        compV = V('A') - V('K')
        compI = compV > Vf * 0.5 ? (compV - Vf) / 10 : compV * 1e-6
        compP = compV * compI; on = compI > 1e-3; break
      }
      case 'switch_no': case 'limit_switch': case 'proximity_switch':
      case 'pressure_switch': case 'temperature_switch':
        on = interactiveStates[comp.id]?.state === 'closed'
        compV = on ? (V('A') - V('B')) : 0; compI = on ? Math.abs(compV) / 0.001 : 0; compP = compI * compI * 0.001; break
      case 'switch_nc': case 'circuit_breaker':
        on = interactiveStates[comp.id]?.state !== 'open'
        compV = on ? (V('A') - V('B')) : 0; compI = on ? Math.abs(compV) / 0.001 : 0; compP = compI * compI * 0.001; break
      case 'pushbutton_no':
        on = interactiveStates[comp.id]?.state === 'pressed'
        compV = on ? (V('A') - V('B')) : 0; compI = on ? Math.abs(compV) / 0.001 : 0; compP = compI * compI * 0.001; break
      case 'pushbutton_nc':
        on = interactiveStates[comp.id]?.state !== 'pressed'
        compV = on ? (V('A') - V('B')) : 0; compI = on ? Math.abs(compV) / 0.001 : 0; compP = compI * compI * 0.001; break
      case 'switch_spdt': {
        // Conducting throw is selected by the override or the configured Position.
        const spos = interactiveStates[comp.id]?.state || comp.simParams?.position || 'NO'
        on = true  // an SPDT always connects COM to one throw
        compV = spos === 'NO' ? (V('COM') - V('NO')) : (V('COM') - V('NC'))
        compI = Math.abs(compV) / 0.001; compP = compI * compI * 0.001; break
      }
      case 'relay_contact_no': case 'contactor_no':
        on = relayEnergized[comp.designator] ?? false
        compV = on ? (V('C') - V('NO')) : 0; compI = on ? Math.abs(compV) / 0.001 : 0; compP = compI * compI * 0.001; break
      case 'relay_contact_nc': case 'contactor_nc':
        on = !(relayEnergized[comp.designator] ?? false)
        compV = on ? (V('C') - V('NC')) : 0; compI = on ? Math.abs(compV) / 0.001 : 0; compP = compI * compI * 0.001; break
      case 'relay_contact_spdt':
        on = relayEnergized[comp.designator] ?? false
        compV = on ? (V('C') - V('NO')) : (V('C') - V('NC'))
        compI = Math.abs(compV) / 0.001; compP = compI * compI * 0.001; break
      default:
        compV = 0; compI = 0; compP = 0; on = false
    }

    componentStates[comp.id] = { V: compV, I: compI, P: compP, on }
  }

  // Per-pin current magnitudes. Most components carry the same current through
  // every pin, but multi-throw switches only conduct through one throw — the
  // open throw (and any wire bound to it) must read zero so it doesn't animate.
  const pinCurrent = {}
  for (const comp of components) {
    const cs = componentStates[comp.id]
    const I = Math.abs(cs?.I ?? 0)
    for (const pin of (comp.pins || [])) {
      pinCurrent[`${comp.id}.${pin.id}`] = I
    }
    if (comp.type === 'switch_spdt') {
      const spos = interactiveStates[comp.id]?.state || comp.simParams?.position || 'NO'
      const openThrow = spos === 'NO' ? 'NC' : 'NO'
      pinCurrent[`${comp.id}.${openThrow}`] = 0
    } else if (comp.type === 'relay_contact_spdt') {
      const energized = relayEnergized[comp.designator] ?? false
      const openThrow = energized ? 'NC' : 'NO'
      pinCurrent[`${comp.id}.${openThrow}`] = 0
    }
  }
  const pinCur = ref =>
    ref?.componentId ? pinCurrent[`${ref.componentId}.${ref.pinId}`] : undefined

  // Signed per-pin current — positive when conventional current flows OUT of the
  // component at that pin (into the wire). A wire's own two endpoints are always
  // on the same net, so a voltage gradient across the wire is always zero and
  // can't tell us the flow direction. Instead we read the direction off the pin
  // the wire is bound to: through a passive/switch, current exits at the LOWER-
  // potential terminal; through a source it exits at the HIGHER-potential one.
  const pinSignedOut = {}
  const Vof = net => nodeVoltages[net] ?? 0
  const setPair = (compId, pX, pY, magnitude, exitsAtXWhenTrue) => {
    const s = exitsAtXWhenTrue ? 1 : -1
    pinSignedOut[`${compId}.${pX}`] = s * magnitude
    pinSignedOut[`${compId}.${pY}`] = -s * magnitude
  }
  // Pair where current exits at the lower-voltage pin (passives, switches, diodes).
  const loadPair = (comp, pX, pY) => {
    const nX = pinNet[`${comp.id}.${pX}`], nY = pinNet[`${comp.id}.${pY}`]
    if (!nX || !nY) return
    const mag = Math.abs(componentStates[comp.id]?.I ?? 0)
    setPair(comp.id, pX, pY, mag, Vof(nX) < Vof(nY))
  }
  // Pair where current exits at the higher-voltage pin (delivering source).
  const sourcePair = (comp, pPos, pNeg) => {
    const nP = pinNet[`${comp.id}.${pPos}`], nN = pinNet[`${comp.id}.${pNeg}`]
    if (!nP || !nN) return
    const mag = Math.abs(componentStates[comp.id]?.I ?? 0)
    setPair(comp.id, pPos, pNeg, mag, Vof(nP) > Vof(nN))
  }
  for (const comp of components) {
    switch (comp.type) {
      case 'resistor': case 'variable_resistor': case 'potentiometer':
      case 'fuse': case 'inductor': case 'lamp': case 'buzzer': case 'speaker':
      case 'motor': case 'generator': case 'solenoid': case 'ammeter':
      case 'voltmeter': case 'wattmeter': case 'capacitor':
      case 'switch_no': case 'switch_nc': case 'limit_switch': case 'proximity_switch':
      case 'pressure_switch': case 'temperature_switch': case 'circuit_breaker':
      case 'pushbutton_no': case 'pushbutton_nc':
        loadPair(comp, 'A', 'B'); break
      case 'relay_coil': case 'contactor_coil':
        loadPair(comp, 'A1', 'A2'); break
      case 'electrolytic_capacitor':
        loadPair(comp, pinNet[`${comp.id}.A`] ? 'A' : 'POS', pinNet[`${comp.id}.B`] ? 'B' : 'NEG'); break
      case 'led': case 'diode': case 'zener_diode': case 'photodiode':
        loadPair(comp, 'A', 'K'); break
      case 'switch_spdt': {
        const spos = interactiveStates[comp.id]?.state || comp.simParams?.position || 'NO'
        loadPair(comp, 'COM', spos === 'NO' ? 'NO' : 'NC'); break
      }
      case 'relay_contact_no': case 'contactor_no':
        loadPair(comp, 'C', 'NO'); break
      case 'relay_contact_nc': case 'contactor_nc':
        loadPair(comp, 'C', 'NC'); break
      case 'relay_contact_spdt':
        loadPair(comp, 'C', (relayEnergized[comp.designator] ?? false) ? 'NO' : 'NC'); break
      case 'battery': sourcePair(comp, 'POS', 'NEG'); break
      case 'ac_voltage_source': sourcePair(comp, 'A', 'B'); break
      case 'dc_current_source': sourcePair(comp, 'POS', 'NEG'); break
      default: break
    }
  }
  // Direction along the wire (points[0] → points[last] = +1) from the pin it is
  // bound to. pinA sits at points[0], pinB at points[last].
  const wireDir = wire => {
    const soA = wire.pinA?.componentId
      ? pinSignedOut[`${wire.pinA.componentId}.${wire.pinA.pinId}`] : undefined
    if (soA != null && Math.abs(soA) > 1e-12) return soA > 0 ? 1 : -1
    const soB = wire.pinB?.componentId
      ? pinSignedOut[`${wire.pinB.componentId}.${wire.pinB.pinId}`] : undefined
    if (soB != null && Math.abs(soB) > 1e-12) return soB > 0 ? -1 : 1
    return null
  }

  // Compute wireStates
  const wireStates = {}
  for (const wire of (wires || [])) {
    if (!wire.points?.length) continue
    const p0 = wire.points[0]
    const pLast = wire.points[wire.points.length - 1]
    const net0 = uf.find(ptKey(p0.x, p0.y))
    const netLast = uf.find(ptKey(pLast.x, pLast.y))
    const voltage = nodeVoltages[net0] ?? 0

    let current = 0
    let dir = 1

    // Try to get current from the specific pin this wire is bound to. Using the
    // pin (not the whole component) means a wire on a switch's open throw reads
    // zero current and stays un-animated.
    let found = false
    const curA = pinCur(wire.pinA)
    const curB = pinCur(wire.pinB)
    const pinI = curA != null ? curA : curB
    if (pinI != null) {
      current = Math.abs(pinI)
      dir = wireDir(wire) ?? 1
      found = true
    }
    if (!found) {
      // Fallback: estimate from voltage gradient
      const V0 = nodeVoltages[net0] ?? 0
      const VL = nodeVoltages[netLast] ?? 0
      const dV = V0 - VL
      current = Math.abs(dV) / 1000
      dir = dV >= 0 ? 1 : -1
    }

    wireStates[wire.id] = { voltage, current, dir }
  }

  return { nodeVoltages, componentStates, wireStates, relayEnergized }
}
