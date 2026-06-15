import { describe, it, expect, beforeEach } from 'vitest'
import useSchematicStore from './schematicStore'
import { createPlcDevice, createPlcPin } from '../lib/plcDevices'

// Regression guard for the reported "PLC config gets deleted across updates" bug.
// The fix is structural: plcDevices ride along in _buildProjectSnapshot and are
// backfilled by migrateProject/migratePlcDevice on every load path. These tests
// lock that round-trip down so a future change can never silently drop the
// registry (or any pin field) again.

const store = () => useSchematicStore.getState()
const activeProject = () => {
  const s = store()
  return s.projects.find(p => p.id === s.activeProjectId)
}

// Round-trip the active project exactly the way persistence does: build a
// snapshot, serialize, parse, re-import as a fresh project (runs through
// sanitizeLoadedProject + migrateProject). Returns the reloaded project.
function roundTrip() {
  const snapshot = store()._buildProjectSnapshot()
  const json = JSON.stringify(snapshot, null, 2)
  store().importProjectJSON(json)
  return activeProject()
}

describe('PLC registry persistence', () => {
  beforeEach(() => {
    store().newProject('PLC Persistence')
  })

  it('survives a full snapshot → stringify → reload round-trip', () => {
    const dev = createPlcDevice('PLC1')
    dev.location = 'Cabinet A'
    dev.pins = [
      createPlcPin({ address: 'I0.0', name: 'Start', kind: 'DI', channel: 'CH1', connector: 'X1', maxCurrent: '0.5' }),
      createPlcPin({ address: 'Q0.1', name: 'Lamp', kind: 'DO', capabilities: ['DO', 'PWM'], connector: 'X2', maxCurrent: '2' }),
    ]
    store().setPlcDevices([dev])

    const p = roundTrip()
    expect(p.plcDevices).toHaveLength(1)
    const loaded = p.plcDevices[0]
    expect(loaded.name).toBe('PLC1')
    expect(loaded.location).toBe('Cabinet A')
    expect(loaded.pins).toHaveLength(2)

    const [a, b] = loaded.pins
    expect(a).toMatchObject({ address: 'I0.0', name: 'Start', kind: 'DI', channel: 'CH1', connector: 'X1', maxCurrent: '0.5' })
    expect(b).toMatchObject({ address: 'Q0.1', kind: 'DO', connector: 'X2', maxCurrent: '2' })
    expect(b.capabilities).toEqual(['DO', 'PWM'])
  })

  it('backfills plcDevices: [] on a project that predates the registry', () => {
    // A v4 project JSON with NO plcDevices key at all (old file).
    const legacy = JSON.stringify({
      version: 4,
      id: 'p_old', name: 'Old', drawingIds: ['d_old'], activeDrawingId: 'd_old',
      folders: [], attachments: [],
      drawings: [{
        id: 'd_old', name: 'D', type: 'electrical',
        components: [], wires: [], junctions: [], annotations: [],
        titleBlock: { visible: false }, viewState: { panX: 0, panY: 0, zoom: 1 },
        isDirty: false, lastSaved: null,
      }],
    })
    expect(() => store().importProjectJSON(legacy)).not.toThrow()
    expect(activeProject().plcDevices).toEqual([])
  })

  it('migrates a device/pin saved before the new pin fields existed', () => {
    // A device whose pins predate capabilities/channel/connector/maxCurrent.
    const legacy = JSON.stringify({
      version: 4,
      id: 'p_legacy_dev', name: 'Legacy Dev', drawingIds: ['d1'], activeDrawingId: 'd1',
      folders: [], attachments: [],
      plcDevices: [{
        id: 'dev1', name: 'PLC', location: 'Panel',
        pins: [{ id: 'pin1', address: 'I0.0', name: 'Run', kind: 'DI', notes: '' }],
      }],
      drawings: [{
        id: 'd1', name: 'D', type: 'electrical',
        components: [], wires: [], junctions: [], annotations: [],
        titleBlock: { visible: false }, viewState: { panX: 0, panY: 0, zoom: 1 },
        isDirty: false, lastSaved: null,
      }],
    })
    store().importProjectJSON(legacy)
    const pin = activeProject().plcDevices[0].pins[0]
    expect(pin.capabilities).toEqual(['DI'])   // defaults to its configured kind
    expect(pin.channel).toBe('')
    expect(pin.connector).toBe('')
    expect(pin.maxCurrent).toBe('')
    expect(activeProject().plcDevices[0].images).toEqual([])
  })
})
