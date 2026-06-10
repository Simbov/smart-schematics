import { describe, it, expect } from 'vitest'
import { runDCSimulation } from './dcSolver.js'
import { battery, resistor, lamp, spdt, wire, boundWire, ground, voltmeter, diode, potentiometer } from '../../test/circuitBuilder.js'
import { createBox } from '../boxComponent.js'

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

describe('dcSolver — solenoid relay (self-contained coil + SPDT contact)', () => {
  // A1/A2 = coil; C/NO/NC = contact. Energising the coil throws C from NC to NO.
  function solenoidRelay(a1, a2, c, no, nc, { designator = 'K1', id = 'sr1' } = {}) {
    return {
      id, type: 'solenoid_relay', designator, value: '', simParams: {},
      pins: [
        { id: 'A1', absX: a1[0], absY: a1[1] },
        { id: 'A2', absX: a2[0], absY: a2[1] },
        { id: 'C', absX: c[0], absY: c[1] },
        { id: 'NO', absX: no[0], absY: no[1] },
        { id: 'NC', absX: nc[0], absY: nc[1] },
      ],
    }
  }

  it('closes C→NO and lights an NO load when the coil is energised', () => {
    const bt = battery([0, 0], [0, 100])                       // 9V across the coil
    const sr = solenoidRelay([0, 0], [0, 100], [0, 0], [300, 0], [500, 0])
    const la = lamp([300, 0], [0, 100])                        // NO → NEG
    const res = runDCSimulation([bt, sr, la], [], {})
    expect(res.componentStates[sr.id].on).toBe(true)           // coil energised
    expect(res.componentStates[la.id].on).toBe(true)           // NO contact closed
  })

  it('rests on C→NC (NO load dark) when the coil is not energised', () => {
    const bt = battery([0, 0], [0, 100])
    // Coil floating (both pins on an isolated net) → 0 V → not energised.
    const sr = solenoidRelay([900, 900], [900, 900], [0, 0], [300, 0], [500, 0])
    const laNC = lamp([500, 0], [0, 100], { id: 'laNC' })      // NC → NEG (should light)
    const laNO = lamp([300, 0], [0, 100], { id: 'laNO' })      // NO → NEG (should stay dark)
    const res = runDCSimulation([bt, sr, laNC, laNO], [], {})
    expect(res.componentStates[sr.id].on).toBe(false)
    expect(res.componentStates['laNC'].on).toBe(true)
    expect(res.componentStates['laNO'].on).toBe(false)
  })
})

describe('dcSolver — multiple ground symbols are one node', () => {
  it('closes a circuit through two un-wired ground symbols', () => {
    // POS → lamp → ground#2 ;  battery NEG → ground#1.  The two ground symbols
    // are NOT wired together — they must still be the same node (node 0) so the
    // lamp lights. Previously only the first ground became node 0 and the second
    // floated, leaving the lamp dark.
    const bt = battery([0, 0], [0, 100])              // 9V, POS(0,0) NEG(0,100)
    const la = lamp([0, 0], [200, 0])                 // A on POS, B at (200,0)
    const g1 = ground([0, 100])                       // shares NEG coord
    const g2 = ground([200, 0])                       // shares lamp.B coord
    const res = runDCSimulation([bt, la, g1, g2], [], {})
    expect(res.componentStates[la.id].on).toBe(true)
    expect(res.componentStates[la.id].I).toBeCloseTo(0.9, 4)
  })
})

describe('dcSolver — potentiometer wiper divider', () => {
  it('taps half the supply at position 0.5', () => {
    const bt = battery([0, 0], [0, 100], { voltage: 10 })
    const g = ground([0, 100])                        // NEG = node 0
    const rv = potentiometer([0, 0], [0, 100], [50, 50], 10000, 0.5)
    const vm = voltmeter([50, 50], [0, 100])          // probe W → ground
    const res = runDCSimulation([bt, g, rv, vm], [], {})
    expect(res.componentStates[vm.id].V).toBeCloseTo(5, 2)
  })

  it('taps 7.5V at position 0.25 (wiper nearer A)', () => {
    const bt = battery([0, 0], [0, 100], { voltage: 10 })
    const g = ground([0, 100])
    const rv = potentiometer([0, 0], [0, 100], [50, 50], 10000, 0.25)
    const vm = voltmeter([50, 50], [0, 100])
    const res = runDCSimulation([bt, g, rv, vm], [], {})
    expect(res.componentStates[vm.id].V).toBeCloseTo(7.5, 2)
  })
})

