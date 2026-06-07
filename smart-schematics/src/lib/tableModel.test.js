import { describe, it, expect } from 'vitest'
import {
  createTable, setCell, addRow, addCol, removeRow, removeCol,
  resizeCol, resizeRow, tableSize,
  MIN_COL_WIDTH, MIN_ROW_HEIGHT,
} from './tableModel.js'
import { plainToDoc, docToPlain, emptyDoc } from './richText.js'

const GRID = 10

// Invariant assertion reused across mutations.
function expectRectangular(t) {
  expect(t.colWidths).toHaveLength(t.cols)
  expect(t.rowHeights).toHaveLength(t.rows)
  expect(t.cells).toHaveLength(t.rows)
  for (const row of t.cells) expect(row).toHaveLength(t.cols)
}

describe('createTable', () => {
  it('builds a rows×cols grid of empty rich-text cells with defaults', () => {
    const t = createTable({ rows: 2, cols: 3, grid: GRID })
    expect(t.rows).toBe(2)
    expect(t.cols).toBe(3)
    expectRectangular(t)
    expect(docToPlain(t.cells[0][0])).toBe('')
    expect(t.borderColor).toBeTruthy()
    expect(t.borderWidth).toBeGreaterThan(0)
    expect(t.headerRow).toBe(false)
    // dims snapped to grid + floored
    for (const w of t.colWidths) expect(w % GRID).toBe(0)
    for (const h of t.rowHeights) expect(h % GRID).toBe(0)
  })

  it('floors at least 1 row and 1 col', () => {
    const t = createTable({ rows: 0, cols: 0, grid: GRID })
    expect(t.rows).toBeGreaterThanOrEqual(1)
    expect(t.cols).toBeGreaterThanOrEqual(1)
    expectRectangular(t)
  })
})

describe('setCell', () => {
  it('stores a RichDoc at (r,c) without mutating the input', () => {
    const t = createTable({ rows: 2, cols: 2, grid: GRID })
    const doc = plainToDoc('hello')
    const out = setCell(t, 1, 0, doc)
    expect(docToPlain(out.cells[1][0])).toBe('hello')
    expect(docToPlain(t.cells[1][0])).toBe('') // original untouched
  })

  it('is a no-op for out-of-range coords', () => {
    const t = createTable({ rows: 1, cols: 1, grid: GRID })
    expect(setCell(t, 5, 5, plainToDoc('x'))).toBe(t)
  })
})

describe('add/remove row & col keep the grid rectangular', () => {
  it('addRow / addCol grow the grid', () => {
    let t = createTable({ rows: 1, cols: 1, grid: GRID })
    t = addRow(t, undefined, GRID)
    t = addCol(t, undefined, GRID)
    expect(t.rows).toBe(2)
    expect(t.cols).toBe(2)
    expectRectangular(t)
  })

  it('removeRow / removeCol shrink the grid but never below 1×1', () => {
    let t = createTable({ rows: 2, cols: 2, grid: GRID })
    t = removeRow(t, 0)
    t = removeCol(t, 0)
    expect(t.rows).toBe(1)
    expect(t.cols).toBe(1)
    expectRectangular(t)
    // refuse to drop the last row/col
    expect(removeRow(t, 0).rows).toBe(1)
    expect(removeCol(t, 0).cols).toBe(1)
  })
})

describe('resizeCol / resizeRow', () => {
  it('snaps to grid and floors at the minimum', () => {
    const t = createTable({ rows: 1, cols: 1, grid: GRID })
    const wide = resizeCol(t, 0, 137, GRID)
    expect(wide.colWidths[0] % GRID).toBe(0)
    const tiny = resizeCol(t, 0, 1, GRID)
    expect(tiny.colWidths[0]).toBeGreaterThanOrEqual(MIN_COL_WIDTH)
    const short = resizeRow(t, 0, 1, GRID)
    expect(short.rowHeights[0]).toBeGreaterThanOrEqual(MIN_ROW_HEIGHT)
  })
})

describe('tableSize', () => {
  it('is the sum of column widths and row heights', () => {
    const t = createTable({ rows: 2, cols: 2, colWidth: 80, rowHeight: 30, grid: GRID })
    const { width, height } = tableSize(t)
    expect(width).toBe(t.colWidths.reduce((a, b) => a + b, 0))
    expect(height).toBe(t.rowHeights.reduce((a, b) => a + b, 0))
  })
})

describe('createTable fill (v0.2.0)', () => {
  it('defaults fill to null and stores a provided fill', () => {
    expect(createTable({}).fill).toBe(null)
    expect(createTable({ fill: '#ffeeaa' }).fill).toBe('#ffeeaa')
  })
})
