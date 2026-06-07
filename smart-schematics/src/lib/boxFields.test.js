import { describe, it, expect } from 'vitest'
import { createField, addField, updateField, removeField, genFieldId } from './boxFields.js'

// Stage 1 (v0.2.0): flexible property rows for component boxes.

describe('boxFields helpers', () => {
  it('createField mints an id and defaults label/value/unit to empty strings', () => {
    const f = createField()
    expect(typeof f.id).toBe('string')
    expect(f.id.length).toBeGreaterThan(0)
    expect(f).toMatchObject({ label: '', value: '', unit: '' })
  })

  it('createField keeps caller-supplied parts', () => {
    const f = createField({ label: 'Resistance', value: '4.7k', unit: 'Ω' })
    expect(f).toMatchObject({ label: 'Resistance', value: '4.7k', unit: 'Ω' })
  })

  it('genFieldId produces unique ids', () => {
    const ids = new Set(Array.from({ length: 200 }, () => genFieldId()))
    expect(ids.size).toBe(200)
  })

  it('addField appends without mutating the input and keeps ids unique', () => {
    const a = []
    const b = addField(a, { label: 'A' })
    expect(a).toHaveLength(0) // input untouched
    expect(b).toHaveLength(1)
    // A colliding id is re-minted so the list stays unique.
    const collide = addField(b, { id: b[0].id, label: 'B' })
    expect(collide).toHaveLength(2)
    expect(collide[1].id).not.toBe(b[0].id)
    expect(new Set(collide.map(f => f.id)).size).toBe(2)
  })

  it('updateField patches label/value/unit by id and never changes the id', () => {
    const list = addField([], { label: 'A', value: '1' })
    const id = list[0].id
    const out = updateField(list, id, { value: '2', id: 'HACK' })
    expect(out[0].value).toBe('2')
    expect(out[0].id).toBe(id) // id immutable
    // Unknown id is a no-op.
    expect(updateField(list, 'nope', { value: 'x' })).toEqual(list)
  })

  it('removeField drops by id and is a no-op for unknown ids', () => {
    const list = addField(addField([], { label: 'A' }), { label: 'B' })
    const out = removeField(list, list[0].id)
    expect(out).toHaveLength(1)
    expect(out[0].label).toBe('B')
    expect(removeField(list, 'nope')).toHaveLength(2)
  })
})

describe('reorderById / moveField (drag-to-reorder)', () => {
  const mk = () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  it('moves an item to the position of the drop target', async () => {
    const { reorderById, moveField } = await import('./boxFields.js')
    expect(reorderById(mk(), 'a', 'c').map(x => x.id)).toEqual(['b', 'c', 'a'])
    expect(reorderById(mk(), 'c', 'a').map(x => x.id)).toEqual(['c', 'a', 'b'])
    expect(moveField(mk(), 'b', 'a').map(x => x.id)).toEqual(['b', 'a', 'c'])
  })
  it('is a no-op for unknown ids or self-move and never mutates input', async () => {
    const { reorderById } = await import('./boxFields.js')
    const arr = mk()
    expect(reorderById(arr, 'a', 'a').map(x => x.id)).toEqual(['a', 'b', 'c'])
    expect(reorderById(arr, 'a', 'zz').map(x => x.id)).toEqual(['a', 'b', 'c'])
    expect(arr.map(x => x.id)).toEqual(['a', 'b', 'c'])
  })
})
