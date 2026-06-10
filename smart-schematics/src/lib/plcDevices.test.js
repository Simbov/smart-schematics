import { describe, it, expect } from 'vitest'
import {
  createPlcDevice, createPlcPin,
  addDevice, updateDevice, removeDevice,
  addPin, updatePin, removePin,
  findDevice, findDeviceByName, pinsForIoType, modeForKind, bindingParams,
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

  it('bindingParams auto-populates device, location, address, name and mode', () => {
    const device = { ...createPlcDevice('Main PLC'), location: 'Cabinet A' }
    const pin = createPlcPin({ address: 'IW64', name: 'Tank level', kind: 'AI' })
    expect(bindingParams(device, pin)).toEqual({
      device: 'Main PLC',
      location: 'Cabinet A',
      address: 'IW64',
      name: 'Tank level',
      mode: 'Analogue',
    })
    expect(bindingParams(null, pin)).toEqual({})
    expect(bindingParams(device, null)).toEqual({})
  })
})
