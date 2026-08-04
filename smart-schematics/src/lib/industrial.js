// Industrial control-panel components — the parametric block symbols used on
// machine wiring diagrams: terminal strips, harness connectors, safety relays,
// safety-PLC I/O terminal groups, mode selector switches and panel indicators.
//
// Unlike the ~150 fixed symbols in the library, the size and pin set of these
// parts follow a way/channel/contact count, so each one exposes the parametric
// def contract:
//
//   sizeFor(simParams)    -> { width, height }   on-canvas footprint
//   derivePins(simParams) -> pin specs           rebuilt when a count changes
//
// Everything here is pure: no DOM, no store, no React. The SVG that renders
// these shapes lives in symbols/electrical/IndustrialSymbols.jsx and reads its
// geometry from the *Drawing() helpers below, so the picture and the pins can
// never drift apart.
//
// Terminal numbering follows IEC 60947-1 / EN 50205 conventions:
//   * safety-relay NO output contacts are 13/14, 23/24, 33/34 …
//   * NC auxiliary contacts continue the sequence as x1/x2 (41/42, 51/52 …)
//   * A1/A2 is the coil supply, S/T-R pairs are the channel inputs,
//     X1/X4 is the reset (feedback) loop.

const clampInt = (v, lo, hi, fallback) => {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return fallback
  return Math.max(lo, Math.min(hi, n))
}

// ── Terminal strip ──────────────────────────────────────────────────────────
//
// A DIN-rail terminal block: `ways` terminals side by side, each linking a field
// conductor (bottom) to an internal one (top). Pin ids are positional (T1/B1,
// T2/B2 …) rather than the printed terminal number, so renumbering the strip
// with `startNumber` relabels it without detaching a single wire.

export const TERMINAL_MIN_WAYS = 1
export const TERMINAL_MAX_WAYS = 40
const TERMINAL_PITCH = 20
const TERMINAL_BODY_H = 20
const TERMINAL_LEAD = 20

export const clampTerminalWays = v => clampInt(v, TERMINAL_MIN_WAYS, TERMINAL_MAX_WAYS, 6)
export const clampStartNumber = v => clampInt(v, 0, 9999, 1)

export function terminalStripGeom(simParams = {}) {
  const ways = clampTerminalWays(simParams.ways ?? 6)
  const start = clampStartNumber(simParams.startNumber ?? 1)
  const width = ways * TERMINAL_PITCH
  return {
    ways, start, width,
    bodyH: TERMINAL_BODY_H,
    height: TERMINAL_BODY_H + TERMINAL_LEAD * 2,
    // Centre line of terminal i (0-based). Always lands on a 10-unit grid step.
    x: i => -width / 2 + TERMINAL_PITCH / 2 + i * TERMINAL_PITCH,
  }
}

export function terminalStripSize(simParams) {
  const g = terminalStripGeom(simParams)
  return { width: g.width, height: g.height }
}

export function terminalStripPins(simParams) {
  const g = terminalStripGeom(simParams)
  const pins = []
  for (let i = 0; i < g.ways; i++) {
    const label = String(g.start + i)
    pins.push({ id: `T${i + 1}`, relX: g.x(i), relY: -(g.bodyH / 2 + TERMINAL_LEAD), direction: 'N', label })
    pins.push({ id: `B${i + 1}`, relX: g.x(i), relY: g.bodyH / 2 + TERMINAL_LEAD, direction: 'S', label })
  }
  return pins
}

// Terminal style. 'Block' is the DIN-rail block — a ruled body with the way
// number inside each cell. 'Round' is the panel-connector rail used on operator
// panels: a plain bar with a round screw terminal on it per way and the number
// printed below, which is how a panel plug like XS340 is drawn.
export const TERMINAL_STYLES = ['Block', 'Round']

// Links strapped between terminals inside the plug, written the way a panel
// drawing calls them out: "8-16,7-15". Entries name PRINTED terminal numbers,
// and anything that isn't a real pair of terminals on this strip is dropped.
export function parseJumpers(spec, ways, start) {
  const out = []
  for (const part of String(spec ?? '').split(',')) {
    const [a, b] = part.split('-').map(t => Number(t.trim()))
    const ia = a - start, ib = b - start
    const ok = n => Number.isInteger(n) && n >= 0 && n < ways
    if (ok(ia) && ok(ib) && ia !== ib) out.push({ a: ia, b: ib, labelA: String(a), labelB: String(b) })
  }
  return out
}

