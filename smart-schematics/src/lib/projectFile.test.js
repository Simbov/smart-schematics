import { describe, it, expect } from 'vitest'
import {
  projectSize, formatBytes, isOverSizeLimit, sanitizeLoadedProject,
  SIZE_WARN_BYTES,
} from './projectFile'

const PNG_SRC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('projectSize', () => {
  it('returns 0 for null/empty input', () => {
    expect(projectSize(null)).toBe(0)
    expect(projectSize(undefined)).toBe(0)
  })

  it('measures the UTF-8 byte length of the serialized snapshot', () => {
    const snap = { version: 3, name: 'x', drawings: [] }
    const expected = new TextEncoder().encode(JSON.stringify(snap)).length
    expect(projectSize(snap)).toBe(expected)
  })

  it('counts base64 image payloads toward the total', () => {
    const small = { version: 3, drawings: [{ images: [] }] }
    const withImage = {
      version: 3,
      drawings: [{ images: [{ id: 'i1', src: PNG_SRC, x: 0, y: 0, width: 1, height: 1 }] }],
    }
    expect(projectSize(withImage)).toBeGreaterThan(projectSize(small) + PNG_SRC.length)
  })

  it('counts multi-byte characters as >1 byte each', () => {
    const ascii = projectSize({ n: 'aaaa' })
    const unicode = projectSize({ n: '€€€€' }) // each € is 3 UTF-8 bytes
    expect(unicode).toBeGreaterThan(ascii)
  })

  it('returns 0 when the snapshot cannot be serialized', () => {
    const circular = {}
    circular.self = circular
    expect(projectSize(circular)).toBe(0)
  })
})

describe('formatBytes', () => {
  it('formats across units', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(25 * 1024 * 1024)).toBe('25.0 MB')
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2.0 GB')
  })
})

describe('isOverSizeLimit', () => {
  it('uses the 25 MB default threshold', () => {
    expect(isOverSizeLimit(SIZE_WARN_BYTES - 1)).toBe(false)
    expect(isOverSizeLimit(SIZE_WARN_BYTES + 1)).toBe(true)
  })
  it('accepts a custom limit', () => {
    expect(isOverSizeLimit(100, 50)).toBe(true)
    expect(isOverSizeLimit(40, 50)).toBe(false)
  })
})

describe('sanitizeLoadedProject', () => {
  it('passes non-object input through untouched', () => {
    expect(sanitizeLoadedProject(null).data).toBeNull()
    expect(sanitizeLoadedProject(null).dropped).toEqual({ images: 0, attachments: 0 })
  })

  it('keeps all good images/attachments and reports nothing dropped', () => {
    const data = {
      attachments: [{ id: 'a1', name: 'd.pdf', data: 'AAAA' }],
      drawings: [{ id: 'd1', images: [{ id: 'i1', src: PNG_SRC }] }],
    }
    const { data: out, dropped } = sanitizeLoadedProject(data)
    expect(dropped).toEqual({ images: 0, attachments: 0 })
    // No change → same reference for stability.
    expect(out).toBe(data)
  })

  it('drops malformed images but keeps the good ones', () => {
    const data = {
      drawings: [{
        id: 'd1',
        images: [
          { id: 'good', src: PNG_SRC },   // valid
          { id: 'nosrc' },                 // missing src
          { id: 'emptysrc', src: '' },     // empty src
          { src: PNG_SRC },                // missing id
          null,                            // junk
        ],
      }],
    }
    const { data: out, dropped } = sanitizeLoadedProject(data)
    expect(dropped.images).toBe(4)
    expect(out.drawings[0].images).toEqual([{ id: 'good', src: PNG_SRC }])
    // Original not mutated.
    expect(data.drawings[0].images).toHaveLength(5)
  })

  it('drops malformed attachments but keeps the good ones', () => {
    const data = {
      attachments: [
        { id: 'a1', name: 'ok.pdf', data: 'AAAA' }, // valid
        { id: 'a2', name: 'nodata.pdf' },           // missing data
        { id: 'a3', name: 'empty', data: '' },      // empty data
        { name: 'noid', data: 'BBBB' },             // missing id
      ],
      drawings: [],
    }
    const { data: out, dropped } = sanitizeLoadedProject(data)
    expect(dropped.attachments).toBe(3)
    expect(out.attachments).toEqual([{ id: 'a1', name: 'ok.pdf', data: 'AAAA' }])
  })

  it('leaves a drawing without an images array alone', () => {
    const data = { drawings: [{ id: 'd1' }], attachments: [] }
    const { data: out, dropped } = sanitizeLoadedProject(data)
    expect(dropped).toEqual({ images: 0, attachments: 0 })
    expect(out).toBe(data)
  })
})
