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

  it('builds snapshots at version 4', () => {
    store().newProject('V4 Project')
    expect(store()._buildProjectSnapshot().version).toBe(4)
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
        images: [], // v0.2.0: migration backfills panel-only reference images
        links: [],  // v0.2.0: migration backfills panel-only reference links
      },
      pins: [
        { id: 'P1', relX: -40, relY: 0, absX: 60, absY: 100, direction: 'W', label: '' },
        { id: 'P2', relX: 40, relY: 0, absX: 140, absY: 100, direction: 'E', label: '' },
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

// ─── Stage 1 (v0.2.0): v3 → v4 schema foundation ────────────────────────────

describe('Stage 1 — v3 → v4 migration & snapshot version', () => {
  it('backfills tables:[] and pin.label on a v3 file, snapshot stamps version 4', () => {
    const v3 = JSON.stringify({
      version: 3,
      id: 'p_v3', name: 'V3 Project',
      drawingIds: ['d_v3'], activeDrawingId: 'd_v3',
      folders: [], attachments: [],
      drawings: [{
        id: 'd_v3', name: 'V3 Drawing', type: 'electrical',
        components: [{
          id: 'c1', type: 'resistor', designator: 'R1', value: '1k',
          x: 0, y: 0, rotation: 0, flipH: false, flipV: false,
          pins: [{ id: 'A', relX: -20, relY: 0, absX: -20, absY: 0, direction: 'W' }],
          simParams: {}, simState: {}, labelOffset: { x: 0, y: -15 },
        }],
        wires: [], junctions: [], annotations: [], images: [], folderId: null,
        titleBlock: { title: 'V3', visible: false },
        viewState: { panX: 0, panY: 0, zoom: 1 },
      }],
    })
    expect(() => store().importProjectJSON(v3)).not.toThrow()
    const d = activeDrawing()
    expect(d.tables).toEqual([])                       // backfilled
    expect(d.components[0].pins[0].label).toBe('')      // backfilled
    expect(store()._buildProjectSnapshot().version).toBe(4)
  })

  it('round-trips every new v0.2.0 field with zero loss', () => {
    store().newProject('v4 fields')
    const did = store().activeDrawingId

    // A box carrying flexible fields + an image + info, a resistor with a style
    // override + label scale, a text annotation with explicit width/height, and
    // a table with a populated cell — injected directly to test serialization.
    useSchematicStore.setState(s => ({
      drawings: s.drawings.map(d => d.id !== did ? d : {
        ...d,
        components: [
          {
            id: 'box_f', type: 'box', designator: 'M1', value: '', description: '',
            x: 10, y: 10, rotation: 0, flipH: false, flipV: false,
            box: {
              width: 80, height: 60, doc: { align: 'left', paragraphs: [{ runs: [] }] },
              fill: '#fff', stroke: '#000', cornerRadius: 4,
              fields: [{ id: 'f1', label: 'Resistance', value: '4.7k', unit: 'Ω' }],
              image: PNG_SRC, info: 'Datasheet rev B',
            },
            pins: [{ id: 'S1', relX: 0, relY: 30, absX: 10, absY: 40, direction: 'S', label: 'OUT' }],
            simParams: {}, simState: {}, labelOffset: { x: 0, y: -15 },
          },
          {
            id: 'r1', type: 'resistor', designator: 'R1', value: '1k', description: '',
            x: 200, y: 0, rotation: 0, flipH: false, flipV: false,
            resistorStyle: 'IEEE', labelScale: 2,
            pins: [{ id: 'A', relX: -20, relY: 0, absX: 180, absY: 0, direction: 'W', label: '' }],
            simParams: {}, simState: {}, labelOffset: { x: 0, y: -15 },
          },
        ],
        annotations: [{
          id: 't1', type: 'text', x: 0, y: 100,
          doc: { align: 'left', paragraphs: [{ runs: [{ text: 'note' }] }] },
          text: 'note', fontSize: 14, width: 160, height: 48,
        }],
        tables: [{
          id: 'tbl1', x: 0, y: 200, rows: 1, cols: 2,
          colWidths: [80, 80], rowHeights: [30],
          cells: [[
            { align: 'left', paragraphs: [{ runs: [{ text: 'Pin' }] }] },
            { align: 'left', paragraphs: [{ runs: [{ text: 'Net' }] }] },
          ]],
          borderColor: '#334155', borderWidth: 1, headerRow: true,
        }],
      }),
    }))

    const before = activeDrawing()
    const { drawing } = roundTrip()

    const box = drawing.components.find(c => c.id === 'box_f')
    expect(box.box.fields).toEqual([{ id: 'f1', label: 'Resistance', value: '4.7k', unit: 'Ω' }])
    expect(box.box.image).toBe(PNG_SRC) // legacy field preserved (additive)
    // v0.2.0: the legacy single image folds into the panel-only images array.
    expect(box.box.images).toHaveLength(1)
    expect(box.box.images[0].src).toBe(PNG_SRC)
    expect(box.box.info).toBe('Datasheet rev B')
    expect(box.pins[0].label).toBe('OUT')

    const r = drawing.components.find(c => c.id === 'r1')
    expect(r.resistorStyle).toBe('IEEE')
    expect(r.labelScale).toBe(2)

    const t = drawing.annotations.find(a => a.id === 't1')
    expect(t.width).toBe(160)
    expect(t.height).toBe(48)

    expect(drawing.tables).toHaveLength(1)
    expect(drawing.tables[0]).toEqual(before.tables[0])
    expect(drawing.tables[0].cells[0][0].paragraphs[0].runs[0].text).toBe('Pin')
  })
})

describe('Stage 1 — legacy fixtures load with zero data loss', () => {
  // A full v3 file: components (incl. a box), wires, annotations, images,
  // junctions, and a title block. Must survive load → re-save with nothing lost.
  function fullV3() {
    return JSON.stringify({
      version: 3,
      id: 'p_full', name: 'Full', drawingIds: ['d_full'], activeDrawingId: 'd_full',
      folders: [], attachments: [],
      drawings: [{
        id: 'd_full', name: 'Full Drawing', type: 'electrical', folderId: null,
        components: [
          {
            id: 'r1', type: 'resistor', designator: 'R1', value: '1k',
            x: 0, y: 0, rotation: 0, flipH: false, flipV: false,
            pins: [{ id: 'A', relX: -20, relY: 0, absX: -20, absY: 0, direction: 'W' }],
            simParams: {}, simState: {}, labelOffset: { x: 0, y: -15 },
          },
          {
            id: 'b1', type: 'box', designator: 'U1', value: '',
            x: 100, y: 0, rotation: 0, flipH: false, flipV: false,
            box: { width: 80, height: 60, doc: { align: 'left', paragraphs: [{ runs: [{ text: 'IC' }] }] }, fill: '#eef', stroke: '#333', cornerRadius: 4 },
            pins: [{ id: 'P1', relX: -40, relY: 0, absX: 60, absY: 0, direction: 'W' }],
            simParams: {}, simState: {}, labelOffset: { x: 0, y: -15 },
          },
        ],
        wires: [{ id: 'w1', points: [{ x: -20, y: 0 }, { x: 60, y: 0 }], netName: '', style: 'solid', weight: 1, pinA: { componentId: 'r1', pinId: 'A' }, pinB: { componentId: 'b1', pinId: 'P1' } }],
        junctions: [{ id: 'j1', x: 60, y: 0 }],
        annotations: [{ id: 'a1', type: 'text', x: 0, y: 80, doc: { align: 'left', paragraphs: [{ runs: [{ text: 'hi' }] }] }, text: 'hi', fontSize: 14 }],
        images: [{ id: 'im1', src: PNG_SRC, x: 0, y: 150, width: 40, height: 40, rotation: 0, opacity: 1, locked: false }],
        titleBlock: { title: 'Full', visible: true },
        viewState: { panX: 0, panY: 0, zoom: 1 },
      }],
    })
  }

  it('loads a full v3 file and re-saves it without losing any element', () => {
    expect(() => store().importProjectJSON(fullV3())).not.toThrow()
    const d0 = activeDrawing()
    expect(d0.components).toHaveLength(2)
    expect(d0.wires).toHaveLength(1)
    expect(d0.junctions).toHaveLength(1)
    expect(d0.annotations).toHaveLength(1)
    expect(d0.images).toHaveLength(1)

    const { drawing } = roundTrip()
    expect(drawing.components).toHaveLength(2)
    expect(drawing.wires).toHaveLength(1)
    expect(drawing.wires[0].pinA.componentId).toBe('r1')
    expect(drawing.junctions).toHaveLength(1)
    expect(drawing.annotations[0].text).toBe('hi')
    expect(drawing.images[0].src).toBe(PNG_SRC)
    expect(drawing.components.find(c => c.id === 'b1').box.doc.paragraphs[0].runs[0].text).toBe('IC')
    // new field backfilled, nothing dropped
    expect(drawing.tables).toEqual([])
  })
})