export function terminalStripDrawing(simParams = {}) {
  const g = terminalStripGeom(simParams)
  const half = g.bodyH / 2
  const disconnect = simParams.disconnect === true
  const style = simParams.style === 'Round' ? 'Round' : 'Block'
  const cells = []
  for (let i = 0; i < g.ways; i++) {
    cells.push({
      x: g.x(i),
      number: String(g.start + i),
      // Separator between this cell and the next (omitted after the last).
      separatorX: i < g.ways - 1 ? g.x(i) + TERMINAL_PITCH / 2 : null,
    })
  }
  // Straps between terminals inside the plug. They are stacked at different
  // heights so two jumpers over the same span never lie on top of each other.
  const jumpers = parseJumpers(simParams.jumpers, g.ways, g.start).map((j, i) => ({
    ...j,
    xa: g.x(j.a),
    xb: g.x(j.b),
    y: -(half + 8 + i * 6),
  }))

  return {
    ...g, half, disconnect, style, cells, jumpers,
    rect: { x: -g.width / 2, y: -half, width: g.width, height: g.bodyH },
    lead: { top: -(half + TERMINAL_LEAD), bottom: half + TERMINAL_LEAD },
  }
}

// ── Harness connector ───────────────────────────────────────────────────────
//
// A multi-way plug/receptacle drawn as a shell with numbered contacts, the way a
// machine harness drawing shows C-C1 … C-C9. Contacts exit to the right; flip
// the component for the mating half.

export const CONNECTOR_MIN_WAYS = 1
export const CONNECTOR_MAX_WAYS = 40
const CONNECTOR_PITCH = 20
const CONNECTOR_LEFT = -20   // shell left edge
const CONNECTOR_EDGE = 10    // shell right edge — where the leads start
const CONNECTOR_PIN_X = 20   // lead endpoint

export const clampConnectorWays = v => clampInt(v, CONNECTOR_MIN_WAYS, CONNECTOR_MAX_WAYS, 6)

export function harnessConnectorGeom(simParams = {}) {
  const ways = clampConnectorWays(simParams.ways ?? 6)
  const start = clampStartNumber(simParams.startNumber ?? 1)
  const height = ways * CONNECTOR_PITCH
  return {
    ways, start, height,
    width: CONNECTOR_PIN_X * 2,
    left: CONNECTOR_LEFT,
    edge: CONNECTOR_EDGE,
    pinX: CONNECTOR_PIN_X,
    // Centre line of contact i (0-based).
    y: i => -height / 2 + CONNECTOR_PITCH / 2 + i * CONNECTOR_PITCH,
  }
}

export function harnessConnectorSize(simParams) {
  const g = harnessConnectorGeom(simParams)
  return { width: g.width, height: g.height }
}

export function harnessConnectorPins(simParams) {
  const g = harnessConnectorGeom(simParams)
  const pins = []
  for (let i = 0; i < g.ways; i++) {
    pins.push({ id: `P${i + 1}`, relX: g.pinX, relY: g.y(i), direction: 'E', label: String(g.start + i) })
  }
  return pins
}

// Housing style. 'Plain' is the flat rectangle a harness/loom drawing uses — a
// numbered column of ways and nothing else. 'Keyed' adds the chamfered
// orientation key and a pin/socket contact glyph, for a connector detail view.
export const CONNECTOR_STYLES = ['Plain', 'Keyed']

export function harnessConnectorDrawing(simParams = {}) {
  const g = harnessConnectorGeom(simParams)
  const style = simParams.style === 'Keyed' ? 'Keyed' : 'Plain'
  // 'Pin' = male contact (solid), 'Socket' = female (open cup). Anything else
  // (an older file, a typo) falls back to socket, the commoner harness half.
  const gender = simParams.gender === 'Pin' ? 'Pin' : 'Socket'
  const contacts = []
  for (let i = 0; i < g.ways; i++) {
    contacts.push({
      y: g.y(i),
      number: String(g.start + i),
      // Plain housings rule off each way so the column reads as a way list.
      dividerY: i < g.ways - 1 ? g.y(i) + CONNECTOR_PITCH / 2 : null,
    })
  }
  return {
    ...g, style, gender, contacts,
    rect: { x: g.left, y: -g.height / 2, width: g.edge - g.left, height: g.height },
  }
}

