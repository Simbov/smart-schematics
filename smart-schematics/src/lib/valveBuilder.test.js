import { describe, it, expect } from 'vitest'
import {
  clampPorts, clampPositions, valveConfig, valvePins,
  valvePositionKeys, valveDefaultPosition, valveRouting, valveConductingPairs,
} from './valveBuilder'

describe('valve builder model (issue #20)', () => {
  it('clamps ports and positions to allowed values', () => {
    expect(clampPorts(4)).toBe(4)
    expect(clampPorts(7)).toBe(4)   // unsupported → default 4
    expect(clampPorts('3')).toBe(3)
    expect(clampPositions('2')).toBe(2)
    expect(clampPositions(9)).toBe(3)
  })

  it('generates the right pins per port count', () => {
    expect(valvePins(2).map(p => p.id)).toEqual(['P', 'A'])
    expect(valvePins(3).map(p => p.id)).toEqual(['P', 'T', 'A'])
    expect(valvePins(4).map(p => p.id)).toEqual(['P', 'T', 'A', 'B'])
  })

  it('exposes position keys + default neutral position', () => {
    expect(valvePositionKeys({ positions: 3 })).toEqual(['a', 'center', 'b'])
    expect(valvePositionKeys({ positions: 2 })).toEqual(['a', 'b'])
    expect(valveDefaultPosition({ positions: 3 })).toBe('center')
    expect(valveDefaultPosition({ positions: 2 })).toBe('b')
  })

  it('routes a 4-port valve: crossed/parallel extremes + centre condition', () => {
    const cfg = { ports: 4, positions: 3, centerPosition: 'closed' }
    const r = valveRouting(cfg)
    expect(r.a).toEqual([['P', 'B'], ['A', 'T']])
    expect(r.b).toEqual([['P', 'A'], ['B', 'T']])
    expect(r.center).toEqual([])
    expect(valveRouting({ ...cfg, centerPosition: 'open' }).center).toEqual([['P', 'T'], ['A', 'T'], ['B', 'T']])
    expect(valveRouting({ ...cfg, centerPosition: 'tandem' }).center).toEqual([['P', 'T']])
  })

  it('a 2-position valve has no centre key', () => {
    expect(valveRouting({ ports: 4, positions: 2 }).center).toBeUndefined()
  })

  it('valveConductingPairs falls back to the neutral position', () => {
    const cfg = { ports: 4, positions: 3, centerPosition: 'closed' }
    expect(valveConductingPairs(cfg)).toEqual([])          // defaults to centre
    expect(valveConductingPairs(cfg, 'b')).toEqual([['P', 'A'], ['B', 'T']])
  })
})
