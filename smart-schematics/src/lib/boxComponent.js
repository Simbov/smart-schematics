// Pure geometry + factory for the component-box (Stage 5).
//
// A "box" is a built-in Component (type:'box') that rides the existing
// components[] array, so wire-snapping, rotate/flip reattachment, move, and
// selection all work for free via the same machinery as every other component.
// It carries a `box:{ width, height, doc, fill, stroke, cornerRadius }` payload
// (Stage 1 schema) and user-defined pins on its edges. It has NO simulation
// model — the DC solver no-ops unknown types.
//
// Everything here is side-effect-free so it can be unit-tested without a DOM.
// The React/Canvas layer wires these into placement/resize/pin-edit.

import { emptyDoc } from './richText'
// Reuse Stage 3's resize math + grid snap so a box resizes exactly like an image.
import { resizeBox, snapBox, snap, RESIZE_HANDLES, MIN_IMAGE_SIZE } from './imageUtils'

export { resizeBox, snapBox, RESIZE_HANDLES }

// Default box geometry — a clean grid multiple at the default grid of 10.
export const DEFAULT_BOX_WIDTH = 80
export const DEFAULT_BOX_HEIGHT = 60
export const DEFAULT_BOX_FILL = '#f1f5f9'
export const DEFAULT_BOX_STROKE = '#334155'
export const DEFAULT_CORNER_RADIUS = 4

// Minimum box side (world units). Mirrors the image resize floor so a box can't
// collapse below a usable size.
export const MIN_BOX_SIZE = MIN_IMAGE_SIZE

// The default per-side pin counts: a 2-terminal block (one pin left, one right).
export const DEFAULT_PIN_SPEC = { W: 1, E: 1, N: 0, S: 0 }

// Edge normal direction for each side. Pins sit on the edge line with their
// `direction` pointing outward (the IEC/IEEE lead convention).
const SIDE_DIRECTION = { W: 'W', E: 'E', N: 'N', S: 'S' }

// Even-spacing positions for `n` pins along a span of length `len`, then snapped
// to the grid so leads land on grid. With n pins the span is divided into n+1
// gaps and pins sit at gap boundaries (1..n)/(n+1) — centered and symmetric.
// Returns offsets measured from the start of the span.
//
// SINGLE-PIN CENTERING RULE: when a side has exactly one pin it must sit at the
// CENTER of that edge. We snap the *on-axis* coordinate to the nearest grid
// multiple measured FROM THE CENTER (not from the span start), so the lone pin
// stays exactly centered and grid-stable regardless of the edge length's parity.
// The off-axis coordinate (the edge line itself) is handled by the caller, which
// always pins relX/relY to ±width/2 or ±height/2 — so the pin can never drift
// off the edge line.
function spacedOffsets(n, len, grid) {
  const center = len / 2
  if (n === 1) {
    // Snap the offset-from-center to grid, then re-add the center. This keeps the
    // pin at the edge midpoint and on a grid line relative to the box center
    // (relX/relY = off - len/2, so a centered, grid-snapped offset ⇒ relX/relY is
    // a clean grid multiple too).
    const snappedFromCenter = grid > 0 ? snap(0, grid) : 0 // 0 ⇒ exact center
    return [center + snappedFromCenter]
  }
  const out = []
  for (let i = 1; i <= n; i++) {
    const raw = (len * i) / (n + 1)
    // Snap each interior pin relative to the center so spacing stays symmetric
    // and grid-aligned about the edge midpoint.
    const off = grid > 0 ? center + snap(raw - center, grid) : raw
    out.push(off)
  }
  return out
}

// Compute the pins for a box given its size and a per-side count spec.
//
//   box  — { width, height } (origin is the box CENTER, like every component;
//           relX/relY are offsets from that center).
//   spec — { W, E, N, S } pin counts per side (missing side ⇒ 0). May ALSO carry
//          an optional `labels` map keyed by pin id (e.g. { W1:'VCC', E1:'GND' })
//          so callers can name pins; absent label ⇒ '' (the v0.2.0 Pin.label
//          default).
//   grid — grid size to snap pin offsets to (0 ⇒ no snap).
//
// Pins sit EXACTLY on the edge line (relX/relY at ±width/2 or ±height/2) and are
// evenly spaced along the edge, each snapped to grid. A side with exactly one pin
// is centered on its edge (see spacedOffsets). `direction` = the edge normal so
// wires approach the box squarely. Each pin carries `label: string` (default '').
export function boxPins(box, spec = DEFAULT_PIN_SPEC, grid = 10) {
  const w = box.width
  const h = box.height
  const hw = w / 2
  const hh = h / 2
  const counts = { W: 0, E: 0, N: 0, S: 0, ...spec }
  const labels = spec.labels || {}
  const pins = []

  // West / East edges: pins spaced vertically (offset measured top→bottom).
  for (const side of ['W', 'E']) {
    const n = Math.max(0, Math.round(counts[side] || 0))
    const offs = spacedOffsets(n, h, grid)
    offs.forEach((off, i) => {
      const id = `${side}${i + 1}`
      pins.push({
        id,
        relX: side === 'W' ? -hw : hw,
        relY: off - hh,
        direction: SIDE_DIRECTION[side],
        label: labels[id] ?? '',
      })
    })
  }
  // North / South edges: pins spaced horizontally (offset measured left→right).
  for (const side of ['N', 'S']) {
    const n = Math.max(0, Math.round(counts[side] || 0))
    const offs = spacedOffsets(n, w, grid)
    offs.forEach((off, i) => {
      const id = `${side}${i + 1}`
      pins.push({
        id,
        relX: off - hw,
        relY: side === 'N' ? -hh : hh,
        direction: SIDE_DIRECTION[side],
        label: labels[id] ?? '',
      })
    })
  }
  return pins
}