// ── Safety relay ────────────────────────────────────────────────────────────
//
// A dual-channel safety relay (the SENTRY SSR10 class of device): coil supply
// A1/A2, one input channel pair per monitored channel, a reset loop X1/X4, and
// force-guided output contacts — `contacts` NO safety contacts followed by
// `auxContacts` NC auxiliaries.

export const RELAY_MIN_CONTACTS = 1
export const RELAY_MAX_CONTACTS = 4
export const RELAY_MAX_AUX = 2
const RELAY_COL = 40
const RELAY_BODY_H = 170
const RELAY_LEAD = 20

// Internal contact stack. A dual-channel safety relay puts TWO redundant
// contacts in series on every output — one per internal relay — and ties them
// to two armature bars that run right across the output section. That pair of
// horizontal bars is the most recognisable thing about the device's internal
// diagram, so the geometry is spelled out rather than approximated.
const RELAY_CONTACT = {
  fixed1: -46,   // upper fixed contact
  pivot1: -28,   // upper moving contact (rides armature 1)
  armature1: -37,
  fixed2: 4,     // lower fixed contact
  pivot2: 22,    // lower moving contact (rides armature 2)
  armature2: 13,
}

export const clampRelayContacts = v => clampInt(v, RELAY_MIN_CONTACTS, RELAY_MAX_CONTACTS, 3)
export const clampRelayAux = v => clampInt(v, 0, RELAY_MAX_AUX, 1)
export const clampRelayChannels = v => clampInt(v, 1, 2, 2)

// NO safety contact i (0-based) is numbered 13/14, 23/24, 33/34 …
export function safetyContactNumbers(i) {
  return { top: `${i + 1}3`, bottom: `${i + 1}4` }
}
// NC auxiliaries continue the same sequence: with 3 NO contacts, aux 0 is 41/42.
export function auxContactNumbers(i, contacts) {
  const n = contacts + i + 1
  return { top: `${n}1`, bottom: `${n}2` }
}

export function safetyRelayGeom(simParams = {}) {
  const contacts = clampRelayContacts(simParams.contacts ?? 3)
  const aux = clampRelayAux(simParams.auxContacts ?? 1)
  const channels = clampRelayChannels(simParams.channels ?? 2)
  // Columns: A1, A2, then a T/R pair per channel, then one per output contact.
  const supplyCols = 2
  const channelCols = channels * 2
  const cols = supplyCols + channelCols + contacts + aux
  const width = cols * RELAY_COL
  return {
    contacts, aux, channels, cols, width,
    supplyCols, channelCols,
    bodyH: RELAY_BODY_H,
    height: RELAY_BODY_H + RELAY_LEAD * 2,
    lead: RELAY_LEAD,
    // Centre line of column i (0-based).
    x: i => -width / 2 + RELAY_COL / 2 + i * RELAY_COL,
    // Index of the first output-contact column.
    firstContactCol: supplyCols + channelCols,
  }
}

export function safetyRelaySize(simParams) {
  const g = safetyRelayGeom(simParams)
  return { width: g.width, height: g.height }
}

