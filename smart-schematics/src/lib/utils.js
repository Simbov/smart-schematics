export function snapToGrid(value, gridSize) {
  return Math.round(value / gridSize) * gridSize
}

export function screenToWorld(screenX, screenY, panX, panY, zoom) {
  return {
    x: (screenX - panX) / zoom,
    y: (screenY - panY) / zoom,
  }
}

export function worldToScreen(worldX, worldY, panX, panY, zoom) {
  return {
    x: worldX * zoom + panX,
    y: worldY * zoom + panY,
  }
}

export function distance(ax, ay, bx, by) {
  return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2)
}

// Compute absolute pin positions given component transform
export function computePinAbsPositions(pins, x, y, rotation, flipH, flipV) {
  const r = ((rotation || 0) * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  return pins.map(p => {
    const sx = p.relX * (flipH ? -1 : 1)
    const sy = p.relY * (flipV ? -1 : 1)
    return {
      ...p,
      absX: x + sx * cos - sy * sin,
      absY: y + sx * sin + sy * cos,
    }
  })
}
