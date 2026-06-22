import { describe, it, expect } from 'vitest'
import {
  clampPorts, manifoldGeom, manifoldPins, manifoldDrawing,
  MANIFOLD_MIN_PORTS, MANIFOLD_MAX_PORTS,
} from './manifold'

describe('manifold geometry (issue #22)', () => {
  it('clampPorts keeps the count within bounds and integer', () => {
    expect(clampPorts(1)).toBe(MANIFOLD_MIN_PORTS)
    expect(clampPorts(99)).toBe(MANIFOLD_MAX_PORTS)
    expect(clampPorts(3.4)).toBe(3)
    expect(clampPorts('5')).toBe(5)
  })

  it('manifoldPins yields P plus one numbered work port per count', () => {
    const pins = manifoldPins(4)
    expect(pins).toHaveLength(5)
    expect(pins[0].id).toBe('P')
    expect(pins.slice(1).map(p => p.id)).toEqual(['A1', 'A2', 'A3', 'A4'])
    // Work ports sit on the bottom edge (south) and are evenly spaced.
    const xs = pins.slice(1).map(p => p.relX)
    expect(pins.slice(1).every(p => p.direction === 'S')).toBe(true)
    const gaps = xs.slice(1).map((x, i) => +(x - xs[i]).toFixed(3))
    expect(new Set(gaps).size).toBe(1)
  })

  it('the block grows with the port count', () => {
    expect(manifoldGeom(8).width).toBeGreaterThan(manifoldGeom(2).width)
  })

  it('manifoldDrawing emits one stub per work port', () => {
    expect(manifoldDrawing(6).stubs).toHaveLength(6)
  })
})
