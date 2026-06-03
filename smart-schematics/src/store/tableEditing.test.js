import { describe, it, expect, beforeEach } from 'vitest'
import useSchematicStore from './schematicStore'
import { createTable, setCell } from '../lib/tableModel'
import { plainToDoc, docToPlain } from '../lib/richText'

// Stage 9 (v0.2.0): tables on the canvas. The Canvas tool + TableLayer are UI;
// this covers the store path it drives: place → edit a cell → persist.

const store = () => useSchematicStore.getState()
const activeDrawing = () => {
  const s = store()
  return s.drawings.find(d => d.id === s.activeDrawingId)
}
function roundTrip() {
  const json = JSON.stringify(store()._buildProjectSnapshot(), null, 2)
  store().importProjectJSON(json)
  return activeDrawing()
}

describe('table place + cell edit + persistence', () => {
  let did, tableId
  beforeEach(() => {
    store().newProject('Tables')
    did = store().activeDrawingId
    tableId = store().addTable(did, createTable({ x: 0, y: 0, rows: 2, cols: 2, grid: 10 }))
  })

  it('editing a cell via updateTable(setCell) persists and round-trips', () => {
    const t = activeDrawing().tables.find(t => t.id === tableId)
    const next = setCell(t, 0, 1, plainToDoc('Net'))
    store().updateTable(did, tableId, { cells: next.cells })
    expect(docToPlain(activeDrawing().tables[0].cells[0][1])).toBe('Net')

    const after = roundTrip().tables.find(t => t.id === tableId)
    expect(docToPlain(after.cells[0][1])).toBe('Net')
    expect(after.rows).toBe(2)
    expect(after.cols).toBe(2)
  })
})
