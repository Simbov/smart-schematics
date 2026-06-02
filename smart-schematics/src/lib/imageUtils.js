// Pure geometry helpers for inserted images (Stage 3).
//
// All exports are side-effect-free so they can be unit-tested without a DOM.
// The React/Canvas layer wires these into selection/drag/resize; everything
// that involves arithmetic on an image box lives here.

// Minimum world-units an image side may shrink to during a resize. Keeps a
// dragged handle from collapsing or inverting the box.
export const MIN_IMAGE_SIZE = 10

// Default cap (world units) for the longest side of a freshly-inserted image,
// so a huge photo doesn't drop onto the canvas at full pixel size.
export const DEFAULT_MAX_SIZE = 400

// snapToGrid mirrors src/lib/utils.js so this module has no cross-dep.
export function snap(value, grid) {
  if (!grid || grid <= 0) return value
  return Math.round(value / grid) * grid
}

// Clamp a natural pixel size to fit within `maxSize` (longest side), preserving
// aspect ratio. Images already within the cap are returned unchanged. Falls back
// to a square `maxSize` when a dimension is missing/zero (e.g. an SVG with no
// intrinsic size).
export function aspectFitSize(naturalW, naturalH, maxSize = DEFAULT_MAX_SIZE) {
  const w = Number(naturalW) || 0
  const h = Number(naturalH) || 0
  if (w <= 0 || h <= 0) return { width: maxSize, height: maxSize }
  const longest = Math.max(w, h)
  if (longest <= maxSize) return { width: w, height: h }
  const scale = maxSize / longest
  return { width: w * scale, height: h * scale }
}

// Default placement: center a box of `size` on a world point, then snap its
// origin (top-left) to the grid. Used to drop an inserted image in the middle
// of the current viewport.
export function defaultPlacement(centerX, centerY, size, grid = 0) {
  const x = centerX - size.width / 2
  const y = centerY - size.height / 2
  return { x: snap(x, grid), y: snap(y, grid) }
}

// Snap an image box's origin to the grid (size unchanged). Used on move-commit.
export function snapBox(box, grid) {
  return { ...box, x: snap(box.x, grid), y: snap(box.y, grid) }
}

// The eight resize-handle ids. Corners resize two sides; edges resize one.
export const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

// Which edges a handle drags. left/top move the origin; right/bottom move the
// far edge.
function handleEdges(handle) {
  return {
    left: handle.includes('w'),
    right: handle.includes('e'),
    top: handle.includes('n'),
    bottom: handle.includes('s'),
  }
}

// Resize an image box by dragging `handle` by (dx, dy) in world units.
//
// - Per-handle: corner handles move both an x-edge and a y-edge; edge handles
//   move a single edge.
// - Min size: each dimension is floored at MIN_IMAGE_SIZE; a side stops moving
//   (the opposite edge stays put) rather than inverting.
// - keepAspect (Shift): preserves the box's original aspect ratio. The driving
//   axis is the one with the larger raw delta; the other dimension follows, and
//   the box still grows from the anchored (opposite) corner/edge.
//
// Returns a new {x, y, width, height}; never mutates the input.
export function resizeBox(box, handle, dx, dy, keepAspect = false) {
  const edges = handleEdges(handle)
  const aspect = box.height !== 0 ? box.width / box.height : 1

  let { x, y, width, height } = box
  let right = x + width
  let bottom = y + height

  if (keepAspect) {
    // Determine the new width/height honoring aspect, driven by the dominant
    // axis, then re-derive edges from the anchored corner.
    const movesW = edges.left || edges.right
    const movesH = edges.top || edges.bottom

    // Signed change to width/height implied by the drag (positive = grow).
    let dW = (edges.right ? dx : 0) + (edges.left ? -dx : 0)
    let dH = (edges.bottom ? dy : 0) + (edges.top ? -dy : 0)

    let newW = width + dW
    let newH = height + dH

    // Drive off one axis, derive the other from aspect. For a corner the
    // dominant (larger raw delta) axis wins; an edge drives its own axis.
    const widthDriven = movesW && movesH
      ? Math.abs(dW) >= Math.abs(dH)
      : movesW
    if (widthDriven) newH = newW / aspect
    else newW = newH * aspect

    // Floor the driving dimension at MIN, then re-derive the other so the ratio
    // stays exact even when the drag would invert/collapse the box.
    if (widthDriven) {
      newW = Math.max(MIN_IMAGE_SIZE, newW)
      newH = newW / aspect
      if (newH < MIN_IMAGE_SIZE) { newH = MIN_IMAGE_SIZE; newW = newH * aspect }
    } else {
      newH = Math.max(MIN_IMAGE_SIZE, newH)
      newW = newH * aspect
      if (newW < MIN_IMAGE_SIZE) { newW = MIN_IMAGE_SIZE; newH = newW / aspect }
    }

    // Anchor: edges that don't move stay fixed.
    if (edges.left) x = right - newW
    else x = box.x // left fixed
    if (edges.top) y = bottom - newH
    else y = box.y // top fixed

    return { x, y, width: newW, height: newH }
  }

  // Free resize (no aspect lock): move the dragged edges, floor at min size.
  if (edges.left) {
    x = Math.min(x + dx, right - MIN_IMAGE_SIZE)
    width = right - x
  }
  if (edges.right) {
    right = Math.max(right + dx, x + MIN_IMAGE_SIZE)
    width = right - x
  }
  if (edges.top) {
    y = Math.min(y + dy, bottom - MIN_IMAGE_SIZE)
    height = bottom - y
  }
  if (edges.bottom) {
    bottom = Math.max(bottom + dy, y + MIN_IMAGE_SIZE)
    height = bottom - y
  }

  return { x, y, width, height }
}
