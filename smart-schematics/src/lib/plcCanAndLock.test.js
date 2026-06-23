import { describe, it, expect } from 'vitest'
import {
  kindsForIoType, modeForKind, pinsForIoType,
  deviceConfigOnSchematic, migratePlcDevice, createPlcDevice,
} from './plcDevices'

describe('PLC CAN block binding (issue #31)', () => {
  it('plc_can binds to CAN-bus pin kinds', () => {
    expect(kindsForIoType('plc_can')).toEqual(['CANH', 'CANL', 'CANSH'])
  })

  it('CAN pin kinds map to the CAN line mode', () => {
    expect(modeForKind('CANH')).toBe('CAN High')
    expect(modeForKind('CANL')).toBe('CAN Low')
  })

  it('only CAN-capable pins are offered to a plc_can block', () => {
    const device = {
      pins: [
        { id: 'p1', kind: 'DI', capabilities: ['DI'] },
        { id: 'p2', kind: 'CANH', capabilities: ['CANH'] },
        { id: 'p3', kind: 'CANL', capabilities: ['CANL'] },
      ],
    }
    expect(pinsForIoType(device, 'plc_can').map(p => p.id)).toEqual(['p2', 'p3'])
  })
})

describe('Per-device config lock (issue #30)', () => {
  it('defaults to inheriting the project signal master', () => {
    const dev = createPlcDevice('PLC1')
    expect(dev.signalMaster).toBe('inherit')
    expect(deviceConfigOnSchematic(dev, 'schematic')).toBe(true)
    expect(deviceConfigOnSchematic(dev, 'registry')).toBe(false)
  })

  it('a per-device override wins over the project default', () => {
    expect(deviceConfigOnSchematic({ signalMaster: 'schematic' }, 'registry')).toBe(true)
    expect(deviceConfigOnSchematic({ signalMaster: 'registry' }, 'schematic')).toBe(false)
  })

  it('migration backfills signalMaster on legacy devices', () => {
    const dev = migratePlcDevice({ name: 'old', pins: [] })
    expect(dev.signalMaster).toBe('inherit')
  })
})
