import { describe, it, expect, beforeEach } from 'vitest'
import useSchematicStore from './schematicStore'

// Stage 1: schema & serialization foundation.
// Verifies that the new per-drawing/per-project fields (images, folders,
// attachments, box components) migrate cleanly off old files and survive a full
// build-snapshot → stringify → parse → reload round-trip.

const PNG_SRC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const PDF_DATA = 'JVBERi0xLjQKJeLjz9MKMyAwIG9iago=' // arbitrary base64 blob

const store = () => useSchematicStore.getState()
const activeProject = () => {
  const s = store()
  return s.projects.find(p => p.id === s.activeProjectId)
}
const activeDrawing = () => {
  const s = store()
  return s.drawings.find(d => d.id === s.activeDrawingId)
}

// Round-trip the active project the way persistence does: build a snapshot,
// serialize, parse, then re-import it as a fresh project. Returns the freshly
// loaded project + its drawings.
function roundTrip() {
  const snapshot = store()._buildProjectSnapshot()
  const json = JSON.stringify(snapshot, null, 2)
  store().importProjectJSON(json)
  return { project: activeProject(), drawing: activeDrawing(), snapshot: JSON.parse(json) }
}

describe('Stage 1 — v2 → v3 migration', () => {
  it('backfills empty defaults on a v2 file and does not throw', () => {
    // A realistic v2 project: no images / folders / attachments / folderId.
    const v2 = JSON.stringify({
      version: 2,
      id: 'p_legacy',
      name: 'Legacy Project',
      drawingIds: ['d_legacy'],
      activeDrawingId: 'd_legacy',
      drawings: [{
        id: 'd_legacy',
        name: 'Legacy Drawing',
        type: 'electrical',
        components: [],
        wires: [],
        junctions: [],
        annotations: [],
        titleBlock: { title: 'Legacy', visible: false },
        viewState: { panX: 0, panY: 0, zoom: 1 },
        isDirty: false,
        lastSaved: null,
      }],
    })

    expect(() => store().importProjectJSON(v2)).not.toThrow()

    const p = activeProject()
    expect(p.folders).toEqual([])
    expect(p.attachments).toEqual([])

    const d = activeDrawing()
    expect(d.images).toEqual([])
    expect(d.folderId).toBeNull()
  })

  it('builds snapshots at version 3', () => {
    store().newProject('V3 Project')
    expect(store()._buildProjectSnapshot().version).toBe(3)
  })
})

describe('Stage 1 — image round-trip', () => {
  it('preserves an image (incl. base64 src) byte-for-byte through a snapshot', () => {
    store().newProject('Img Project')
    const did = store().activeDrawingId
    store().addImage(did, {
      id: 'image_a', src: PNG_SRC,
      x: 40, y: 80, width: 120, height: 90,
      rotation: 90, opacity: 0.75, locked: true,
    })

    const before = activeDrawing().images[0]
    const { drawing } = roundTrip()
    const after = drawing.images.find(img => img.id === 'image_a')

    expect(after).toEqual(before)
    expect(after.src).toBe(PNG_SRC)
  })
})

describe('Stage 1 — folder CRUD', () => {
  beforeEach(() => {
    store().newProject('Folder Project')
  })

  it('creates nested folders, moves a drawing in, and re-parents on delete', () => {
    const did = store().activeDrawingId
    const parent = store().addFolder('Parent', null)
    const child = store().addFolder('Child', parent)

    expect(activeProject().folders).toHaveLength(2)
    expect(activeProject().folders.find(f => f.id === child).parentId).toBe(parent)

    store().moveDrawingToFolder(did, child)
    expect(activeDrawing().folderId).toBe(child)

    // Deleting the parent removes the parent + descendant child and re-parents
    // any drawing that lived in either to root (folderId = null).
    store().deleteFolder(parent)
    expect(activeProject().folders).toHaveLength(0)
    expect(activeDrawing().folderId).toBeNull()
  })

  it('round-trips folders and a drawing.folderId through a snapshot', () => {
    const did = store().activeDrawingId
    const f = store().addFolder('Schematics', null)
    store().moveDrawingToFolder(did, f)

    const { project, drawing } = roundTrip()
    expect(project.folders).toEqual([{ id: f, name: 'Schematics', parentId: null }])
    expect(drawing.folderId).toBe(f)
  })

  it('renameFolder updates the name', () => {
    const f = store().addFolder('Old', null)
    store().renameFolder(f, 'New')
    expect(activeProject().folders.find(x => x.id === f).name).toBe('New')
  })
})

describe('Stage 1 — attachment round-trip', () => {
  beforeEach(() => {
    store().newProject('Attach Project')
  })

  it('adds a base64 attachment with metadata', () => {
    const id = store().addAttachment({ name: 'datasheet.pdf', mime: 'application/pdf', data: PDF_DATA })
    const att = activeProject().attachments[0]
    expect(att.id).toBe(id)
    expect(att.data).toBe(PDF_DATA)
    expect(att.name).toBe('datasheet.pdf')
    expect(att.mime).toBe('application/pdf')
    expect(typeof att.addedAt).toBe('number')
  })

  it('round-trips an attachment base64 payload through a snapshot', () => {
    const id = store().addAttachment({ name: 'notes.txt', mime: 'text/plain', data: PDF_DATA })
    const { project } = roundTrip()
    const restored = project.attachments.find(a => a.id === id)
    expect(restored.data).toBe(PDF_DATA)
  })

  it('removeAttachment drops it from the project', () => {
    const id = store().addAttachment({ name: 'x.bin', mime: 'application/octet-stream', data: PDF_DATA })
    expect(activeProject().attachments).toHaveLength(1)
    store().removeAttachment(id)
    expect(activeProject().attachments).toHaveLength(0)
  })
})

describe('Stage 1 — box component round-trip', () => {
  it('preserves a type:box component with its box payload + pins', () => {
    store().newProject('Box Project')
    const did = store().activeDrawingId
    const boxComp = {
      id: 'box_1',
      type: 'box',
      designator: 'U1',
      value: '',
      description: '',
      x: 100, y: 100,
      rotation: 0, flipH: false, flipV: false,
      box: {
        width: 80, height: 60,
        doc: { align: 'left', paragraphs: [{ runs: [{ text: 'MCU' }] }] },
        fill: '#eef', stroke: '#333', cornerRadius: 4,
      },
      pins: [
        { id: 'P1', relX: -40, relY: 0, absX: 60, absY: 100, direction: 'W' },
        { id: 'P2', relX: 40, relY: 0, absX: 140, absY: 100, direction: 'E' },
      ],
      simParams: {},
      simState: {},
      labelOffset: { x: 0, y: -15 },
    }
    // Place directly on the drawing (Stage 5 builds the real factory/tool).
    useSchematicStore.setState(s => ({
      drawings: s.drawings.map(d =>
        d.id === did ? { ...d, components: [...d.components, boxComp] } : d
      ),
    }))

    const before = activeDrawing().components.find(c => c.id === 'box_1')
    const { drawing } = roundTrip()
    const after = drawing.components.find(c => c.id === 'box_1')
    expect(after).toEqual(before)
    expect(after.box.doc.paragraphs[0].runs[0].text).toBe('MCU')
  })
})
