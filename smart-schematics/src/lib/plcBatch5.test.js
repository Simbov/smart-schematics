import { describe, it, expect } from 'vitest'
import {
  createPlcDevice, createPlcPin, addPin, updatePin,
  kindOptionsForPin, pinPickerLabel,
  devicesToCsv, deviceToCsv, csvToDevices, parseCsv,
  deviceToJson, deviceFromJson, appendImportedDevices,
  writeSignalToRegistry, findPinById,
  addDeviceDatasheet, removeDeviceDatasheet, migratePlcDevice,
  PIN_KINDS, CAN_KINDS,
} from './plcDevices'

describe('B1 — kindOptionsForPin restricts to capable kinds', () => {
  it('lists only the pin capabilities', () => {
    const pin = createPlcPin({ kind: 'DO', capabilities: ['DO', 'PWM'] })
    expect(kindOptionsForPin(pin)).toEqual(['DO', 'PWM'])
  })
  it('falls back to all kinds when no capabilities declared', () => {
    const pin = createPlcPin({ kind: 'DI', capabilities: [] })
    expect(kindOptionsForPin(pin)).toEqual(PIN_KINDS)
  })
  it('always keeps the configured kind selectable', () => {
    const pin = { kind: 'AI', capabilities: ['DO'] }
    expect(kindOptionsForPin(pin)).toContain('AI')
  })
})

describe('B2 — pinPickerLabel shows connector/channel', () => {
  it('joins connector · address · channel — name', () => {
    const pin = createPlcPin({ connector: 'X1', address: 'I0.0', channel: 'CH3', name: 'Start' })
    expect(pinPickerLabel(pin)).toBe('X1 · I0.0 · CH3 — Start')
  })
  it('omits blanks and the name dash when unnamed', () => {
    const pin = createPlcPin({ address: 'Q0.1' })
    expect(pinPickerLabel(pin)).toBe('Q0.1')
  })
})

describe('B5 — extended pin kinds', () => {
  it('includes FREQ and the CAN bus pins', () => {
    expect(PIN_KINDS).toEqual(expect.arrayContaining(['FREQ', 'CANH', 'CANL', 'CANSH']))
    expect(CAN_KINDS).toEqual(['CANH', 'CANL', 'CANSH'])
  })
})

describe('B6 — CSV/JSON device import-export round-trips', () => {
  function sampleDevices() {
    let d = createPlcDevice('PLC1')
    d.location = 'Cabinet A'
    let devs = [d]
    devs = addPin(devs, d.id, { address: 'I0.0', channel: 'CH1', connector: 'X1', kind: 'DI', capabilities: ['DI', 'AI'], name: 'Start', maxCurrent: '', notes: 'n1' })
    devs = addPin(devs, d.id, { address: 'Q0.0', channel: 'CH2', connector: 'X2', kind: 'PWM', capabilities: ['DO', 'PWM'], name: 'Pump', maxCurrent: '2', notes: '' })
    return devs
  }

  it('parseCsv handles quoted cells with commas', () => {
    const rows = parseCsv('a,"b,c",d\n1,2,3')
    expect(rows[0]).toEqual(['a', 'b,c', 'd'])
    expect(rows[1]).toEqual(['1', '2', '3'])
  })

  it('csvToDevices(devicesToCsv(d)) preserves pin fields', () => {
    const devs = sampleDevices()
    const back = csvToDevices(devicesToCsv(devs))
    expect(back).toHaveLength(1)
    expect(back[0].name).toBe('PLC1')
    expect(back[0].location).toBe('Cabinet A')
    expect(back[0].pins).toHaveLength(2)
    const p = back[0].pins[1]
    expect(p.address).toBe('Q0.0')
    expect(p.channel).toBe('CH2')
    expect(p.connector).toBe('X2')
    expect(p.kind).toBe('PWM')
    expect(p.capabilities).toEqual(['DO', 'PWM'])
    expect(p.maxCurrent).toBe('2')
    expect(p.name).toBe('Pump')
  })

  it('single-device CSV exports just that device', () => {
    const devs = sampleDevices()
    const back = csvToDevices(deviceToCsv(devs[0]))
    expect(back).toHaveLength(1)
    expect(back[0].pins).toHaveLength(2)
  })

  it('JSON round-trip keeps device images (lossless)', () => {
    let devs = sampleDevices()
    devs[0].images = [{ id: 'x', src: 'data:image/png;base64,AAAA', heading: 'front' }]
    const back = deviceFromJson(deviceToJson(devs[0]))
    expect(back.images).toHaveLength(1)
    expect(back.images[0].src).toBe('data:image/png;base64,AAAA')
    expect(back.pins).toHaveLength(2)
  })

  it('appendImportedDevices de-dupes names', () => {
    const devs = sampleDevices()
    const out = appendImportedDevices(devs, [createPlcDevice('PLC1')])
    expect(out).toHaveLength(2)
    expect(out[1].name).toBe('PLC1 (2)')
  })
})

describe('B4 — writeSignalToRegistry', () => {
  it('writes name back to the registry pin', () => {
    let d = createPlcDevice('PLC1')
    let devs = addPin([d], d.id, { address: 'I0.0', kind: 'DI', name: 'old' })
    const pinId = devs[0].pins[0].id
    const next = writeSignalToRegistry(devs, pinId, { name: 'new' })
    expect(findPinById(next, pinId).pin.name).toBe('new')
  })
  it('writing a kind adds it to capabilities', () => {
    let d = createPlcDevice('PLC1')
    let devs = addPin([d], d.id, { address: 'I0.0', kind: 'DI', capabilities: ['DI'] })
    const pinId = devs[0].pins[0].id
    const next = writeSignalToRegistry(devs, pinId, { kind: 'AI' })
    const pin = findPinById(next, pinId).pin
    expect(pin.kind).toBe('AI')
    expect(pin.capabilities).toContain('AI')
  })
})

describe('B7 — device datasheets + notes', () => {
  it('migratePlcDevice backfills notes + datasheets', () => {
    const legacy = { id: 'd', name: 'PLC', pins: [] }
    const m = migratePlcDevice(legacy)
    expect(m.notes).toBe('')
    expect(m.datasheets).toEqual([])
  })
  it('add/remove datasheet helpers', () => {
    let d = createPlcDevice('PLC1')
    let devs = addDeviceDatasheet([d], d.id, { name: 'sheet.pdf', mime: 'application/pdf', data: 'data:application/pdf;base64,AA' })
    expect(devs[0].datasheets).toHaveLength(1)
    const dsId = devs[0].datasheets[0].id
    devs = removeDeviceDatasheet(devs, d.id, dsId)
    expect(devs[0].datasheets).toHaveLength(0)
  })
})
