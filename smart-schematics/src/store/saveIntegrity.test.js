import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import useSchematicStore from './schematicStore'

// The node test env ships a read-only localStorage without a writable setItem,
// so we install a simple in-memory mock we can control (and make throw).
function installMockLocalStorage() {
  const map = new Map()
  const mock = {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, val) => { map.set(key, String(val)) },
    removeItem: key => { map.delete(key) },
    clear: () => map.clear(),
  }
  vi.stubGlobal('localStorage', mock)
  return mock
}

// Stage 7: save integrity. In browser/localStorage mode (the test env — not
// Tauri), saveAll must:
//   - persist a serializable project and mark drawings clean, and
//   - on a serialization/write failure, surface a warning and NOT mark drawings
//     clean (so the in-memory good state is preserved and not silently lost).

const store = () => useSchematicStore.getState()
const activeDrawing = () => {
  const s = store()
  return s.drawings.find(d => d.id === s.activeDrawingId)
}

describe('Stage 7 — saveAll integrity (browser/localStorage path)', () => {
  let ls
  beforeEach(() => {
    ls = installMockLocalStorage()
    store().newProject('Save Project')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('writes to localStorage and clears isDirty on success', async () => {
    // Mark dirty via a normal mutation.
    const did = store().activeDrawingId
    store().addImage(did, { id: 'i1', src: 'data:image/png;base64,AAAA', x: 0, y: 0, width: 10, height: 10 })
    expect(activeDrawing().isDirty).toBe(true)

    const ok = await store().saveAll()
    expect(ok).toBe(true)
    expect(activeDrawing().isDirty).toBe(false)
    expect(localStorage.getItem('schematic_projects')).toBeTruthy()
    const stored = JSON.parse(localStorage.getItem('schematic_projects'))
    expect(stored.version).toBe(3)
  })

  it('does not mark drawings clean when the write throws', async () => {
    const did = store().activeDrawingId
    store().addImage(did, { id: 'i2', src: 'data:image/png;base64,AAAA', x: 0, y: 0, width: 10, height: 10 })
    expect(activeDrawing().isDirty).toBe(true)

    const spy = vi.spyOn(ls, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    const alertMock = vi.fn()
    vi.stubGlobal('alert', alertMock)

    const ok = await store().saveAll()

    expect(ok).toBe(false)
    expect(alertMock).toHaveBeenCalled()
    // Crucially: the drawing stays dirty so the user's data is not considered saved.
    expect(activeDrawing().isDirty).toBe(true)

    spy.mockRestore()
  })
})

describe('Stage 7 — load-time sanitization via importProjectJSON', () => {
  beforeEach(() => {
    store().newProject('Sanitize Project')
  })

  it('drops a corrupt image on import but keeps good content', () => {
    const json = JSON.stringify({
      version: 3,
      name: 'Corrupt',
      drawingIds: ['d1'],
      activeDrawingId: 'd1',
      drawings: [{
        id: 'd1',
        name: 'D',
        type: 'electrical',
        components: [],
        wires: [],
        junctions: [],
        annotations: [],
        images: [
          { id: 'good', src: 'data:image/png;base64,AAAA', x: 0, y: 0, width: 10, height: 10 },
          { id: 'bad' }, // missing src — must be dropped
        ],
        titleBlock: { title: 'D', visible: false },
        viewState: { panX: 0, panY: 0, zoom: 1 },
      }],
    })

    expect(() => store().importProjectJSON(json)).not.toThrow()
    const d = activeDrawing()
    expect(d.images).toHaveLength(1)
    expect(d.images[0].id).toBe('good')
  })
})
