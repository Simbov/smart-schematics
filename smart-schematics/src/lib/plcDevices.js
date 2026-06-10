// PLC device registry — pure model helpers (no DOM, no store).
//
// A project can define its PLC hardware once: each device has a name, a
// location, and a pin table. Placed PLC I/O components (plc_input/plc_output)
// can then pick a device + pin address and auto-populate their signal name,
// mode, device and location from the registry instead of retyping them.
//
//   Device: { id, name, location, pins: Pin[] }
//   Pin:    { id, address, name, kind, connector, notes }
//   kind ∈ 'DI' | 'DO' | 'AI' | 'PWM'
//   connector = which physical plug the pin sits on, e.g. "X1" (free text) —
//   the device page reads like a connector/pin list.

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
  return { id: genPlcId('plcdev'), name, location: '', pins: [] }
}

export function createPlcPin(overrides = {}) {
  return { id: genPlcId('plcpin'), address: '', name: '', kind: 'DI', connector: '', notes: '', ...overrides }
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
    mode: modeForKind(pin.kind),
  }
}
