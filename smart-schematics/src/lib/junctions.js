// Pure helpers for junctions (v0.4.0).
//
// A junction was historically just a connection dot: `{ id, x, y }` auto-created
// where three or more wire ends meet (T-junction). v0.4.0 makes junctions
// first-class, documentable nodes: the user can left-click anywhere on a wire to
// drop one, select it, and give it a label + reorderable content blocks (photos,
// properties, notes) via `junction.blocks` (shared with boxes, see boxBlocks.js).
//
// Schema (all content fields optional / lazily added):
//   { id, x, y, manual?:boolean, label?:string, blocks?:Block[] }
//
// `manual:true` marks a user-placed junction so `pruneJunctions` (wireUtils.js)
// never deletes it for having <3 wire connections — only auto dots are pruned.
//
// Everything here is side-effect-free so it unit-tests with no DOM.

import { isPointOnWire } from './wireUtils'

let _junctionCounter = 0

export function genJunctionId() {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `jct_${uuid}`
  return `jct_${Date.now().toString(36)}_${(_junctionCounter++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

// Build a user-placed (manual) junction node. id auto-minted when absent.
export function createJunction({ id = null, x = 0, y = 0 } = {}) {
  return { id: id || genJunctionId(), x, y, manual: true, label: '', blocks: [] }
}

// Ids of all junctions whose point lies on the given wire's polyline. Drives
// "drag a wire → its junctions move with it" (the junctions sit on that wire).
export function junctionsOnWire(junctions = [], wire) {
  if (!wire) return []
  return (junctions || [])
    .filter(j => isPointOnWire(j.x, j.y, wire))
    .map(j => j.id)
}

// Ids of all junctions sitting on ANY of the given wires (deduped). Used by the
// drag system to gather the junctions that should follow a multi-wire drag.
export function junctionsOnWires(junctions = [], wires = []) {
  const ids = new Set()
  for (const w of wires || []) {
    for (const id of junctionsOnWire(junctions, w)) ids.add(id)
  }
  return [...ids]
}