export function safetyRelayPins(simParams) {
  const g = safetyRelayGeom(simParams)
  const top = -(g.bodyH / 2 + g.lead)
  const bottom = g.bodyH / 2 + g.lead
  const pins = [
    { id: 'A1', relX: g.x(0), relY: top, direction: 'N', label: 'A1' },
    { id: 'A2', relX: g.x(1), relY: top, direction: 'N', label: 'A2' },
    // Reset / feedback loop sits under the supply columns.
    { id: 'X1', relX: g.x(0), relY: bottom, direction: 'S', label: 'X1' },
    { id: 'X4', relX: g.x(1), relY: bottom, direction: 'S', label: 'X4' },
  ]
  for (let ch = 0; ch < g.channels; ch++) {
    pins.push({ id: `T${ch + 1}`, relX: g.x(g.supplyCols + ch * 2), relY: top, direction: 'N', label: `T${ch + 1}` })
    pins.push({ id: `R${ch + 1}`, relX: g.x(g.supplyCols + ch * 2 + 1), relY: top, direction: 'N', label: `R${ch + 1}` })
  }
  for (let i = 0; i < g.contacts; i++) {
    const n = safetyContactNumbers(i)
    const col = g.firstContactCol + i
    pins.push({ id: n.top, relX: g.x(col), relY: top, direction: 'N', label: n.top })
    pins.push({ id: n.bottom, relX: g.x(col), relY: bottom, direction: 'S', label: n.bottom })
  }
  for (let i = 0; i < g.aux; i++) {
    const n = auxContactNumbers(i, g.contacts)
    const col = g.firstContactCol + g.contacts + i
    pins.push({ id: n.top, relX: g.x(col), relY: top, direction: 'N', label: n.top })
    pins.push({ id: n.bottom, relX: g.x(col), relY: bottom, direction: 'S', label: n.bottom })
  }
  return pins
}

export function safetyRelayDrawing(simParams = {}) {
  const g = safetyRelayGeom(simParams)
  const half = g.bodyH / 2
  const outputs = []
  for (let i = 0; i < g.contacts; i++) {
    outputs.push({ x: g.x(g.firstContactCol + i), kind: 'NO', ...safetyContactNumbers(i) })
  }
  for (let i = 0; i < g.aux; i++) {
    outputs.push({ x: g.x(g.firstContactCol + g.contacts + i), kind: 'NC', ...auxContactNumbers(i, g.contacts) })
  }
  const channels = []
  for (let ch = 0; ch < g.channels; ch++) {
    channels.push({
      label: `CH${ch + 1}`,
      xT: g.x(g.supplyCols + ch * 2),
      xR: g.x(g.supplyCols + ch * 2 + 1),
    })
  }
  // Status indicators: one per channel plus a MODE lamp, stacked in the gap
  // between the channel columns and the first output column.
  const indicators = [...channels.map(c => c.label)]
  indicators.splice(1, 0, 'MODE')
  // Mode-select legend below them: a two-cell column, Manual over Auto, with the
  // active one crossed.
  const modeSelect = { active: simParams.mode === 'Auto' ? 'A' : 'M', cells: ['M', 'A'] }

  // Both armature bars span the whole output section with a little overhang, so
  // they read as one mechanical carrier rather than per-contact stubs.
  const OVERHANG = 15
  const span = outputs.length
    ? { from: outputs[0].x - OVERHANG, to: outputs[outputs.length - 1].x + OVERHANG }
    : null

  return {
    ...g, half, outputs, channels, indicators, modeSelect,
    contact: RELAY_CONTACT,
    rect: { x: -g.width / 2, y: -half, width: g.width, height: g.bodyH },
    supply: { xPos: g.x(0), xNeg: g.x(1) },
    // The two internal relays' armatures — every output contact hangs off them,
    // which is what "force-guided" means on the drawing.
    armatures: span
      ? [{ y: RELAY_CONTACT.armature1, ...span }, { y: RELAY_CONTACT.armature2, ...span }]
      : [],
  }
}

// ── Safety I/O module (terminal group) ──────────────────────────────────────
//
// One terminal group of a safety PLC (the HIMatrix class of controller): a
// labelled block — DI / DO / TO / AI / PWR — with `channels` numbered terminals
// along the bottom and a per-terminal signal designation.

export const IO_MIN_CHANNELS = 1
export const IO_MAX_CHANNELS = 16
export const IO_GROUPS = ['DI', 'DO', 'TO', 'AI', 'AO', 'PWR']
const IO_PITCH = 20
const IO_LABEL_ZONE = 40   // group-tag column at the left, inside the dashed box
const IO_BODY_H = 46
const IO_LEAD = 22

export const clampIoChannels = v => clampInt(v, IO_MIN_CHANNELS, IO_MAX_CHANNELS, 6)

// Which way the field conductors leave the group. A controller drawn with its
// power/output groups along the top of the module has those leads going UP; the
// input groups along the bottom send theirs DOWN.
export const IO_LEAD_DIRS = ['Down', 'Up']

