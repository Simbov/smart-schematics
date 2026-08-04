import { describe, it, expect } from 'vitest'
import { splitDesignator, nextDesignator, allocateDesignator, renumberForPaste } from './designators'

describe('splitDesignator', () => {
  it('splits a prefix from its trailing number', () => {
    expect(splitDesignator('R12')).toEqual({ prefix: 'R', n: 12 })
    expect(splitDesignator('KM3')).toEqual({ prefix: 'KM', n: 3 })
  })

  it('returns null when there is no trailing number to allocate against', () => {
    expect(splitDesignator('MAIN CONTACTOR')).toBeNull()
    expect(splitDesignator('')).toBeNull()
    expect(splitDesignator(undefined)).toBeNull()
  })
})

describe('nextDesignator', () => {
  it('starts at 1 on an empty sheet', () => {
    expect(nextDesignator('R', [])).toBe('R1')
  })

  it('only considers designators sharing the prefix', () => {
    expect(nextDesignator('R', ['C1', 'C2', 'LED1'])).toBe('R1')
  })

  it('does not confuse a longer prefix for a shorter one', () => {
    expect(nextDesignator('K', ['KM1', 'KM2'])).toBe('K1')
    expect(nextDesignator('KM', ['K1'])).toBe('KM1')
  })

  it('fills the lowest free gap', () => {
    expect(nextDesignator('R', ['R1', 'R3'])).toBe('R2')
  })
})

describe('allocateDesignator (regression: duplicate after delete)', () => {
  it('never reuses a number that is still on the sheet', () => {
    // The old rule counted components of the type: deleting R1 out of [R1, R2]
    // left count = 1, so the next resistor was numbered R2 — a duplicate.
    const afterDeletingR1 = [{ designator: 'R2', type: 'resistor' }]
    expect(allocateDesignator('R', afterDeletingR1)).toBe('R1')

    const afterDeletingR2 = [{ designator: 'R1', type: 'resistor' }]
    expect(allocateDesignator('R', afterDeletingR2)).toBe('R2')
  })

  it('allocates across every component, not just the same type', () => {
    // Connectors and Deutsch plugs share the 'X' prefix across different types.
    const existing = [
      { designator: 'X1', type: 'conn_dt_2' },
      { designator: 'X2', type: 'conn_acode_3' },
    ]
    expect(allocateDesignator('X', existing)).toBe('X3')
  })
})

describe('renumberForPaste (regression: duplicate on paste/duplicate)', () => {
  it('gives each pasted component a free number', () => {
    const existing = [{ designator: 'R1' }, { designator: 'R2' }]
    const out = renumberForPaste([{ designator: 'R1' }], existing)
    expect(out[0].designator).toBe('R3')
  })

  it('does not collide within a single multi-item paste', () => {
    const existing = [{ designator: 'R1' }]
    const out = renumberForPaste([{ designator: 'R1' }, { designator: 'R1' }], existing)
    expect(out.map(c => c.designator)).toEqual(['R2', 'R3'])
  })

  it('renumbers per prefix independently', () => {
    const existing = [{ designator: 'R1' }, { designator: 'C1' }]
    const out = renumberForPaste([{ designator: 'R1' }, { designator: 'C1' }], existing)
    expect(out.map(c => c.designator)).toEqual(['R2', 'C2'])
  })

  it('leaves an un-numbered, user-typed designator alone', () => {
    const out = renumberForPaste([{ designator: 'MAIN CONTACTOR' }], [])
    expect(out[0].designator).toBe('MAIN CONTACTOR')
  })

  it('does not mutate the incoming components', () => {
    const incoming = [{ designator: 'R1', id: 'a' }]
    renumberForPaste(incoming, [{ designator: 'R1' }])
    expect(incoming[0].designator).toBe('R1')
  })
})
