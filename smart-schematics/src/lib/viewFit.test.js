import { describe, it, expect } from 'vitest'
import { fitViewState, boundsFromSelection, MIN_ZOOM } from './viewFit'

describe('fitViewState', () => {
  const vw = 1000, vh = 600

  it('scales a big drawing down until it fits', () => {
    const v = fitViewState({ minX: 0, minY: 0, maxX: 4000, maxY: 1200 }, vw, vh)
    expect(v.zoom).toBeCloseTo(0.25, 5)   // width-limited: 1000 / 4000
    // ...and the content actually lands inside the viewport.
    expect(0 * v.zoom + v.panX).toBeCloseTo(0, 5)
    expect(4000 * v.zoom + v.panX).toBeCloseTo(1000, 5)
  })

  it('centres content on the axis with slack', () => {
    const v = fitViewState({ minX: 0, minY: 0, maxX: 4000, maxY: 1200 }, vw, vh)
    const top = 0 * v.zoom + v.panY
    const bottom = 1200 * v.zoom + v.panY
    expect(top).toBeCloseTo((vh - 300) / 2, 5)
    expect(vh - bottom).toBeCloseTo((vh - 300) / 2, 5)
  })

  it('does not magnify a small drawing past 1:1', () => {
    // "Fit" should not blow a lone resistor up to fill the screen.
    const v = fitViewState({ minX: 0, minY: 0, maxX: 40, maxY: 20 }, vw, vh)
    expect(v.zoom).toBe(1)
  })

  it('honours an explicit maxZoom', () => {
    expect(fitViewState({ minX: 0, minY: 0, maxX: 40, maxY: 20 }, vw, vh, { maxZoom: 4 }).zoom).toBe(4)
  })

  it('clamps absurdly large content to the minimum zoom', () => {
    const v = fitViewState({ minX: 0, minY: 0, maxX: 10_000_000, maxY: 10 }, vw, vh)
    expect(v.zoom).toBe(MIN_ZOOM)
  })

  it('returns null rather than jumping somewhere arbitrary', () => {
    expect(fitViewState(null, vw, vh)).toBeNull()
    expect(fitViewState({ minX: 0, minY: 0, maxX: 0, maxY: 0 }, vw, vh)).toBeNull()
    expect(fitViewState({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, 0, 0)).toBeNull()
  })
})

describe('boundsFromSelection', () => {
  const drawing = {
    components: [
      { id: 'c1', x: 100, y: 100, pins: [{ id: 'A', absX: 80, absY: 100 }, { id: 'B', absX: 120, absY: 100 }] },
      { id: 'c2', x: 900, y: 900, pins: [] },
    ],
    wires: [{ id: 'w1', points: [{ x: 0, y: 0 }, { x: 50, y: 50 }] }],
    tables: [{ id: 't1', x: 500, y: 500, colWidths: [40, 40], rowHeights: [20] }],
    junctions: [{ id: 'j1', x: 300, y: 300 }],
    annotations: [{ id: 'a1', type: 'text', x: 200, y: 200 }],
  }

  it('covers only the selected items', () => {
    const b = boundsFromSelection(drawing, ['c1'], 0)
    expect(b).toEqual({ minX: 60, minY: 60, maxX: 140, maxY: 140 })
  })

  it('spans every selected layer, tables and junctions included', () => {
    const b = boundsFromSelection(drawing, ['w1', 't1', 'j1', 'a1'], 0)
    expect(b.minX).toBe(0)
    expect(b.minY).toBe(0)
    expect(b.maxX).toBe(580)   // table right edge
    expect(b.maxY).toBe(520)   // table bottom edge
  })

  it('pads the box so the selection is not flush to the viewport edge', () => {
    const b = boundsFromSelection(drawing, ['j1'], 40)
    expect(b).toEqual({ minX: 260, minY: 260, maxX: 340, maxY: 340 })
  })

  it('returns null for an empty or missing selection', () => {
    expect(boundsFromSelection(drawing, [])).toBeNull()
    expect(boundsFromSelection(drawing, ['nope'])).toBeNull()
    expect(boundsFromSelection(null, ['c1'])).toBeNull()
  })
})
