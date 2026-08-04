// Reference-designator allocation.
//
// A designator must be unique within a drawing — it is how a schematic names a
// part, and how contact/coil pairs (K1 coil ↔ K1 contact) find each other in the
// simulator. Two earlier rules both broke that:
//
//   * "count the components of this type, add one" — delete R1 from [R1, R2] and
//     the next resistor is numbered R2, colliding with the survivor.
//   * paste/duplicate copied the designator verbatim — Ctrl+D on R1 gave a
//     second R1.
//
// Both are fixed by allocating from the set of designators already in use.

const SPLIT = /^([^0-9]*)(\d+)$/

// Split "KM12" into { prefix: 'KM', n: 12 }. A designator with no trailing
// number (or an empty one) has no numeric slot to reserve.
export function splitDesignator(designator) {
  const m = SPLIT.exec(String(designator ?? '').trim())
  if (!m) return null
  return { prefix: m[1], n: Number(m[2]) }
}

// The lowest positive integer N for which `${prefix}${N}` is not already taken.
// `taken` is any iterable of existing designator strings. Gaps are reused, so
// deleting R2 out of R1..R3 makes the next resistor R2 again — which is what an
// engineer expects when renumbering a sheet.
export function nextDesignator(prefix, taken) {
  const used = new Set()
  for (const d of (taken || [])) {
    const parts = splitDesignator(d)
    if (parts && parts.prefix === prefix) used.add(parts.n)
  }
  let n = 1
  while (used.has(n)) n++
  return `${prefix}${n}`
}

// Allocate a designator for a new component about to be added to `components`.
export function allocateDesignator(prefix, components) {
  return nextDesignator(prefix, (components || []).map(c => c.designator))
}

// Renumber a batch of components being pasted/duplicated into `existing`.
// Returns a new array; each incoming component keeps its prefix but gets the
// next free number, and numbers already handed out in this same batch are
// reserved so a multi-item paste never collides with itself.
//
// A designator with no trailing digits (a user-typed name like "MAIN CONTACTOR")
// is left alone — there is no number to bump, and silently renaming it would
// lose information.
export function renumberForPaste(incoming, existing) {
  const taken = new Set((existing || []).map(c => c.designator).filter(Boolean))
  return (incoming || []).map(c => {
    const parts = splitDesignator(c.designator)
    if (!parts) return c
    const next = nextDesignator(parts.prefix, taken)
    taken.add(next)
    return { ...c, designator: next }
  })
}
