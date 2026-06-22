// Manifold component — a hydraulic distribution block with a single pressure
// supply (P) and a configurable number of work ports tapped off a common
// internal gallery. Geometry + pin layout are derived from the port count so the
// block grows with the number of ports (issue #22). Pure — no DOM, no store.

export const MANIFOLD_MIN_PORTS = 2
export const MANIFOLD_MAX_PORTS = 16

const PORT_SPACING = 16   // gap between adjacent work ports
const END_MARGIN = 14     // margin from the block ends to the first/last port
const BLOCK_HEIGHT = 22

export function clampPorts(n) {
  const v = Math.round(Number(n) || 0)
  return Math.max(MANIFOLD_MIN_PORTS, Math.min(MANIFOLD_MAX_PORTS, v))
}

// Block geometry (world units, centred on the component origin) for `ports`
// work ports. `width` grows with the count; height is fixed.
export function manifoldGeom(ports) {
  const n = clampPorts(ports)
  const inner = (n - 1) * PORT_SPACING
  const width = inner + END_MARGIN * 2
  return { n, width, height: BLOCK_HEIGHT }
}

// X coordinate (relative to origin) of work port i (0-based).
function portX(i, width) {
  return -width / 2 + END_MARGIN + i * PORT_SPACING
}

// Pin specs for the manifold: the pressure supply P on the left edge, then
// A1..An evenly spaced along the bottom edge. Shapes match every other placed
// component ({ id, relX, relY, direction, label }).
export function manifoldPins(ports) {
  const { n, width, height } = manifoldGeom(ports)
  const pins = [
    { id: 'P', relX: -width / 2 - 8, relY: 0, direction: 'W', label: 'P' },
  ]
  for (let i = 0; i < n; i++) {
    pins.push({
      id: `A${i + 1}`,
      relX: portX(i, width),
      relY: height / 2 + 8,
      direction: 'S',
      label: `${i + 1}`,
    })
  }
  return pins
}

// Drawing primitives for the symbol: the body rect, the internal gallery line,
// and the work-port stubs. Returned in world units (origin-centred).
export function manifoldDrawing(ports) {
  const { n, width, height } = manifoldGeom(ports)
  const stubs = []
  for (let i = 0; i < n; i++) {
    const x = portX(i, width)
    stubs.push({ x, y1: height / 2, y2: height / 2 + 8, label: `${i + 1}` })
  }
  return {
    n, width, height,
    rect: { x: -width / 2, y: -height / 2, width, height },
    gallery: { x1: -width / 2 + END_MARGIN, x2: width / 2 - END_MARGIN, y: 0 },
    supply: { x1: -width / 2 - 8, x2: -width / 2, y: 0 },
    stubs,
  }
}
