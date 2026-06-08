import { describe, it, expect } from 'vitest'
import { createBox, boxPins, boxPinLabelPos } from './boxComponent.js'

const GRID = 10

describe('boxPins — pin labels (v0.2.0)', () => {
  const box = { width: 80, height: 60 }

  it('defaults every pin label to an empty string', () => {
    const pins = boxPins(box, { W: 1, E: 1 }, GRID)
    for (const p of pins) expect(p.label).toBe('')
  })

  it('applies caller-supplied labels by pin id', () => {
    const pins = boxPins(box, { W: 1, E: 1, labels: { W1: 'VCC', E1: 'GND' } }, GRID)
    expect(pins.find(p => p.id === 'W1').label).toBe('VCC')
    expect(pins.find(p => p.id === 'E1').label).toBe('GND')
  })

  it('flows labels through createBox', () => {
    const b = createBox({ width: 80, height: 60, grid: GRID, pinSpec: { S: 1, labels: { S1: 'OUT' } } })
    expect(b.pins.find(p => p.id === 'S1').label).toBe('OUT')
  })
})

describe('boxPins — single bottom pin is centered + on a grid line', () => {
  it('places a lone S pin dead-centre of the bottom edge', () => {
    const box = { width: 80, height: 60 }
    const pins = boxPins(box, { S: 1 }, GRID)
    const s = pins.find(p => p.id === 'S1')
    expect(s).toBeTruthy()
    // Centered: relX (offset from box center) is exactly 0.
    expect(s.relX).toBe(0)
    // On the bottom edge line: relY = +height/2.
    expect(s.relY).toBe(30)
    expect(s.direction).toBe('S')
  })

  it('keeps the lone pin centered + grid-aligned even on an odd-multiple edge', () => {
    const box = { width: 90, height: 50 }
    const pins = boxPins(box, { N: 1 }, GRID)
    const n = pins.find(p => p.id === 'N1')
    expect(n.relX).toBe(0)        // centered
    expect(n.relX % GRID).toBe(0) // on a grid line relative to centre
    expect(n.relY).toBe(-25)      // top edge line
  })

  it('multi-pin edges stay evenly spaced + symmetric about the centre', () => {
    const box = { width: 80, height: 60 }
    const pins = boxPins(box, { W: 2 }, GRID).filter(p => p.direction === 'W')
    expect(pins).toHaveLength(2)
    const ys = pins.map(p => p.relY).sort((a, b) => a - b)
    expect(ys[0]).toBe(-ys[1]) // symmetric about the centre
    for (const y of ys) expect(Math.abs(y % GRID)).toBe(0)
  })
})

describe('boxPinLabelPos — labels sit inside the box from the pin', () => {
  it('insets toward the box interior with the right anchor per edge', () => {
    expect(boxPinLabelPos({ absX: -40, absY: 0, direction: 'W' }, 8))
      .toMatchObject({ x: -32, y: 0, anchor: 'start' })
    expect(boxPinLabelPos({ absX: 40, absY: 0, direction: 'E' }, 8))
      .toMatchObject({ x: 32, y: 0, anchor: 'end' })
    expect(boxPinLabelPos({ absX: 0, absY: -30, direction: 'N' }, 8))
      .toMatchObject({ x: 0, y: -22, anchor: 'middle' })
    expect(boxPinLabelPos({ absX: 0, absY: 30, direction: 'S' }, 8))
      .toMatchObject({ x: 0, y: 22, anchor: 'middle' })
  })

  it('falls back to relX/relY when abs coords are absent', () => {
    expect(boxPinLabelPos({ relX: -40, relY: 0, direction: 'W' }, 8).x).toBe(-32)
  })
})

describe('createBox — v0.2.0 box payload', () => {
  it('seeds empty fields, empty images and empty info', () => {
    const b = createBox({ grid: GRID })
    expect(b.box.fields).toEqual([])
    expect(b.box.images).toEqual([])
    expect(b.box.info).toBe('')
  })
})

describe('boxPinLabelPos outside placement (v0.2.0)', () => {
  it('places labels just OUTSIDE the box edge (no overlap with centre text)', () => {
    expect(boxPinLabelPos({ absX: -40, absY: 0, direction: 'W' }, 8, true))
      .toEqual({ x: -48, y: 0, anchor: 'end', baseline: 'middle' })
    expect(boxPinLabelPos({ absX: 40, absY: 0, direction: 'E' }, 8, true))
      .toEqual({ x: 48, y: 0, anchor: 'start', baseline: 'middle' })
    expect(boxPinLabelPos({ absX: 0, absY: -30, direction: 'N' }, 8, true))
      .toEqual({ x: 0, y: -38, anchor: 'middle', baseline: 'auto' })
    expect(boxPinLabelPos({ absX: 0, absY: 30, direction: 'S' }, 8, true))
      .toEqual({ x: 0, y: 38, anchor: 'middle', baseline: 'hanging' })
  })
  it('still defaults to inside placement when outside is false', () => {
    expect(boxPinLabelPos({ absX: -40, absY: 0, direction: 'W' }, 8))
      .toEqual({ x: -32, y: 0, anchor: 'start', baseline: 'middle' })
  })
})

describe('boxPinLabelPos clearWire offset (v0.4.0)', () => {
  it('nudges the label perpendicular to an attached wire so it is not covered', () => {
    // W/E: wire is horizontal ⇒ label lifts above it (y decreases, baseline auto).
    expect(boxPinLabelPos({ absX: -40, absY: 0, direction: 'W' }, 8, true, true))
      .toEqual({ x: -48, y: -7, anchor: 'end', baseline: 'auto' })
    expect(boxPinLabelPos({ absX: 40, absY: 0, direction: 'E' }, 8, true, true))
      .toEqual({ x: 48, y: -7, anchor: 'start', baseline: 'auto' })
    // N/S: wire is vertical ⇒ label shifts to the right (x increases).
    expect(boxPinLabelPos({ absX: 0, absY: -30, direction: 'N' }, 8, true, true))
      .toEqual({ x: 7, y: -38, anchor: 'start', baseline: 'auto' })
    expect(boxPinLabelPos({ absX: 0, absY: 30, direction: 'S' }, 8, true, true))
      .toEqual({ x: 7, y: 38, anchor: 'start', baseline: 'hanging' })
  })
})

describe('updateBox preserves pin labels across a resize (v0.4.0 item 8)', () => {
  it('rebuilt pins keep their labels when geometry changes', () => {
    // Simulate the store's rebuild path: extract labels by id, pass through pinSpec.
    const before = createBox({ width: 80, height: 60, grid: GRID, pinSpec: { W: 1, E: 1, labels: { W1: 'VCC', E1: 'GND' } } })
    const labels = {}
    for (const p of before.pins) if (p.label) labels[p.id] = p.label
    const after = createBox({ width: 120, height: 100, grid: GRID, pinSpec: { W: 1, E: 1, labels } })
    expect(after.pins.find(p => p.id === 'W1').label).toBe('VCC')
    expect(after.pins.find(p => p.id === 'E1').label).toBe('GND')
  })
})
