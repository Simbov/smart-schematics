import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import useSchematicStore from './schematicStore'

// Stage 7: finalize v2 → v3 migration against a realistic, checked-in v2 fixture.
// Asserts that every new field (images, folderId, folders, attachments, and the
// rich-text `doc` on text annotations) defaults correctly while all existing
// content (components, wires, annotations, title block) survives intact.

const fixturePath = fileURLToPath(
  new URL('../test/fixtures/project_v2.scpro.json', import.meta.url)
)
const v2Json = readFileSync(fixturePath, 'utf-8')

const store = () => useSchematicStore.getState()
const activeProject = () => {
  const s = store()
  return s.projects.find(p => p.id === s.activeProjectId)
}
const activeDrawing = () => {
  const s = store()
  return s.drawings.find(d => d.id === s.activeDrawingId)
}

describe('Stage 7 — v2 fixture migrates to v3', () => {
  beforeEach(() => {
    // Reset to a clean single project so the import is isolated.
    store().newProject('scratch')
  })

  it('opens the v2 fixture without throwing', () => {
    expect(() => store().importProjectJSON(v2Json)).not.toThrow()
  })

  it('backfills all new project + drawing fields with safe defaults', () => {
    store().importProjectJSON(v2Json)
    const p = activeProject()
    const d = activeDrawing()

    // New project-level fields.
    expect(p.folders).toEqual([])
    expect(p.attachments).toEqual([])

    // New drawing-level fields.
    expect(d.images).toEqual([])
    expect(d.folderId).toBeNull()
  })

  it('migrates a legacy plain-text annotation to a rich-text doc', () => {
    store().importProjectJSON(v2Json)
    const d = activeDrawing()
    const ann = d.annotations.find(a => a.id === 'a_1')
    expect(ann.doc).toBeTruthy()
    // The plain text had two lines → two paragraphs.
    expect(ann.doc.paragraphs).toHaveLength(2)
    expect(ann.doc.paragraphs[0].runs[0].text).toBe('Legacy note')
    expect(ann.doc.paragraphs[1].runs[0].text).toBe('second line')
    // Original plain text is preserved for back-compat.
    expect(ann.text).toBe('Legacy note\nsecond line')
  })

  it('keeps existing components, wires, and title block intact', () => {
    store().importProjectJSON(v2Json)
    const d = activeDrawing()

    expect(d.components).toHaveLength(1)
    const r1 = d.components[0]
    expect(r1.designator).toBe('R1')
    expect(r1.value).toBe('1k')
    expect(r1.pins).toHaveLength(2)
    expect(r1.simParams.resistance).toBe('1000')

    expect(d.wires).toHaveLength(1)
    expect(d.wires[0].points).toEqual([
      { x: 120, y: 100 },
      { x: 200, y: 100 },
    ])

    expect(d.titleBlock.title).toBe('Power Supply')
    expect(d.titleBlock.revision).toBe('A')
    expect(d.titleBlock.visible).toBe(true)
    expect(d.name).toBe('Power Supply')
  })

  it('a migrated v2 project re-saves as version 4', () => {
    store().importProjectJSON(v2Json)
    expect(store()._buildProjectSnapshot().version).toBe(4)
  })
})

describe('v0.2.0 — legacy box migrates forward without data loss', () => {
  beforeEach(() => { store().newProject('scratch') })

  it('folds legacy box.image into box.images and backfills box.links', () => {
    const legacy = JSON.stringify({
      version: 3,
      id: 'p_old', name: 'Old', drawingIds: ['d_old'], activeDrawingId: 'd_old',
      drawings: [{
        id: 'd_old', name: 'D', type: 'electrical',
        components: [{
          id: 'box_old', type: 'box', designator: 'BX1', value: '', description: '',
          x: 0, y: 0, rotation: 0, flipH: false, flipV: false,
          pins: [{ id: 'P1', relX: -40, relY: 0, absX: -40, absY: 0, direction: 'W' }],
          box: { width: 80, height: 60, doc: { align: 'left', paragraphs: [{ runs: [{ text: 'IC' }] }] },
                 fill: '#eef', stroke: '#333', cornerRadius: 4, image: 'data:image/png;base64,AAAA' },
        }],
        wires: [{ id: 'w_old', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], netName: '', style: 'solid', weight: 1, pinA: null, pinB: null }],
        junctions: [], annotations: [],
        titleBlock: { title: 'D', visible: false }, viewState: { panX: 0, panY: 0, zoom: 1 },
      }],
    })
    store().importProjectJSON(legacy)
    const d = activeDrawing()
    const box = d.components.find(c => c.id === 'box_old')
    // Legacy single image folded into the panel-only images array.
    expect(box.box.images).toHaveLength(1)
    expect(box.box.images[0].src).toBe('data:image/png;base64,AAAA')
    // New panel-only links array backfilled.
    expect(box.box.links).toEqual([])
    // Pre-existing pin gains an empty label; old content untouched.
    expect(box.pins[0].label).toBe('')
    expect(box.box.doc.paragraphs[0].runs[0].text).toBe('IC')
    // Old wire with no color is preserved (renders with the theme default).
    expect(d.wires[0].color).toBeUndefined()
    // New tables array backfilled at the drawing level.
    expect(d.tables).toEqual([])
  })
})
