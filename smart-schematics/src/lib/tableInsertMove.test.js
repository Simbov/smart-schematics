import { describe, it, expect } from 'vitest'
import { createTable, insertRow, insertCol, moveRow, moveCol, tableSize } from './tableModel'
import { docToPlain } from './richText'
import { tableToHtml, tableToTsv } from './tableClipboard'
import {
  createBlock, blockTableSetCell, blockTableAddRow, blockTableAddCol,
  blockTableRemoveRow, blockTableRemoveCol, normalizeGrid,
} from './boxBlocks'

// Tag cells with identifiable plain text so we can track them through moves.
function tagged(rows, cols) {
  const t = createTable({ rows, cols, grid: 0 })
  t.cells = t.cells.map((row, r) => row.map((_, c) => ({ paragraphs: [{ align: 'left', runs: [{ text: `${r}-${c}` }] }] })))
  return t
}
const plain = (t, r, c) => docToPlain(t.cells[r][c])

describe('tableModel — insert / move', () => {
  it('insertRow adds an empty row at the index and shifts the rest down', () => {
    const t = insertRow(tagged(2, 2), 1)
    expect(t.rows).toBe(3)
    expect(plain(t, 0, 0)).toBe('0-0')
    expect(plain(t, 1, 0)).toBe('')      // inserted blank
    expect(plain(t, 2, 0)).toBe('1-0')   // old row 1 pushed down
    expect(t.rowHeights).toHaveLength(3)
  })

  it('insertCol adds an empty column at the index', () => {
    const t = insertCol(tagged(2, 2), 0)
    expect(t.cols).toBe(3)
    expect(plain(t, 0, 0)).toBe('')      // inserted blank at far left
    expect(plain(t, 0, 1)).toBe('0-0')
    expect(t.colWidths).toHaveLength(3)
  })

  it('insert clamps an out-of-range index to append', () => {
    expect(insertRow(tagged(2, 2), 99).rows).toBe(3)
    expect(insertCol(tagged(2, 2), -5).cols).toBe(3)
  })

  it('moveRow reorders rows and their heights', () => {
    const base = tagged(3, 1)
    base.rowHeights = [10, 20, 30]
    const t = moveRow(base, 0, 2)
    expect([plain(t, 0, 0), plain(t, 1, 0), plain(t, 2, 0)]).toEqual(['1-0', '2-0', '0-0'])
    expect(t.rowHeights).toEqual([20, 30, 10])
  })

  it('moveCol reorders columns and their widths', () => {
    const base = tagged(1, 3)
    base.colWidths = [10, 20, 30]
    const t = moveCol(base, 2, 0)
    expect([plain(t, 0, 0), plain(t, 0, 1), plain(t, 0, 2)]).toEqual(['0-2', '0-0', '0-1'])
    expect(t.colWidths).toEqual([30, 10, 20])
  })

  it('move is a no-op for same/out-of-range indices', () => {
    const t = tagged(2, 2)
    expect(moveRow(t, 0, 0)).toBe(t)
    expect(moveCol(t, 5, 0)).toBe(t)
  })

  it('tableSize sums widths/heights', () => {
    const t = createTable({ rows: 2, cols: 2, colWidths: [40, 60], rowHeights: [20, 30], grid: 0 })
    expect(tableSize(t)).toEqual({ width: 100, height: 50 })
  })
})

describe('tableClipboard — HTML / TSV export', () => {
  const t = tagged(2, 2)
  it('emits a bordered HTML table with <th> for the header row', () => {
    const html = tableToHtml({ ...t, headerRow: true })
    expect(html.startsWith('<table')).toBe(true)
    expect(html).toContain('<th')
    expect(html).toContain('0-0')
    expect(html).toContain('1-1')
  })
  it('TSV is tab/newline separated', () => {
    expect(tableToTsv(t)).toBe('0-0\t0-1\n1-0\t1-1')
  })
})

describe('boxBlocks — table block', () => {
  it('createBlock(table) builds a rows×cols string grid', () => {
    const b = createBlock({ type: 'table', rows: 2, cols: 3 })
    expect(b.type).toBe('table')
    expect(b.cells).toHaveLength(2)
    expect(b.cells[0]).toHaveLength(3)
    expect(b.cells[0][0]).toBe('')
  })

  it('normalizeGrid coerces ragged input to a rectangular string grid', () => {
    const g = normalizeGrid([['a'], [undefined, 'b', 'c']], 2, 2)
    expect(g).toEqual([['a', ''], ['', 'b']])
  })

  it('set/add/remove keep the grid rectangular', () => {
    let b = createBlock({ type: 'table', rows: 2, cols: 2 })
    b = blockTableSetCell(b, 0, 1, 'hi')
    expect(b.cells[0][1]).toBe('hi')
    b = blockTableAddRow(b)
    expect(b.rows).toBe(3)
    expect(b.cells[2]).toEqual(['', ''])
    b = blockTableAddCol(b)
    expect(b.cols).toBe(3)
    expect(b.cells[0]).toHaveLength(3)
    b = blockTableRemoveRow(b, 0)
    expect(b.rows).toBe(2)
    b = blockTableRemoveCol(b, 2)
    expect(b.cols).toBe(2)
  })

  it('refuses to remove the last row/column', () => {
    let b = createBlock({ type: 'table', rows: 1, cols: 1 })
    expect(blockTableRemoveRow(b, 0)).toBe(b)
    expect(blockTableRemoveCol(b, 0)).toBe(b)
  })
})

describe('boxBlocks — link block', () => {
  it('createBlock(link) carries label + url', () => {
    const b = createBlock({ type: 'link', label: 'Datasheet', url: 'https://x.com' })
    expect(b.type).toBe('link')
    expect(b.label).toBe('Datasheet')
    expect(b.url).toBe('https://x.com')
  })
  it('defaults label/url to empty strings', () => {
    const b = createBlock({ type: 'link' })
    expect(b.label).toBe('')
    expect(b.url).toBe('')
  })
})
