// Grid-size options for the StatusBar grid control (Stage 5).
// Pure module — no DOM/store dependencies so it stays trivially testable.

export const GRID_SIZES = [5, 10, 20, 25, 50]

// Map an arbitrary numeric input to the nearest valid grid option.
// Non-finite / invalid input falls back to the default (10). Ties (equal
// distance to two options) resolve to the smaller option.
export function clampGridSize(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return 10
  let best = GRID_SIZES[0]
  let bestDist = Math.abs(num - best)
  for (const size of GRID_SIZES) {
    const dist = Math.abs(num - size)
    if (dist < bestDist) {
      best = size
      bestDist = dist
    }
  }
  return best
}
