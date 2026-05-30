// Label placement: keep a component's designator clear of any wire that would
// otherwise run through it. We try a fixed priority of sides around the
// component's on-screen bounding box and pick the first whose label box no wire
// segment crosses.

const GAP = 6          // clearance between the symbol edge and the label box
const LABEL_H = 11     // approx label box height (font ~8px + padding)
const CHAR_W = 5       // approx glyph advance at fontSize 8

// Does segment (x1,y1)-(x2,y2) intersect the axis-aligned rect [rx,ry,rw,rh]?
function segIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
  const xMin = rx, xMax = rx + rw, yMin = ry, yMax = ry + rh
  // Either endpoint inside the rect → intersects.
  if ((x1 >= xMin && x1 <= xMax && y1 >= yMin && y1 <= yMax) ||
      (x2 >= xMin && x2 <= xMax && y2 >= yMin && y2 <= yMax)) return true
  // Otherwise test against the four edges.
  return (
    segSeg(x1, y1, x2, y2, xMin, yMin, xMax, yMin) ||
    segSeg(x1, y1, x2, y2, xMax, yMin, xMax, yMax) ||
    segSeg(x1, y1, x2, y2, xMax, yMax, xMin, yMax) ||
    segSeg(x1, y1, x2, y2, xMin, yMax, xMin, yMin)
  )
}

function segSeg(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = cross(dx - cx, dy - cy, ax - cx, ay - cy)
  const d2 = cross(dx - cx, dy - cy, bx - cx, by - cy)
  const d3 = cross(bx - ax, by - ay, cx - ax, cy - ay)
  const d4 = cross(bx - ax, by - ay, dx - ax, dy - ay)
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))
}

const cross = (ux, uy, vx, vy) => ux * vy - uy * vx

// Candidate label box (world coords) for a given side, given the component
// origin (ox,oy) and the symbol's on-screen half-extents (hw,hh).
function labelBox(side, ox, oy, hw, hh, lw, lh) {
  switch (side) {
    case 'top':    return { x: ox - lw / 2, y: oy - hh - GAP - lh, w: lw, h: lh }
    case 'bottom': return { x: ox - lw / 2, y: oy + hh + GAP,      w: lw, h: lh }
    case 'right':  return { x: ox + hw + GAP, y: oy - lh / 2,      w: lw, h: lh }
    case 'left':   return { x: ox - hw - GAP - lw, y: oy - lh / 2, w: lw, h: lh }
    default:       return { x: ox - lw / 2, y: oy - hh - GAP - lh, w: lw, h: lh }
  }
}

const SIDES = ['top', 'bottom', 'right', 'left']

// Pick the best side ('top' | 'bottom' | 'right' | 'left') for a component's
// designator label so it doesn't sit under a wire. Falls back to 'top' if every
// side is obstructed.
export function chooseLabelSide(component, def, wires) {
  const text = component.designator || ''
  if (!text) return 'top'

  const w = def?.width || 40
  const h = def?.height || 20
  const rot = (((component.rotation || 0) % 360) + 360) % 360
  const sideways = rot === 90 || rot === 270
  const hw = (sideways ? h : w) / 2
  const hh = (sideways ? w : h) / 2

  const lw = text.length * CHAR_W + 4
  const lh = LABEL_H

  for (const side of SIDES) {
    const box = labelBox(side, component.x, component.y, hw, hh, lw, lh)
    let hit = false
    for (const wire of wires) {
      const pts = wire.points || []
      for (let i = 0; i < pts.length - 1 && !hit; i++) {
        if (segIntersectsRect(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y,
                              box.x, box.y, box.w, box.h)) hit = true
      }
      if (hit) break
    }
    if (!hit) return side
  }
  return 'top'
}
