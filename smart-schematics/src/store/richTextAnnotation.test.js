import { describe, it, expect, beforeEach } from 'vitest'
import useSchematicStore, { genId } from './schematicStore'
import { plainToDoc, docToPlain, isEmptyDoc } from '../lib/richText'

const drawing = () => {
  const s = useSchematicStore.getState()
  return s.drawings.find(d => d.id === s.activeDrawingId)
}

function freshProject() {
  useSchematicStore.getState().newProject('RT Test')
  return useSchematicStore.getState().activeDrawingId
}

describe('Stage 4 — rich-text annotations in the store', () => {
  let drawingId
  beforeEach(() => {
    drawingId = freshProject()
  })

  it('a created text annotation stores a valid doc', () => {
    const ann = { id: genId(), type: 'text', x: 10, y: 20, text: '', doc: plainToDoc('hello'), fontSize: 14 }
    useSchematicStore.getState().addAnnotation(drawingId, ann)
    const stored = drawing().annotations.find(a => a.id === ann.id)
    expect(stored.doc).toBeTruthy()
    expect(Array.isArray(stored.doc.paragraphs)).toBe(true)
    expect(isEmptyDoc(stored.doc)).toBe(false)
    expect(docToPlain(stored.doc)).toBe('hello')
  })

  it('updateAnnotation with a doc keeps the plain text mirror in sync', () => {
    const ann = { id: genId(), type: 'text', x: 0, y: 0, text: '', doc: plainToDoc('old'), fontSize: 14 }
    useSchematicStore.getState().addAnnotation(drawingId, ann)
    const newDoc = {
      align: 'center',
      paragraphs: [
        { runs: [{ text: 'bold', bold: true }, { text: ' red', color: '#ff0000' }] },
        { runs: [{ text: 'line two' }] },
      ],
    }
    useSchematicStore.getState().updateAnnotation(drawingId, ann.id, { doc: newDoc })
    const stored = drawing().annotations.find(a => a.id === ann.id)
    expect(stored.doc).toEqual(newDoc)
    // back-compat: `text` mirror == docToPlain(doc)
    expect(stored.text).toBe('bold red\nline two')
  })

  it("doc round-trips through a save snapshot", () => {
    const doc = {
      align: 'right',
      paragraphs: [{ runs: [{ text: 'persist me', italic: true, fontSize: 20, color: '#123456' }] }],
    }
    const ann = { id: genId(), type: 'callout', x: 5, y: 5, width: 120, height: 60, text: docToPlain(doc), doc, fontSize: 12 }
    useSchematicStore.getState().addAnnotation(drawingId, ann)

    const snapshot = useSchematicStore.getState()._buildProjectSnapshot()
    const reparsed = JSON.parse(JSON.stringify(snapshot))
    const rd = reparsed.drawings.find(d => d.id === drawingId)
    const rann = rd.annotations.find(a => a.id === ann.id)
    expect(rann.doc).toEqual(doc)
  })

  it('legacy text-only annotation gains a doc on load via migration', () => {
    // Build a project JSON that mimics an old file: annotation has `text`, no `doc`.
    const legacy = {
      name: 'Legacy',
      drawings: [{
        id: 'd1',
        name: 'D1',
        type: 'electrical',
        components: [],
        wires: [],
        junctions: [],
        annotations: [
          { id: 'a1', type: 'text', x: 0, y: 0, text: 'line1\nline2', fontSize: 14 },
          { id: 'a2', type: 'callout', x: 1, y: 1, width: 120, height: 60, text: 'note', fontSize: 12 },
        ],
        titleBlock: {},
        viewState: { panX: 0, panY: 0, zoom: 1 },
      }],
    }
    useSchematicStore.getState().importProjectJSON(JSON.stringify(legacy))
    const dr = drawing()
    const a1 = dr.annotations.find(a => a.text === 'line1\nline2')
    const a2 = dr.annotations.find(a => a.text === 'note')
    expect(a1.doc).toBeTruthy()
    expect(a1.doc.paragraphs).toHaveLength(2)
    expect(docToPlain(a1.doc)).toBe('line1\nline2')
    expect(a2.doc).toBeTruthy()
    expect(docToPlain(a2.doc)).toBe('note')
  })
})
