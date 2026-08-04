import { describe, it, expect } from 'vitest'
import { selectableIds, idsInBand } from './selection'

const drawing = {
  components: [{ id: 'c1', x: 10, y: 10 }, { id: 'c2', x: 500, y: 500 }],
  wires: [{ id: 'w1', points: [{ x: 5, y: 5 }, { x: 20, y: 20 }] },
          { id: 'w2', points: [{ x: 5, y: 5 }, { x: 900, y: 900 }] }],
  annotations: [{ id: 'a1', type: 'text', x: 15, y: 15 },
                { id: 'a2', type: 'callout', x: 10, y: 10, width: 20, height: 20 }],
  images: [{ id: 'i1', x: 0, y: 0, width: 30, height: 30 },
           { id: 'i2', x: 0, y: 0, width: 30, height: 30, locked: true }],
  tables: [{ id: 't1', x: 0, y: 0, colWidths: [20, 20], rowHeights: [10, 10] }],
  junctions: [{ id: 'j1', x: 12, y: 12 }],
}

describe('selectableIds (Ctrl+A)', () => {
  it('includes tables and junctions (regression: Select All skipped both)', () => {
    const ids = selectableIds(drawing)
    expect(ids).toContain('t1')
    expect(ids).toContain('j1')
  })

  it('covers every other layer too', () => {
    const ids = selectableIds(drawing)
    for (const id of ['c1', 'c2', 'w1', 'w2', 'a1', 'a2', 'i1']) expect(ids).toContain(id)
  })

  it('leaves locked images out — Delete would otherwise remove them', () => {
    expect(selectableIds(drawing)).not.toContain('i2')
  })

  it('tolerates a drawing missing optional layers', () => {
    expect(selectableIds({ components: [{ id: 'c1' }] })).toEqual(['c1'])
    expect(selectableIds(null)).toEqual([])
  })
})

describe('idsInBand (rubber band)', () => {
  const band = { minX: 0, minY: 0, maxX: 100, maxY: 100 }

  it('selects a fully enclosed table (regression: tables were skipped)', () => {
    expect(idsInBand(drawing, band)).toContain('t1')
  })

  it('leaves a table that only partly overlaps the band', () => {
    const wide = { tables: [{ id: 'big', x: 0, y: 0, colWidths: [500], rowHeights: [10] }] }
    expect(idsInBand(wide, band)).not.toContain('big')
  })

  it('takes point-like items by origin and extent items only when enclosed', () => {
    const ids = idsInBand(drawing, band)
    expect(ids).toEqual(expect.arrayContaining(['c1', 'w1', 'a1', 'a2', 'i1', 'j1']))
    expect(ids).not.toContain('c2')  // origin outside
    expect(ids).not.toContain('w2')  // runs out of the band
  })

  it('never selects a locked image', () => {
    expect(idsInBand(drawing, band)).not.toContain('i2')
  })

  it('ignores a wire with no points rather than selecting it', () => {
    expect(idsInBand({ wires: [{ id: 'empty', points: [] }] }, band)).toEqual([])
  })
})
