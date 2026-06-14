import { describe, it, expect } from 'vitest'
import { runHydraulicSimulation } from './hydraulicSim'

// Minimal scenario builders. The sim maps pins to nets purely by their
// absX/absY coordinates and unions wire points, so we just place pins at points
// and connect them with 2-point wires.
let uid = 0
const pin = (id, x, y) => ({ id, absX: x, absY: y })
const wire = (a, b) => ({ id: `w${uid++}`, points: [{ x: a[0], y: a[1] }, { x: b[0], y: b[1] }] })
const pump = (out, tankPt) => ({
  id: 'PUMP', type: 'hyd_pump_fixed',
  pins: [pin('OUT', out[0], out[1]), pin('IN', tankPt[0], tankPt[1])],
  simParams: { displacement: 18, speed: 1500 },
})
const reservoir = (pt) => ({ id: `RES${uid++}`, type: 'hyd_reservoir', pins: [pin('T', pt[0], pt[1])], simParams: {} })

describe('hydraulic check valve is directional (A→B forward only)', () => {
  it('passes forward flow A→B to a downstream cylinder', () => {
    const cv = { id: 'CV', type: 'hyd_check_valve', pins: [pin('A', 50, 0), pin('B', 100, 0)], simParams: {} }
    const cyl = { id: 'CYL', type: 'hyd_cylinder_single', pins: [pin('A', 150, 0)], simParams: {} }
    const components = [pump([0, 0], [0, 100]), reservoir([0, 200]), cv, cyl]
    const wires = [
      wire([0, 0], [50, 0]),     // pump OUT → check A
      wire([100, 0], [150, 0]),  // check B → cylinder A
      wire([0, 100], [0, 200]),  // pump IN → reservoir
    ]
    const cylPos = {}
    const { componentStates } = runHydraulicSimulation(components, wires, {}, {}, cylPos)
    expect(componentStates.CV.flowing).toBe(true)
    expect(componentStates.CYL.extending).toBe(true)
    expect(cylPos.CYL).toBeGreaterThan(0)
  })

  it('blocks reverse flow B→A (downstream cylinder stays put)', () => {
    // Pump now feeds the B side; forward direction is A→B so B→A is blocked.
    const cv = { id: 'CV', type: 'hyd_check_valve', pins: [pin('A', 150, 0), pin('B', 50, 0)], simParams: {} }
    const cyl = { id: 'CYL', type: 'hyd_cylinder_single', pins: [pin('A', 200, 0)], simParams: {} }
    const components = [pump([0, 0], [0, 100]), reservoir([0, 200]), cv, cyl]
    const wires = [
      wire([0, 0], [50, 0]),       // pump OUT → check B
      wire([150, 0], [200, 0]),    // check A → cylinder A
      wire([0, 100], [0, 200]),    // pump IN → reservoir
    ]
    const cylPos = {}
    const { componentStates } = runHydraulicSimulation(components, wires, {}, {}, cylPos)
    expect(componentStates.CV.flowing).toBe(false)
    expect(componentStates.CYL.extending).toBe(false)
    expect(cylPos.CYL ?? 0).toBe(0)
  })
})

describe('steering (through-rod) cylinder simulates', () => {
  it('extends from mid-stroke when port A is pressurised', () => {
    const cyl = {
      id: 'STR', type: 'hyd_cylinder_steering',
      pins: [pin('A', 50, 0), pin('B', 50, 200)], simParams: {},
    }
    const components = [pump([0, 0], [0, 100]), reservoir([0, 200]), reservoir([0, 300]), cyl]
    const wires = [
      wire([0, 0], [50, 0]),       // pump OUT → cyl A (pressurised)
      wire([50, 200], [0, 300]),   // cyl B → reservoir (return)
      wire([0, 100], [0, 200]),    // pump IN → reservoir
    ]
    const cylPos = {}
    const { componentStates } = runHydraulicSimulation(components, wires, {}, {}, cylPos)
    expect(componentStates.STR.extending).toBe(true)
    expect(cylPos.STR).toBeGreaterThan(50)  // started centred at 50
  })
})

describe('relief valve relieves when its inlet is pressurised', () => {
  it('reports relieving with P pressurised', () => {
    const rv = { id: 'RV', type: 'hyd_relief_valve', pins: [pin('P', 0, 0), pin('T', 0, -50)], simParams: {} }
    const components = [pump([0, 0], [0, 100]), reservoir([0, 200]), reservoir([0, -100]), rv]
    const wires = [
      wire([0, 0], [0, 0]),        // pump OUT coincident with relief P
      wire([0, -50], [0, -100]),   // relief T → reservoir
      wire([0, 100], [0, 200]),    // pump IN → reservoir
    ]
    const { componentStates } = runHydraulicSimulation(components, wires, {}, {}, {})
    expect(componentStates.RV.relieving).toBe(true)
  })
})
