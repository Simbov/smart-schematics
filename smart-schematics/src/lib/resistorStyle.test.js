import { describe, it, expect } from 'vitest'
import { resolveResistorStyle, RESISTOR_STYLES } from './resistorStyle.js'

describe('resolveResistorStyle', () => {
  it('per-component override wins over the global default', () => {
    expect(resolveResistorStyle({ resistorStyle: 'IEEE' }, { resistorStyle: 'IEC' })).toBe('IEEE')
    expect(resolveResistorStyle({ resistorStyle: 'IEC' }, { resistorStyle: 'IEEE' })).toBe('IEC')
  })

  it('falls back to the global default when no override', () => {
    expect(resolveResistorStyle({}, { resistorStyle: 'IEEE' })).toBe('IEEE')
    expect(resolveResistorStyle({ resistorStyle: undefined }, { resistorStyle: 'IEEE' })).toBe('IEEE')
  })

  it('defaults to IEC when neither is set or value is unknown', () => {
    expect(resolveResistorStyle({}, {})).toBe('IEC')
    expect(resolveResistorStyle(undefined, undefined)).toBe('IEC')
    expect(resolveResistorStyle({ resistorStyle: 'bogus' }, {})).toBe('IEC')
    expect(resolveResistorStyle({}, { resistorStyle: 'bogus' })).toBe('IEC')
  })

  it('exposes the known styles', () => {
    expect(RESISTOR_STYLES).toEqual(['IEC', 'IEEE'])
  })
})
