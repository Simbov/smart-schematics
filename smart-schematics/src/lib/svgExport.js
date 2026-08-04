// Helpers for exporting the live schematic SVG to a standalone SVG/PNG/PDF.
//
// Two problems this module solves, both behind "exports look bad":
//
// 1. COLOURS. On-canvas elements colour themselves with CSS custom properties
//    (`stroke: var(--wire-color)`, `fill: var(--component-color)`, theme tints on
//    tables/junctions). Those variables are defined on the document root. When we
//    serialize a clone of the SVG and rasterise it as a *detached* <img> (blob
//    URL), that document context is gone — `var(--…)` resolves to nothing, so
//    wires vanish, strokes turn invalid, and the result looks broken. The fix is
//    to read the *computed* colour off each live element and write it as a
//    concrete inline value on the matching clone node before serialising.
//
// 2. BOUNDS. The content extent must include images, tables and junctions (not
//    just components/wires/annotations) and must use each component's real
//    footprint, or wide parts and pictures get cropped out of the export.

import { getElectricalDef } from './components/electrical'
import { getHydraulicDef } from './components/hydraulic'
import { getCustomDef } from './components/custom'
import { componentSize } from './componentSize'

function getAnyDef(type) {
  return getElectricalDef(type) || getHydraulicDef(type) || getCustomDef(type)
}

// Colour-bearing presentation properties we resolve to concrete values. Reading
// the *computed* value turns any `var(--…)`, `currentColor`, or inherited colour
// into an absolute one that survives serialisation into a standalone document.
const COLOR_PROPS = ['fill', 'stroke', 'stop-color', 'color', 'flood-color', 'lighting-color']

// Walk the live SVG and its clone in lockstep, copying each element's computed
// colour properties onto the clone as inline styles. `live`/`clone` must be the
// same structural tree (clone produced by `live.cloneNode(true)`), so a parallel
// index walk lines them up without needing ids. `getComputed` is injectable for
// testing; defaults to the real window.getComputedStyle.
export function inlineComputedColors(live, clone, getComputed) {
  const read = getComputed || ((el) => (typeof window !== 'undefined' ? window.getComputedStyle(el) : null))
  const walk = (liveEl, cloneEl) => {
    if (!liveEl || !cloneEl || liveEl.nodeType !== 1) return
    const cs = read(liveEl)
    if (cs) {
      for (const prop of COLOR_PROPS) {
        const val = cs.getPropertyValue(prop)
        // Skip empties and "none" (a real, meaningful value we leave to the attr).
        if (val && val !== 'none' && cloneEl.style) {
          cloneEl.style.setProperty(prop, val)
        }
      }
    }
    const lc = liveEl.children || []
    const cc = cloneEl.children || []
    for (let i = 0; i < lc.length && i < cc.length; i++) walk(lc[i], cc[i])
  }
  walk(live, clone)
  return clone
}

// Tight world-coordinate content bounds for a drawing, including every layer:
// components (by real def footprint), wires, annotations, images, tables and
// junctions. Returns { minX, minY, maxX, maxY } padded by `pad`, or null when the
// drawing has nothing to export.
export function boundsFromDrawing(drawing, pad = 30) {
  if (!drawing) return null
  const xs = [], ys = []
  const add = (x, y) => { xs.push(x); ys.push(y) }

  for (const c of (drawing.components || [])) {
    // Use the component's real footprint: boxes carry their own size, parametric
    // parts derive theirs from their current simParams, everything else is the
    // static def footprint. A type with no def at all keeps the old generous
    // 40×40 guess so a stale custom symbol is never cropped.
    const def = getAnyDef(c.type)
    let halfW = 40, halfH = 40
    if (c.type === 'box' || def) {
      const size = componentSize(c, def)
      halfW = size.width / 2
      halfH = size.height / 2
    }
    // Pad a little for labels/designators that overhang the symbol box.
    halfW += 10; halfH += 14
    add(c.x - halfW, c.y - halfH)
    add(c.x + halfW, c.y + halfH)
  }
  for (const w of (drawing.wires || [])) {
    for (const p of (w.points || [])) add(p.x, p.y)
  }
  for (const a of (drawing.annotations || [])) {
    add(a.x, a.y)
    if (a.type === 'callout') add(a.x + (a.width || 120), a.y + (a.height || 60))
    else if (a.width && a.height) add(a.x + a.width, a.y + a.height)
  }
  for (const im of (drawing.images || [])) {
    add(im.x, im.y)
    add(im.x + (im.width || 0), im.y + (im.height || 0))
  }
  for (const t of (drawing.tables || [])) {
    const w = (t.colWidths || []).reduce((s, v) => s + v, 0)
    const h = (t.rowHeights || []).reduce((s, v) => s + v, 0)
    add(t.x, t.y)
    add(t.x + w, t.y + h)
  }
  for (const j of (drawing.junctions || [])) {
    add(j.x - 6, j.y - 6)
    add(j.x + 6, j.y + 6)
  }

  if (!xs.length) return null
  return {
    minX: Math.min(...xs) - pad,
    minY: Math.min(...ys) - pad,
    maxX: Math.max(...xs) + pad,
    maxY: Math.max(...ys) + pad,
  }
}
