import { describe, it, expect } from 'vitest'
import { ELECTRICAL_COMPONENTS, getElectricalDef } from './electrical.js'
import { ELECTRICAL_SYMBOL_MAP } from '../symbols/electrical/index.js'

// Stage 4 (v0.2.0): basic connector library (Deutsch DT, M12 A-code, headers).

const CONNECTOR_TYPES = [
  'conn_dt_2', 'conn_dt_3', 'conn_dt_4',
  'conn_acode_3', 'conn_acode_4',
  'conn_header_2', 'conn_header_4',
]
const GRID = 10

describe('connector library', () => {
  it('registers exactly the expected connector types in the Connectors category', () => {
    const cats = ELECTRICAL_COMPONENTS.filter(c => c.category === 'Connectors').map(c => c.type)
    expect(new Set(cats)).toEqual(new Set(CONNECTOR_TYPES))
  })

  for (const type of CONNECTOR_TYPES) {
    describe(type, () => {
      const def = getElectricalDef(type)

      it('exists with category Connectors and a label', () => {
        expect(def).toBeTruthy()
        expect(def.category).toBe('Connectors')
        expect(typeof def.label).toBe('string')
      })

      it('has >=2 pins, unique ids, all on the grid', () => {
        expect(def.pins.length).toBeGreaterThanOrEqual(2)
        const ids = def.pins.map(p => p.id)
        expect(new Set(ids).size).toBe(ids.length) // unique
        for (const p of def.pins) {
          expect(p.relX % GRID).toBe(0)
          expect(Math.abs(p.relY % GRID)).toBe(0)
          expect(['N', 'S', 'E', 'W']).toContain(p.direction)
        }
      })

      it('has a registered symbol component', () => {
        expect(typeof ELECTRICAL_SYMBOL_MAP[type]).toBe('function')
      })
    })
  }
})
