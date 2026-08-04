import { describe, it, expect } from 'vitest'
import { ELECTRICAL_COMPONENTS, getElectricalDef } from './electrical'
import { HYDRAULIC_COMPONENTS, getHydraulicDef } from './hydraulic'
import { ELECTRICAL_SYMBOL_MAP } from '../symbols/electrical'
import { HYDRAULIC_SYMBOL_MAP } from '../symbols/HydraulicSymbols'
import { componentSize } from '../componentSize'

// Library-wide invariants. A def that is missing a symbol renders as nothing on
// the canvas (PlacedComponent bails out), and a parametric def whose contract is
// half-wired silently falls back to a frozen footprint or an un-rebuilt pin set
// — both fail quietly, which is why they are worth asserting.

const ALL = [
  ...ELECTRICAL_COMPONENTS.map(d => [d, ELECTRICAL_SYMBOL_MAP]),
  ...HYDRAULIC_COMPONENTS.map(d => [d, HYDRAULIC_SYMBOL_MAP]),
]

describe('component library registry', () => {
  it('has a symbol for every def', () => {
    const missing = ALL.filter(([def, map]) => !map[def.type]).map(([def]) => def.type)
    expect(missing).toEqual([])
  })

  it('has no duplicate types', () => {
    const types = ALL.map(([def]) => def.type)
    expect(new Set(types).size).toBe(types.length)
  })

  it('gives every def the fields the canvas and library card need', () => {
    for (const [def] of ALL) {
      expect(def, def.type).toMatchObject({
        label: expect.any(String),
        category: expect.any(String),
        defaultDesignatorPrefix: expect.any(String),
        viewBox: expect.any(String),
      })
      expect(def.width, def.type).toBeGreaterThan(0)
      expect(def.height, def.type).toBeGreaterThan(0)
      expect(Array.isArray(def.pins), def.type).toBe(true)
    }
  })

  it('gives every pin a unique id and a direction', () => {
    for (const [def] of ALL) {
      const ids = def.pins.map(p => p.id)
      expect(new Set(ids).size, `${def.type} pin ids`).toBe(ids.length)
      for (const p of def.pins) {
        expect(['N', 'S', 'E', 'W'], `${def.type}.${p.id}`).toContain(p.direction)
      }
    }
  })
})

describe('parametric def contract', () => {
  const parametric = ALL.map(([def]) => def).filter(d => d.sizeFor || d.derivePins)

  it('covers the parts that are meant to be parametric', () => {
    expect(parametric.map(d => d.type).sort()).toEqual([
      'harness_connector', 'hyd_dcv_custom', 'hyd_manifold', 'safety_io_module',
      'safety_relay', 'selector_switch', 'terminal_strip',
    ])
  })

  it('pairs sizeFor with derivePins on every parametric def', () => {
    for (const def of parametric) {
      expect(typeof def.sizeFor, def.type).toBe('function')
      expect(typeof def.derivePins, def.type).toBe('function')
    }
  })

  it('declares exactly which params rebuild the pin set', () => {
    for (const def of parametric) {
      const rebuilding = Object.entries(def.simParams || {}).filter(([, p]) => p.rebuildsPins)
      expect(rebuilding.length, `${def.type} has no rebuildsPins param`).toBeGreaterThan(0)
    }
  })

  it('reproduces the shipped default pins and footprint from the default params', () => {
    for (const def of parametric) {
      const defaults = Object.fromEntries(
        Object.entries(def.simParams || {}).map(([k, p]) => [k, p.default])
      )
      // The static `pins` / `width` / `height` fields must describe the same part
      // the parametric functions produce at the defaults, or a freshly placed
      // component changes shape the first time any param is touched.
      expect(def.derivePins(defaults), `${def.type} pins`).toEqual(def.pins)
      expect(def.sizeFor(defaults), `${def.type} size`)
        .toEqual({ width: def.width, height: def.height })
    }
  })

  it('never returns a degenerate size or an empty pin set', () => {
    for (const def of parametric) {
      for (const params of [{}, { ways: -5, ports: -5, channels: -5, positions: -5, poles: -5, contacts: -5 },
                            { ways: 1e6, ports: 1e6, channels: 1e6, positions: 1e6, poles: 1e6, contacts: 1e6 }]) {
        const size = def.sizeFor(params)
        expect(size.width, def.type).toBeGreaterThan(0)
        expect(size.height, def.type).toBeGreaterThan(0)
        expect(def.derivePins(params).length, def.type).toBeGreaterThan(0)
      }
    }
  })

  it('is what componentSize actually reads', () => {
    const def = getElectricalDef('terminal_strip')
    expect(componentSize({ type: 'terminal_strip', simParams: { ways: 20 } }, def))
      .toEqual(def.sizeFor({ ways: 20 }))
  })
})

describe('industrial control section', () => {
  const INDUSTRIAL = [
    'terminal_strip', 'harness_connector', 'safety_relay',
    'safety_io_module', 'selector_switch', 'panel_indicator',
  ]

  it('registers all six parts under one category', () => {
    for (const type of INDUSTRIAL) {
      const def = getElectricalDef(type)
      expect(def, type).toBeTruthy()
      expect(def.category, type).toBe('Industrial Control')
      expect(ELECTRICAL_SYMBOL_MAP[type], type).toBeTruthy()
    }
  })

  it('is searchable by the words an engineer would type', () => {
    const find = q => ELECTRICAL_COMPONENTS.filter(d =>
      d.label.toLowerCase().includes(q) ||
      d.type.toLowerCase().includes(q) ||
      d.tags?.some(t => t.toLowerCase().includes(q))
    ).map(d => d.type)

    expect(find('terminal')).toContain('terminal_strip')
    expect(find('harness')).toContain('harness_connector')
    expect(find('e-stop')).toContain('safety_relay')
    expect(find('force-guided')).toContain('safety_relay')
    expect(find('test output')).toContain('safety_io_module')
    expect(find('rotary')).toContain('selector_switch')
    expect(find('pilot light')).toContain('panel_indicator')
  })

  it('does not collide with the hydraulic library', () => {
    for (const type of INDUSTRIAL) expect(getHydraulicDef(type)).toBeNull()
  })
})
