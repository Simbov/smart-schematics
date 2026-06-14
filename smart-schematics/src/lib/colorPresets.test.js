import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  DEFAULT_SWATCHES, normalizeHex, loadPresets, addPreset, removePreset, allSwatches,
} from './colorPresets'

// In-memory localStorage stub (the test env is 'node', no DOM).
const mem = new Map()
vi.stubGlobal('localStorage', {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)) },
  removeItem: k => { mem.delete(k) },
  clear: () => mem.clear(),
})

describe('colorPresets', () => {
  beforeEach(() => { localStorage.clear() })

  it('normalises hex strings (case, missing #, shorthand)', () => {
    expect(normalizeHex('#AABBCC')).toBe('#aabbcc')
    expect(normalizeHex('aabbcc')).toBe('#aabbcc')
    expect(normalizeHex('#abc')).toBe('#aabbcc')
    expect(normalizeHex('nope')).toBeNull()
    expect(normalizeHex(null)).toBeNull()
  })

  it('starts empty and round-trips a custom preset through localStorage', () => {
    expect(loadPresets()).toEqual([])
    addPreset('#123456')
    expect(loadPresets()).toEqual(['#123456'])
  })

  it('dedupes and keeps newest first', () => {
    addPreset('#111111')
    addPreset('#222222')
    addPreset('#111111') // re-add moves it to front, no dupes
    expect(loadPresets()).toEqual(['#111111', '#222222'])
  })

  it('does not store a colour already in the defaults', () => {
    addPreset(DEFAULT_SWATCHES[0])
    expect(loadPresets()).toEqual([])
  })

  it('removePreset drops a custom colour', () => {
    addPreset('#abcdef')
    removePreset('#ABCDEF') // case-insensitive
    expect(loadPresets()).toEqual([])
  })

  it('allSwatches concatenates defaults then customs', () => {
    addPreset('#0f0f0f')
    const all = allSwatches()
    expect(all.slice(0, DEFAULT_SWATCHES.length)).toEqual(DEFAULT_SWATCHES)
    expect(all[all.length - 1]).toBe('#0f0f0f')
  })
})
