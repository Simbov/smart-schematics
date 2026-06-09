import { describe, it, expect } from 'vitest'
import { isCropped, normalizeCrop, cropToImageRect, FULL_CROP } from './imageUtils'

describe('image crop helpers', () => {
  it('isCropped is false for null / full frame, true once trimmed', () => {
    expect(isCropped(null)).toBe(false)
    expect(isCropped(FULL_CROP)).toBe(false)
    expect(isCropped({ x: 0.1, y: 0, w: 0.9, h: 1 })).toBe(true)
  })

  it('normalizeCrop clamps to [0,1] with a minimum size', () => {
    expect(normalizeCrop(null)).toEqual(FULL_CROP)
    const c = normalizeCrop({ x: -0.5, y: 0.9, w: 2, h: 0.5 })
    expect(c.x).toBeGreaterThanOrEqual(0)
    expect(c.x + c.w).toBeLessThanOrEqual(1.0001)
    expect(c.y + c.h).toBeLessThanOrEqual(1.0001)
  })

  it('cropToImageRect scales the image so the crop fills the display box', () => {
    // Crop the right half: x=0.5,w=0.5 over a 100-wide display box.
    const img = { x: 0, y: 0, width: 100, height: 100, crop: { x: 0.5, y: 0, w: 0.5, h: 1 } }
    const r = cropToImageRect(img)
    expect(r.imageW).toBeCloseTo(200, 5)        // full image is twice the box wide
    expect(r.imageH).toBeCloseTo(100, 5)
    expect(r.imageX).toBeCloseTo(-100, 5)       // shifted so the right half lands at x=0
    expect(r.clip).toEqual({ x: 0, y: 0, w: 100, h: 100 })
  })

  it('full crop renders 1:1 with the display box', () => {
    const img = { x: 10, y: 20, width: 80, height: 40, crop: FULL_CROP }
    const r = cropToImageRect(img)
    expect(r.imageW).toBeCloseTo(80, 5)
    expect(r.imageH).toBeCloseTo(40, 5)
    expect(r.imageX).toBeCloseTo(10, 5)
    expect(r.imageY).toBeCloseTo(20, 5)
  })
})
