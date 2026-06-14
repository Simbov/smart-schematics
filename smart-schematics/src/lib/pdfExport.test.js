import { describe, it, expect } from 'vitest'
import { fitImageToArea, titleBlockLayout, pageLabel, A4_LANDSCAPE, PAGE_MARGIN, TITLE_BLOCK_HEIGHT } from './pdfExport'

describe('pdfExport geometry', () => {
  it('fits a wide image to the available width, centred vertically', () => {
    // Very wide image → width-bound.
    const r = fitImageToArea(1000, 100)
    const availW = A4_LANDSCAPE.width - PAGE_MARGIN * 2
    expect(r.w).toBeCloseTo(availW, 5)
    expect(r.x).toBeCloseTo(PAGE_MARGIN, 5)
    expect(r.y).toBeGreaterThan(PAGE_MARGIN) // centred in the taller available area
  })

  it('fits a tall image to the available height, centred horizontally', () => {
    const r = fitImageToArea(100, 1000)
    const availH = A4_LANDSCAPE.height - PAGE_MARGIN * 2 - TITLE_BLOCK_HEIGHT
    expect(r.h).toBeCloseTo(availH, 5)
    expect(r.x).toBeGreaterThan(PAGE_MARGIN)
  })

  it('never lets the artwork overlap the title block', () => {
    const r = fitImageToArea(1000, 1000)
    const tb = titleBlockLayout()
    expect(r.y + r.h).toBeLessThanOrEqual(tb.y + 0.001)
  })

  it('title block sits along the bottom margin with three cells spanning the width', () => {
    const tb = titleBlockLayout()
    expect(tb.y).toBeCloseTo(A4_LANDSCAPE.height - PAGE_MARGIN - TITLE_BLOCK_HEIGHT, 5)
    const span = tb.cells.reduce((s, c) => s + c.w, 0)
    expect(span).toBeCloseTo(tb.w, 5)
  })

  it('falls back to the full area for a zero-size image', () => {
    const r = fitImageToArea(0, 0)
    expect(r.w).toBeGreaterThan(0)
    expect(r.h).toBeGreaterThan(0)
  })

  it('pageLabel is 1-based', () => {
    expect(pageLabel(0, 5)).toBe('Page 1 of 5')
    expect(pageLabel(4, 5)).toBe('Page 5 of 5')
  })
})
