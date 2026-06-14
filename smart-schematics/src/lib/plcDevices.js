// PLC device registry — pure model helpers (no DOM, no store).
//
// A project can define its PLC hardware once: each device has a name, a
// location, and a pin table. Placed PLC I/O components (plc_input/plc_output)
// can then pick a device + pin address and auto-populate their signal name,
// mode, device and location from the registry instead of retyping them.
//
//   Device: { id, name, location, images: DeviceImage[], pins: Pin[] }
//   Pin:    { id, address, name, kind, capabilities, channel, connector, notes }
//   kind ∈ 'DI' | 'DO' | 'AI' | 'PWM'  — what the pin is *configured* as.
//   capabilities ⊆ PIN_KINDS — what the pin *can* do (e.g. PWM-capable but set DO).
//   channel = logical channel name, e.g. "CH1" (free text).
//   connector = which physical plug the pin sits on, e.g. "X1" (free text) —
//   the device page reads like a connector/pin list.
//   DeviceImage = { id, src, heading } — a photo of where the PLC physically sits.

let counter = 0
const genPlcId = (prefix) =>
  `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`

export const PIN_KINDS = ['DI', 'DO', 'AI', 'PWM']

// Which pin kinds a placed I/O component type can bind to.
const KINDS_BY_IO_TYPE = {
  plc_input: ['DI', 'AI'],
  plc_digital_input: ['DI', 'AI'],
  plc_analog_input: ['DI', 'AI'],
  plc_output: ['DO', 'PWM'],
  plc_digital_output: ['DO', 'PWM'],
  plc_pwm_output: ['DO', 'PWM'],
}

// The simParams.mode value a pin kind implies on the placed component.
const MODE_BY_KIND = { DI: 'Digital', AI: 'Analogue', DO: 'Digital', PWM: 'PWM' }

export function createPlcDevice(name = 'PLC 1') {
  return { id: genPlcId('plcdev'), name, location: '', images: [], pins: [] }
}

export function createPlcPin(overrides = {}) {
  const kind = overrides.kind || 'DI'
  return {
    id: genPlcId('plcpin'),
    address: '', name: '', kind,
    capabilities: [kind],   // what the pin *can* do; defaults to its configured kind
    channel: '', connector: '', notes: '',
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
    notes: pin.notes || '',
    mode: modeForKind(pin.kind),
    pinId: pin.id,          // stable binding key — survives device rename / address edits
  }
}

// The simParam keys that the registry owns once a component is bound to a pin.
// The Properties panel renders these read-only for bound components and resolves
// their live values from the registry via bindingParams (registry is master).
export const REGISTRY_OWNED_KEYS = ['name', 'channel', 'connector', 'location', 'notes', 'mode']

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

// Flatten the device registry into a CSV (one row per pin) — a portable
// connector/pin list that opens in Excel or imports into PLC tooling.
export function devicesToCsv(devices) {
  const header = ['Device', 'Location', 'Connector', 'Address', 'Channel', 'Type', 'Capabilities', 'Signal name', 'Notes']
  const rows = [header]
  for (const d of devices || []) {
    for (const p of d.pins || []) {
      rows.push([
        d.name, d.location || '', p.connector || '', p.address || '', p.channel || '',
        p.kind || '', (p.capabilities || [p.kind]).join('/'), p.name || '', p.notes || '',
      ])
    }
  }
  return rows.map(r => r.map(csvCell).join(',')).join('\n')
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
  for (const p of (device.pins || [])) {
    p.channel ??= ''
    p.connector ??= ''
    p.notes ??= ''
    if (!p.capabilities || !p.capabilities.length) p.capabilities = [p.kind || 'DI']
  }
  return device
}
