import { describe, it, expect } from 'vitest'
import {
  aspectFitSize,
  defaultPlacement,
  snapBox,
  resizeBox,
  snap,
  MIN_IMAGE_SIZE,
  DEFAULT_MAX_SIZE,
  RESIZE_HANDLES,
} from './imageUtils.js'

describe('aspectFitSize', () => {
  it('leaves images within the cap unchanged', () => {
    expect(aspectFitSize(200, 100)).toEqual({ width: 200, height: 100 })
  })

  it('clamps an oversize landscape image preserving ratio', () => {
    const { width, height } = aspectFitSize(800, 400, 400)
    expect(width).toBe(400)
    expect(height).toBe(200)
    expect(width / height).toBeCloseTo(800 / 400)
  })

  it('clamps an oversize portrait image preserving ratio', () => {
    const { width, height } = aspectFitSize(400, 800, 400)
    expect(height).toBe(400)
    expect(width).toBe(200)
    expect(width / height).toBeCloseTo(400 / 800)
  })

  it('uses the default cap when none is given', () => {
    const { width, height } = aspectFitSize(2000, 1000)
    expect(Math.max(width, height)).toBe(DEFAULT_MAX_SIZE)
  })

  it('falls back to a square cap when a dimension is missing', () => {
    expect(aspectFitSize(0, 0, 300)).toEqual({ width: 300, height: 300 })
    expect(aspectFitSize(100, 0, 250)).toEqual({ width: 250, height: 250 })
  })
})

describe('snap', () => {
  it('rounds to the nearest grid multiple', () => {
    expect(snap(13, 10)).toBe(10)
    expect(snap(16, 10)).toBe(20)
    expect(snap(-13, 10)).toBe(-10)
  })
  it('is a no-op when grid is 0 or missing', () => {
    expect(snap(13, 0)).toBe(13)
    expect(snap(13)).toBe(13)
  })
})

describe('defaultPlacement', () => {
  it('centers the box on the point', () => {
    // size 100x60 centered on (200,200) → origin (150,170)
    expect(defaultPlacement(200, 200, { width: 100, height: 60 }, 0)).toEqual({ x: 150, y: 170 })
  })

  it('snaps the centered origin to the grid', () => {
    // center 205,200 size 100x60 → raw origin 155,170 → snap10 → 160,170
    expect(defaultPlacement(205, 200, { width: 100, height: 60 }, 10)).toEqual({ x: 160, y: 170 })
  })

  it('snaps an off-grid centered origin', () => {
    // center 203,203 size 100x60 → raw origin 153,173 → snap10 → 150,170
    expect(defaultPlacement(203, 203, { width: 100, height: 60 }, 10)).toEqual({ x: 150, y: 170 })
  })
})

describe('snapBox', () => {
  it('snaps the origin and leaves size alone', () => {
    expect(snapBox({ x: 13, y: 27, width: 100, height: 50 }, 10))
      .toEqual({ x: 10, y: 30, width: 100, height: 50 })
  })
})

describe('resizeBox', () => {
  const box = { x: 100, y: 100, width: 200, height: 100 }

  it('se handle grows width & height, origin fixed', () => {
    expect(resizeBox(box, 'se', 40, 20)).toEqual({ x: 100, y: 100, width: 240, height: 120 })
  })

  it('nw handle moves origin and shrinks both dims', () => {
    expect(resizeBox(box, 'nw', 20, 10)).toEqual({ x: 120, y: 110, width: 180, height: 90 })
  })

  it('e edge changes only width', () => {
    expect(resizeBox(box, 'e', 30, 999)).toEqual({ x: 100, y: 100, width: 230, height: 100 })
  })

  it('n edge changes only height & moves top', () => {
    expect(resizeBox(box, 'n', 999, 25)).toEqual({ x: 100, y: 125, width: 200, height: 75 })
  })

  it('w edge changes only width & moves left', () => {
    expect(resizeBox(box, 'w', 50, 0)).toEqual({ x: 150, y: 100, width: 150, height: 100 })
  })

  it('s edge changes only height', () => {
    expect(resizeBox(box, 's', 0, 40)).toEqual({ x: 100, y: 100, width: 200, height: 140 })
  })

  it('floors a dimension at MIN_IMAGE_SIZE rather than inverting (e edge)', () => {
    const r = resizeBox(box, 'e', -1000, 0)
    expect(r.width).toBe(MIN_IMAGE_SIZE)
    expect(r.x).toBe(100)
  })

  it('floors at min and pins the far edge when dragging w past it', () => {
    const r = resizeBox(box, 'w', 1000, 0)
    expect(r.width).toBe(MIN_IMAGE_SIZE)
    // far (right) edge stays at 300 → x = 290
    expect(r.x).toBe(box.x + box.width - MIN_IMAGE_SIZE)
  })

  it('floors at min on the n edge', () => {
    const r = resizeBox(box, 'n', 0, 1000)
    expect(r.height).toBe(MIN_IMAGE_SIZE)
    expect(r.y).toBe(box.y + box.height - MIN_IMAGE_SIZE)
  })

  it('keepAspect on a corner preserves the ratio (width-dominant)', () => {
    const r = resizeBox(box, 'se', 100, 5, true)
    expect(r.width / r.height).toBeCloseTo(box.width / box.height)
    expect(r.x).toBe(100)
    expect(r.y).toBe(100)
  })

  it('keepAspect on a corner preserves the ratio (height-dominant)', () => {
    const r = resizeBox(box, 'se', 5, 100, true)
    expect(r.width / r.height).toBeCloseTo(box.width / box.height)
  })

  it('keepAspect on the nw corner anchors the se corner', () => {
    const r = resizeBox(box, 'nw', 40, 5, true)
    expect(r.width / r.height).toBeCloseTo(box.width / box.height)
    // se corner stays at (300,200)
    expect(r.x + r.width).toBeCloseTo(300)
    expect(r.y + r.height).toBeCloseTo(200)
  })

  it('keepAspect on a single edge derives the other dimension', () => {
    const r = resizeBox(box, 'e', 100, 0, true)
    expect(r.width).toBe(300)
    expect(r.height).toBeCloseTo(150) // 2:1 ratio kept
  })

  it('keepAspect honors min size on both dims', () => {
    const r = resizeBox(box, 'se', -1000, -1000, true)
    expect(Math.min(r.width, r.height)).toBeGreaterThanOrEqual(MIN_IMAGE_SIZE)
    expect(r.width / r.height).toBeCloseTo(box.width / box.height)
  })

  it('exposes the eight handle ids', () => {
    expect(RESIZE_HANDLES).toHaveLength(8)
    expect(RESIZE_HANDLES).toContain('nw')
    expect(RESIZE_HANDLES).toContain('se')
  })
})
