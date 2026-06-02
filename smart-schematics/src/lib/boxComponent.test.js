import { describe, it, expect } from 'vitest'
import {
  createBox,
  boxPins,
  resizeBoxGeometry,
  DEFAULT_BOX_WIDTH,
  DEFAULT_BOX_HEIGHT,
  MIN_BOX_SIZE,
} from './boxComponent.js'
import { isEmptyDoc } from './richText.js'

const GRID = 10

describe('createBox factory', () => {
  it('produces a valid type:box Component with a grid-multiple default size', () => {
    const b = createBox({ x: 100, y: 100, grid: GRID })
    expect(b.type).toBe('box')
    expect(b.box.width).toBe(DEFAULT_BOX_WIDTH)
    expect(b.box.height).toBe(DEFAULT_BOX_HEIGHT)
    expect(b.box.width % GRID).toBe(0)
    expect(b.box.height % GRID).toBe(0)
    // Component contract fields present.
    expect(b.rotation).toBe(0)
    expect(b.flipH).toBe(false)
    expect(b.flipV).toBe(false)
    expect(b.simParams).toEqual({})
    expect(Array.isArray(b.pins)).toBe(true)
    // Empty rich-text label by default.
    expect(isEmptyDoc(b.box.doc)).toBe(true)
  })

  it('snaps a non-grid requested size up to grid multiples & floors at MIN', () => {
    const b = createBox({ width: 83, height: 4, grid: GRID })
    expect(b.box.width).toBe(80)
    expect(b.box.height).toBe(MIN_BOX_SIZE) // floored, not 0
    expect(b.box.height % GRID).toBe(0)
  })

  it('places default pins as a 2-terminal block (one W, one E) on the edge', () => {
    const b = createBox({ x: 0, y: 0, width: 80, height: 60, grid: GRID })
    expect(b.pins).toHaveLength(2)
    const w = b.pins.find(p => p.id === 'W1')
    const e = b.pins.find(p => p.id === 'E1')
    expect(w.relX).toBe(-40)
    expect(e.relX).toBe(40)
    expect(w.direction).toBe('W')
    expect(e.direction).toBe('E')
    // abs positions seeded from origin.
    expect(w.absX).toBe(-40)
    expect(e.absX).toBe(40)
  })
})

describe('boxPins geometry', () => {
  const box = { width: 80, height: 60 }

  it('lands every pin exactly on the edge line', () => {
    const pins = boxPins(box, { W: 2, E: 2, N: 2, S: 2 }, GRID)
    for (const p of pins) {
      const onVertEdge = Math.abs(p.relX) === 40
      const onHorizEdge = Math.abs(p.relY) === 30
      expect(onVertEdge || onHorizEdge).toBe(true)
    }
  })

  it('snaps pin offsets to the grid', () => {
    const pins = boxPins(box, { W: 0, E: 0, N: 3, S: 0 }, GRID)
    // N edge offsets relative to box center; relX must be a grid multiple offset.
    for (const p of pins) {
      expect((p.relX + box.width / 2) % GRID).toBe(0)
    }
  })

  it('spaces N pins evenly & symmetrically along an edge', () => {
    // 3 pins on a width-80 edge → raw offsets 20/40/60 (already grid-aligned).
    const pins = boxPins({ width: 80, height: 60 }, { W: 0, E: 0, N: 3, S: 0 }, GRID)
    const xs = pins.map(p => p.relX).sort((a, b) => a - b)
    expect(xs).toEqual([-20, 0, 20])
  })

  it('sets direction = the edge normal for each side', () => {
    const pins = boxPins(box, { W: 1, E: 1, N: 1, S: 1 }, GRID)
    expect(pins.find(p => p.id === 'W1').direction).toBe('W')
    expect(pins.find(p => p.id === 'E1').direction).toBe('E')
    expect(pins.find(p => p.id === 'N1').direction).toBe('N')
    expect(pins.find(p => p.id === 'S1').direction).toBe('S')
  })

  it('produces no pins for a side with count 0', () => {
    const pins = boxPins(box, { W: 0, E: 0, N: 0, S: 0 }, GRID)
    expect(pins).toHaveLength(0)
  })
})

describe('resizeBoxGeometry — grid snap + min size', () => {
  // Top-left box (the resize gesture works in top-left coords like an image).
  const tl = { x: 0, y: 0, width: 80, height: 60 }

  it('snaps the resized size to grid multiples', () => {
    const out = resizeBoxGeometry(tl, 'se', 13, 7, GRID)
    expect(out.width % GRID).toBe(0)
    expect(out.height % GRID).toBe(0)
    // 80+13=93 → snap 90; 60+7=67 → snap 70.
    expect(out.width).toBe(90)
    expect(out.height).toBe(70)
  })

  it('respects the minimum size when dragged inward past the floor', () => {
    const out = resizeBoxGeometry(tl, 'se', -200, -200, GRID)
    expect(out.width).toBeGreaterThanOrEqual(MIN_BOX_SIZE)
    expect(out.height).toBeGreaterThanOrEqual(MIN_BOX_SIZE)
  })
})
