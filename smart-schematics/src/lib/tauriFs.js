// Tauri API bridge — all Tauri calls live here so the rest of the app stays
// runnable in a plain browser (npm run dev without Tauri).

export function isRunningInTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// Tracks whether we are currently writing to suppress the file watcher
let _selfWriting = false

export function setSelfWriting(v) { _selfWriting = v }
export function isSelfWriting() { return _selfWriting }

// ─── Dialogs ────────────────────────────────────────────────────────────────

export async function openFileDialog(filters = []) {
  if (!isRunningInTauri()) return null
  const { open } = await import('@tauri-apps/plugin-dialog')
  return open({ filters, multiple: false })
}

export async function saveFileDialog(defaultPath, filters = []) {
  if (!isRunningInTauri()) return null
  const { save } = await import('@tauri-apps/plugin-dialog')
  return save({ defaultPath, filters })
}

// ─── File system ─────────────────────────────────────────────────────────────

export async function readTextFile(path) {
  if (!isRunningInTauri()) return null
  const { readTextFile } = await import('@tauri-apps/plugin-fs')
  return readTextFile(path)
}

export async function writeTextFile(path, content) {
  if (!isRunningInTauri()) return
  const { writeTextFile } = await import('@tauri-apps/plugin-fs')
  setSelfWriting(true)
  try {
    await writeTextFile(path, content)
  } finally {
    // Clear the flag after a short delay so the fs watcher event (which arrives
    // asynchronously) can still see the flag
    setTimeout(() => setSelfWriting(false), 800)
  }
}

export async function watchFile(path, callback) {
  if (!isRunningInTauri()) return () => {}
  const { watch } = await import('@tauri-apps/plugin-fs')
  return watch(path, callback, { recursive: false })
}

// ─── Window title ─────────────────────────────────────────────────────────────

export async function setWindowTitle(title) {
  document.title = title
  if (!isRunningInTauri()) return
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().setTitle(title)
  } catch {
    // Non-fatal — window title is cosmetic
  }
}

// ─── Recent files (stored in localStorage, works in both modes) ───────────────

const RECENT_KEY = 'schematic_recent_files'
const MAX_RECENT = 10

export function getRecentFiles() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  } catch {
    return []
  }
}

export function addRecentFile(path) {
  const list = [path, ...getRecentFiles().filter(p => p !== path)].slice(0, MAX_RECENT)
  localStorage.setItem(RECENT_KEY, JSON.stringify(list))
}

export function removeRecentFile(path) {
  const list = getRecentFiles().filter(p => p !== path)
  localStorage.setItem(RECENT_KEY, JSON.stringify(list))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function basename(path) {
  return path ? path.replace(/\\/g, '/').split('/').pop() : ''
}
