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

// Point-in-image hit test honoring the image's rotation (0/90/180/270 only).
//
// An image is an axis-aligned box {x, y, width, height} that may be rotated in
// 90° steps about its own center. Rather than rotate the box, we rotate the
// query point by -rotation about the center back into the box's un-rotated
// frame, then do a plain rect containment test. This is the SINGLE source of
// truth for "is this world point inside this image" — both Canvas click
// handling and any future hit-testing must use it so picking and the rendered
// rect can never disagree (the old per-<image> onClick path was the source of
// the flaky selection bug).
export function imageHitTest(image, wx, wy) {
  if (!image) return false
  const { x, y, width, height } = image
  const cx = x + width / 2
  const cy = y + height / 2
  // Normalize rotation to 0/90/180/270. Anything else is treated as its nearest
  // right-angle (images only ever rotate in 90° steps in this app).
  const rot = ((Math.round((image.rotation || 0) / 90) * 90) % 360 + 360) % 360

  // Rotate the query point by -rot about the center, into the box's local frame.
  let dx = wx - cx
  let dy = wy - cy
  let lx, ly
  switch (rot) {
    case 90:  lx =  dy; ly = -dx; break   // inverse of +90°
    case 180: lx = -dx; ly = -dy; break
    case 270: lx = -dy; ly =  dx; break
    default:  lx =  dx; ly =  dy; break    // 0°
  }
  // The un-rotated box is centered at the origin in local coords.
  return Math.abs(lx) <= width / 2 && Math.abs(ly) <= height / 2
}

// Z-order-correct image pick: returns the TOPMOST image under a world point, or
// null on a miss. Images later in the array render on top (see Canvas/ImageLayer
// draw order), so we scan back-to-front. Locked images are select-through and
// skipped unless `includeLocked` is set (Alt/right-click path, so a locked image
// can be re-selected to unlock it).
export function topImageAt(images, wx, wy, { includeLocked = false } = {}) {
  if (!images) return null
  for (let i = images.length - 1; i >= 0; i--) {
    const img = images[i]
    if (!img) continue
    if (img.locked && !includeLocked) continue
    if (imageHitTest(img, wx, wy)) return img
  }
  return null
}

// The eight resize-handle ids. Corners resize two sides; edges resize one.
export const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

// Full (uncropped) crop rect, in normalized [0,1] source coordinates.
export const FULL_CROP = { x: 0, y: 0, w: 1, h: 1 }

// True when a crop rect actually trims the image (i.e. is not the full frame).
export function isCropped(crop) {
  if (!crop) return false
  return !(crop.x <= 0.0001 && crop.y <= 0.0001 && crop.w >= 0.9999 && crop.h >= 0.9999)
}

// Clamp/normalize a crop rect to valid [0,1] bounds with a minimum visible area.
export function normalizeCrop(crop) {
  if (!crop) return { ...FULL_CROP }
  const MIN = 0.02
  let x = Math.min(Math.max(0, crop.x ?? 0), 1 - MIN)
  let y = Math.min(Math.max(0, crop.y ?? 0), 1 - MIN)
  let w = Math.min(Math.max(MIN, crop.w ?? 1), 1 - x)
  let h = Math.min(Math.max(MIN, crop.h ?? 1), 1 - y)
  return { x, y, w, h }
}

// Geometry for rendering a cropped image in SVG: the image element is scaled up
// so the crop region fills the displayed box (img.x/y/width/height), and a clip
// rect hides everything outside that box. Returns the <image> placement + the
// clip rect (which equals the display box). For an un-cropped image the image
// placement equals the display box and no clip is needed.
export function cropToImageRect(img) {
  const crop = normalizeCrop(img.crop)
  const fullW = img.width / crop.w
  const fullH = img.height / crop.h
  return {
    imageX: img.x - crop.x * fullW,
    imageY: img.y - crop.y * fullH,
    imageW: fullW,
    imageH: fullH,
    clip: { x: img.x, y: img.y, w: img.width, h: img.height },
  }
}

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
