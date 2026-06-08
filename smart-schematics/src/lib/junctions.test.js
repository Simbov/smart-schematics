import { describe, it, expect } from 'vitest'
import { createJunction, junctionsOnWire, junctionsOnWires } from './junctions'

const wire = (id, pts) => ({ id, points: pts })

describe('junctions', () => {
  it('createJunction makes a manual node with empty content + an id', () => {
    const j = createJunction({ x: 10, y: 20 })
    expect(j).toMatchObject({ x: 10, y: 20, manual: true, label: '', blocks: [] })
    expect(j.id).toMatch(/^jct_/)
  })

  it('junctionsOnWire matches points lying on the wire polyline', () => {
    const w = wire('w1', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }])
    const js = [
      createJunction({ id: 'a', x: 50, y: 0 }),   // on first segment
      createJunction({ id: 'b', x: 100, y: 25 }),  // on second segment
      createJunction({ id: 'c', x: 40, y: 40 }),   // off the wire
    ]
    expect(junctionsOnWire(js, w).sort()).toEqual(['a', 'b'])
  })

  it('junctionsOnWires dedupes across multiple wires', () => {
    const w1 = wire('w1', [{ x: 0, y: 0 }, { x: 100, y: 0 }])
    const w2 = wire('w2', [{ x: 50, y: 0 }, { x: 50, y: 80 }]) // shares (50,0)
    const js = [createJunction({ id: 'shared', x: 50, y: 0 })]
    expect(junctionsOnWires(js, [w1, w2])).toEqual(['shared'])
  })

  it('handles empty inputs gracefully', () => {
    expect(junctionsOnWire([], null)).toEqual([])
    expect(junctionsOnWires([], [])).toEqual([])
  })
})
