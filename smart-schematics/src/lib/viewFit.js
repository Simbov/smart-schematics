// Fit-to-screen: the view state that brings a whole drawing (or an arbitrary
// world rect) into a viewport.
//
// "Fit to Screen (0)" used to just reset pan to 0,0 and zoom to 1. On anything
// larger than one screen that is not a fit — it drops you at the sheet origin
// with the drawing off-screen, which reads as the button doing nothing. Real
// fitting is the same arithmetic zoomToSelection already used, so it lives here
// once and both callers share it.
//
// Pure — no store, no DOM.

export const MIN_ZOOM = 0.05
export const MAX_ZOOM = 8

// View state that centres `bounds` ({minX, minY, maxX, maxY}) in a viewport of
// `vw` × `vh` screen pixels. Returns null when there is nothing to fit, so the
// caller can leave the view alone rather than jumping somewhere arbitrary.
export function fitViewState(bounds, vw, vh, { maxZoom = 1 } = {}) {
  if (!bounds || !(vw > 0) || !(vh > 0)) return null
  const contentW = bounds.maxX - bounds.minX
  const contentH = bounds.maxY - bounds.minY
  if (!(contentW > 0) || !(contentH > 0)) return null

  // Never zoom PAST 1:1 to fill the screen with a tiny drawing — a lone resistor
  // blown up to 8× is not what "fit" means.
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, maxZoom, Math.min(vw / contentW, vh / contentH)))
  return {
    zoom,
    panX: (vw - contentW * zoom) / 2 - bounds.minX * zoom,
    panY: (vh - contentH * zoom) / 2 - bounds.minY * zoom,
  }
}

// Bounds of just the selected items, in the same shape boundsFromDrawing
// returns. Used by zoom-to-selection (Z).
export function boundsFromSelection(drawing, ids, pad = 40) {
  if (!drawing || !ids?.length) return null
  const set = new Set(ids)
  const xs = [], ys = []
  const add = (x, y) => { xs.push(x); ys.push(y) }

  for (const c of (drawing.components || [])) {
    if (!set.has(c.id)) continue
    for (const p of (c.pins || [])) add(p.absX ?? c.x, p.absY ?? c.y)
    add(c.x - 40, c.y - 40); add(c.x + 40, c.y + 40)
  }
  for (const w of (drawing.wires || [])) {
    if (!set.has(w.id)) continue
    for (const p of (w.points || [])) add(p.x, p.y)
  }
  for (const a of (drawing.annotations || [])) {
    if (!set.has(a.id)) continue
    add(a.x, a.y)
    if (a.width && a.height) add(a.x + a.width, a.y + a.height)
    else if (a.type === 'callout') add(a.x + 120, a.y + 60)
  }
  for (const im of (drawing.images || [])) {
    if (!set.has(im.id)) continue
    add(im.x, im.y); add(im.x + (im.width || 0), im.y + (im.height || 0))
  }
  for (const t of (drawing.tables || [])) {
    if (!set.has(t.id)) continue
    add(t.x, t.y)
    add(t.x + (t.colWidths || []).reduce((s, v) => s + v, 0),
        t.y + (t.rowHeights || []).reduce((s, v) => s + v, 0))
  }
  for (const j of (drawing.junctions || [])) {
    if (!set.has(j.id)) continue
    add(j.x, j.y)
  }
  if (!xs.length) return null
  return {
    minX: Math.min(...xs) - pad, minY: Math.min(...ys) - pad,
    maxX: Math.max(...xs) + pad, maxY: Math.max(...ys) + pad,
  }
}
