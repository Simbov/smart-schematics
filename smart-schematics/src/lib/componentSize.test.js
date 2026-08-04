import { describe, it, expect } from 'vitest'
import { componentSize } from './componentSize'
import { getHydraulicDef } from './components/hydraulic'
import { getElectricalDef } from './components/electrical'
import { manifoldGeom } from './manifold'

describe('componentSize', () => {
  it('returns the static footprint for a fixed symbol', () => {
    const def = getElectricalDef('resistor')
    expect(componentSize({ type: 'resistor', simParams: {} })).toEqual({
      width: def.width, height: def.height,
    })
  })

  it('reads a box off the instance, not a def', () => {
    expect(componentSize({ type: 'box', box: { width: 240, height: 120 } }))
      .toEqual({ width: 240, height: 120 })
  })

  it('falls back for a box with no stored geometry', () => {
    expect(componentSize({ type: 'box' })).toEqual({ width: 80, height: 60 })
  })

  it('grows a manifold with its port count (regression: bounds were frozen at the default)', () => {
    const def = getHydraulicDef('hyd_manifold')
    const small = componentSize({ type: 'hyd_manifold', simParams: { ports: 2 } }, def)
    const large = componentSize({ type: 'hyd_manifold', simParams: { ports: 16 } }, def)
    expect(large.width).toBeGreaterThan(small.width)
    expect(large.width).toBe(manifoldGeom(16).width + 24)
    // The static def field still describes the default-parameter part.
    expect(def.width).toBe(manifoldGeom(4).width + 24)
  })

  it('narrows the valve builder when it drops to two positions', () => {
    const def = getHydraulicDef('hyd_dcv_custom')
    const three = componentSize({ type: 'hyd_dcv_custom', simParams: { positions: '3' } }, def)
    const two = componentSize({ type: 'hyd_dcv_custom', simParams: { positions: '2' } }, def)
    expect(three.width).toBe(160)
    expect(two.width).toBe(130)
  })

  it('falls back to the static footprint when sizeFor returns something unusable', () => {
    const def = { width: 44, height: 22, sizeFor: () => ({ width: 0, height: NaN }) }
    expect(componentSize({ type: 'x', simParams: {} }, def)).toEqual({ width: 44, height: 22 })
  })

  it('uses the historic default for an unknown type', () => {
    expect(componentSize({ type: 'custom_gone' }, null)).toEqual({ width: 40, height: 20 })
  })
})
