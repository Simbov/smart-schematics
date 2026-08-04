/* eslint-disable no-unused-vars */
// Generator for the "ACS Autonomy Kit" reference schematic.
//
// Not a test — a build script that happens to run under vitest so it can import
// the app's own ESM modules. It drives the REAL store actions (addComponent,
// setComponentPins, addWire, addBox, addTable, addAnnotation) and then writes
// `_buildProjectSnapshot()` to disk as a .scpro.json the app can open. Driving
// the store rather than hand-writing JSON means the file is guaranteed to match
// whatever schema the app currently reads.
//
//   OUT_PROJECT=/path/to/file.scpro.json npx vitest run scripts/buildAcsDemo.test.js

import { it } from 'vitest'
import { writeFileSync } from 'node:fs'
import useSchematicStore from '../src/store/schematicStore'
import { getElectricalDef } from '../src/lib/components/electrical'
import { createTable, setCell } from '../src/lib/tableModel'
import { plainToDoc } from '../src/lib/richText'

const store = () => useSchematicStore.getState()
let did = null

// ── helpers ────────────────────────────────────────────────────────────────

let seq = 0
const uid = p => `${p}_${(seq++).toString(36)}`

function place(type, x, y, { params = {}, designator, value } = {}) {
  const def = getElectricalDef(type)
  const id = store().addComponent(did, type, x, y, def)
  if (Object.keys(params).length) {
    const defaults = Object.fromEntries(
      Object.entries(def.simParams || {}).map(([k, v]) => [k, v.default ?? ''])
    )
    const merged = { ...defaults, ...params }
    if (def.derivePins) store().setComponentPins(did, id, def.derivePins(merged), params)
    else for (const [k, v] of Object.entries(params)) store().updateComponentSimParam(did, id, k, v)
  }
  const patch = {}
  if (designator != null) patch.designator = designator
  if (value != null) patch.value = value
  if (Object.keys(patch).length) store().updateComponent(did, id, patch)
  return id
}

function comp(id) {
  return store().drawings.find(d => d.id === did).components.find(c => c.id === id)
}

// Absolute position of a pin, so wires always land exactly on a terminal.
function pinAt(compId, pinId) {
  const p = comp(compId).pins.find(p => p.id === pinId)
  if (!p) throw new Error(`no pin ${pinId} on ${comp(compId).designator} (${comp(compId).type})`)
  return { x: p.absX, y: p.absY, componentId: compId, pinId }
}

// A wire along an explicit orthogonal path. `pts` are the intermediate corners;
// the endpoints come from the two pins, and pinA/pinB bind the wire so it
// follows the component if it is ever moved.
function wire(a, b, pts = [], color = null) {
  const points = [{ x: a.x, y: a.y }, ...pts, { x: b.x, y: b.y }]
  const w = {
    id: uid('w'), netName: '', points, style: 'solid', weight: 1,
    ...(color ? { color } : {}),
    pinA: { componentId: a.componentId, pinId: a.pinId },
    pinB: { componentId: b.componentId, pinId: b.pinId },
  }
  store().addWire(did, w)
  return w.id
}

// Route through a vertical channel at x = ch: out horizontally, across, back in.
function routeX(a, b, ch, color) {
  return wire(a, b, [{ x: ch, y: a.y }, { x: ch, y: b.y }], color)
}
// Route through a horizontal channel at y = ch.
function routeY(a, b, ch, color) {
  return wire(a, b, [{ x: a.x, y: ch }, { x: b.x, y: ch }], color)
}
// Out to xa, down/up to y=ch, across to xb, then in.
function routeZ(a, b, xa, ch, xb, color) {
  return wire(a, b, [{ x: xa, y: a.y }, { x: xa, y: ch }, { x: xb, y: ch }, { x: xb, y: b.y }], color)
}

function text(x, y, str, size = 12, opts = {}) {
  store().addAnnotation(did, {
    id: uid('a'), type: 'text', x, y, text: str, doc: plainToDoc(str), fontSize: size, ...opts,
  })
}

