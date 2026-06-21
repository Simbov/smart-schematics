import { describe, it, expect } from 'vitest'
import { runDCSimulation } from './dcSolver.js'
import { lamp, ground, wire } from '../../test/circuitBuilder.js'

// A PLC digital input asserts a field signal onto its IN pin. Toggling it High
// should drive the configured input voltage so anything wired to the input
// actually responds (the bug: it was an inert terminal and nothing happened).
function plcInput(inXY, { mode = 'Digital', voltage = 24, id = 'pi1', designator = 'DI1' } = {}) {
  return {
    id, type: 'plc_input', designator, value: '',
    simParams: { mode, voltage },
    pins: [{ id: 'IN', absX: inXY[0], absY: inXY[1] }],
  }
}

// Lamp from the input pin to ground; the input is the only source in the circuit.
function rig(states, opts) {
  const pi = plcInput([100, 0], opts)
  const la = lamp([200, 0], [200, 40])
  const gnd = ground([300, 40])
  const wires = [
    wire([100, 0], [200, 0]),    // IN -> lamp A
    wire([200, 40], [300, 40]),  // lamp B -> ground
  ]
  const res = runDCSimulation([pi, la, gnd], wires, states)
  return { pi, la, res }
}

describe('dcSolver — PLC digital input drives its pin', () => {
  it('High lights a lamp wired to the input (≈24 V across it)', () => {
    const { pi, la, res } = rig({ pi1: { state: 'closed' } })
    expect(res.componentStates[pi.id].on).toBe(true)
    expect(res.componentStates[la.id].on).toBe(true)
    expect(res.componentStates[la.id].V).toBeGreaterThan(20)
  })

  it('Low leaves the lamp dark (input tied to 0 V)', () => {
    const { la, res } = rig({ pi1: { state: 'open' } })
    expect(res.componentStates[la.id].on).toBe(false)
    expect(res.componentStates[la.id].I).toBeCloseTo(0, 4)
  })

  it('honours a custom input voltage', () => {
    const { la, res } = rig({ pi1: { state: 'closed' } }, { voltage: 12 })
    expect(res.componentStates[la.id].V).toBeGreaterThan(9)
    expect(res.componentStates[la.id].V).toBeLessThan(13)
  })

  it('Analogue mode does not stamp a source (no binary drive)', () => {
    const { la, res } = rig({ pi1: { state: 'closed' } }, { mode: 'Analogue' })
    expect(res.componentStates[la.id].I).toBeCloseTo(0, 4)
  })
})
