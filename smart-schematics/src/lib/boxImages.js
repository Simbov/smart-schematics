// Pure helpers for a component-box's reference images (v0.2.0).
//
// A box's `box.images` is an array of `{ id, src, heading }` entries. These are
// reference pictures shown ONLY in the Properties panel — they document the
// component (datasheet snippet, photo, pinout diagram) and are NOT drawn on the
// schematic, so adding one never changes the canvas appearance. Each image can
// be filed under a free-text `heading` so the panel reads like a little document.
//
// Backward compatibility: earlier builds stored a single `box.image` (a data URL
// rendered inside the box on the canvas). `normalizeBoxImages` folds any legacy
// `box.image` into the new `images` array so existing schematics keep their
// picture (now shown in the panel instead of on the canvas) with zero data loss.
//
// Everything here is side-effect-free: helpers return new arrays and never
// mutate inputs, so they unit-test with no DOM.

import { reorderById } from './boxFields'

let _imgCounter = 0

// Mint a unique image id. Uses crypto.randomUUID when available, with a
// timestamp + counter + random fallback for the node test environment.
export function genBoxImageId() {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `bimg_${uuid}`
  return `bimg_${Date.now().toString(36)}_${(_imgCounter++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

// Build a single image entry. `src` is a data URL (or any image href). `heading`
// is the optional category/title shown above it in the panel. id auto-minted.
export function createBoxImage({ id = null, src = '', heading = '' } = {}) {
  return { id: id || genBoxImageId(), src, heading }
}

// Append an image, guaranteeing a unique id within the list.
export function addBoxImage(images = [], image = {}) {
  const list = images || []
  const taken = new Set(list.map(im => im.id))
  let im = createBoxImage(image)
  while (taken.has(im.id)) im = createBoxImage({ ...image, id: genBoxImageId() })
  return [...list, im]
}

// Patch one image by id (src/heading). The id itself is never changed; unknown
// ids are a no-op.
export function updateBoxImage(images = [], id, patch = {}) {
  const { id: _ignore, ...rest } = patch
  return (images || []).map(im => (im.id === id ? { ...im, ...rest } : im))
}

// Remove an image by id. Unknown ids are a no-op.
export function removeBoxImage(images = [], id) {
  return (images || []).filter(im => im.id !== id)
}

// Reorder reference images (drag fromId onto toId). Delegates to the shared
// id-based reorder so fields/images/links behave identically. Never mutates.
export function moveBoxImage(images = [], fromId, toId) {
  return reorderById(images, fromId, toId)
}

// Resolve a box's images array, folding a legacy single `box.image` data URL into
// the array when there's no `images` yet. Returns a fresh array; never mutates.
// PURELY ADDITIVE — used by the drawing migration so old files keep their picture.
export function normalizeBoxImages(box = {}) {
  if (Array.isArray(box.images)) return box.images
  if (box.image) return [createBoxImage({ src: box.image, heading: '' })]
  return []
}
