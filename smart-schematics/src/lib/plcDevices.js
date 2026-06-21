// PLC device registry — pure model helpers (no DOM, no store).
//
// A project can define its PLC hardware once: each device has a name, a
// location, and a pin table. Placed PLC I/O components (plc_input/plc_output)
// can then pick a device + pin address and auto-populate their signal name,
// mode, device and location from the registry instead of retyping them.
//
//   Device: { id, name, location, images: DeviceImage[], pins: Pin[] }
//   Pin:    { id, address, name, kind, capabilities, channel, connector, maxCurrent, notes }
//   kind ∈ 'DI' | 'DO' | 'AI' | 'PWM'  — what the pin is *configured* as.
//   capabilities ⊆ PIN_KINDS — what the pin *can* do (e.g. PWM-capable but set DO).
//   channel = logical channel name, e.g. "CH1" (free text).
//   maxCurrent = the pin's current rating in amps, e.g. "0.5" (free text — what
//   the pin is *capable* of driving/sinking).
//   connector = which physical plug the pin sits on, e.g. "X1" (free text) —
//   the device page reads like a connector/pin list.
//   DeviceImage = { id, src, heading } — a photo of where the PLC physically sits.

let counter = 0
const genPlcId = (prefix) =>
  `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`

// Pin kinds. DI/DO/AI/PWM are the classic I/O classes; FREQ is a frequency /
// pulse-counting input; CANH/CANL/CANSH are CAN-bus pins (high, low, shield) so a
// bus connector's pins can be documented in the registry/CSV too.
export const PIN_KINDS = ['DI', 'DO', 'AI', 'PWM', 'FREQ', 'CANH', 'CANL', 'CANSH']

// Kinds that are CAN-bus pins rather than discrete/analogue I/O — used to keep
// them out of the binding pickers (there is no CAN I/O component to bind them to)
// while still letting them be listed and exported.
export const CAN_KINDS = ['CANH', 'CANL', 'CANSH']

// Which pin kinds a placed I/O component type can bind to. FREQ counts as an
// input class (a frequency/pulse input); CAN pins are not bindable to the basic
// I/O components.
const KINDS_BY_IO_TYPE = {
  plc_input: ['DI', 'AI', 'FREQ'],
  plc_digital_input: ['DI', 'AI', 'FREQ'],
  plc_analog_input: ['DI', 'AI', 'FREQ'],
  plc_output: ['DO', 'PWM'],
  plc_digital_output: ['DO', 'PWM'],
  plc_pwm_output: ['DO', 'PWM'],
}

// The simParams.mode value a pin kind implies on the placed component. FREQ maps
// to the input's Digital mode (it's a pulse-level signal); CAN kinds have no I/O
// mode and default to Digital if ever asked.
const MODE_BY_KIND = {
  DI: 'Digital', AI: 'Analogue', DO: 'Digital', PWM: 'PWM', FREQ: 'Digital',
  CANH: 'Digital', CANL: 'Digital', CANSH: 'Digital',
}

export function createPlcDevice(name = 'PLC 1') {
  return { id: genPlcId('plcdev'), name, location: '', notes: '', images: [], datasheets: [], pins: [] }
}

export function createPlcPin(overrides = {}) {
  const kind = overrides.kind || 'DI'
  return {
    id: genPlcId('plcpin'),
    address: '', name: '', kind,
    capabilities: [kind],   // what the pin *can* do; defaults to its configured kind
    channel: '', connector: '', maxCurrent: '', notes: '',
    ...overrides,
  }
}

// True if `pin` is capable of acting as kind `k` (capabilities, falling back to
// the configured kind for legacy pins that predate the capabilities field).
export function pinIsCapable(pin, k) {
  if (!pin) return false
  const caps = pin.capabilities && pin.capabilities.length ? pin.capabilities : [pin.kind]
  return caps.includes(k)
}

// The Type (`kind`) options a pin may be set to: only the kinds it's *capable* of.
// Always includes the currently-configured kind (so a legacy/odd value stays
// selectable) and falls back to every kind when a pin declares no capabilities.
export function kindOptionsForPin(pin) {
  if (!pin) return PIN_KINDS
  const caps = pin.capabilities && pin.capabilities.length ? pin.capabilities : []
  const opts = caps.length ? PIN_KINDS.filter(k => caps.includes(k)) : [...PIN_KINDS]
  if (pin.kind && !opts.includes(pin.kind)) opts.unshift(pin.kind)
  return opts
}

