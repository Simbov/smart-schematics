// What "select everything" and "drag a box round it" actually select.
//
// Both used to be written inline in Canvas.jsx and both had drifted out of sync
// with the drawing model as new layers were added: Ctrl+A missed tables and
// junctions, and the rubber band missed tables. A table you can drag but cannot
// box-select is the kind of gap that reads as "selection is broken".
//
// Pure functions, no store and no DOM, so the rules are testable.

// Every id a Select All should pick up. Locked images are excluded — a locked
// image is explicitly opted out of being moved or deleted, so sweeping it into
// the selection would let Delete take it out anyway.
export function selectableIds(drawing) {
  if (!drawing) return []
  return [
    ...(drawing.components || []).map(c => c.id),
    ...(drawing.wires || []).map(w => w.id),
    ...(drawing.annotations || []).map(a => a.id),
    ...(drawing.images || []).filter(im => !im.locked).map(im => im.id),
    ...(drawing.tables || []).map(t => t.id),
    ...(drawing.junctions || []).map(j => j.id),
  ]
}

function tableSize(table) {
  return {
    w: (table.colWidths || []).reduce((s, v) => s + v, 0),
    h: (table.rowHeights || []).reduce((s, v) => s + v, 0),
  }
}

// Ids inside a rubber band spanning world rect { minX, minY, maxX, maxY }.
//
// Point-like items (components, junctions, text) qualify on their origin;
// extent-bearing items (wires, callouts, images, tables) must be fully enclosed,
// so brushing the corner of a big table never drags the whole thing along.
export function idsInBand(drawing, band) {
  if (!drawing || !band) return []
  const { minX, minY, maxX, maxY } = band
  const hasPoint = (x, y) => x >= minX && x <= maxX && y >= minY && y <= maxY
  const encloses = (x, y, w, h) => x >= minX && x + w <= maxX && y >= minY && y + h <= maxY

  const inside = []
  for (const c of (drawing.components || [])) {
    if (hasPoint(c.x, c.y)) inside.push(c.id)
  }
  for (const w of (drawing.wires || [])) {
    if ((w.points || []).length && w.points.every(p => hasPoint(p.x, p.y))) inside.push(w.id)
  }
  for (const a of (drawing.annotations || [])) {
    if (a.type === 'text') {
      if (hasPoint(a.x, a.y)) inside.push(a.id)
    } else if (a.type === 'callout') {
      if (encloses(a.x, a.y, a.width || 120, a.height || 60)) inside.push(a.id)
    }
  }
  for (const im of (drawing.images || [])) {
    if (im.locked) continue
    if (encloses(im.x, im.y, im.width || 0, im.height || 0)) inside.push(im.id)
  }
  for (const t of (drawing.tables || [])) {
    const { w, h } = tableSize(t)
    if (encloses(t.x, t.y, w, h)) inside.push(t.id)
  }
  for (const j of (drawing.junctions || [])) {
    if (hasPoint(j.x, j.y)) inside.push(j.id)
  }
  return inside
}
