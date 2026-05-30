import { describe, it, expect } from 'vitest'
import { chooseLabelSide } from './labelPlacement.js'

const def = { width: 40, height: 20 }
const comp = (designator, x = 0, y = 0, rotation = 0) => ({ designator, x, y, rotation })

describe('chooseLabelSide', () => {
  it('defaults to top when there are no wires', () => {
    expect(chooseLabelSide(comp('R1'), def, [])).toBe('top')
  })

  it('returns top for a component with no designator', () => {
    expect(chooseLabelSide(comp(''), def, [{ points: [{ x: -50, y: -30 }, { x: 50, y: -30 }] }])).toBe('top')
  })

  it('dodges to a clear side when a wire runs through the top label box', () => {
    // Horizontal wire across the top, where the default 'top' label would sit.
    const wires = [{ points: [{ x: -50, y: -25 }, { x: 50, y: -25 }] }]
    const side = chooseLabelSide(comp('R1'), def, wires)
    expect(side).not.toBe('top')
    expect(['bottom', 'right', 'left']).toContain(side)
  })

  it('falls back to top when every side is obstructed', () => {
    // Surround the component with wire segments on all four candidate boxes.
    const wires = [
      { points: [{ x: -50, y: -25 }, { x: 50, y: -25 }] },  // top
      { points: [{ x: -50, y: 25 }, { x: 50, y: 25 }] },    // bottom
      { points: [{ x: 35, y: -30 }, { x: 35, y: 30 }] },    // right
      { points: [{ x: -35, y: -30 }, { x: -35, y: 30 }] },  // left
    ]
    expect(chooseLabelSide(comp('R1'), def, wires)).toBe('top')
  })
})