// A compact one-line label for a pin in the bound-component Pin picker. Surfaces
// the channel + connector (the user asked to see the channel number when picking)
// alongside the address and signal name, e.g. "X1 · I0.0 · CH3 — Start button".
export function pinPickerLabel(pin) {
  if (!pin) return ''
  const head = [pin.connector, pin.address, pin.channel].filter(Boolean).join(' · ')
  return pin.name ? `${head || pin.address || '—'} — ${pin.name}` : (head || pin.address || '—')
}

// ── Immutable device-list edits (mirror the boxBlocks helper style) ─────────

export function addDevice(devices, name) {
  const list = devices || []
  return [...list, createPlcDevice(name ?? `PLC ${list.length + 1}`)]
}

export function updateDevice(devices, deviceId, patch) {
  return (devices || []).map(d => (d.id === deviceId ? { ...d, ...patch } : d))
}

export function removeDevice(devices, deviceId) {
  return (devices || []).filter(d => d.id !== deviceId)
}

export function addPin(devices, deviceId, overrides = {}) {
  return (devices || []).map(d =>
    d.id === deviceId ? { ...d, pins: [...(d.pins || []), createPlcPin(overrides)] } : d
  )
}

export function updatePin(devices, deviceId, pinId, patch) {
  return (devices || []).map(d =>
    d.id === deviceId
      ? { ...d, pins: (d.pins || []).map(p => (p.id === pinId ? { ...p, ...patch } : p)) }
      : d
  )
}

export function removePin(devices, deviceId, pinId) {
  return (devices || []).map(d =>
    d.id === deviceId ? { ...d, pins: (d.pins || []).filter(p => p.id !== pinId) } : d
  )
}

// Move a pin up/down within its device's pin list. `dir` is ±1; out-of-range
// moves are a no-op (the list is returned unchanged).
export function movePin(devices, deviceId, pinId, dir) {
  return (devices || []).map(d => {
    if (d.id !== deviceId) return d
    const pins = [...(d.pins || [])]
    const i = pins.findIndex(p => p.id === pinId)
    const j = i + dir
    if (i < 0 || j < 0 || j >= pins.length) return d
    ;[pins[i], pins[j]] = [pins[j], pins[i]]
    return { ...d, pins }
  })
}

// ── Location photos ─────────────────────────────────────────────────────────

export function addDeviceImage(devices, deviceId, { src, heading = '' }) {
  return (devices || []).map(d =>
    d.id === deviceId
      ? { ...d, images: [...(d.images || []), { id: genPlcId('plcimg'), src, heading }] }
      : d
  )
}

export function updateDeviceImage(devices, deviceId, imageId, patch) {
  return (devices || []).map(d =>
    d.id === deviceId
      ? { ...d, images: (d.images || []).map(im => (im.id === imageId ? { ...im, ...patch } : im)) }
      : d
  )
}

export function removeDeviceImage(devices, deviceId, imageId) {
  return (devices || []).map(d =>
    d.id === deviceId ? { ...d, images: (d.images || []).filter(im => im.id !== imageId) } : d
  )
}

// ── Datasheets / docs ─────────────────────────────────────────────────────────
// Embedded reference documents for a device (datasheet PDF, wiring notes photo,
// etc.). Stored base64 like project attachments: { id, name, mime, data }.

export function addDeviceDatasheet(devices, deviceId, { name, mime, data }) {
  return (devices || []).map(d =>
    d.id === deviceId
      ? { ...d, datasheets: [...(d.datasheets || []), { id: genPlcId('plcds'), name: name || 'document', mime: mime || '', data }] }
      : d
  )
}

export function removeDeviceDatasheet(devices, deviceId, datasheetId) {
  return (devices || []).map(d =>
    d.id === deviceId ? { ...d, datasheets: (d.datasheets || []).filter(ds => ds.id !== datasheetId) } : d
  )
}

// ── Lookups used by the Properties panel ────────────────────────────────────

export function findDevice(devices, deviceId) {
  return (devices || []).find(d => d.id === deviceId) || null
}

// Find a device by its display name (what simParams.device stores, so the
// schematic file stays meaningful without the registry).
export function findDeviceByName(devices, name) {
  if (!name) return null
  return (devices || []).find(d => d.name === name) || null
}

// Pins on `device` that a component of `ioType` can bind to.
export function pinsForIoType(device, ioType) {
  const kinds = KINDS_BY_IO_TYPE[ioType]
  if (!device || !kinds) return []
  return (device.pins || []).filter(p => kinds.includes(p.kind))
}

