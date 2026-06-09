// Pure helpers for the unified "document content" of a component-box or a
// junction (v0.4.0).
//
// Earlier builds split a box's documentation into four fixed sections — `fields`
// (property rows), `images`, `links`, and a single `info` string. The redesigned
// Properties pane treats all of that as ONE ordered list of mixed blocks the user
// can interleave and reorder freely (a subheading here, a property there, a photo,
// a paragraph). That list lives on `box.blocks` (and `junction.blocks`).
//
// A block is one of:
//   { id, type:'heading',  text, size }      size ∈ 'small' | 'medium' | 'large'
//   { id, type:'property', label, value, unit }
//   { id, type:'text',     text }
//   { id, type:'image',    src, heading }     src = data URL / href (panel-only)
//
// Everything here is side-effect-free (returns new arrays, never mutates) so it
// unit-tests with no DOM. Ids are unique within a list. Reorder reuses the shared
// `reorderById` from boxFields.js so blocks drag exactly like the old sections.

import { reorderById } from './boxFields'
import { normalizeBoxImages } from './boxImages'

let _blockCounter = 0

// Heading display sizes (px) used by the panel's document view. Stored on a
// heading block as a key so the value is theme/render independent.
export const HEADING_SIZES = { small: 13, medium: 17, large: 22 }
export const DEFAULT_HEADING_SIZE = 'medium'

// Mint a unique block id (crypto.randomUUID with a node-test fallback).
export function genBlockId() {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `blk_${uuid}`
  return `blk_${Date.now().toString(36)}_${(_blockCounter++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

// Build a single block of the given type, filling per-type defaults. id auto-minted.
export function createBlock({ id = null, type = 'text', ...rest } = {}) {
  const base = { id: id || genBlockId(), type }
  switch (type) {
    case 'heading':
      return { ...base, text: rest.text ?? '', size: rest.size ?? DEFAULT_HEADING_SIZE }
    case 'property':
      return { ...base, label: rest.label ?? '', value: rest.value ?? '', unit: rest.unit ?? '' }
    case 'image':
      return { ...base, src: rest.src ?? '', heading: rest.heading ?? '', size: rest.size ?? DEFAULT_HEADING_SIZE }
    case 'table': {
      const rows = Math.max(1, Math.round(rest.rows ?? 2))
      const cols = Math.max(1, Math.round(rest.cols ?? 2))
      return { ...base, rows, cols, headerRow: rest.headerRow ?? false, cells: normalizeGrid(rest.cells, rows, cols) }
    }
    case 'text':
    default:
      return { ...base, type: 'text', text: rest.text ?? '' }
  }
}

// ── Table-block grid helpers (plain-string cells; documentation tables in a box
// Properties pane). Kept separate from the canvas tableModel which uses RichDoc
// cells — here a simple string grid is enough and edits with plain inputs. ──────

// Coerce any input into an exactly rows×cols grid of strings.
export function normalizeGrid(cells, rows, cols) {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => String(cells?.[r]?.[c] ?? ''))
  )
}

export function blockTableSetCell(block, r, c, value) {
  if (r < 0 || r >= block.rows || c < 0 || c >= block.cols) return block
  const cells = block.cells.map((row, ri) => ri === r ? row.map((v, ci) => ci === c ? String(value) : v) : row)
  return { ...block, cells }
}

export function blockTableAddRow(block) {
  return { ...block, rows: block.rows + 1, cells: [...block.cells, Array(block.cols).fill('')] }
}

export function blockTableAddCol(block) {
  return { ...block, cols: block.cols + 1, cells: block.cells.map(row => [...row, '']) }
}

export function blockTableRemoveRow(block, r) {
  if (block.rows <= 1 || r < 0 || r >= block.rows) return block
  return { ...block, rows: block.rows - 1, cells: block.cells.filter((_, i) => i !== r) }
}

export function blockTableRemoveCol(block, c) {
  if (block.cols <= 1 || c < 0 || c >= block.cols) return block
  return { ...block, cols: block.cols - 1, cells: block.cells.map(row => row.filter((_, i) => i !== c)) }
}

// Append a block, guaranteeing a unique id within the list.
export function addBlock(blocks = [], block = {}) {
  const list = blocks || []
  const taken = new Set(list.map(b => b.id))
  let b = createBlock(block)
  while (taken.has(b.id)) b = createBlock({ ...block, id: genBlockId() })
  return [...list, b]
}

// Patch one block by id. The id and type are never changed; unknown ids no-op.
export function updateBlock(blocks = [], id, patch = {}) {
  const { id: _i, type: _t, ...rest } = patch
  return (blocks || []).map(b => (b.id === id ? { ...b, ...rest } : b))
}

// Remove a block by id. Unknown ids are a no-op.
export function removeBlock(blocks = [], id) {
  return (blocks || []).filter(b => b.id !== id)
}

// Reorder blocks (drag fromId onto toId). Works across block types — this is the
// "mixed together, any order" requirement. Never mutates.
export function moveBlock(blocks = [], fromId, toId) {
  return reorderById(blocks, fromId, toId)
}

// Resolve the ordered block list for a box/junction-like object, folding any
// legacy `fields` / `images` / `links` / `info` into blocks when `blocks` is not
// yet present. Purely additive + zero data loss — used by the drawing migration so
// old `.scpro`/localStorage files upgrade on load. Legacy fields are left in place.
//
// Legacy order is preserved as: properties → images → links(as text) → info(text).
export function migrateBlocks(owner = {}) {
  if (Array.isArray(owner.blocks)) return owner.blocks
  const blocks = []
  for (const f of owner.fields || []) {
    blocks.push(createBlock({ type: 'property', label: f.label, value: f.value, unit: f.unit }))
  }
  for (const im of normalizeBoxImages(owner)) {
    blocks.push(createBlock({ type: 'image', src: im.src, heading: im.heading }))
  }
  for (const l of owner.links || []) {
    // Links are no longer a first-class section; fold them into a text block that
    // keeps the label + url so nothing is lost.
    const text = l.label && l.url ? `${l.label}: ${l.url}` : (l.url || l.label || '')
    if (text) blocks.push(createBlock({ type: 'text', text }))
  }
  if (typeof owner.info === 'string' && owner.info.trim()) {
    blocks.push(createBlock({ type: 'text', text: owner.info }))
  }
  return blocks
}
