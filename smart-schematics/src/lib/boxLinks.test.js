import { describe, it, expect } from 'vitest'
import { createLink, addLink, updateLink, removeLink, moveLink, normalizeUrl } from './boxLinks'

describe('boxLinks pure helpers (v0.2.0)', () => {
  it('createLink mints an id and keeps label/url', () => {
    const l = createLink({ label: 'Datasheet', url: 'example.com' })
    expect(l.id).toMatch(/^lnk_/)
    expect(l).toMatchObject({ label: 'Datasheet', url: 'example.com' })
  })
  it('addLink appends with a unique id', () => {
    const list = addLink(addLink([], { label: 'a' }), { label: 'b' })
    expect(list).toHaveLength(2)
    expect(new Set(list.map(l => l.id)).size).toBe(2)
  })
  it('updateLink patches by id, removeLink drops by id (both immutable)', () => {
    const base = addLink([], { id: 'lnk_1', label: 'a', url: 'x' })
    expect(updateLink(base, 'lnk_1', { url: 'y' })[0].url).toBe('y')
    expect(updateLink(base, 'lnk_1', { id: 'hack' })[0].id).toBe('lnk_1')
    expect(removeLink(base, 'lnk_1')).toEqual([])
    expect(base[0].url).toBe('x')
  })
  it('moveLink reorders by id', () => {
    const arr = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(moveLink(arr, 'a', 'b').map(x => x.id)).toEqual(['b', 'a', 'c'])
  })
  it('normalizeUrl prepends https:// for bare hosts and leaves schemes alone', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com')
    expect(normalizeUrl('https://x.io')).toBe('https://x.io')
    expect(normalizeUrl('mailto:a@b.com')).toBe('mailto:a@b.com')
    expect(normalizeUrl('  ')).toBe('')
  })
})
