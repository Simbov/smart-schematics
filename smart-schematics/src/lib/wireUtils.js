// Auto-route from `from` to `to` using a single orthogonal elbow.
// Chooses H-then-V or V-then-H based on the dominant movement direction.
export function routeWire(from, to) {
  const { x: x1, y: y1 } = from
  const { x: x2, y: y2 } = to
  if (x1 === x2 || y1 === y2) return [from, to] // already straight
  const dx = Math.abs(x2 - x1)
  const dy = Math.abs(y2 - y1)
  if (dx >= dy) {
    return [from, { x: x2, y: y1 }, to] // H-then-V
  } else {
    return [from, { x: x1, y: y2 }, to] // V-then-H
  }
}

export function dedupPoints(points) {
  return points.filter(
    (p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y
  )
}

// Find nearest component pin.
// A pin is a snap candidate when the cursor is either within `threshold` world
// units of the pin OR anywhere inside the component's body (its pin bounding box
// expanded by `bodyPad`). The body test lets the user grab a pin by clicking
// anywhere on the component, not just on the pin's small edge dot.
export function findNearestPin(wx, wy, components, threshold = 18, bodyPad = 14) {
  let best = null
  let bestDist = Infinity

  for (const comp of components) {
    const pins = comp.pins || []
    if (pins.length === 0) continue

    // Component body bounding box (in world coords) from its pins.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const pin of pins) {
      const px = comp.x + pin.relX
      const py = comp.y + pin.relY
      if (px < minX) minX = px
      if (px > maxX) maxX = px
      if (py < minY) minY = py
      if (py > maxY) maxY = py
    }
    const insideBody =
      bodyPad > 0 &&
      wx >= minX - bodyPad && wx <= maxX + bodyPad &&
      wy >= minY - bodyPad && wy <= maxY + bodyPad

    for (const pin of pins) {
      const px = comp.x + pin.relX
      const py = comp.y + pin.relY
      const d = Math.sqrt((wx - px) ** 2 + (wy - py) ** 2)
      // Eligible if near the pin OR clicking within the component body.
      if ((d <= threshold || insideBody) && d < bestDist) {
        bestDist = d
        best = { type: 'pin', componentId: comp.id, pinId: pin.id, x: px, y: py }
      }
    }
  }
  return best
}

// Nearest point on a single orthogonal segment to (px,py), clamped to segment bounds.
function nearestOnSegment(px, py, x1, y1, x2, y2) {
  if (x1 === x2) {
    const cy = Math.min(Math.max(py, Math.min(y1, y2)), Math.max(y1, y2))
    return { x: x1, y: cy }
  }
  if (y1 === y2) {
    const cx = Math.min(Math.max(px, Math.min(x1, x2)), Math.max(x1, x2))
    return { x: cx, y: y1 }
  }
  return null
}

// Find nearest point on any existing wire (endpoints or segment midpoints) within threshold.
// Returns { type:'wire', x, y, wireId, isEndpoint } or null.
export function findNearestWireSnap(wx, wy, wires, threshold = 18) {
  let best = null
  let bestDist = threshold

  for (const wire of wires) {
    const pts = wire.points

    // Prioritise wire endpoints slightly (smaller virtual distance)
    for (const pt of [pts[0], pts[pts.length - 1]]) {
      const d = Math.sqrt((wx - pt.x) ** 2 + (wy - pt.y) ** 2)
      if (d < bestDist) {
        bestDist = d
        best = { type: 'wire', x: pt.x, y: pt.y, wireId: wire.id, isEndpoint: true }
      }
    }

    // Segment mid-snapping (for T-junctions)
    for (let i = 0; i < pts.length - 1; i++) {
      const { x: x1, y: y1 } = pts[i]
      const { x: x2, y: y2 } = pts[i + 1]
      const nearest = nearestOnSegment(wx, wy, x1, y1, x2, y2)
      if (!nearest) continue
      const d = Math.sqrt((wx - nearest.x) ** 2 + (wy - nearest.y) ** 2)
      if (d < bestDist) {
        bestDist = d
        best = { type: 'wire', x: nearest.x, y: nearest.y, wireId: wire.id, isEndpoint: false }
      }
    }
  }
  return best
}