export function safetyIoGeom(simParams = {}) {
  const channels = clampIoChannels(simParams.channels ?? 6)
  const start = clampStartNumber(simParams.startNumber ?? 1)
  const up = simParams.leads === 'Up'
  const width = IO_LABEL_ZONE + channels * IO_PITCH + 12
  const height = IO_BODY_H + IO_LEAD
  // Body sits opposite the leads so body + leads straddle the origin evenly.
  const top = up ? -height / 2 + IO_LEAD : -height / 2
  return {
    channels, start, width, up,
    bodyH: IO_BODY_H,
    height,
    lead: IO_LEAD,
    left: -width / 2,
    top,
    x: i => -width / 2 + IO_LABEL_ZONE + 6 + IO_PITCH / 2 + i * IO_PITCH,
  }
}

export function safetyIoSize(simParams) {
  const g = safetyIoGeom(simParams)
  return { width: g.width, height: g.height }
}

export function safetyIoPins(simParams) {
  const g = safetyIoGeom(simParams)
  const relY = g.up ? g.top - g.lead : g.top + g.bodyH + g.lead
  const pins = []
  for (let i = 0; i < g.channels; i++) {
    pins.push({
      id: `C${i + 1}`, relX: g.x(i), relY,
      direction: g.up ? 'N' : 'S', label: String(g.start + i),
    })
  }
  return pins
}

// Per-terminal signal designations come from a comma-separated `signals` string
// ("L-,1,2,3,4,L+"), so a group can carry the real designations off the drawing.
// Missing entries render blank rather than shifting the remaining ones.
export function parseSignals(signals, channels) {
  const parts = String(signals ?? '').split(',').map(s => s.trim())
  return Array.from({ length: channels }, (_, i) => parts[i] || '')
}

export function safetyIoDrawing(simParams = {}) {
  const g = safetyIoGeom(simParams)
  const group = IO_GROUPS.includes(simParams.group) ? simParams.group : 'DI'
  const signals = parseSignals(simParams.signals, g.channels)
  const terminals = []
  for (let i = 0; i < g.channels; i++) {
    terminals.push({ x: g.x(i), number: String(g.start + i), signal: signals[i] })
  }
  // Rows inside the body. The controller's own drawing puts the screw terminals
  // nearest the field side, the terminal numbers just inside them, and the
  // signal designations in their own bordered strip at the far side — so the
  // three rows flip together when the leads come off the top instead.
  // Ring nearest the field side, then the terminal number, then the signal
  // designation furthest in — so the screw the conductor lands on is always the
  // row closest to where that conductor leaves the group.
  const near = g.up ? g.top + 4 : g.top + g.bodyH - 4
  const step = g.up ? 1 : -1
  const rows = {
    ring: near + step * 7,
    number: near + step * 20,
    signal: near + step * 33,
  }

  return {
    ...g, group, terminals, rows,
    // Outer group boundary — dashed, the way a controller's terminal groups are
    // fenced off on the manufacturer's diagram.
    rect: { x: g.left, y: g.top, width: g.width, height: g.bodyH },
    // The signal designations sit in their own boxed strip.
    signalBox: {
      x: g.left + IO_LABEL_ZONE, y: rows.signal - 7,
      width: g.width - IO_LABEL_ZONE - 4, height: 14,
    },
    labelX: g.left + 6,
    labelY: g.top + g.bodyH / 2,
    leadFrom: g.up ? g.top : g.top + g.bodyH,
    leadTo: g.up ? g.top - g.lead : g.top + g.bodyH + g.lead,
  }
}

// ── Mode / selector switch ──────────────────────────────────────────────────
//
// A cam / mode switch as a panel drawing shows it: not a rotary with an arc, but
// the switch's CONTACT DEVELOPMENT — a bank of independent contact pairs, each
// bridging two terminals, all thrown together by one shaft. That is what the
// mode-switch truth table's "1-2 / 3-4 / 5-6 …" columns refer to, and it is how
// the contacts get wired onto the panel plug beneath.
//
//        ┌──/──┐   ┌─────┐        ← contacts (open / made)
//        │     │   │     │
//        1     2   3     4        ← terminals, down onto the plug

