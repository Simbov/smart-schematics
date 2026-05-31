// Test helpers for building circuits to feed into the DC solver.
//
// ── How the solver consumes a circuit (the non-obvious parts) ──────────────
//
// `runDCSimulation(components, wires, interactiveStates)` does NOT use any DOM
// or React. It builds electrical nets purely from geometry:
//
//   • Every pin has absolute coordinates `absX`/`absY`. Two pins are on the same
//     net only if they share a coordinate OR are joined transitively through a
//     wire whose endpoints sit on those coordinates.
//   • `buildWireNets` Union-Finds all wire points; `ptKey` rounds coords to the
//     nearest integer, so use integer coordinates in tests.
//   • To connect pin P (at x,y) to pin Q (at u,v) you add a wire whose points are
//     [{x,y},{u,v}] — the wire endpoints must coincide with the pin coords.
//   • Ground net priority: a `ground` component's GND pin → else battery NEG →
//     else `vss_rail` GND → else nets[0].
//   • Battery default EMF is 9 V (override via simParams.voltage or value '12V').
//
// These helpers hide that bookkeeping: place pins at coordinates, then call
// `wire(aXY, bXY)` to tie two coordinates together.

let _seq = 0
const uid = (p) => `${p}${_seq++}`

/** A pin at absolute coordinates. */
export const pin = (id, x, y) => ({ id, absX: x, absY: y })

/** A wire tying a list of [x,y] coordinates into one net. */
export const wire = (...pts) => ({
  id: uid('w'),
  points: pts.map(([x, y]) => ({ x, y })),
})

/**
 * A wire whose endpoints are bound to specific component pins — needed when a
 * test cares about per-pin wire current (e.g. an SPDT's open throw). `pinA`/
 * `pinB` are `{ componentId, pinId }` or null.
 */
export const boundWire = (aXY, bXY, pinA = null, pinB = null) => ({
  id: uid('w'),
  points: [{ x: aXY[0], y: aXY[1] }, { x: bXY[0], y: bXY[1] }],
  pinA, pinB,
})

/** Battery: POS at posXY, NEG at negXY. NEG becomes the ground reference. */
export function battery(posXY, negXY, { voltage, designator = 'BT1', id = uid('bt') } = {}) {
  return {
    id, type: 'battery', designator, value: voltage ? `${voltage}V` : '9V',
    simParams: voltage != null ? { voltage } : {},
    pins: [pin('POS', ...posXY), pin('NEG', ...negXY)],
  }
}

/** Resistor between A and B (ohms via simParams.resistance). */
export function resistor(aXY, bXY, ohms, { designator = 'R1', id = uid('r') } = {}) {
  return {
    id, type: 'resistor', designator, value: `${ohms}`,
    simParams: { resistance: ohms },
    pins: [pin('A', ...aXY), pin('B', ...bXY)],
  }
}

/** Lamp between A and B (fixed 10Ω model in the solver). */
export function lamp(aXY, bXY, { designator = 'LA1', id = uid('la') } = {}) {
  return {
    id, type: 'lamp', designator, value: '',
    simParams: {},
    pins: [pin('A', ...aXY), pin('B', ...bXY)],
  }
}

/** Ground symbol (single GND pin). All ground symbols share node 0. */
export function ground(xy, { id = uid('gnd') } = {}) {
  return { id, type: 'ground', designator: 'GND', value: '', simParams: {}, pins: [pin('GND', ...xy)] }
}

/** Voltmeter probe (1GΩ, negligible loading): reads V(A)−V(B) as componentStates.V. */
export function voltmeter(aXY, bXY, { designator = 'VM1', id = uid('vm') } = {}) {
  return { id, type: 'voltmeter', designator, value: '', simParams: {}, pins: [pin('A', ...aXY), pin('B', ...bXY)] }
}

/** Diode/LED/zener: anode A, cathode K. Pass `forwardVoltage`/`zenerVoltage`/`type`. */
export function diode(aXY, kXY, { type = 'diode', forwardVoltage, zenerVoltage, designator = 'D1', id = uid('d') } = {}) {
  const simParams = {}
  if (forwardVoltage != null) simParams.forwardVoltage = forwardVoltage
  if (zenerVoltage != null) simParams.zenerVoltage = zenerVoltage
  return { id, type, designator, value: '', simParams, pins: [pin('A', ...aXY), pin('K', ...kXY)] }
}

/** Potentiometer: ends A/B, wiper W. `position` 0→wiper at A, 1→wiper at B. */
export function potentiometer(aXY, bXY, wXY, ohms, position = 0.5, { designator = 'RV1', id = uid('rv') } = {}) {
  return {
    id, type: 'potentiometer', designator, value: `${ohms}`,
    simParams: { resistance: ohms, position },
    pins: [pin('A', ...aXY), pin('B', ...bXY), pin('W', ...wXY)],
  }
}

/** SPDT switch: COM / NO / NC. `position` is the configured initial throw ('NO'|'NC'). */
export function spdt(comXY, noXY, ncXY, position = 'NO', { designator = 'S1', id = uid('s') } = {}) {
  return {
    id, type: 'switch_spdt', designator, value: '',
    simParams: { position },
    pins: [pin('COM', ...comXY), pin('NO', ...noXY), pin('NC', ...ncXY)],
  }
}