// simParams.mode implied by a pin kind ('DI' → 'Digital', 'AI' → 'Analogue', …).
export function modeForKind(kind) {
  return MODE_BY_KIND[kind] || 'Digital'
}

// The simParams patch a component should adopt when bound to a device pin —
// the auto-populate at the heart of "define the device once, every DI/DO
// fills itself in".
export function bindingParams(device, pin) {
  if (!device || !pin) return {}
  return {
    device: device.name,
    location: device.location || '',
    address: pin.address || '',
    name: pin.name || '',
    channel: pin.channel || '',
    connector: pin.connector || '',
    maxCurrent: pin.maxCurrent || '',
    notes: pin.notes || '',
    mode: modeForKind(pin.kind),
    pinId: pin.id,          // stable binding key — survives device rename / address edits
  }
}

// The simParam keys that the registry owns once a component is bound to a pin.
// The Properties panel renders these read-only for bound components and resolves
// their live values from the registry via bindingParams (registry is master).
export const REGISTRY_OWNED_KEYS = ['name', 'channel', 'connector', 'maxCurrent', 'location', 'notes', 'mode']

// Write signal-identity fields (name and/or kind) back onto a registry pin found
// by its stable id. Used when the project's signal-master setting is 'schematic'
// so editing a bound symbol's name/IO-type updates the registry (and thereby
// every other symbol bound to the same pin). Pure — returns a new devices array.
export function writeSignalToRegistry(devices, pinId, patch) {
  if (!pinId) return devices
  const { device } = findPinById(devices, pinId)
  if (!device) return devices
  const clean = {}
  if (patch.name != null) clean.name = patch.name
  if (patch.kind != null) {
    clean.kind = patch.kind
    // Keep the new kind in the pin's capability set so it stays selectable.
    const { pin } = findPinById(devices, pinId)
    const caps = (pin?.capabilities && pin.capabilities.length) ? pin.capabilities : (pin ? [pin.kind] : [])
    clean.capabilities = caps.includes(patch.kind) ? caps : [...caps, patch.kind]
  }
  return updatePin(devices, device.id, pinId, clean)
}

// Find a pin (and its owning device) anywhere in the registry by its stable id.
export function findPinById(devices, pinId) {
  if (!pinId) return { device: null, pin: null }
  for (const d of (devices || [])) {
    const pin = (d.pins || []).find(p => p.id === pinId)
    if (pin) return { device: d, pin }
  }
  return { device: null, pin: null }
}

// Resolve the live identity simParams for a placed component, given its current
// simParams (which carry the binding key `pinId`, with `device`+`address` as a
// readable mirror). A bound component takes its registry-owned fields live from
// the registry (registry is master); an unbound/manual one is returned as-is.
// Matching prefers the stable `pinId` so a device rename or address edit doesn't
// silently break the binding. Returns `{ params, device, pin, bound }`.
export function resolveBinding(devices, simParams = {}) {
  let { device, pin } = findPinById(devices, simParams.pinId)
  if (!pin) {
    // Legacy / pre-pinId binding: fall back to device name + pin address.
    device = findDeviceByName(devices, simParams.device)
    pin = device ? (device.pins || []).find(p => p.address === simParams.address) : null
  }
  if (!device || !pin) return { params: simParams, device: null, pin: null, bound: false }
  return { params: { ...simParams, ...bindingParams(device, pin) }, device, pin, bound: true }
}

const PLC_IO_TYPES = new Set(['plc_input', 'plc_output'])

// Write-through re-sync: rewrite the registry-owned simParams of every bound PLC
// component so a registry edit (rename, address/channel/notes/location change)
// shows live on the schematic. Bound components are matched by stable pinId, so
// the binding survives renames. Unbound/manual components are left untouched.
// Pure — returns a new components array (same reference when nothing changed).
export function resyncPlcComponents(components, devices) {
  let changed = false
  const next = (components || []).map(c => {
    if (!c || !PLC_IO_TYPES.has(c.type)) return c
    const sp = c.simParams || {}
    if (!sp.pinId && !sp.device) return c          // never bound
    const { device, pin } = findPinById(devices, sp.pinId)
    if (!device || !pin) return c                  // pin gone → keep last-synced values (manual)
    const patch = bindingParams(device, pin)
    // Skip if nothing actually changed.
    if (REGISTRY_OWNED_KEYS.concat('address', 'device', 'pinId').every(k => sp[k] === patch[k])) return c
    changed = true
    return { ...c, simParams: { ...sp, ...patch } }
  })
  return changed ? next : components
}

