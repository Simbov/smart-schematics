import { describe, it, expect } from 'vitest'
import { GRID_SIZES, clampGridSize } from './gridOptions'

describe('clampGridSize', () => {
  it('passes valid options through unchanged', () => {
    for (const s of GRID_SIZES) {
      expect(clampGridSize(s)).toBe(s)
    }
  })

  it('maps arbitrary inputs to the nearest valid option', () => {
    expect(clampGridSize(6)).toBe(5)    // closer to 5 than 10
    expect(clampGridSize(8)).toBe(10)   // closer to 10 than 5
    expect(clampGridSize(12)).toBe(10)
    expect(clampGridSize(22)).toBe(20)
    expect(clampGridSize(23)).toBe(25)
    expect(clampGridSize(40)).toBe(50)
    expect(clampGridSize(1000)).toBe(50) // above max clamps to largest
    expect(clampGridSize(1)).toBe(5)     // below min clamps to smallest
  })

  it('handles non-finite / invalid input by falling back to default 10', () => {
    expect(clampGridSize(NaN)).toBe(10)
    expect(clampGridSize(undefined)).toBe(10)
    expect(clampGridSize('abc')).toBe(10)
    // Number(null) === 0 (finite) → clamps to nearest option (5), not the fallback.
    expect(clampGridSize(null)).toBe(5)
  })

  it('resolves an exact midpoint tie to the smaller option', () => {
    // 7.5 is equidistant from 5 and 10 → smaller (5) wins.
    expect(clampGridSize(7.5)).toBe(5)
  })
})
