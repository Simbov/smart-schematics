import { describe, it, expect } from 'vitest'
import {
  createPlcDevice, createPlcPin,
  addDevice, updateDevice, removeDevice,
  addPin, updatePin, removePin, movePin,
  addDeviceImage, removeDeviceImage,
  findDevice, findDeviceByName, pinsForIoType, modeForKind, bindingParams,
  pinIsCapable, resolveBinding, devicesToCsv, groupPinsByConnector, migratePlcDevice,
  resyncPlcComponents,
  PIN_KINDS,
} from './plcDevices'

describe('PLC device registry model', () => {
  it('creates a device with empty location and pin table', () => {
    const d = createPlcDevice('PLC1')
    expect(d.name).toBe('PLC1')
    expect(d.location).toBe('')
    expect(d.pins).toEqual([])
    expect(d.id).toBeTruthy()
  })

  it('creates pins with unique ids and DI default kind', () => {
    const a = createPlcPin()
    const b = createPlcPin({ address: 'Q0.0', kind: 'DO' })
    expect(a.kind).toBe('DI')
    expect(b.kind).toBe('DO')
    expect(a.id).not.toBe(b.id)
  })

  it('add/update/remove device are immutable list edits', () => {
    const one = addDevice([], 'Main PLC')
    expect(one).toHaveLength(1)

    const renamed = updateDevice(one, one[0].id, { name: 'PLC-A', location: 'Cabinet 1' })
    expect(renamed[0].name).toBe('PLC-A')
    expect(renamed[0].location).toBe('Cabinet 1')
    expect(one[0].name).toBe('Main PLC') // original untouched

    expect(removeDevice(renamed, renamed[0].id)).toEqual([])
  })

  it('auto-names added devices PLC n', () => {
    const two = addDevice(addDevice([]))
    expect(two[0].name).toBe('PLC 1')
    expect(two[1].name).toBe('PLC 2')
  })

  it('add/update/remove pin target only the matching device', () => {
    let devices = addDevice(addDevice([], 'A'), 'B')
    devices = addPin(devices, devices[0].id, { address: 'I0.0', name: 'Start' })
    expect(devices[0].pins).toHaveLength(1)
    expect(devices[1].pins).toHaveLength(0)

    devices = updatePin(devices, devices[0].id, devices[0].pins[0].id, { kind: 'AI' })
    expect(devices[0].pins[0].kind).toBe('AI')

    devices = removePin(devices, devices[0].id, devices[0].pins[0].id)
    expect(devices[0].pins).toHaveLength(0)
  })

  it('finds devices by id and by display name', () => {
    const devices = addDevice([], 'Main PLC')
    expect(findDevice(devices, devices[0].id)).toBe(devices[0])
    expect(findDeviceByName(devices, 'Main PLC')).toBe(devices[0])
    expect(findDeviceByName(devices, 'Nope')).toBeNull()
    expect(findDeviceByName(devices, '')).toBeNull()
  })

  it('filters pins by I/O component type (inputs see DI/AI, outputs see DO/PWM)', () => {
    let devices = addDevice([], 'PLC1')
    const id = devices[0].id
    devices = addPin(devices, id, { address: 'I0.0', kind: 'DI' })
    devices = addPin(devices, id, { address: 'IW64', kind: 'AI' })
    devices = addPin(devices, id, { address: 'Q0.0', kind: 'DO' })
    devices = addPin(devices, id, { address: 'Q0.1', kind: 'PWM' })

    const dev = devices[0]
    expect(pinsForIoType(dev, 'plc_input').map(p => p.address)).toEqual(['I0.0', 'IW64'])
    expect(pinsForIoType(dev, 'plc_output').map(p => p.address)).toEqual(['Q0.0', 'Q0.1'])
    expect(pinsForIoType(null, 'plc_input')).toEqual([])
    expect(pinsForIoType(dev, 'resistor')).toEqual([])
  })

  it('maps every pin kind to a component mode', () => {
    expect(modeForKind('DI')).toBe('Digital')
    expect(modeForKind('DO')).toBe('Digital')
    expect(modeForKind('AI')).toBe('Analogue')
    expect(modeForKind('PWM')).toBe('PWM')
    expect(PIN_KINDS).toEqual(['DI', 'DO', 'AI', 'PWM'])
  })

  it('bindingParams auto-populates device, location, address, name, channel, connector, notes, mode and pinId', () => {
    const device = { ...createPlcDevice('Main PLC'), location: 'Cabinet A' }
    const pin = createPlcPin({ address: 'IW64', name: 'Tank level', kind: 'AI', channel: 'CH3', connector: 'X2', notes: '0–10V' })
    expect(bindingParams(device, pin)).toEqual({
      device: 'Main PLC',
      location: 'Cabinet A',
      address: 'IW64',
      name: 'Tank level',
      channel: 'CH3',
      connector: 'X2',
      notes: '0–10V',
      mode: 'Analogue',
      pinId: pin.id,
    })
    expect(bindingParams(null, pin)).toEqual({})
    expect(bindingParams(device, null)).toEqual({})
  })

  it('resolveBinding survives a device rename by matching the stable pinId', () => {
    let devices = addDevice([], 'PLC1')
    const id = devices[0].id
    devices = addPin(devices, id, { address: 'I0.0', name: 'Start', kind: 'DI' })
    const pinId = devices[0].pins[0].id
    // Component was bound, then the device got renamed in the registry.
    devices = updateDevice(devices, id, { name: 'PLC-A' })
    const r = resolveBinding(devices, { device: 'PLC1', address: 'I0.0', pinId, name: 'STALE' })
    expect(r.bound).toBe(true)
    expect(r.params.device).toBe('PLC-A')  // rewritten from the registry
    expect(r.params.name).toBe('Start')
  })

  it('new pins default capabilities to their configured kind', () => {
    expect(createPlcPin({ kind: 'DO' }).capabilities).toEqual(['DO'])
    const pin = createPlcPin({ kind: 'DO', capabilities: ['DO', 'PWM'] })
    expect(pinIsCapable(pin, 'PWM')).toBe(true)
    expect(pinIsCapable(pin, 'AI')).toBe(false)
    // legacy pin with no capabilities falls back to its kind
    expect(pinIsCapable({ kind: 'AI' }, 'AI')).toBe(true)
  })

  it('movePin reorders within a device and clamps at the ends', () => {
    let devices = addDevice([], 'PLC1')
    const id = devices[0].id
    devices = addPin(devices, id, { address: 'A' })
    devices = addPin(devices, id, { address: 'B' })
    devices = addPin(devices, id, { address: 'C' })
    const [a, b] = devices[0].pins
    devices = movePin(devices, id, b.id, -1)
    expect(devices[0].pins.map(p => p.address)).toEqual(['B', 'A', 'C'])
    // moving the first up is a no-op
    devices = movePin(devices, id, devices[0].pins[0].id, -1)
    expect(devices[0].pins.map(p => p.address)).toEqual(['B', 'A', 'C'])
    // moving the last down is a no-op
    devices = movePin(devices, id, devices[0].pins[2].id, 1)
    expect(devices[0].pins.map(p => p.address)).toEqual(['B', 'A', 'C'])
  })

  it('add/remove device images target the matching device', () => {
    let devices = addDevice([], 'PLC1')
    const id = devices[0].id
    devices = addDeviceImage(devices, id, { src: 'data:img', heading: 'Cabinet' })
    expect(devices[0].images).toHaveLength(1)
    expect(devices[0].images[0].heading).toBe('Cabinet')
    devices = removeDeviceImage(devices, id, devices[0].images[0].id)
    expect(devices[0].images).toHaveLength(0)
  })

  it('resolveBinding pulls registry values for a bound component, leaves manual ones untouched', () => {
    let devices = addDevice([], 'Main PLC')
    const id = devices[0].id
    devices = updateDevice(devices, id, { location: 'Cabinet A' })
    devices = addPin(devices, id, { address: 'I0.0', name: 'Start', kind: 'DI', channel: 'CH1' })

    const bound = resolveBinding(devices, { device: 'Main PLC', address: 'I0.0', name: 'STALE' })
    expect(bound.bound).toBe(true)
    expect(bound.params.name).toBe('Start')     // registry wins
    expect(bound.params.channel).toBe('CH1')
    expect(bound.params.location).toBe('Cabinet A')

    const manual = resolveBinding(devices, { device: '', address: 'X', name: 'Hand typed' })
    expect(manual.bound).toBe(false)
    expect(manual.params.name).toBe('Hand typed')
  })

  it('devicesToCsv emits one header + one row per pin, quoting commas', () => {
    let devices = addDevice([], 'PLC1')
    const id = devices[0].id
    devices = updateDevice(devices, id, { location: 'Cab, A' })
    devices = addPin(devices, id, { address: 'I0.0', name: 'Start', kind: 'DI', connector: 'X1', channel: 'CH1' })
    const csv = devicesToCsv(devices)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Device,Location,Connector,Address,Channel,Type,Capabilities,Signal name,Notes')
    expect(lines[1]).toContain('"Cab, A"')
    expect(lines[1]).toContain('I0.0')
    expect(lines).toHaveLength(2)
  })

  it('groupPinsByConnector buckets pins by connector preserving order', () => {
    let devices = addDevice([], 'PLC1')
    const id = devices[0].id
    devices = addPin(devices, id, { address: 'A', connector: 'X1' })
    devices = addPin(devices, id, { address: 'B', connector: 'X2' })
    devices = addPin(devices, id, { address: 'C', connector: 'X1' })
    devices = addPin(devices, id, { address: 'D' }) // unassigned
    const groups = groupPinsByConnector(devices[0])
    expect(groups.map(g => g.connector)).toEqual(['X1', 'X2', ''])
    expect(groups[0].pins.map(p => p.address)).toEqual(['A', 'C'])
  })

  it('resyncPlcComponents rewrites bound components and leaves manual/non-PLC ones alone', () => {
    let devices = addDevice([], 'PLC1')
    const id = devices[0].id
    devices = addPin(devices, id, { address: 'I0.0', name: 'Start', kind: 'DI', channel: 'CH1' })
    const pinId = devices[0].pins[0].id

    const boundComp = { id: 'c1', type: 'plc_input', simParams: { device: 'PLC1', address: 'I0.0', pinId, name: 'OLD', channel: 'OLD' } }
    const manualComp = { id: 'c2', type: 'plc_input', simParams: { device: '', address: 'X', name: 'Manual' } }
    const resistor = { id: 'c3', type: 'resistor', simParams: {} }

    // Rename the device + change the pin's signal name in the registry.
    devices = updateDevice(devices, id, { name: 'PLC-A' })
    devices = updatePin(devices, id, pinId, { name: 'Run', channel: 'CH9' })

    const next = resyncPlcComponents([boundComp, manualComp, resistor], devices)
    expect(next[0].simParams.name).toBe('Run')      // pulled from registry
    expect(next[0].simParams.channel).toBe('CH9')
    expect(next[0].simParams.device).toBe('PLC-A')  // rename propagated
    expect(next[1]).toBe(manualComp)                // manual untouched (same ref)
    expect(next[2]).toBe(resistor)                  // non-PLC untouched
  })

  it('migratePlcDevice backfills new fields without disturbing existing pin data', () => {
    const legacy = { id: 'd1', name: 'Old PLC', location: 'Cab', pins: [
      { id: 'p1', address: 'I0.0', name: 'Start', kind: 'DI' },
    ] }
    const migrated = migratePlcDevice(legacy)
    expect(migrated.images).toEqual([])
    expect(migrated.pins[0].capabilities).toEqual(['DI'])
    expect(migrated.pins[0].channel).toBe('')
    expect(migrated.pins[0].connector).toBe('')
    expect(migrated.pins[0].address).toBe('I0.0') // untouched
    expect(migrated.pins[0].name).toBe('Start')
  })
})
