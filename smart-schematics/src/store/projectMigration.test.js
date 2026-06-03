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
