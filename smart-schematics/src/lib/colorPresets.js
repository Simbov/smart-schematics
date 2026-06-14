// Program-wide colour presets — built-in default swatches plus user-saved
// customs, persisted in localStorage so a palette built on one drawing is
// available everywhere (wire colours, component/symbol colour overrides).
//
// Pure module: no React, no DOM beyond localStorage (guarded for non-browser
// test environments). Hex strings are normalised to lowercase `#rrggbb`.

const STORAGE_KEY = 'schematic_color_presets'

// A practical default palette (theme-neutral): greys, the wire/sim accents, and
// a spread of signal colours engineers reach for on a schematic.
export const DEFAULT_SWATCHES = [
  '#1e293b', '#64748b', '#ef4444', '#f59e0b', '#eab308',
  '#22c55e', '#10b981', '#3b82f6', '#2563eb', '#8b5cf6',
  '#ec4899', '#000000',
]

export function normalizeHex(hex) {
  if (typeof hex !== 'string') return null
  let h = hex.trim().toLowerCase()
  if (!h.startsWith('#')) h = `#${h}`
  // Expand #rgb → #rrggbb
  if (/^#[0-9a-f]{3}$/.test(h)) h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`
  return /^#[0-9a-f]{6}$/.test(h) ? h : null
}

function safeStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

// Load the user's saved custom presets (excludes the built-in defaults).
export function loadPresets() {
  const store = safeStorage()
  if (!store) return []
  try {
    const raw = store.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.map(normalizeHex).filter(Boolean)
  } catch {
    return []
  }
}

function save(list) {
  const store = safeStorage()
  if (store) {
    try { store.setItem(STORAGE_KEY, JSON.stringify(list)) } catch { /* quota / private mode */ }
  }
  return list
}

// Add a custom preset (dedup against defaults + existing customs). Returns the
// new custom list. Newest-first so a freshly saved colour appears at the front.
export function addPreset(hex) {
  const h = normalizeHex(hex)
  if (!h) return loadPresets()
  if (DEFAULT_SWATCHES.includes(h)) return loadPresets()
  const existing = loadPresets().filter(c => c !== h)
  return save([h, ...existing])
}

export function removePreset(hex) {
  const h = normalizeHex(hex)
  return save(loadPresets().filter(c => c !== h))
}

// The full swatch list shown in a picker: built-in defaults followed by customs.
export function allSwatches() {
  return [...DEFAULT_SWATCHES, ...loadPresets()]
}