function box(x, y, w, h, lines, { fill = '#ffffff', stroke = '#334155' } = {}) {
  const id = store().addBox(did, x, y, {
    width: w, height: h, fill, stroke,
    doc: plainToDoc(lines.join('\n')),
    pinSpec: { top: 0, bottom: 0, left: 0, right: 0 },
  })
  // Labelled boxes carry their name in the box text; the auto 'BX1' designator
  // above them would just be noise on the sheet.
  store().updateComponent(did, id, { designator: '' })
  return id
}

// The title block lives at a FIXED world rect (0,500)–(800,600). Slide the whole
// drawing clear of it so it reads as a header above the sheet instead of landing
// on top of a component.
function clearTitleBlock(snapshot, { left = 60, top = 700 } = {}) {
  const d = snapshot.drawings[0]
  const xs = [], ys = []
  for (const c of d.components) { xs.push(c.x); ys.push(c.y) }
  for (const w of d.wires) for (const p of w.points) { xs.push(p.x); ys.push(p.y) }
  for (const a of d.annotations) { xs.push(a.x); ys.push(a.y) }
  for (const t of (d.tables || [])) { xs.push(t.x); ys.push(t.y) }
  const dx = left - Math.min(...xs)
  const dy = top - Math.min(...ys)

  for (const c of d.components) {
    c.x += dx; c.y += dy
    for (const p of (c.pins || [])) { p.absX += dx; p.absY += dy }
  }
  for (const w of d.wires) for (const p of w.points) { p.x += dx; p.y += dy }
  for (const a of d.annotations) { a.x += dx; a.y += dy }
  for (const t of (d.tables || [])) { t.x += dx; t.y += dy }
  for (const j of (d.junctions || [])) { j.x += dx; j.y += dy }
  return snapshot
}

function table(x, y, rows, cols, colWidths, data) {
  let t = createTable({ id: uid('t'), x, y, rows, cols, colWidths, rowHeight: 22, headerRow: true })
  data.forEach((row, r) => row.forEach((cell, c) => {
    if (cell !== '') t = setCell(t, r, c, plainToDoc(String(cell)))
  }))
  store().addTable(did, t)
  return t.id
}

// A one-line label box. Fixing width+height stops a long signal name wrapping
// onto a second line and colliding with the contact below it.
const PINLABEL = { width: 250, height: 13 }
const WIRELABEL = { width: 70, height: 13 }

// Wire colours lifted from the source drawing.
const C = {
  red: '#dc2626', blue: '#2563eb', cyan: '#06b6d4', magenta: '#d946ef',
  green: '#16a34a', orange: '#f97316', purple: '#7c3aed', black: '#334155',
  pink: '#ec4899', brown: '#92400e', grey: '#64748b',
}

// ── the drawing ────────────────────────────────────────────────────────────

