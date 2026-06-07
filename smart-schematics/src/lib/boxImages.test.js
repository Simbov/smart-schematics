import { describe, it, expect } from 'vitest'
import {
  createBoxImage, addBoxImage, updateBoxImage, removeBoxImage, normalizeBoxImages,
} from './boxImages'

describe('boxImages pure helpers (v0.2.0)', () => {
  it('createBoxImage mints an id and keeps src/heading', () => {
    const im = createBoxImage({ src: 'data:x', heading: 'Pinout' })
    expect(im.id).toMatch(/^bimg_/)
    expect(im.src).toBe('data:x')
    expect(im.heading).toBe('Pinout')
  })

  it('createBoxImage defaults heading to empty', () => {
    expect(createBoxImage({ src: 'd' }).heading).toBe('')
  })

  it('addBoxImage appends without mutating and guarantees unique ids', () => {
    const a = addBoxImage([], { src: 'a' })
    const b = addBoxImage(a, { id: a[0].id, src: 'b' }) // colliding id
    expect(a).toHaveLength(1)
    expect(b).toHaveLength(2)
    expect(b[0].id).not.toBe(b[1].id)
  })

  it('updateBoxImage patches heading by id and never changes the id', () => {
    const a = addBoxImage([], { src: 'a', heading: 'old' })
    const next = updateBoxImage(a, a[0].id, { heading: 'new', id: 'hack' })
    expect(next[0].heading).toBe('new')
    expect(next[0].id).toBe(a[0].id)
    expect(a[0].heading).toBe('old') // original untouched
  })

  it('removeBoxImage drops by id; unknown id is a no-op', () => {
    const a = addBoxImage(addBoxImage([], { src: 'a' }), { src: 'b' })
    expect(removeBoxImage(a, a[0].id)).toHaveLength(1)
    expect(removeBoxImage(a, 'nope')).toHaveLength(2)
  })

  describe('normalizeBoxImages — backward compat', () => {
    it('returns the array as-is when box.images exists', () => {
      const imgs = [{ id: 'x', src: 's', heading: 'h' }]
      expect(normalizeBoxImages({ images: imgs })).toBe(imgs)
    })

    it('folds a legacy single box.image into a one-entry array', () => {
      const out = normalizeBoxImages({ image: 'data:legacy' })
      expect(out).toHaveLength(1)
      expect(out[0].src).toBe('data:legacy')
      expect(out[0].heading).toBe('')
      expect(out[0].id).toMatch(/^bimg_/)
    })

    it('returns empty array for a box with neither images nor image', () => {
      expect(normalizeBoxImages({})).toEqual([])
    })
  })
})

describe('moveBoxImage (drag-to-reorder)', () => {
  it('reorders by id without mutating', async () => {
    const { moveBoxImage } = await import('./boxImages')
    const imgs = [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }]
    expect(moveBoxImage(imgs, 'i3', 'i1').map(x => x.id)).toEqual(['i3', 'i1', 'i2'])
    expect(imgs.map(x => x.id)).toEqual(['i1', 'i2', 'i3'])
  })
})
