import { describe, it, expect } from 'vitest'
import { textOuterBox, outerBoxToAnnotation, TEXT_PAD, MIN_TEXT_W } from './annotationLayout.js'

describe('textOuterBox', () => {
  it('uses explicit width/height when the box is fixed-size', () => {
    const ann = { x: 100, y: 50, fontSize: 14, width: 160, height: 48 }
    const box = textOuterBox(ann, 'hello')
    expect(box.width).toBe(160 + TEXT_PAD * 2)
    expect(box.height).toBe(48 + TEXT_PAD * 2)
    expect(box.x).toBe(100 - TEXT_PAD)
    expect(box.y).toBe(50 - 14 - TEXT_PAD)
  })

  it('autosizes from content when no explicit size', () => {
    const ann = { x: 0, y: 0, fontSize: 10 }
    const box = textOuterBox(ann, 'ab\ncde')
    // 2 lines, longest = 3 chars.
    expect(box.width).toBeGreaterThanOrEqual(MIN_TEXT_W)
    expect(box.height).toBeGreaterThan(0)
  })
})

describe('outerBoxToAnnotation', () => {
  it('round-trips a fixed box through textOuterBox', () => {
    const ann = { x: 100, y: 50, fontSize: 14, width: 160, height: 48 }
    const box = textOuterBox(ann, '')
    const back = outerBoxToAnnotation(box, ann)
    expect(back.x).toBe(100)
    expect(back.y).toBe(50)
    expect(back.width).toBe(160)
    expect(back.height).toBe(48)
  })

  it('floors width/height at the minimum', () => {
    const ann = { x: 0, y: 0, fontSize: 14 }
    const back = outerBoxToAnnotation({ x: 0, y: 0, width: 1, height: 1 }, ann)
    expect(back.width).toBeGreaterThanOrEqual(MIN_TEXT_W)
  })
})
