// Pure helpers for a component-box's flexible property rows (Stage 1, v0.2.0).
//
// A box's `box.fields` is an array of `{ id, label, value, unit }` rows that
// replaces the single generic `value` for boxes (a box's `value` is simply no
// longer read — it is NOT deleted, for backward compatibility). Every helper is
// side-effect-free: it returns a new array and never mutates its input, so it is
// trivially unit-testable with no DOM.
//
// Field ids are unique within a box. `createField` mints an id; `addField`
// guarantees uniqueness even if a caller-supplied field collides.

let _fieldCounter = 0

// Mint a unique field id. Uses crypto.randomUUID when available (browser/Tauri),
// falling back to a timestamp + counter + random suffix so ids stay unique even
// in the node test environment and across reloads.
export function genFieldId() {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `fld_${uuid}`
  return `fld_${Date.now().toString(36)}_${(_fieldCounter++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

// Build a single field row. All parts optional; id is auto-minted when absent.
export function createField({ id = null, label = '', value = '', unit = '' } = {}) {
  return { id: id || genFieldId(), label, value, unit }
}

// Append a field to a list, guaranteeing its id is unique within the list. If a
// caller hands in a field whose id already exists (or no id), a fresh id is used.
export function addField(fields = [], field = {}) {
  const list = fields || []
  const taken = new Set(list.map(f => f.id))
  let f = createField(field)
  while (taken.has(f.id)) f = createField({ ...field, id: genFieldId() })
  return [...list, f]
}

// Patch one field by id (label/value/unit). The id itself is never changed.
// Unknown ids are a no-op (returns the same shape).
export function updateField(fields = [], id, patch = {}) {
  const { id: _ignore, ...rest } = patch
  return (fields || []).map(f => (f.id === id ? { ...f, ...rest } : f))
}

// Remove a field by id. Unknown ids are a no-op.
export function removeField(fields = [], id) {
  return (fields || []).filter(f => f.id !== id)
}
