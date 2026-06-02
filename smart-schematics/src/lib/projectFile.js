// Pure helpers for the bundled .scpro project file (Stage 7).
//
// All exports are side-effect-free so they can be unit-tested without a DOM or
// the store. They underpin two UX safety nets:
//   - projectSize(snapshot)      → byte estimate of the serialized file (incl.
//                                  base64 image/attachment payloads) for the
//                                  size-awareness indicator + warning.
//   - sanitizeLoadedProject(data)→ drops malformed images/attachments on load so
//                                  one corrupt payload can't crash the open.

// Warn the user past this serialized size — base64 images/attachments bloat the
// single bundled file and OneDrive sync gets unhappy. ~25 MB per the plan.
export const SIZE_WARN_BYTES = 25 * 1024 * 1024

// Byte length of a UTF-8 string without allocating a Buffer/TextEncoder per call
// where avoidable. TextEncoder is available in Node (test env) and browsers.
function utf8Bytes(str) {
  if (typeof str !== 'string') return 0
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length
  }
  // Fallback: count code units widened for multi-byte chars.
  let bytes = 0
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c < 0x80) bytes += 1
    else if (c < 0x800) bytes += 2
    else if (c >= 0xd800 && c <= 0xdbff) { bytes += 4; i++ }
    else bytes += 3
  }
  return bytes
}

// Estimate the on-disk size of the bundled .scpro for `snapshot` (the object
// `_buildProjectSnapshot()` returns). We serialize and measure the UTF-8 byte
// length — this is exactly what gets written, so base64 image `src` and
// attachment `data` are fully accounted for. Returns 0 for a null/empty input.
export function projectSize(snapshot) {
  if (!snapshot) return 0
  let json
  try {
    json = JSON.stringify(snapshot)
  } catch {
    // A snapshot that can't even stringify has no meaningful size.
    return 0
  }
  return utf8Bytes(json)
}

// Human-readable size, e.g. 1536 → "1.5 KB", 26214400 → "25.0 MB".
export function formatBytes(bytes) {
  if (!bytes || bytes < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  const decimals = i === 0 ? 0 : 1
  return `${n.toFixed(decimals)} ${units[i]}`
}

// True when the serialized project exceeds the warn threshold.
export function isOverSizeLimit(bytes, limit = SIZE_WARN_BYTES) {
  return bytes > limit
}

// ─── Load-time validation ─────────────────────────────────────────────────────

// An image is usable only if it has an id and a non-empty string `src`. We don't
// validate the base64 itself (too costly / browser will reject a bad href on
// render) — we just guarantee the shape so the render path never throws.
function isValidImage(img) {
  return !!img
    && typeof img === 'object'
    && typeof img.src === 'string'
    && img.src.length > 0
    && img.id != null
}

// An attachment is usable only if it has an id, a name, and a non-empty string
// `data` payload.
function isValidAttachment(att) {
  return !!att
    && typeof att === 'object'
    && att.id != null
    && typeof att.data === 'string'
    && att.data.length > 0
}

// Defensively prune malformed images/attachments from a parsed project file
// before it enters the store. Returns a NEW object (does not mutate `data`):
//   { data, dropped: { images: n, attachments: m } }
// `data` keeps every good entry untouched; `dropped` lets the caller surface a
// non-fatal warning. A drawing with no `images` array, or a project with no
// `attachments`, passes through unchanged (Stage 1 migration adds the defaults).
export function sanitizeLoadedProject(data) {
  const dropped = { images: 0, attachments: 0 }
  if (!data || typeof data !== 'object') {
    return { data, dropped }
  }

  const cleanDrawings = Array.isArray(data.drawings)
    ? data.drawings.map(d => {
        if (!d || !Array.isArray(d.images)) return d
        const kept = d.images.filter(isValidImage)
        dropped.images += d.images.length - kept.length
        return kept.length === d.images.length ? d : { ...d, images: kept }
      })
    : data.drawings

  let cleanAttachments = data.attachments
  if (Array.isArray(data.attachments)) {
    const kept = data.attachments.filter(isValidAttachment)
    dropped.attachments = data.attachments.length - kept.length
    cleanAttachments = kept
  }

  // Only rebuild the object if something actually changed, to keep referential
  // stability for the common (all-valid) case.
  if (dropped.images === 0 && dropped.attachments === 0) {
    return { data, dropped }
  }
  return {
    data: { ...data, drawings: cleanDrawings, attachments: cleanAttachments },
    dropped,
  }
}
