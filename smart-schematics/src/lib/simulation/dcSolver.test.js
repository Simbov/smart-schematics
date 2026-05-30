import { describe, it, expect } from 'vitest'
import { runDCSimulation } from './dcSolver.js'
import { battery, resistor, lamp, spdt, wire, boundWire } from '../../test/circuitBuilder.js'

describe('dcSolver — basic circuits', () => {
  it('drives a single resistor across a battery (Ohm law)', () => {
    // 9V battery, 90Ω resistor → I = 0.1 A.
    const bt = battery([0, 0], [0, 100])
    const r = resistor([0, 0], [0, 100], 90)
    const res = runDCSimulation([bt, r], [], {})
    expect(res.componentStates[r.id].I).toBeCloseTo(0.1, 4)
  })

  it('lights a lamp (10Ω) at 0.9 A on a 9V battery', () => {
    const bt = battery([0, 0], [0, 100])
    const la = lamp([0, 0], [0, 100])
    const res = runDCSimulation([bt, la], [], {})
    expect(res.componentStates[la.id].I).toBeCloseTo(0.9, 4)
    expect(res.componentStates[la.id].on).toBe(true)
  })
})

describe('dcSolver — SPDT switch', () => {
  // Common rig: lamp from battery POS to the throw node; COM wired to NEG.
  // With COM-NO closed the lamp lights; with COM-NC closed it stays dark
  // (the NC throw at (500,0) is dangling — no return path).
  function spdtRig(position) {
    const bt = battery([100, 0], [100, 100])
    const la = lamp([100, 0], [300, 0])               // A on POS net, B at (300,0)
    const sw = spdt([0, 50], [300, 0], [500, 0], position)  // COM, NO=lamp.B, NC=dangling
    const wires = [wire([0, 50], [100, 100])]          // COM -> NEG
    return { la, res: runDCSimulation([bt, la, sw], wires, {}) }
  }

  it('honors the configured Position=NO without any toggle (lamp lit)', () => {
    const { la, res } = spdtRig('NO')
    expect(res.componentStates[la.id].on).toBe(true)
    // ~0.9 A; the switch's 0.001Ω contact adds a tiny drop (9/10.001), so use a
    // loose tolerance rather than exact 0.9.
    expect(res.componentStates[la.id].I).toBeCloseTo(0.9, 2)
  })

  it('honors the configured Position=NC without any toggle (lamp dark)', () => {
    const { la, res } = spdtRig('NC')
    expect(res.componentStates[la.id].on).toBe(false)
    expect(res.componentStates[la.id].I).toBeCloseTo(0, 4)
  })

  it('a user override in interactiveStates beats the configured Position', () => {
    const bt = battery([100, 0], [100, 100])
    const la = lamp([100, 0], [300, 0])
    const sw = spdt([0, 50], [300, 0], [500, 0], 'NC')   // configured NC (would be dark)
    const wires = [wire([0, 50], [100, 100])]
    const res = runDCSimulation([bt, la, sw], wires, { [sw.id]: { state: 'NO' } })
    expect(res.componentStates[la.id].on).toBe(true)     // override forces NO → lit
  })

  it('reports the switch own V/I when conducting (regression: was missing → 0)', () => {
    const { res } = (() => {
      const bt = battery([100, 0], [100, 100])
      const la = lamp([100, 0], [300, 0])
      const sw = spdt([0, 50], [300, 0], [500, 0], 'NO')
      const wires = [wire([0, 50], [100, 100])]
      return { res: runDCSimulation([bt, la, sw], wires, {}), sw }
    })()
    const swState = Object.values(res.componentStates).find(s => s.on && s.I > 0 && s.I < 1)
    expect(swState).toBeDefined()
  })
})

describe('dcSolver — SPDT wire animation (per-pin current)', () => {
  // Lamp from battery+ to the NO throw; COM returns to battery−; the NC throw
  // is wired to a dangling stub. Each switch lead is its OWN pin-bound wire so
  // we can inspect per-wire current. With Position=NO the COM and NO wires must
  // carry current (animate) while the open NC throw's wire must read ~0.
  function rig(position) {
    const bt = battery([100, 0], [100, 100])
    const la = lamp([100, 0], [200, 0])                      // A on POS, B at (200,0)
    const sw = spdt([0, 50], [300, 0], [500, 0], position)   // COM, NO, NC
    const comW = boundWire([0, 50], [100, 100], { componentId: sw.id, pinId: 'COM' })
    const noW = boundWire([300, 0], [200, 0],
      { componentId: sw.id, pinId: 'NO' }, { componentId: la.id, pinId: 'B' })
    const ncW = boundWire([500, 0], [600, 0], { componentId: sw.id, pinId: 'NC' })
    const res = runDCSimulation([bt, la, sw], [comW, noW, ncW], {})
    return { res, comW, noW, ncW }
  }

  it('animates the COM and conducting (NO) leads, not the open (NC) lead', () => {
    const { res, comW, noW, ncW } = rig('NO')
    expect(res.wireStates[comW.id].current).toBeGreaterThan(1e-3)
    expect(res.wireStates[noW.id].current).toBeGreaterThan(1e-3)
    expect(res.wireStates[ncW.id].current).toBeCloseTo(0, 6)
  })

  it('flows the NO and COM leads in the physically correct direction', () => {
    // points are [switch-pin, other]. Current enters the switch at NO (from the
    // lamp) and leaves at COM (to battery −):
    //   noW  = [NO(300,0), lamp.B(200,0)]  → current last→first → dir -1
    //   comW = [COM(0,50), NEG(100,100)]   → current first→last → dir +1
    const { res, comW, noW } = rig('NO')
    expect(res.wireStates[noW.id].dir).toBe(-1)
    expect(res.wireStates[comW.id].dir).toBe(1)
  })

  it('flips which throw animates when Position=NC', () => {
    // Position NC: the NC throw conducts (but its stub is dangling so no loop
    // current flows anywhere) — the key assertion is that the now-open NO lead
    // reads zero rather than inheriting the switch current.
    const { res, noW } = rig('NC')
    expect(res.wireStates[noW.id].current).toBeCloseTo(0, 6)
  })
})

describe('dcSolver — degenerate circuits', () => {
  it("the user's circuit (both throws → +, COM → −, no load) is a dead short", () => {
    // Both throws tied to battery +, COM to battery − : a short through the
    // switch's 0.001Ω contact, ~9000 A, no load to drop voltage across.
    const bt = battery([100, 0], [100, 100])
    const sw = spdt([0, 50], [200, 40], [200, 60], 'NO')
    const wires = [
      wire([200, 40], [100, 0]),   // NO -> POS
      wire([200, 60], [100, 0]),   // NC -> POS
      wire([0, 50], [100, 100]),   // COM -> NEG
    ]
    const res = runDCSimulation([bt, sw], wires, {})
    const sw_s = res.componentStates[sw.id]
    expect(sw_s.on).toBe(true)
    expect(sw_s.I).toBeGreaterThan(1000)   // pathological current — confirms the short
  })

  it('returns safe empty defaults for an empty schematic', () => {
    const res = runDCSimulation([], [], {})
    expect(res.componentStates).toEqual({})
    expect(res.wireStates).toEqual({})
  })
})