it('builds the ACS autonomy kit schematic', () => {
  store().newProject('ACS Autonomy Kit')
  did = store().activeDrawingId
  store().renameDrawing(did, 'Autonomy Kit Installation')
  store().updateTitleBlock(did, {
    title: 'ACS AUTONOMY KIT — MACHINE INSTALLATION',
    drawingNumber: 'ACS-0001',
    revision: 'A',
    author: 'Simon Vollert',
    company: 'Smart Schematics',
    visible: true,
  })

  // ══ Zone A — machine harness interface ═══════════════════════════════════
  text(80, 70, 'MACHINE HARNESS INTERFACE', 16)
  box(230, 250, 200, 90, ['HARNESS AS', '', 'Machine loom'], { fill: '#f8fafc' })

  const cc9 = place('harness_connector', 470, 250, {
    designator: 'C-C9', params: { ways: 12, gender: 'Socket' },
  })
  const adc1 = place('harness_connector', 720, 250, {
    designator: 'AD-C1', params: { ways: 12, gender: 'Pin' },
  })
  store().flipComponent(did, adc1, 'H')

  const HARNESS_LABELS = [
    '818-BK', 'C250-BK', '819-GY', '592-BU', 'F418-GN', 'C237-BK',
    'F419-YL', '200-BK', '—', '—', '—', '—',
  ]
  for (let i = 0; i < 12; i++) {
    const a = pinAt(cc9, `P${i + 1}`)
    const b = pinAt(adc1, `P${i + 1}`)
    wire(a, b, [], i < 8 ? C.black : C.grey)
    // Wire number sits in the gap ABOVE its own conductor, clear of both.
    if (HARNESS_LABELS[i] !== '—') text(a.x + 40, a.y - 16, HARNESS_LABELS[i], 8, WIRELABEL)
  }
  text(470, 400, 'C-C9', 11)
  text(700, 400, 'AD-C1', 11)

  box(230, 620, 200, 110,
    ['ELECTRONICS AS', '', 'Machine ranging node'], { fill: '#f8fafc' })
  const adc2 = place('harness_connector', 470, 620, {
    designator: 'AD-C2', params: { ways: 7, gender: 'Socket' },
  })
  const AD_C2_FN = ['POWER', 'GND', 'RS232 RX', 'RS232 TX', 'IO1', 'IO2', 'GND']
  AD_C2_FN.forEach((fn, i) => text(500, pinAt(adc2, `P${i + 1}`).y - 16, fn, 8, PINLABEL))

  // ══ Zone B — autonomy kit connectors ═════════════════════════════════════
  text(980, 70, 'AUTONOMY KIT — TPRSM', 16)

  const cc7 = place('harness_connector', 1080, 180, {
    designator: 'C-C7', params: { ways: 4, gender: 'Socket' },
  })
  const ETH1 = ['ETHERNET 1 TX+ (YL)', 'ETHERNET 1 RX+ (WH)', 'ETHERNET 1 TX- (OR)', 'ETHERNET 1 RX- (BU)']
  const ETH1_W = ['C1-1 YL', 'C1-3 WH', 'C1-2 OR', 'C1-4 BU']
  ETH1.forEach((fn, i) => {
    text(1110, pinAt(cc7, `P${i + 1}`).y - 16, fn, 8, PINLABEL)
    text(1020, pinAt(cc7, `P${i + 1}`).y - 16, ETH1_W[i], 8, WIRELABEL)
  })
  text(1010, 100, 'C-C7', 11)

  const cc8 = place('harness_connector', 1080, 380, {
    designator: 'C-C8', params: { ways: 4, gender: 'Socket' },
  })
  const ETH2 = ['ETHERNET 2 TX+ (YL)', 'ETHERNET 2 RX+ (WH)', 'ETHERNET 2 TX- (OR)', 'ETHERNET 2 RX- (BU)']
  const ETH2_W = ['C2-1 YL', 'C2-3 WH', 'C2-2 OR', 'C2-4 BU']
  ETH2.forEach((fn, i) => {
    text(1110, pinAt(cc8, `P${i + 1}`).y - 16, fn, 8, PINLABEL)
    text(1020, pinAt(cc8, `P${i + 1}`).y - 16, ETH2_W[i], 8, WIRELABEL)
  })
  text(1010, 300, 'C-C8', 11)

  const cc2 = place('harness_connector', 1080, 860, {
    designator: 'C-C2', params: { ways: 24, gender: 'Socket' },
  })
  const CC2_FN = [
    'POWER (24 VDC) TPRSM PWR IN', '0 VDC TPRSM PWR', 'ENABLE 1-3', 'INPUT SPARE 1',
    '', '', '', 'ENABLE 2-3', 'STROBE', '', '', 'ENABLE 1-4',
    'ARMED FEEDBACK', 'LOCATED', '', 'ARM REQUEST LOCAL RESET',
    'FAULT STATUS', '', 'ARM STATUS (OUT)', 'OPERATING STATUS', '', '', '', '',
  ]
  const CC2_W = { 0: '592-BU', 1: '200-BK' }
  CC2_FN.forEach((fn, i) => {
    if (!fn) return
    text(1110, pinAt(cc2, `P${i + 1}`).y - 16, fn, 8, PINLABEL)
    if (CC2_W[i]) text(1010, pinAt(cc2, `P${i + 1}`).y - 16, CC2_W[i], 8, WIRELABEL)
  })
  text(1010, 600, 'C-C2', 11)

  const cc4 = place('harness_connector', 1080, 1420, {
    designator: 'C-C4', params: { ways: 6, gender: 'Socket' },
  })
  const CC4_FN = ['REM. MODE CH1', 'VSO LOOP TO CH1 REM. MODE', '', 'REM. MODE CH2', 'VSO LOOP TO CH2 REM. MODE', '']
  const CC4_W = ['EL337-BU', 'V871-GN', '', 'U987-PK', 'EL338-PU', '']
  CC4_FN.forEach((fn, i) => {
    if (!fn) return
    text(1110, pinAt(cc4, `P${i + 1}`).y - 16, fn, 8, PINLABEL)
    text(1010, pinAt(cc4, `P${i + 1}`).y - 16, CC4_W[i], 8, WIRELABEL)
  })
  text(1010, 1340, 'C-C4', 11)

  const bc3 = place('harness_connector', 1080, 1660, {
    designator: 'B-C3', params: { ways: 6, gender: 'Socket' },
  })
  const BC3_FN = ['BU-16', 'RD-16', 'WH-16', 'YL-16', 'BK-16', 'GN-16']
  BC3_FN.forEach((fn, i) => text(1110, pinAt(bc3, `P${i + 1}`).y - 16, fn, 8, PINLABEL))
  text(1010, 1580, 'B-C3', 11)
  box(830, 1660, 180, 120, ['SWITCH ASSEMBLY', '', '2 × mode switch'], { fill: '#f8fafc' })

  // ══ Zone C — S340 operator panel ═════════════════════════════════════════
  text(1900, 70, 'S340 OPERATOR PANEL', 16)
  text(1900, 96, 'SWITCH STATE SHOWN IN MANUAL POSITION', 10)

  // The mode switch is drawn as its contact development — a bank of contact
  // pairs bridging the panel plug's terminals, thrown together by one shaft.
  // The pairs made here are the MANUAL row of the truth table.
  const s340 = place('selector_switch', 2380, 420, {
    designator: 'S340', value: 'Mode switch',
    params: { pairs: 8, startNumber: 1, closed: '1,2,5', state: 'Manual' },
  })
  const xs340 = place('terminal_strip', 2380, 700, {
    designator: 'XS340', params: { ways: 16, startNumber: 1, style: 'Round', jumpers: '8-16,7-15' },
  })
  text(2080, 690, 'XS340', 12)

  // Every switch contact drops onto its own two plug terminals.
  for (let i = 0; i < 8; i++) {
    routeX(pinAt(s340, `A${i + 1}`), pinAt(xs340, `T${2 * i + 1}`), pinAt(s340, `A${i + 1}`).x, C.black)
    routeX(pinAt(s340, `B${i + 1}`), pinAt(xs340, `T${2 * i + 2}`), pinAt(s340, `B${i + 1}`).x, C.black)
  }

  // Callouts, each placed against the thing it names.
  text(1900, 662, 'INTERNAL JUMPERS', 10, { width: 130, height: 14 })
  text(2130, 186, 'Autom Steering enable (Orbitrol) (TRUCK)', 9, PINLABEL)
  text(2130, 200, 'RRC pwr (LOADER)', 9, PINLABEL)
  text(2500, 292, 'ACS Machine status light', 9, PINLABEL)
  text(2640, 404, 'Auto / manual mode to VCM', 9, PINLABEL)
  text(2450, 96, 'WLAN POWER', 9, PINLABEL)

  // Panel devices share the terminals their function is wired across, and sit
  // directly above them so each drop is a short straight run.
  const ack = place('pushbutton_no', 2280, 240, { designator: 'SB1', value: 'ACK' })
  const wlan = place('panel_indicator', 2400, 150, {
    designator: 'HL2', value: 'WLAN power',
    params: { colour: 'Blue', style: 'LED' },
  })
  const acs = place('panel_indicator', 2440, 300, {
    designator: 'HL1', value: 'ACS machine status',
    params: { colour: 'Amber', style: 'LED' },
  })
  const drop = (a, b, colour) => routeX(a, b, a.x, colour)
  drop(pinAt(ack, 'A'), pinAt(xs340, 'T3'), C.orange)
  drop(pinAt(ack, 'B'), pinAt(xs340, 'T4'), C.orange)
  drop(pinAt(wlan, 'A'), pinAt(xs340, 'T9'), C.blue)
  drop(pinAt(wlan, 'B'), pinAt(xs340, 'T10'), C.blue)
  drop(pinAt(acs, 'A'), pinAt(xs340, 'T11'), C.green)
  drop(pinAt(acs, 'B'), pinAt(xs340, 'T12'), C.green)

  table(2660, 120, 5, 10, [90, 150, 46, 46, 46, 46, 50, 54, 54, 54], [
    ['Switch state', 'Description', '1-2', '3-4', '5-6', '7-8', '9-10', '11-12', '13-14', '15-16'],
    ['1', 'Offline test mode', 'X', 'X', 'X', 'X', '', '', '', ''],
    ['2', 'Manual', 'X', 'X', '', '', 'X', '', '', ''],
    ['3', 'Auto', '', '', 'X', '', '', 'X', '', ''],
    ['4', 'ACS ACK', '', '', 'X', 'X', '', 'X', '', ''],
  ])
  text(2660, 100, 'MODE SWITCH TRUTH TABLE', 11)

  // ══ Zone D — application plug bus ════════════════════════════════════════
  const xap = place('terminal_strip', 1500, 2000, {
    designator: 'XAP', value: 'Application Plug',
    params: { ways: 40, startNumber: 1 },
  })
  text(1060, 1960, 'APPLICATION PLUG', 14)

  // ══ Zone E — vehicle control module interface ════════════════════════════
  text(80, 1960, 'VCM INTERFACE', 16)
  box(280, 2080, 260, 130, [
    'X90 X1-C',
    '5V PWM output',
    '5V relay ground',
    'DC auto open',
    'IO sense cancel',
  ], { fill: '#fef9c3' })
  box(280, 2300, 260, 180, [
    'APPLICATION PLUG',
    'Unisolated power',
    'Regulated power',
    'MF I/O CH1 – CH4',
    'Option board 1 A/B',
    'Option board 2 A/B',
  ], { fill: '#fef9c3' })
  box(280, 2560, 260, 80, ['GND BUS'], { fill: '#e2e8f0' })

  // ══ Zone F — AA01 HIMATRIX safety controller ═════════════════════════════
  // The module boundary is dashed on the controller's own diagram; the group
  // conductors deliberately cross it on their way to the field.
  box(1090, 2410, 800, 400, [], { fill: 'none', stroke: '#64748b' })
  text(700, 2180, 'AA01   HIMATRIX', 16)

  // Power, test-output and digital-output groups run along the top of the
  // module with their conductors leaving upward; the input banks sit along the
  // bottom and send theirs down.
  const pwr = place('safety_io_module', 800, 2280, {
    designator: '', params: { group: 'PWR', leads: 'Up', channels: 4, startNumber: 1, signals: 'L-,L+,L+,L-' },
  })
  const to = place('safety_io_module', 1040, 2280, {
    designator: '', params: { group: 'TO', leads: 'Up', channels: 6, startNumber: 1, signals: 'L-,1,2,4,8,S+' },
  })
  const dout = place('safety_io_module', 1290, 2280, {
    designator: '', params: { group: 'DO', leads: 'Up', channels: 6, startNumber: 7, signals: 'L-,1,2,3,4,L+' },
  })
  const di1 = place('safety_io_module', 900, 2560, {
    designator: '', params: { group: 'DI', channels: 6, startNumber: 19, signals: 'LS+,1,2,3,4,L-' },
  })
  const di2 = place('safety_io_module', 1250, 2560, {
    designator: '', params: { group: 'DI', channels: 6, startNumber: 25, signals: 'LS+,1,2,3,4,L-' },
  })

  // ══ Zone G — SENTRY SSR10 safety relays ══════════════════════════════════
  const manual = place('safety_relay', 2150, 2420, {
    designator: 'KSR1', params: { brand: 'SENTRY', model: 'SSR10', tag: 'LOS', mode: 'Manual', supply: '+24 VDC', contacts: 3, auxContacts: 1 },
  })
  text(2000, 2560, 'MANUAL', 16)
  const auto = place('safety_relay', 2700, 2420, {
    designator: 'KSR2', params: { brand: 'SENTRY', model: 'SSR10', tag: 'LOS', mode: 'Auto', supply: '+24 VDC', contacts: 3, auxContacts: 1 },
  })
  text(2550, 2560, 'AUTO', 16)

  const k1 = place('relay_coil', 1900, 1700, { designator: 'K1', value: 'Auto/manual' })
  box(3080, 1400, 160, 70, ['PDU Log'], { fill: '#f8fafc' })

  // ══ Wiring ═══════════════════════════════════════════════════════════════

  // Machine 24 V feed: C-C2 power/0 V down to the application plug bus.
  routeZ(pinAt(cc2, 'P1'), pinAt(xap, 'T1'), 1260, 1900, pinAt(xap, 'T1').x, C.red)
  routeZ(pinAt(cc2, 'P2'), pinAt(xap, 'T2'), 1280, 1920, pinAt(xap, 'T2').x, C.black)

  // Enable / status lines from C-C2 into the HIMATRIX digital inputs.
  const CC2_TO_DI = [
    ['P3', di1, 'C2', C.cyan], ['P8', di1, 'C3', C.cyan],
    ['P12', di1, 'C4', C.magenta], ['P13', di2, 'C2', C.magenta],
    ['P14', di2, 'C3', C.purple], ['P16', di2, 'C4', C.purple],
  ]
  CC2_TO_DI.forEach(([p, mod, ch, col], i) => {
    routeZ(pinAt(cc2, p), pinAt(mod, ch), 1340 + i * 20, 2160 + i * 12, pinAt(mod, ch).x, col)
  })

  // HIMATRIX digital outputs drive the two safety-relay input channels.
  routeZ(pinAt(dout, 'C2'), pinAt(manual, 'T1'), 1720, 2200, pinAt(manual, 'T1').x, C.green)
  routeZ(pinAt(dout, 'C3'), pinAt(manual, 'T2'), 1740, 2180, pinAt(manual, 'T2').x, C.green)
  routeZ(pinAt(dout, 'C4'), pinAt(auto, 'T1'), 1760, 2160, pinAt(auto, 'T1').x, C.orange)
  routeZ(pinAt(dout, 'C5'), pinAt(auto, 'T2'), 1780, 2140, pinAt(auto, 'T2').x, C.orange)

  // C-C4 remote-mode loops return to the relay channel returns.
  routeZ(pinAt(cc4, 'P1'), pinAt(manual, 'R1'), 1300, 1520, pinAt(manual, 'R1').x, C.blue)
  routeZ(pinAt(cc4, 'P2'), pinAt(manual, 'R2'), 1320, 1540, pinAt(manual, 'R2').x, C.blue)
  routeZ(pinAt(cc4, 'P4'), pinAt(auto, 'R1'), 1340, 1560, pinAt(auto, 'R1').x, C.pink)
  routeZ(pinAt(cc4, 'P5'), pinAt(auto, 'R2'), 1360, 1580, pinAt(auto, 'R2').x, C.pink)

  // Relay coil supplies from the application plug.
  routeZ(pinAt(xap, 'B5'), pinAt(manual, 'A1'), 1240, 2260, pinAt(manual, 'A1').x, C.red)
  routeZ(pinAt(xap, 'B6'), pinAt(manual, 'A2'), 1260, 2280, pinAt(manual, 'A2').x, C.black)
  routeZ(pinAt(xap, 'B7'), pinAt(auto, 'A1'), 1280, 2300, pinAt(auto, 'A1').x, C.red)
  routeZ(pinAt(xap, 'B8'), pinAt(auto, 'A2'), 1300, 2320, pinAt(auto, 'A2').x, C.black)

  // Reset (feedback) loops X1 → X4 on each relay.
  wire(pinAt(manual, 'X1'), pinAt(manual, 'X4'),
    [{ x: pinAt(manual, 'X1').x, y: 2620 }, { x: pinAt(manual, 'X4').x, y: 2620 }], C.grey)
  wire(pinAt(auto, 'X1'), pinAt(auto, 'X4'),
    [{ x: pinAt(auto, 'X1').x, y: 2620 }, { x: pinAt(auto, 'X4').x, y: 2620 }], C.grey)

  // Safety contacts back to the HIMATRIX test outputs (loop monitoring).
  routeZ(pinAt(manual, '14'), pinAt(to, 'C2'), 2080, 2700, pinAt(to, 'C2').x, C.cyan)
  routeZ(pinAt(auto, '14'), pinAt(to, 'C3'), 2620, 2740, pinAt(to, 'C3').x, C.cyan)

  // Panel strip out to the machine side.
  routeZ(pinAt(xs340, 'B1'), pinAt(cc2, 'P16'), 2100, 1240, 1300, C.orange)
  routeZ(pinAt(xs340, 'B3'), pinAt(cc2, 'P19'), 2120, 1260, 1320, C.magenta)
  routeZ(pinAt(xs340, 'B5'), pinAt(cc2, 'P20'), 2140, 1280, 1340, C.purple)
  routeZ(pinAt(xs340, 'B7'), pinAt(k1, 'A1'), 2160, 1600, 1880, C.green)
  routeZ(pinAt(xs340, 'B9'), pinAt(k1, 'A2'), 2180, 1640, 1920, C.green)

  // Ethernet pairs down to the application plug.
  const ETH_COL = [C.orange, C.grey, C.orange, C.blue]
  for (let i = 0; i < 4; i++) {
    routeZ(pinAt(cc7, `P${i + 1}`), pinAt(xap, `T${20 + i}`), 1420 + i * 16, 1120 + i * 14,
      pinAt(xap, `T${20 + i}`).x, ETH_COL[i])
    routeZ(pinAt(cc8, `P${i + 1}`), pinAt(xap, `T${25 + i}`), 1500 + i * 16, 1200 + i * 14,
      pinAt(xap, `T${25 + i}`).x, ETH_COL[i])
  }

  // Ranging-node power/serial across to the kit.
  routeZ(pinAt(adc2, 'P1'), pinAt(xap, 'T31'), 900, 1780, pinAt(xap, 'T31').x, C.red)
  routeZ(pinAt(adc2, 'P2'), pinAt(xap, 'T32'), 920, 1800, pinAt(xap, 'T32').x, C.black)
  routeZ(pinAt(adc2, 'P3'), pinAt(xap, 'T33'), 940, 1820, pinAt(xap, 'T33').x, C.green)
  routeZ(pinAt(adc2, 'P4'), pinAt(xap, 'T34'), 960, 1840, pinAt(xap, 'T34').x, C.green)

  // Switch assembly into the HIMATRIX DI bank.
  routeZ(pinAt(bc3, 'P1'), pinAt(di1, 'C5'), 1300, 2200, pinAt(di1, 'C5').x, C.blue)
  routeZ(pinAt(bc3, 'P2'), pinAt(di1, 'C6'), 1320, 2220, pinAt(di1, 'C6').x, C.red)
  routeZ(pinAt(bc3, 'P3'), pinAt(di2, 'C5'), 1340, 2240, pinAt(di2, 'C5').x, C.grey)
  routeZ(pinAt(bc3, 'P4'), pinAt(di2, 'C6'), 1360, 2260, pinAt(di2, 'C6').x, C.orange)

  // HIMATRIX supply off the application plug.
  routeZ(pinAt(xap, 'B1'), pinAt(pwr, 'C2'), 1180, 2200, pinAt(pwr, 'C2').x, C.red)
  routeZ(pinAt(xap, 'B2'), pinAt(pwr, 'C1'), 1160, 2180, pinAt(pwr, 'C1').x, C.black)

  const snapshot = clearTitleBlock(store()._buildProjectSnapshot())
  writeFileSync(process.env.OUT_PROJECT, JSON.stringify(snapshot, null, 2))

  const d = snapshot.drawings[0]
  // eslint-disable-next-line no-console
  console.log(`BUILT components=${d.components.length} wires=${d.wires.length} ` +
    `annotations=${d.annotations.length} tables=${(d.tables || []).length}`)
})
