import { describe, it, expect } from 'vitest'
import { uniformFontSize, activeMarks } from './richTextEditing'

const doc = (align, runs) => ({ align, paragraphs: [{ runs }] })
const multi = (align, paras) => ({ align, paragraphs: paras.map(runs => ({ runs })) })

describe('uniformFontSize', () => {
  it('returns the shared size when every non-empty run agrees', () => {
    expect(uniformFontSize(doc('left', [
      { text: 'a', fontSize: 18 },
      { text: 'b', fontSize: 18 },
    ]))).toBe(18)
  })

  it('returns the shared size across multiple paragraphs', () => {
    expect(uniformFontSize(multi('left', [
      [{ text: 'a', fontSize: 24 }],
      [{ text: 'b', fontSize: 24 }],
    ]))).toBe(24)
  })

  it('returns null when sizes differ', () => {
    expect(uniformFontSize(doc('left', [
      { text: 'a', fontSize: 12 },
      { text: 'b', fontSize: 18 },
    ]))).toBeNull()
  })

  it('returns null when some runs carry no explicit size', () => {
    expect(uniformFontSize(doc('left', [
      { text: 'a', fontSize: 14 },
      { text: 'b' },
    ]))).toBeNull()
  })

  it('returns null when no run carries a size', () => {
    expect(uniformFontSize(doc('left', [{ text: 'a' }, { text: 'b' }]))).toBeNull()
  })

  it('ignores empty-text runs', () => {
    expect(uniformFontSize(doc('left', [
      { text: '', fontSize: 99 },
      { text: 'real', fontSize: 14 },
    ]))).toBe(14)
  })

  it('returns null for an empty doc', () => {
    expect(uniformFontSize({ align: 'left', paragraphs: [{ runs: [] }] })).toBeNull()
    expect(uniformFontSize(null)).toBeNull()
    expect(uniformFontSize({})).toBeNull()
  })
})

describe('activeMarks', () => {
  it('reports all marks active when every run is uniformly styled', () => {
    expect(activeMarks(doc('center', [
      { text: 'a', bold: true, italic: true, underline: true, fontSize: 18 },
      { text: 'b', bold: true, italic: true, underline: true, fontSize: 18 },
    ]))).toEqual({ bold: true, italic: true, underline: true, align: 'center', fontSize: 18 })
  })

  it('reports a mark false when only some runs carry it (mixed)', () => {
    expect(activeMarks(doc('left', [
      { text: 'a', bold: true },
      { text: 'b' },
    ]))).toEqual({ bold: false, italic: false, underline: false, align: 'left', fontSize: null })
  })

  it('reports false for every mark on an unstyled doc', () => {
    const m = activeMarks(doc('left', [{ text: 'plain' }]))
    expect(m.bold).toBe(false)
    expect(m.italic).toBe(false)
    expect(m.underline).toBe(false)
    expect(m.fontSize).toBeNull()
  })

  it('reports alignment from doc.align', () => {
    expect(activeMarks(doc('right', [{ text: 'x' }])).align).toBe('right')
    expect(activeMarks(doc('center', [{ text: 'x' }])).align).toBe('center')
    expect(activeMarks(doc('left', [{ text: 'x' }])).align).toBe('left')
  })

  it('defaults align to left for missing/invalid values', () => {
    expect(activeMarks({ paragraphs: [{ runs: [{ text: 'x' }] }] }).align).toBe('left')
    expect(activeMarks(doc('justify', [{ text: 'x' }])).align).toBe('left')
    expect(activeMarks(null).align).toBe('left')
  })

  it('marks are false when the doc has no runs', () => {
    expect(activeMarks({ align: 'left', paragraphs: [{ runs: [] }] }))
      .toEqual({ bold: false, italic: false, underline: false, align: 'left', fontSize: null })
  })
})
