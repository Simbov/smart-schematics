// Pure helpers for a component-box's clickable reference links (v0.2.0).
//
// A box's `box.links` is an array of `{ id, label, url }` entries shown ONLY in
// the Properties panel — a small set of documentation hyperlinks (datasheet,
// supplier page, etc.). In the panel's clean view each renders as a clickable
// link; in edit mode it becomes label + url textboxes with a remove button.
//
// Everything here is side-effect-free (returns new arrays, never mutates) so it
// unit-tests with no DOM. Mirrors boxFields.js / boxImages.js exactly.

import { reorderById } from './boxFields'

let _linkCounter = 0

// Mint a unique link id (crypto.randomUUID with a node-test fallback).
export function genLinkId() {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `lnk_${uuid}`
  return `lnk_${Date.now().toString(36)}_${(_linkCounter++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

// Build a single link entry. `label` is the display text; `url` the destination.
export function createLink({ id = null, label = '', url = '' } = {}) {
  return { id: id || genLinkId(), label, url }
}

// Append a link, guaranteeing a unique id within the list.
export function addLink(links = [], link = {}) {
  const list = links || []
  const taken = new Set(list.map(l => l.id))
  let l = createLink(link)
  while (taken.has(l.id)) l = createLink({ ...link, id: genLinkId() })
  return [...list, l]
}

// Patch one link by id (label/url). The id itself is never changed; unknown ids
// are a no-op.
export function updateLink(links = [], id, patch = {}) {
  const { id: _ignore, ...rest } = patch
  return (links || []).map(l => (l.id === id ? { ...l, ...rest } : l))
}

// Remove a link by id. Unknown ids are a no-op.
export function removeLink(links = [], id) {
  return (links || []).filter(l => l.id !== id)
}

// Reorder links (drag fromId onto toId). Never mutates.
export function moveLink(links = [], fromId, toId) {
  return reorderById(links, fromId, toId)
}

// Normalize a URL for opening: prepend https:// when the user typed a bare host
// (no scheme). Empty/whitespace returns ''. Leaves mailto:/http(s):/ etc. alone.
export function normalizeUrl(url) {
  const u = (url || '').trim()
  if (!u) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return u
  return `https://${u}`
}