// Pure placement for a box pin's label text (Stage 7). Given a pin's absolute
// world coords + edge direction, returns where to draw its `label` so it sits
// just INSIDE the box from the pin, with the matching SVG text-anchor /
// dominant-baseline. `inset` is in world units. No DOM.
export function boxPinLabelPos(pin, inset = 8) {
  const x = pin.absX ?? pin.relX ?? 0
  const y = pin.absY ?? pin.relY ?? 0
  switch (pin.direction) {
    case 'W': return { x: x + inset, y, anchor: 'start',  baseline: 'middle' }
    case 'E': return { x: x - inset, y, anchor: 'end',    baseline: 'middle' }
    case 'N': return { x, y: y + inset, anchor: 'middle', baseline: 'hanging' }
    case 'S': return { x, y: y - inset, anchor: 'middle', baseline: 'auto' }
    default:  return { x, y, anchor: 'middle', baseline: 'middle' }
  }
}

// Build a valid box Component (type:'box'). The store's addComponent path is not
// used for boxes because a box has no library def; the Canvas calls this factory
// directly and hands the result to a generic add. The origin (x,y) is the box
// CENTER (matching pin relX/relY being offsets from the center).
//
// `pins` carry only relX/relY/direction here; absX/absY are filled in by the
// caller via computePinAbsPositions (same as every placed component).
export function createBox({
  x = 0,
  y = 0,
  width = DEFAULT_BOX_WIDTH,
  height = DEFAULT_BOX_HEIGHT,
  doc = null,
  fill = DEFAULT_BOX_FILL,
  stroke = DEFAULT_BOX_STROKE,
  cornerRadius = DEFAULT_CORNER_RADIUS,
  pinSpec = DEFAULT_PIN_SPEC,
  grid = 10,
  designator = '',
  id = null,
} = {}) {
  const w = grid > 0 ? Math.max(MIN_BOX_SIZE, snap(width, grid)) : width
  const h = grid > 0 ? Math.max(MIN_BOX_SIZE, snap(height, grid)) : height
  const box = { width: w, height: h }
  const pins = boxPins(box, pinSpec, grid).map(p => ({
    ...p,
    absX: x + p.relX,
    absY: y + p.relY,
  }))
  return {
    ...(id ? { id } : {}),
    type: 'box',
    designator,
    value: '',
    description: '',
    x,
    y,
    rotation: 0,
    flipH: false,
    flipV: false,
    pins,
    box: {
      width: w,
      height: h,
      doc: doc || emptyDoc(),
      fill,
      stroke,
      cornerRadius,
      // v0.2.0 box additions — flexible property rows replace the generic
      // `value` for boxes; reference pictures shown only in the Properties panel
      // (NOT drawn on the canvas); free-form info text.
      fields: [],
      images: [],
      info: '',
    },
    simParams: {},
    simState: {},
    labelOffset: { x: 0, y: -15 },
  }
}

// Resize a box's geometry by dragging `handle`, snapping the result to grid and
// flooring at MIN_BOX_SIZE. Returns a new { x, y, width, height } in CENTER
// coordinates (the box's x/y is its center). The caller converts the resize
// gesture (which works in top-left box coords like an image) and re-derives pins.
//
// We delegate the per-handle math to imageUtils.resizeBox using a top-left box,
// then snap. This keeps a single tested resize implementation.
export function resizeBoxGeometry(topLeftBox, handle, dx, dy, grid = 10, keepAspect = false) {
  const resized = resizeBox(topLeftBox, handle, dx, dy, keepAspect)
  if (grid > 0) {
    return {
      x: snap(resized.x, grid),
      y: snap(resized.y, grid),
      width: Math.max(MIN_BOX_SIZE, snap(resized.width, grid)),
      height: Math.max(MIN_BOX_SIZE, snap(resized.height, grid)),
    }
  }
  return {
    x: resized.x,
    y: resized.y,
    width: Math.max(MIN_BOX_SIZE, resized.width),
    height: Math.max(MIN_BOX_SIZE, resized.height),
  }
}