export const SELECTOR_MIN_PAIRS = 1
export const SELECTOR_MAX_PAIRS = 12
const SELECTOR_PAIR_W = 60
const SELECTOR_LEG = 15    // half the spacing between a pair's two legs
const SELECTOR_H = 80

export const clampSelectorPairs = v => clampInt(v, SELECTOR_MIN_PAIRS, SELECTOR_MAX_PAIRS, 8)

// Which pairs are made in the state being drawn — one row of the truth table,
// as a comma-separated list of 1-based pair numbers ("1,2,5"). Out-of-range and
// non-numeric entries are dropped rather than throwing.
export function parseClosedPairs(closed, pairs) {
  const out = new Set()
  for (const part of String(closed ?? '').split(',')) {
    const n = Number(part.trim())
    if (Number.isInteger(n) && n >= 1 && n <= pairs) out.add(n)
  }
  return out
}

export function selectorGeom(simParams = {}) {
  const pairs = clampSelectorPairs(simParams.pairs ?? 8)
  const start = clampStartNumber(simParams.startNumber ?? 1)
  const width = pairs * SELECTOR_PAIR_W
  return {
    pairs, start, width,
    height: SELECTOR_H,
    leg: SELECTOR_LEG,
    contactY: -10,          // the contact bridges its pair here
    pinY: SELECTOR_H / 2,   // terminals drop onto the plug below
    gangY: -32,             // the shaft that throws every contact together
    // Centre line of pair i (0-based); its two legs sit at ±leg either side.
    pairX: i => -width / 2 + SELECTOR_PAIR_W / 2 + i * SELECTOR_PAIR_W,
    // Terminal numbers run straight through: pair 1 is 1-2, pair 2 is 3-4 …
    numberA: i => start + i * 2,
    numberB: i => start + i * 2 + 1,
  }
}

export function selectorSize(simParams) {
  const g = selectorGeom(simParams)
  return { width: g.width, height: g.height }
}

export function selectorPins(simParams) {
  const g = selectorGeom(simParams)
  const pins = []
  for (let i = 0; i < g.pairs; i++) {
    // Ids are positional so renumbering the switch never detaches a wire.
    pins.push({ id: `A${i + 1}`, relX: g.pairX(i) - g.leg, relY: g.pinY, direction: 'S', label: String(g.numberA(i)) })
    pins.push({ id: `B${i + 1}`, relX: g.pairX(i) + g.leg, relY: g.pinY, direction: 'S', label: String(g.numberB(i)) })
  }
  return pins
}

export function selectorDrawing(simParams = {}) {
  const g = selectorGeom(simParams)
  const made = parseClosedPairs(simParams.closed, g.pairs)
  const contacts = []
  for (let i = 0; i < g.pairs; i++) {
    contacts.push({
      x: g.pairX(i),
      left: g.pairX(i) - g.leg,
      right: g.pairX(i) + g.leg,
      made: made.has(i + 1),
      label: `${g.numberA(i)}-${g.numberB(i)}`,
      numberA: String(g.numberA(i)),
      numberB: String(g.numberB(i)),
    })
  }
  return {
    ...g, contacts,
    // One shaft throws them all — dashed, per IEC, spanning the whole bank.
    gang: g.pairs > 1
      ? { y: g.gangY, from: g.pairX(0), to: g.pairX(g.pairs - 1) }
      : null,
  }
}

// ── Panel indicator ─────────────────────────────────────────────────────────

export const INDICATOR_COLOURS = ['Red', 'Green', 'Amber', 'Blue', 'White']
// 'Lamp'  — IEC 60617 signal lamp (circle + cross)
// 'Panel' — the square legend plate used on a control-panel layout
// 'LED'   — light-emitting diode: a diode with the two emission arrows, which is
//           how a panel status light driven from an electronic output is drawn
export const INDICATOR_STYLES = ['Lamp', 'Panel', 'LED']

// Lens colours used only when the indicator is lit. An unlit indicator keeps the
// component/theme stroke and no fill, so a static drawing stays monochrome.
const LENS = {
  Red: '#dc2626',
  Green: '#16a34a',
  Amber: '#f59e0b',
  Blue: '#2563eb',
  White: '#e5e7eb',
}

export function indicatorLens(colour) {
  return LENS[colour] || LENS.Red
}
