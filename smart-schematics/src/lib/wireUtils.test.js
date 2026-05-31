import { describe, it, expect } from 'vitest'
import { wireConnectionCount, pruneJunctions, findNearestPin } from './wireUtils.js'

const w = (...pts) => ({ id: `w${Math.random()}`, points: pts.map(([x, y]) => ({ x, y })) })

describe('wireConnectionCount', () => {
  it('counts each wire endpoint landing on the point as 1', () => {
    const wires = [w([0, 0], [10, 0]), w([0, 0], [0, 10]), w([0, 0], [-10, 0])]
    expect(wireConnectionCount(0, 0, wires)).toBe(3)
  })

  it('counts a wire passing through the point (T-junction) as 2', () => {
    const passThrough = w([-10, 0], [10, 0])        // crosses (0,0) mid-segment
    const tap = w([0, 0], [0, 10])                  // ends at (0,0)
    expect(wireConnectionCount(0, 0, [passThrough, tap])).toBe(3)
  })
})

describe('pruneJunctions', () => {
  it('keeps a junction where 3 wires still meet', () => {
    const wires = [w([0, 0], [10, 0]), w([0, 0], [0, 10]), w([0, 0], [-10, 0])]
    const junctions = [{ id: 'j1', x: 0, y: 0 }]
    expect(pruneJunctions(junctions, wires)).toHaveLength(1)
  })

  it('drops the node when 2 of 3 meeting wires are deleted (only 1 lead left)', () => {
    // Originally three wires met at (0,0). The user deletes two of them; one
    // dangling endpoint remains, so the dot must disappear.
    const remaining = [w([0, 0], [10, 0])]
    const junctions = [{ id: 'j1', x: 0, y: 0 }]
    expect(pruneJunctions(junctions, remaining)).toHaveLength(0)
  })

  it('drops a T-junction once the tap wire is removed (pass-through only = 2)', () => {
    const passThrough = w([-10, 0], [10, 0])
    const junctions = [{ id: 'j1', x: 0, y: 0 }]
    expect(pruneJunctions(junctions, [passThrough])).toHaveLength(0)
  })

  it('leaves unrelated junctions untouched', () => {
    const wires = [w([0, 0], [10, 0]), w([0, 0], [0, 10]), w([0, 0], [-10, 0])]
    const junctions = [{ id: 'j1', x: 0, y: 0 }, { id: 'j2', x: 999, y: 999 }]
    const kept = pruneJunctions(junctions, wires)
    expect(kept.map(j => j.id)).toEqual(['j1'])
  })
})

describe('findNearestPin', () => {
  // Horizontal 2-pin component at (100,100); after a 90° rotation the pins
  // move to the rotated absolute positions carried in absX/absY.
  const rotatedComp = {
    id: 'c1', x: 100, y: 100,
    pins: [
      { id: 'A', relX: -20, relY: 0, absX: 100, absY: 80 },
      { id: 'B', relX: 20, relY: 0, absX: 100, absY: 120 },
    ],
  }

  it('snaps to the rotated pin position (absX/absY), not the unrotated offset', () => {
    const hit = findNearestPin(100, 120, [rotatedComp], 6, 0)
    expect(hit).toMatchObject({ type: 'pin', componentId: 'c1', pinId: 'B', x: 100, y: 120 })
  })

  it('does not snap at the stale unrotated location', () => {
    // (120,100) is where pin B would sit before rotation — must no longer match.
    expect(findNearestPin(120, 100, [rotatedComp], 6, 0)).toBeNull()
  })

  it('falls back to comp.x+relX when absX/absY are absent', () => {
    const comp = { id: 'c2', x: 0, y: 0, pins: [{ id: 'A', relX: 20, relY: 0 }] }
    const hit = findNearestPin(20, 0, [comp], 6, 0)
    expect(hit).toMatchObject({ pinId: 'A', x: 20, y: 0 })
  })
})