// Combined snap: pins beat wire snaps; both beat free grid.
// Returns { type:'pin'|'wire'|'grid', x, y, ... } — always has x,y.
export function getBestSnap(wx, wy, components, wires, pinThreshold = 18, wireThreshold = 14, pinBodyPad = 14) {
  const pin = findNearestPin(wx, wy, components, pinThreshold, pinBodyPad)
  if (pin) return pin
  const wireSnap = findNearestWireSnap(wx, wy, wires, wireThreshold)
  if (wireSnap) return wireSnap
  return { type: 'grid', x: wx, y: wy }
}

// Is point (px,py) strictly on axis-aligned segment (x1,y1)-(x2,y2)?
export function isPointOnSegment(px, py, x1, y1, x2, y2, tol = 0.5) {
  if (x1 === x2) {
    return (
      Math.abs(px - x1) <= tol &&
      py >= Math.min(y1, y2) - tol &&
      py <= Math.max(y1, y2) + tol
    )
  }
  if (y1 === y2) {
    return (
      Math.abs(py - y1) <= tol &&
      px >= Math.min(x1, x2) - tol &&
      px <= Math.max(x1, x2) + tol
    )
  }
  return false
}

export function isPointOnWire(px, py, wire) {
  const pts = wire.points
  for (let i = 0; i < pts.length - 1; i++) {
    if (isPointOnSegment(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y))
      return true
  }
  return false
}

// Is point strictly on the wire but NOT at its endpoints?
export function isPointOnWireMiddle(px, py, wire) {
  const pts = wire.points
  const isEndpoint = (p) =>
    (Math.abs(p.x - pts[0].x) < 0.5 && Math.abs(p.y - pts[0].y) < 0.5) ||
    (Math.abs(p.x - pts[pts.length - 1].x) < 0.5 &&
      Math.abs(p.y - pts[pts.length - 1].y) < 0.5)
  if (isEndpoint({ x: px, y: py })) return false
  return isPointOnWire(px, py, wire)
}

// Count how many wire connections meet at point (px,py).
// An endpoint landing on the point counts as 1; a wire passing through the
// point on its middle (not an endpoint) counts as 2 (it continues on both sides).
export function wireConnectionCount(px, py, wires, tol = 0.5) {
  let count = 0
  for (const w of wires) {
    const pts = w.points
    if (!pts || pts.length < 2) continue
    const first = pts[0]
    const last = pts[pts.length - 1]
    const atFirst = Math.abs(first.x - px) < tol && Math.abs(first.y - py) < tol
    const atLast = Math.abs(last.x - px) < tol && Math.abs(last.y - py) < tol
    if (atFirst) count++
    if (atLast) count++
    if (!atFirst && !atLast && isPointOnWire(px, py, w)) count += 2
  }
  return count
}

// Drop junctions that are no longer real nodes (fewer than 3 wire connections
// meet there). Used after wire deletion so dangling dots disappear.
export function pruneJunctions(junctions, wires) {
  if (!junctions?.length) return junctions || []
  return junctions.filter(j => wireConnectionCount(j.x, j.y, wires) >= 3)
}

// Find crossing points between `wire` and `otherWires`.
// Returns [{x, y, segIdx}] — segIdx is the index into wire.points pairs.
export function findWireCrossings(wire, otherWires) {
  const result = []
  const pts = wire.points
  for (let i = 0; i < pts.length - 1; i++) {
    const s1 = { x1: pts[i].x, y1: pts[i].y, x2: pts[i + 1].x, y2: pts[i + 1].y }
    for (const other of otherWires) {
      if (other.id === wire.id) continue
      const op = other.points
      for (let j = 0; j < op.length - 1; j++) {
        const s2 = { x1: op[j].x, y1: op[j].y, x2: op[j + 1].x, y2: op[j + 1].y }
        const cross = segmentCrossing(s1, s2)
        if (cross) result.push({ ...cross, segIdx: i })
      }
    }
  }
  return result
}

function segmentCrossing(s1, s2) {
  const h1 = s1.y1 === s1.y2
  const h2 = s2.y1 === s2.y2
  if (h1 === h2) return null // parallel
  const h = h1 ? s1 : s2
  const v = h1 ? s2 : s1
  const vx = v.x1
  const hy = h.y1
  const hxMin = Math.min(h.x1, h.x2)
  const hxMax = Math.max(h.x1, h.x2)
  const vyMin = Math.min(v.y1, v.y2)
  const vyMax = Math.max(v.y1, v.y2)
  // Strictly inside both segments (not at endpoints = no junction)
  if (vx > hxMin && vx < hxMax && hy > vyMin && hy < vyMax) {
    return { x: vx, y: hy }
  }
  return null
}