// ── Export / grouping ───────────────────────────────────────────────────────

const csvCell = v => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const CSV_HEADER = ['Device', 'Location', 'Connector', 'Address', 'Channel', 'Type', 'Capabilities', 'Max current (A)', 'Signal name', 'Notes']

// Flatten the device registry into a CSV (one row per pin) — a portable
// connector/pin list that opens in Excel or imports into PLC tooling.
export function devicesToCsv(devices) {
  const rows = [CSV_HEADER]
  for (const d of devices || []) {
    for (const p of d.pins || []) {
      rows.push([
        d.name, d.location || '', p.connector || '', p.address || '', p.channel || '',
        p.kind || '', (p.capabilities || [p.kind]).join('/'), p.maxCurrent || '', p.name || '', p.notes || '',
      ])
    }
  }
  return rows.map(r => r.map(csvCell).join(',')).join('\n')
}

// Single-device CSV — used for "download this PLC config" so one device can be
// carried into another project. Same shape as devicesToCsv, scoped to one device.
export function deviceToCsv(device) {
  return devicesToCsv(device ? [device] : [])
}

// Parse CSV text into rows of cells, honouring quoted fields (with ""-escaping)
// and both \n and \r\n line endings. Tolerant: trailing blank lines are dropped.
export function parseCsv(text) {
  const rows = []
  let row = [], cell = '', inQ = false
  const s = String(text ?? '')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inQ) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++ } else inQ = false
      } else cell += ch
    } else if (ch === '"') {
      inQ = true
    } else if (ch === ',') {
      row.push(cell); cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(c => c !== ''))
}

// Build a fresh device registry array from CSV text (the inverse of
// devicesToCsv). Columns are matched by header name, so column order doesn't
// matter and extra columns are ignored. Rows are grouped into devices by the
// Device column (first row of a device also supplies its Location). Capabilities
// are split on / (falling back to the Type). Returns Device[].
export function csvToDevices(text) {
  const rows = parseCsv(text)
  if (!rows.length) return []
  const header = rows[0].map(h => h.trim().toLowerCase())
  const col = name => header.indexOf(name.toLowerCase())
  const ci = {
    device: col('Device'), location: col('Location'), connector: col('Connector'),
    address: col('Address'), channel: col('Channel'), kind: col('Type'),
    caps: col('Capabilities'), maxCurrent: col('Max current (A)'),
    name: col('Signal name'), notes: col('Notes'),
  }
  const at = (r, i) => (i >= 0 && i < r.length ? r[i].trim() : '')
  const byName = new Map()
  const order = []
  for (const r of rows.slice(1)) {
    const devName = at(r, ci.device) || 'PLC 1'
    if (!byName.has(devName)) {
      const dev = createPlcDevice(devName)
      dev.location = at(r, ci.location)
      byName.set(devName, dev)
      order.push(dev)
    }
    const dev = byName.get(devName)
    if (!dev.location && at(r, ci.location)) dev.location = at(r, ci.location)
    const kind = at(r, ci.kind) || 'DI'
    const capsRaw = at(r, ci.caps)
    const capabilities = capsRaw
      ? capsRaw.split(/[/|]/).map(c => c.trim().toUpperCase()).filter(c => PIN_KINDS.includes(c))
      : [kind]
    dev.pins.push(createPlcPin({
      address: at(r, ci.address), channel: at(r, ci.channel), connector: at(r, ci.connector),
      kind: PIN_KINDS.includes(kind.toUpperCase()) ? kind.toUpperCase() : 'DI',
      capabilities: capabilities.length ? capabilities : [kind],
      maxCurrent: at(r, ci.maxCurrent), name: at(r, ci.name), notes: at(r, ci.notes),
    }))
  }
  return order
}

// Lossless single-device round-trip as JSON (keeps device images, which CSV
// drops). Used for "download / upload individual PLC config".
export function deviceToJson(device) {
  return JSON.stringify({ schematicPlcDevice: 1, device }, null, 2)
}

