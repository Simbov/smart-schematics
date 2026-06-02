import { describe, it, expect } from 'vitest'
import {
  emptyDoc,
  plainToDoc,
  docToPlain,
  docToHtml,
  htmlToDoc,
  isEmptyDoc,
  richExportFallback,
  applyDocStyle,
  setDocAlign,
} from './richText'

describe('emptyDoc', () => {
  it('has the canonical empty shape', () => {
    expect(emptyDoc()).toEqual({ align: 'left', paragraphs: [{ runs: [] }] })
  })
  it('returns independent copies', () => {
    const a = emptyDoc()
    a.paragraphs[0].runs.push({ text: 'x' })
    expect(emptyDoc().paragraphs[0].runs).toEqual([])
  })
})

describe('plainToDoc <-> docToPlain round-trip', () => {
  it('single line', () => {
    const doc = plainToDoc('hello world')
    expect(docToPlain(doc)).toBe('hello world')
    expect(doc.paragraphs).toHaveLength(1)
    expect(doc.paragraphs[0].runs[0]).toEqual({ text: 'hello world' })
  })

  it('multi-line', () => {
    const text = 'line one\nline two\nline three'
    const doc = plainToDoc(text)
    expect(doc.paragraphs).toHaveLength(3)
    expect(docToPlain(doc)).toBe(text)
  })

  it('blank lines become empty paragraphs and round-trip', () => {
    const text = 'a\n\nb'
    const doc = plainToDoc(text)
    expect(doc.paragraphs).toHaveLength(3)
    expect(doc.paragraphs[1].runs).toEqual([])
    expect(docToPlain(doc)).toBe(text)
  })

  it('empty string', () => {
    expect(docToPlain(plainToDoc(''))).toBe('')
  })

  it('docToPlain tolerates a malformed/undefined doc', () => {
    expect(docToPlain(undefined)).toBe('')
    expect(docToPlain({})).toBe('')
  })
})

describe('docToHtml / htmlToDoc round-trip preserving run attributes', () => {
  function roundTrip(doc) {
    return htmlToDoc(docToHtml(doc))
  }

  it('bold / italic / underline', () => {
    const doc = {
      align: 'left',
      paragraphs: [
        { runs: [
          { text: 'plain ' },
          { text: 'bold', bold: true },
          { text: ' ' },
          { text: 'ital', italic: true },
          { text: ' ' },
          { text: 'und', underline: true },
        ] },
      ],
    }
    expect(roundTrip(doc)).toEqual(doc)
  })

  it('color and fontSize', () => {
    const doc = {
      align: 'left',
      paragraphs: [
        { runs: [
          { text: 'red', color: '#ff0000' },
          { text: 'big', fontSize: 24 },
          { text: 'redbig', color: '#00ff00', fontSize: 18 },
        ] },
      ],
    }
    expect(roundTrip(doc)).toEqual(doc)
  })

  it('combined attributes on one run', () => {
    const doc = {
      align: 'center',
      paragraphs: [
        { runs: [
          { text: 'all', bold: true, italic: true, underline: true, color: '#123456', fontSize: 20 },
        ] },
      ],
    }
    expect(roundTrip(doc)).toEqual(doc)
  })

  it('alignment center / right', () => {
    for (const align of ['center', 'right', 'left']) {
      const doc = { align, paragraphs: [{ runs: [{ text: 'x' }] }] }
      expect(roundTrip(doc).align).toBe(align)
    }
  })

  it('multi-paragraph with mixed styling', () => {
    const doc = {
      align: 'left',
      paragraphs: [
        { runs: [{ text: 'first ' }, { text: 'word', bold: true }] },
        { runs: [{ text: 'second', color: '#abcdef' }] },
        { runs: [] },
        { runs: [{ text: 'fourth', italic: true, fontSize: 16 }] },
      ],
    }
    expect(roundTrip(doc)).toEqual(doc)
  })

  it('docToHtml only emits whitelisted tags', () => {
    const html = docToHtml({
      align: 'right',
      paragraphs: [{ runs: [{ text: 'x', bold: true, italic: true, underline: true, color: '#f00', fontSize: 12 }] }],
    })
    // only div / span / b / i / u may appear
    const tags = [...html.matchAll(/<\/?([a-z0-9]+)/gi)].map(m => m[1].toLowerCase())
    for (const t of tags) expect(['div', 'span', 'b', 'i', 'u', 'br']).toContain(t)
  })

  it('escapes HTML special characters in text', () => {
    const doc = { align: 'left', paragraphs: [{ runs: [{ text: 'a < b & c > d "q"' }] }] }
    const html = docToHtml(doc)
    expect(html).not.toContain('a < b')
    expect(htmlToDoc(html)).toEqual(doc)
  })
})

