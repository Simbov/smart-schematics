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

// Read a binary file (e.g. an image picked via openFileDialog) and return it as
// a base64 `data:` URL suitable for an <image href>. Tauri-only; returns null in
// a plain browser (which uses the hidden <input> + FileReader path instead).
export async function readImageAsDataUrl(path) {
  if (!isRunningInTauri()) return null
  const { readFile } = await import('@tauri-apps/plugin-fs')
  const bytes = await readFile(path) // Uint8Array
  // Chunked base64 encode to avoid blowing the call stack on large images.
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  const b64 = btoa(binary)
  const mime = mimeForExtension(path)
  return `data:${mime};base64,${b64}`
}

// Best-effort MIME guess from a file extension for the image data URL.
function mimeForExtension(path) {
  const ext = (path.split('.').pop() || '').toLowerCase()
  switch (ext) {
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'gif': return 'image/gif'
    case 'svg': return 'image/svg+xml'
    case 'webp': return 'image/webp'
    default: return 'application/octet-stream'
  }
}

// Decode a base64 string into a Uint8Array (no data: prefix). Used to write an
// attachment's stored payload back out to disk. Pure — exported for testing.
export function base64ToBytes(b64) {
  // Strip a leading data: URL prefix if one slipped in.
  const comma = b64.indexOf(',')
  const raw = b64.startsWith('data:') && comma >= 0 ? b64.slice(comma + 1) : b64
  const binary = atob(raw)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// Write raw bytes (Uint8Array) to a path. Tauri-only; no-op in a plain browser
// (which uses a Blob download instead). Suppresses the file watcher like the
// text writer so exporting an attachment doesn't trip a false "external change".
export async function writeBinaryFile(path, bytes) {
  if (!isRunningInTauri()) return
  const { writeFile } = await import('@tauri-apps/plugin-fs')
  setSelfWriting(true)
  try {
    await writeFile(path, bytes)
  } finally {
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
