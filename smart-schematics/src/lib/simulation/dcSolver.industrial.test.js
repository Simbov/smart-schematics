import { describe, it, expect } from 'vitest'
import { runDCSimulation, terminalStripPairs } from './dcSolver'
import { pin, wire, boundWire, battery } from '../../test/circuitBuilder'
import { terminalStripPins } from '../industrial'

// The two industrial parts that carry current: a terminal strip has to pass a
// circuit through way-by-way, and a panel indicator has to light like a lamp.
// Everything else in the Industrial Control section is a documentation symbol
// and is correctly inert in the solver.

const stripAt = (x, y, ways) => ({
  id: 'X1', type: 'terminal_strip', designator: 'X1', simParams: { ways },
  pins: terminalStripPins({ ways }).map(p => pin(p.id, x + p.relX, y + p.relY)),
})

const indicator = (aXY, bXY, id = 'HL1') => ({
  id, type: 'panel_indicator', designator: id, simParams: { colour: 'Red', style: 'Lamp' },
  pins: [pin('A', ...aXY), pin('B', ...bXY)],
})

describe('terminalStripPairs', () => {
  it('links each internal terminal to its own field terminal', () => {
    const comp = { pins: terminalStripPins({ ways: 3 }) }
    expect(terminalStripPairs(comp)).toEqual([['T1', 'B1'], ['T2', 'B2'], ['T3', 'B3']])
  })

  it('is empty for a component with no strip pins', () => {
    expect(terminalStripPairs({ pins: [{ id: 'A' }, { id: 'B' }] })).toEqual([])
    expect(terminalStripPairs({})).toEqual([])
  })
})

describe('terminal strip in circuit', () => {
  // A 3-way strip centred at (200, 0): terminals sit on 20-unit centres, so
  // T1/B1 are at x=180, T2/B2 at x=200 and T3/B3 at x=220, with the internal
  // row at y=-30 and the field row at y=+30.
  //
  // 24 V battery → way 1 → lamp → way 2 → back to the battery. Way 3 is spare.
  const strip = stripAt(200, 0, 3)
  const lamp = { id: 'HL', type: 'lamp', designator: 'HL1', simParams: {}, pins: [pin('A', 180, 100), pin('B', 200, 100)] }
  const bt = battery([180, -100], [200, -100], { voltage: 24 })

  const components = [bt, strip, lamp]
  const wires = [
    wire([180, -100], [180, -30]),  // battery +      → way 1 internal
    wire([180, 30], [180, 100]),    // way 1 field    → lamp A
    wire([200, 100], [200, 30]),    // lamp B         → way 2 field
    wire([200, -30], [200, -100]),  // way 2 internal → battery −
  ]

  it('passes the circuit through so the load actually runs', () => {
    const r = runDCSimulation(components, wires, {})
    expect(r.componentStates.HL.on).toBe(true)
    // 24 V across a 10 Ω lamp, less two ~1 mΩ terminals.
    expect(r.componentStates.HL.I).toBeGreaterThan(2.3)
  })

  it('keeps each way electrically separate', () => {
    // A lamp bridged across the spare way 3 must stay dark while ways 1 and 2
    // carry the live circuit through the same strip. Bonded ways would light it.
    const spare = { id: 'HL2', type: 'lamp', designator: 'HL2', simParams: {}, pins: [pin('A', 220, -30), pin('B', 220, 30)] }
    const r = runDCSimulation([...components, spare], wires, {})
    expect(r.componentStates.HL.on).toBe(true)
    expect(r.componentStates.HL2.on).toBe(false)
  })

  it('opens the circuit when a way is left unwired', () => {
    const openWires = wires.slice(0, 3)   // way 2 internal never reaches the battery
    const r = runDCSimulation(components, openWires, {})
    expect(r.componentStates.HL.on).toBe(false)
  })

  it('reports current per way so bound wires animate', () => {
    // Every other component shares one current across all its pins; a strip
    // cannot, because each way carries its own. A wire landing on a loaded way
    // must read the real current, and one on a spare way must read zero.
    const live = boundWire([180, -100], [180, -30], null, { componentId: 'X1', pinId: 'T1' })
    const spare = boundWire([220, -100], [220, -30], null, { componentId: 'X1', pinId: 'T3' })
    const r = runDCSimulation(components, [...wires.slice(1), live, spare], {})
    expect(r.wireStates[live.id].current).toBeGreaterThan(2)
    expect(r.wireStates[spare.id].current).toBe(0)
  })
})

describe('regression: the passive group still uses loadPair', () => {
  // The terminal-strip case sits in the same per-pin-current switch as the
  // passives. Dropping it into the middle of their fall-through group silently
  // stole resistor / variable_resistor / potentiometer, leaving wires bound to
  // them reading zero and never animating.
  it('still gives a plain resistor its per-pin current', () => {
    const bt = battery([0, 0], [100, 0], { voltage: 24 })
    const r1 = {
      id: 'R', type: 'resistor', designator: 'R1', simParams: { resistance: 12 },
      pins: [pin('A', 0, 50), pin('B', 100, 50)],
    }
    const w = boundWire([0, 0], [0, 50], null, { componentId: 'R', pinId: 'A' })
    const result = runDCSimulation([bt, r1], [w, wire([100, 50], [100, 0])], {})
    expect(result.componentStates.R.I).toBeCloseTo(2, 1)
    expect(result.wireStates[w.id].current).toBeCloseTo(2, 1)
  })
})

describe('panel indicator', () => {
  it('lights when supplied, like a lamp', () => {
    const bt = battery([0, 0], [100, 0], { voltage: 24 })
    const hl = indicator([0, 50], [100, 50])
    const r = runDCSimulation([bt, hl], [wire([0, 0], [0, 50]), wire([100, 50], [100, 0])], {})
    expect(r.componentStates.HL1.on).toBe(true)
    expect(r.componentStates.HL1.I).toBeGreaterThan(2)
  })

  it('stays dark on an open circuit', () => {
    const bt = battery([0, 0], [100, 0], { voltage: 24 })
    const hl = indicator([0, 50], [100, 50])
    const r = runDCSimulation([bt, hl], [wire([0, 0], [0, 50])], {})
    expect(r.componentStates.HL1.on).toBe(false)
  })
})