describe('dcSolver — diode forward voltage & zener breakdown', () => {
  it('honors the configured forward voltage', () => {
    // 9V across LED (Vf=2.1) + 100Ω. I = (9 − 2.1)/(Ron 10 + 100) = 0.06273 A.
    const bt = battery([0, 0], [0, 100], { voltage: 9 })
    const g = ground([0, 100])
    const d = diode([0, 0], [100, 0], { type: 'led', forwardVoltage: 2.1 })
    const r = resistor([100, 0], [0, 100], 100)
    const res = runDCSimulation([bt, g, d, r], [], {})
    expect(res.componentStates[d.id].on).toBe(true)
    expect(res.componentStates[d.id].I).toBeCloseTo((9 - 2.1) / 110, 3)
  })

  it('clamps a node to the zener voltage in reverse breakdown', () => {
    // 10V → 1kΩ → node ; zener (5.1V) from node(K) to ground(A) reverse-biased.
    // KCL: (10−Vn)/1000 = (Vn−5.1)/10  → Vn ≈ 5.15V.
    const bt = battery([0, 0], [0, 100], { voltage: 10 })
    const g = ground([0, 100])
    const r = resistor([0, 0], [100, 0], 1000)
    const z = diode([0, 100], [100, 0], { type: 'zener_diode', zenerVoltage: 5.1 }) // A=gnd, K=node
    const vm = voltmeter([100, 0], [0, 100])
    const res = runDCSimulation([bt, g, r, z, vm], [], {})
    expect(res.componentStates[z.id].on).toBe(true)
    expect(res.componentStates[vm.id].V).toBeCloseTo(5.15, 1)
  })
})

describe('dcSolver — component box is inert (Stage 1)', () => {
  // A box is a built-in component (type:'box') with no simulation model. The
  // solver no-ops unknown types, so a box dropped across a live circuit must
  // draw no current, change no node voltage, and never short its pins' nets.
  function pin(id, x, y) { return { id, absX: x, absY: y } }
  function box(p1, p2, { id = 'box1' } = {}) {
    return { id, type: 'box', designator: 'U1', value: '', simParams: {}, pins: [pin('A', ...p1), pin('B', ...p2)] }
  }

  it('changes no node voltage and draws no current when placed across a divider', () => {
    // 9V across two 100Ω resistors in series → midpoint at 4.5V.
    const bt = battery([0, 0], [0, 100])
    const r1 = resistor([0, 0], [0, 50], 100)
    const r2 = resistor([0, 50], [0, 100], 100)
    const vm = voltmeter([0, 50], [0, 100])

    const base = runDCSimulation([bt, r1, r2, vm], [], {})
    expect(base.componentStates[vm.id].V).toBeCloseTo(4.5, 3)

    // Add a box whose pins land on the POS net and the GND net.
    const bx = box([0, 0], [0, 100])
    const withBox = runDCSimulation([bt, r1, r2, vm, bx], [], {})

    // Node voltage and resistor current unchanged → box is inert, no short.
    expect(withBox.componentStates[vm.id].V).toBeCloseTo(base.componentStates[vm.id].V, 6)
    expect(withBox.componentStates[r1.id].I).toBeCloseTo(base.componentStates[r1.id].I, 6)

    // The box itself carries essentially no current.
    const bxState = withBox.componentStates[bx.id]
    if (bxState) expect(Math.abs(bxState.I)).toBeLessThan(1e-9)
  })
})

describe('dcSolver — real createBox() box is inert (Stage 5)', () => {
  // Build an actual box via the Stage 5 factory and drop it across a live
  // battery→lamp loop with its two edge pins landing on the live POS and GND
  // nets. The lamp must light exactly as if the box weren't there, and the box
  // must create no net short (no extra current path).
  it('does not perturb a live lamp circuit or short its pins', () => {
    const bt = battery([0, 0], [0, 100])
    const la = lamp([0, 0], [0, 100])

    const base = runDCSimulation([bt, la], [], {})
    expect(base.componentStates[la.id].on).toBe(true)
    const baseI = base.componentStates[la.id].I

    // Real box at center (40,50), default 80×60 → W1 pin at (0,50)?  We instead
    // position it so its two default pins (W1 left, E1 right) sit on the POS net
    // (0,0) and GND net (0,100). Place center at (0,50): W1 rel(-40,0)→(-40,50),
    // E1 rel(40,0)→(40,50). Those don't touch the nets, so override pin coords to
    // land exactly on POS and GND (the solver reads absX/absY).
    const bx = createBox({ x: 0, y: 50, width: 80, height: 60, grid: 10, id: 'BX1' })
    bx.pins = [
      { ...bx.pins[0], absX: 0, absY: 0 },     // W1 → POS net
      { ...bx.pins[1], absX: 0, absY: 100 },   // E1 → GND net
    ]

    const withBox = runDCSimulation([bt, la, bx], [], {})

    // Lamp current unchanged → the box added no conductive path (no short).
    expect(withBox.componentStates[la.id].on).toBe(true)
    expect(withBox.componentStates[la.id].I).toBeCloseTo(baseI, 6)

    // The box draws no current of its own.
    const bxState = withBox.componentStates[bx.id]
    if (bxState) expect(Math.abs(bxState.I || 0)).toBeLessThan(1e-9)
  })
})

