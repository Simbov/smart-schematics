import { describe, it, expect } from 'vitest'
import { inlineComputedColors, boundsFromDrawing } from './svgExport'

// Minimal fake element tree mirroring what cloneNode(true) produces, enough to
// exercise the parallel walk without a DOM.
function makeEl(tag, children = []) {
  return {
    nodeType: 1,
    tagName: tag,
    children,
    style: {
      _props: {},
      setProperty(k, v) { this._props[k] = v },
      getPropertyValue(k) { return this._props[k] || '' },
    },
  }
}

describe('inlineComputedColors', () => {
  it('writes resolved computed colours onto the clone as inline styles', () => {
    const liveChild = makeEl('path')
    const live = makeEl('g', [liveChild])
    const cloneChild = makeEl('path')
    const clone = makeEl('g', [cloneChild])

    // Fake getComputedStyle: the live child has a concrete wire colour that the
    // var(--wire-color) resolved to.
    const computed = new Map([
      [live, { stroke: 'none', fill: 'none' }],
      [liveChild, { stroke: 'rgb(255, 0, 0)', fill: 'none' }],
    ])
    const getComputed = el => ({
      getPropertyValue: prop => computed.get(el)?.[prop] ?? '',
    })

    inlineComputedColors(live, clone, getComputed)
    expect(cloneChild.style.getPropertyValue('stroke')).toBe('rgb(255, 0, 0)')
    // 'none' is intentionally not written (left to the element's own attr).
    expect(cloneChild.style.getPropertyValue('fill')).toBe('')
  })

  it('does not crash on mismatched/empty subtrees', () => {
    const live = makeEl('g', [makeEl('path')])
    const clone = makeEl('g', []) // fewer children
    const getComputed = () => ({ getPropertyValue: () => '' })
    expect(() => inlineComputedColors(live, clone, getComputed)).not.toThrow()
  })
})

describe('boundsFromDrawing — all layers contribute', () => {
  it('returns null for an empty drawing', () => {
    expect(boundsFromDrawing({ components: [], wires: [] })).toBeNull()
  })

  it('includes an image-only drawing (was cropped out before)', () => {
    const b = boundsFromDrawing({ images: [{ x: 100, y: 200, width: 300, height: 150 }] }, 0)
    expect(b).not.toBeNull()
    expect(b.minX).toBe(100)
    expect(b.maxX).toBe(400)
    expect(b.minY).toBe(200)
    expect(b.maxY).toBe(350)
  })

  it('includes a table extent from col/row sizes', () => {
    const b = boundsFromDrawing({
      tables: [{ x: 0, y: 0, colWidths: [50, 50], rowHeights: [20, 20, 20] }],
    }, 0)
    expect(b.maxX).toBe(100)
    expect(b.maxY).toBe(60)
  })

  it('includes junctions', () => {
    const b = boundsFromDrawing({ junctions: [{ x: 500, y: 500 }] }, 0)
    expect(b.maxX).toBe(506)
    expect(b.minX).toBe(494)
  })

  it('pads the result by the requested margin', () => {
    const b = boundsFromDrawing({ wires: [{ points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }] }, 30)
    expect(b.minX).toBe(-30)
    expect(b.maxX).toBe(40)
  })
})
