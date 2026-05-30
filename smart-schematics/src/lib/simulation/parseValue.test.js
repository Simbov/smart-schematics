import { describe, it, expect } from 'vitest'
import { parseValue, formatSI } from './parseValue.js'

const p = (s) => parseValue(s, 'DEFAULT')

describe('parseValue — plain numbers', () => {
  it('parses integers and decimals', () => {
    expect(p('150000')).toBe(150000)      // user-reported
    expect(p('3300')).toBe(3300)
    expect(p('0')).toBe(0)
    expect(p('0.5')).toBeCloseTo(0.5)
    expect(p('.5')).toBeCloseTo(0.5)
    expect(p('-3.3')).toBeCloseTo(-3.3)
    expect(p('+9')).toBe(9)
  })

  it('tolerates surrounding whitespace', () => {
    expect(p('  150000  ')).toBe(150000)
    expect(p('1 k')).toBe(1000)
  })
})

describe('parseValue — scientific notation', () => {
  it('parses e-notation', () => {
    expect(p('1e3')).toBe(1000)
    expect(p('1E3')).toBe(1000)
    expect(p('2.2e-6')).toBeCloseTo(2.2e-6)
    expect(p('4.7e3')).toBeCloseTo(4700)
  })
})

describe('parseValue — SI prefixes (case-sensitive M vs m)', () => {
  it('handles mega vs milli correctly', () => {
    expect(p('1M')).toBe(1e6)        // user-reported: mega
    expect(p('1m')).toBeCloseTo(1e-3) // user-reported: milli
    expect(p('2.2M')).toBeCloseTo(2.2e6)
    expect(p('100m')).toBeCloseTo(0.1)
  })

  it('handles the full prefix range', () => {
    expect(p('1T')).toBe(1e12)
    expect(p('1G')).toBe(1e9)
    expect(p('4.7k')).toBeCloseTo(4700)
    expect(p('1K')).toBe(1000)        // uppercase K = kilo
    expect(p('10u')).toBeCloseTo(1e-5)
    expect(p('10U')).toBeCloseTo(1e-5)
    expect(p('10µ')).toBeCloseTo(1e-5)
    expect(p('470n')).toBeCloseTo(4.7e-7)
    expect(p('100p')).toBeCloseTo(1e-10)
  })

  it('parses SPICE "meg" as mega', () => {
    expect(p('1meg')).toBe(1e6)
    expect(p('4.7MEG')).toBeCloseTo(4.7e6)
  })
})

describe('parseValue — units stripped safely', () => {
  it('strips a trailing unit without eating the prefix', () => {
    expect(p('1MΩ')).toBe(1e6)        // mega-ohm, NOT 1
    expect(p('4.7kΩ')).toBeCloseTo(4700)
    expect(p('100mA')).toBeCloseTo(0.1)
    expect(p('1mH')).toBeCloseTo(1e-3)  // millihenry
    expect(p('9V')).toBe(9)
    expect(p('220ohm')).toBe(220)
    expect(p('1MHz')).toBe(1e6)
    expect(p('10µF')).toBeCloseTo(1e-5)
  })
})

describe('parseValue — RKM / infix notation', () => {
  it('parses prefix-as-decimal-point notation', () => {
    expect(p('1k5')).toBe(1500)
    expect(p('2k2')).toBe(2200)
    expect(p('4R7')).toBeCloseTo(4.7)
    expect(p('1R0')).toBeCloseTo(1)
    expect(p('220R')).toBe(220)
    expect(p('1M5')).toBe(1.5e6)
    expect(p('R47')).toBeCloseTo(0.47)
  })
})

describe('parseValue — invalid input falls back to default', () => {
  it('returns the default for unparseable strings', () => {
    expect(p('')).toBe('DEFAULT')
    expect(p(null)).toBe('DEFAULT')
    expect(p(undefined)).toBe('DEFAULT')
    expect(p('abc')).toBe('DEFAULT')
    expect(p('M')).toBe('DEFAULT')    // bare prefix
    expect(p('R')).toBe('DEFAULT')
    expect(p('1.2.3')).toBe('DEFAULT')
  })
})

describe('formatSI', () => {
  it('formats with SI prefixes (no integer clobbering)', () => {
    expect(formatSI(150000, 'Ω')).toBe('150kΩ')
    expect(formatSI(1e6, 'Ω')).toBe('1MΩ')
    expect(formatSI(4700, 'Ω')).toBe('4.7kΩ')
    expect(formatSI(0.1, 'A')).toBe('100mA')   // was '1mA' before the fix
    expect(formatSI(0.001, 'A')).toBe('1mA')
    expect(formatSI(0, 'V')).toBe('0V')
    expect(formatSI(9, 'V')).toBe('9V')
  })

  it('round-trips with parseValue', () => {
    for (const n of [150000, 1e6, 0.001, 2200000, 0.1, 4700, 9, 1.5e6]) {
      expect(parseValue(formatSI(n, 'Ω'), 'ERR')).toBeCloseTo(n)
    }
  })

  it('handles invalid input', () => {
    expect(formatSI(NaN, 'V')).toBe('?V')
    expect(formatSI(Infinity, 'V')).toBe('?V')
    expect(formatSI(null)).toBe('?')
  })
})