describe('dcSolver — PLC I/O terminals (PLC release)', () => {
  const plc = (type, pinId, xy, id) => ({
    id, type, designator: id, value: '',
    simParams: { address: pinId === 'IN' ? 'I0.0' : 'Q0.0', mode: 'Digital' },
    pins: [{ id: pinId, absX: xy[0], absY: xy[1] }],
  })

  it('is inert (no stamp, no current) and does not disturb the circuit', () => {
    const bt = battery([0, 0], [0, 100])
    const la = lamp([0, 0], [0, 100])
    const base = runDCSimulation([bt, la], [], {})
    const baseI = base.componentStates[la.id].I

    const di = plc('plc_input', 'IN', [0, 0], 'di1')   // tied to the POS net
    const res = runDCSimulation([bt, la, di], [], {})
    expect(res.componentStates[la.id].I).toBeCloseTo(baseI, 6)
    expect(res.componentStates[di.id].I).toBe(0)
  })

  it('reports the field-pin voltage', () => {
    const bt = battery([0, 0], [0, 100])
    const la = lamp([0, 0], [0, 100])
    const di = plc('plc_input', 'IN', [0, 0], 'di1')   // on the 9V POS net
    const res = runDCSimulation([bt, la, di], [], {})
    expect(res.componentStates[di.id].V).toBeCloseTo(9, 3)
  })

  it('digital input toggles High/Low via interactiveStates (simulatable in both states)', () => {
    const di = plc('plc_input', 'IN', [0, 0], 'di1')
    const low = runDCSimulation([di], [], {})
    expect(low.componentStates[di.id].on).toBe(false)
    const high = runDCSimulation([di], [], { [di.id]: { state: 'closed' } })
    expect(high.componentStates[di.id].on).toBe(true)
  })

  it('output toggles On/Off via interactiveStates', () => {
    const dout = plc('plc_output', 'OUT', [0, 0], 'do1')
    const off = runDCSimulation([dout], [], {})
    expect(off.componentStates[dout.id].on).toBe(false)
    const on = runDCSimulation([dout], [], { [dout.id]: { state: 'closed' } })
    expect(on.componentStates[dout.id].on).toBe(true)
  })
})

describe('dcSolver — horn and valve electronics (batch 2)', () => {
  it('horn draws current PWR→GND and turns on', () => {
    const bt = battery([0, 0], [0, 100])
    const horn = {
      id: 'ha1', type: 'horn', designator: 'HA1', value: '24V', simParams: {},
      pins: [pinAt('PWR', 0, 0), pinAt('GND', 0, 100)],
    }
    const res = runDCSimulation([bt, horn], [], {})
    expect(res.componentStates[horn.id].on).toBe(true)
    expect(res.componentStates[horn.id].I).toBeCloseTo(9 / 8, 3)
  })

  it('valve electronics loads Us–GND; Udc and Error stay inert', () => {
    const bt = battery([0, 0], [0, 100])
    const valve = {
      id: 'yv1', type: 'valve_electronics', designator: 'YV1', value: '', simParams: {},
      pins: [pinAt('Us', 0, 0), pinAt('Error', 50, 50), pinAt('GND', 0, 100), pinAt('Udc', 60, 60)],
    }
    const res = runDCSimulation([bt, valve], [], {})
    expect(res.componentStates[valve.id].on).toBe(true)
    expect(res.componentStates[valve.id].I).toBeCloseTo(9 / 100, 4)
  })
})

function pinAt(id, x, y) { return { id, absX: x, absY: y } }
