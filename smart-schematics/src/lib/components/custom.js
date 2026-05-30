const STORAGE_KEY = 'schematic_custom_components'

export function loadCustomComponents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveCustomComponents(defs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defs))
}

export function getCustomDef(type) {
  return loadCustomComponents().find(d => d.type === type) || null
}