describe('sanitizer (htmlToDoc drops disallowed markup)', () => {
  it('drops <script> entirely including its text', () => {
    const doc = htmlToDoc('<div>safe<script>alert(1)</script></div>')
    expect(docToPlain(doc)).toBe('safe')
  })

  it('strips onclick / other attributes; keeps text', () => {
    const doc = htmlToDoc('<div onclick="evil()">hello</div>')
    expect(docToPlain(doc)).toBe('hello')
    // no run should carry a color/size from the bogus attrs
    expect(doc.paragraphs[0].runs[0]).toEqual({ text: 'hello' })
  })

  it('drops disallowed tags (a, img, table) but preserves their text content', () => {
    const doc = htmlToDoc('<div>click <a href="http://evil">here</a> now<img src="x"></div>')
    expect(docToPlain(doc)).toBe('click here now')
  })

  it('ignores style props other than color and font-size', () => {
    const doc = htmlToDoc('<div><span style="color:#ff0000;background:url(x);position:absolute;font-size:30px">t</span></div>')
    expect(doc.paragraphs[0].runs[0]).toEqual({ text: 't', color: '#ff0000', fontSize: 30 })
  })

  it('handles pasted markup with unknown wrappers', () => {
    const doc = htmlToDoc('<section><div><font face="Arial"><b>Bold</b></font></div></section>')
    expect(docToPlain(doc)).toBe('Bold')
    expect(doc.paragraphs[0].runs.some(r => r.bold)).toBe(true)
  })
})

describe('isEmptyDoc', () => {
  it('true for emptyDoc', () => {
    expect(isEmptyDoc(emptyDoc())).toBe(true)
  })
  it('true for whitespace-only', () => {
    expect(isEmptyDoc(plainToDoc('   \n  \t '))).toBe(true)
  })
  it('true for null / malformed', () => {
    expect(isEmptyDoc(null)).toBe(true)
    expect(isEmptyDoc({})).toBe(true)
  })
  it('false when any run has non-whitespace text', () => {
    expect(isEmptyDoc(plainToDoc('hi'))).toBe(false)
    expect(isEmptyDoc({ align: 'left', paragraphs: [{ runs: [] }, { runs: [{ text: 'x' }] }] })).toBe(false)
  })
})

describe('applyDocStyle (whole-box quick styles)', () => {
  it('applies a uniform attribute to every run across paragraphs', () => {
    const doc = {
      align: 'left',
      paragraphs: [
        { runs: [{ text: 'a' }, { text: 'b', italic: true }] },
        { runs: [{ text: 'c' }] },
      ],
    }
    const out = applyDocStyle(doc, { bold: true })
    expect(out.paragraphs.every(p => p.runs.every(r => r.bold))).toBe(true)
    // existing italic preserved
    expect(out.paragraphs[0].runs[1].italic).toBe(true)
    // input not mutated
    expect(doc.paragraphs[0].runs[0].bold).toBeUndefined()
  })

  it('removes an attribute when passed false/null', () => {
    const doc = { align: 'left', paragraphs: [{ runs: [{ text: 'x', bold: true, color: '#f00' }] }] }
    const out = applyDocStyle(doc, { bold: false, color: null })
    expect(out.paragraphs[0].runs[0]).toEqual({ text: 'x' })
  })

  it('sets color and fontSize', () => {
    const out = applyDocStyle(plainToDoc('hi'), { color: '#00ff00', fontSize: 22 })
    expect(out.paragraphs[0].runs[0]).toEqual({ text: 'hi', color: '#00ff00', fontSize: 22 })
  })
})

describe('setDocAlign', () => {
  it('changes alignment, keeps paragraphs', () => {
    const doc = plainToDoc('a\nb')
    const out = setDocAlign(doc, 'right')
    expect(out.align).toBe('right')
    expect(out.paragraphs).toEqual(doc.paragraphs)
  })
  it('falls back to left for invalid align', () => {
    expect(setDocAlign(plainToDoc('x'), 'bogus').align).toBe('left')
  })
})

describe('richExportFallback', () => {
  it('returns plain lines + align for a multi-line doc', () => {
    const doc = plainToDoc('a\nb\nc')
    doc.align = 'center'
    expect(richExportFallback(doc)).toEqual({ align: 'center', lines: ['a', 'b', 'c'] })
  })
  it('defaults align to left for malformed input', () => {
    expect(richExportFallback({})).toEqual({ align: 'left', lines: [''] })
  })
})