// Parse a device JSON blob (from deviceToJson) back into a device with fresh ids
// so importing into another project never collides with existing ids. Returns a
// Device or null if the blob isn't a recognised single-device export.
export function deviceFromJson(text) {
  let parsed
  try { parsed = JSON.parse(text) } catch { return null }
  const d = parsed?.device || (parsed?.name ? parsed : null)
  if (!d || !d.name) return null
  const device = createPlcDevice(d.name)
  device.location = d.location || ''
  device.notes = d.notes || ''
  device.images = (d.images || []).map(im => ({ id: genPlcId('plcimg'), src: im.src, heading: im.heading || '' }))
  device.datasheets = (d.datasheets || []).map(ds => ({ id: genPlcId('plcds'), name: ds.name || 'document', mime: ds.mime || '', data: ds.data }))
  device.pins = (d.pins || []).map(p => createPlcPin({
    address: p.address || '', name: p.name || '', kind: p.kind || 'DI',
    capabilities: (p.capabilities && p.capabilities.length) ? p.capabilities : [p.kind || 'DI'],
    channel: p.channel || '', connector: p.connector || '', maxCurrent: p.maxCurrent || '', notes: p.notes || '',
  }))
  return migratePlcDevice(device)
}

// Append imported devices to an existing registry, giving each a unique name
// (suffix " (2)", " (3)", …) so importing the same config twice doesn't shadow
// the original. Pure — returns a new array.
export function appendImportedDevices(devices, imported) {
  const out = [...(devices || [])]
  const taken = new Set(out.map(d => d.name))
  for (const dev of imported || []) {
    let name = dev.name
    let n = 2
    while (taken.has(name)) name = `${dev.name} (${n++})`
    taken.add(name)
    out.push(name === dev.name ? dev : { ...dev, name })
  }
  return out
}

// ── Pin ordering ──────────────────────────────────────────────────────────
// The page lets the user re-sort a device's pin list on the fly depending on
// what they're looking for. Modes are pure views over the stored pins; only
// 'manual' reflects the hand-ordered ▲/▼ sequence, so reorder controls show
// only in that mode (the others derive order and would fight the buttons).
export const PIN_SORT_MODES = [
  { id: 'manual', label: 'Manual order' },
  { id: 'connector', label: 'Connector → pin' },
  { id: 'channel', label: 'Channel' },
  { id: 'type', label: 'Type (DI/DO/AI/PWM)' },
]

// Natural compare so "CH2" < "CH10" and "X2" < "X10"; blanks sort last.
function naturalCompare(a, b) {
  const sa = String(a ?? ''), sb = String(b ?? '')
  if (!sa && !sb) return 0
  if (!sa) return 1
  if (!sb) return -1
  return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' })
}

// Return a device's pins ordered by `mode`. Stable: ties keep the stored order.
// 'manual' (and any unknown mode) returns the pins in their stored sequence.
export function sortPins(device, mode = 'manual') {
  const pins = device?.pins || []
  if (mode === 'manual' || !mode) return [...pins]
  const keyed = pins.map((pin, i) => ({ pin, i }))
  const cmp = {
    connector: (a, b) => naturalCompare(a.pin.connector, b.pin.connector),
    channel: (a, b) => naturalCompare(a.pin.channel, b.pin.channel),
    type: (a, b) => PIN_KINDS.indexOf(a.pin.kind) - PIN_KINDS.indexOf(b.pin.kind),
  }[mode]
  if (!cmp) return [...pins]
  keyed.sort((a, b) => cmp(a, b) || a.i - b.i)
  return keyed.map(k => k.pin)
}

// Group a device's pins by connector for the connector-organised page view.
// Preserves the stored pin order within each connector group. Pins with no
// connector fall under the 'Unassigned' bucket (key '').
// Returns an ordered array of { connector, pins } in first-seen order.
export function groupPinsByConnector(device) {
  const groups = []
  const byKey = new Map()
  for (const p of (device?.pins || [])) {
    const key = p.connector || ''
    if (!byKey.has(key)) {
      const g = { connector: key, pins: [] }
      byKey.set(key, g)
      groups.push(g)
    }
    byKey.get(key).pins.push(p)
  }
  return groups
}

// ── Migration ───────────────────────────────────────────────────────────────

// Backfill new fields on a device loaded from an older file — additive, zero
// data loss, so PLC pins set up in a prior release are never disturbed.
export function migratePlcDevice(device) {
  if (!device) return device
  device.images ??= []
  device.notes ??= ''
  device.datasheets ??= []
  for (const p of (device.pins || [])) {
    p.channel ??= ''
    p.connector ??= ''
    p.maxCurrent ??= ''
    p.notes ??= ''
    if (!p.capabilities || !p.capabilities.length) p.capabilities = [p.kind || 'DI']
  }
  return device
}
