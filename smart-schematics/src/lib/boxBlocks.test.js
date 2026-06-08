import { describe, it, expect } from 'vitest'
import {
  createBlock, addBlock, updateBlock, removeBlock, moveBlock, migrateBlocks,
  HEADING_SIZES, DEFAULT_HEADING_SIZE,
} from './boxBlocks'

describe('boxBlocks', () => {
  it('createBlock fills per-type defaults and mints ids', () => {
    const h = createBlock({ type: 'heading' })
    expect(h.type).toBe('heading')
    expect(h.size).toBe(DEFAULT_HEADING_SIZE)
    expect(h.id).toMatch(/^blk_/)
    const p = createBlock({ type: 'property', label: 'R', value: '10', unit: 'k' })
    expect(p).toMatchObject({ type: 'property', label: 'R', value: '10', unit: 'k' })
    const t = createBlock({ type: 'whatever' })
    expect(t.type).toBe('text') // unknown ⇒ text
    const im = createBlock({ type: 'image', src: 'data:...', heading: 'Pinout' })
    expect(im).toMatchObject({ type: 'image', src: 'data:...', heading: 'Pinout' })
  })

  it('add/update/remove are immutable and id/type-stable', () => {
    let blocks = []
    blocks = addBlock(blocks, { type: 'property', label: 'A' })
    blocks = addBlock(blocks, { type: 'text', text: 'hi' })
    expect(blocks).toHaveLength(2)
    const id = blocks[0].id
    const updated = updateBlock(blocks, id, { label: 'B', type: 'image', id: 'x' })
    expect(updated[0].label).toBe('B')
    expect(updated[0].type).toBe('property') // type never changes
    expect(updated[0].id).toBe(id)           // id never changes
    expect(blocks[0].label).toBe('A')        // input not mutated
    expect(removeBlock(blocks, id)).toHaveLength(1)
    expect(removeBlock(blocks, 'nope')).toHaveLength(2)
  })

  it('addBlock guarantees unique ids even on collision', () => {
    const a = addBlock([], { id: 'dup', type: 'text' })
    const b = addBlock(a, { id: 'dup', type: 'text' })
    expect(b[0].id).not.toBe(b[1].id)
  })

  it('moveBlock reorders across types', () => {
    let blocks = []
    blocks = addBlock(blocks, { id: '1', type: 'heading', text: 'H' })
    blocks = addBlock(blocks, { id: '2', type: 'property', label: 'P' })
    blocks = addBlock(blocks, { id: '3', type: 'image' })
    const moved = moveBlock(blocks, '3', '1')
    expect(moved.map(b => b.id)).toEqual(['3', '1', '2'])
  })

  it('migrateBlocks folds legacy fields/images/links/info, preserving when present', () => {
    const existing = { blocks: [{ id: 'z', type: 'text', text: 'kept' }] }
    expect(migrateBlocks(existing)).toBe(existing.blocks)

    const legacy = {
      fields: [{ id: 'f1', label: 'V', value: '5', unit: 'V' }],
      images: [{ id: 'i1', src: 'data:img', heading: 'Pic' }],
      links: [{ id: 'l1', label: 'Datasheet', url: 'http://x' }],
      info: 'some notes',
    }
    const blocks = migrateBlocks(legacy)
    expect(blocks.map(b => b.type)).toEqual(['property', 'image', 'text', 'text'])
    expect(blocks[0]).toMatchObject({ label: 'V', value: '5', unit: 'V' })
    expect(blocks[1]).toMatchObject({ src: 'data:img', heading: 'Pic' })
    expect(blocks[2].text).toContain('Datasheet')
    expect(blocks[3].text).toBe('some notes')
  })

  it('migrateBlocks folds a legacy single box.image (normalizeBoxImages path)', () => {
    const blocks = migrateBlocks({ image: 'data:legacy' })
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ type: 'image', src: 'data:legacy' })
  })

  it('HEADING_SIZES maps the three keys to ascending px', () => {
    expect(HEADING_SIZES.small).toBeLessThan(HEADING_SIZES.medium)
    expect(HEADING_SIZES.medium).toBeLessThan(HEADING_SIZES.large)
  })
})
