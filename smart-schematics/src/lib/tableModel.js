// Pure model + geometry for drawing tables (Stage 1, v0.2.0).
//
// A Table is a free-floating grid of rich-text cells that lives in
// `drawing.tables[]`. Each cell reuses the canonical `RichDoc` model from
// richText.js — DO NOT fork it. Everything here is side-effect-free (no DOM, no
// store) so it is fully unit-testable; the React/Canvas layer wires these into
// placement/resize/cell-edit in a later stage.
//
// Table shape (persisted into .scpro):
//   {
//     id, x, y,
//     rows, cols,
//     colWidths: number[],   // length === cols
//     rowHeights: number[],  // length === rows
//     cells: RichDoc[][],    // cells[r][c], rows × cols, rectangular
//     borderColor, borderWidth, headerRow,
//   }
//
// Invariants kept by every mutator: colWidths.length === cols,
// rowHeights.length === rows, cells is exactly rows × cols and stays rectangular.

import { emptyDoc } from './richText'
import { snap } from './imageUtils'

export const DEFAULT_TABLE_GRID = 10
export const DEFAULT_COL_WIDTH = 80
export const DEFAULT_ROW_HEIGHT = 30
export const MIN_COL_WIDTH = 20
export const MIN_ROW_HEIGHT = 20
export const DEFAULT_BORDER_COLOR = '#334155'
export const DEFAULT_BORDER_WIDTH = 1

// Floor a dimension at `min` then snap to grid (grid<=0 ⇒ no snap). The floor is
// applied after the snap as well so snapping can never push below the minimum.
function snapDim(value, min, grid) {
  let v = Math.max(min, value)
  if (grid > 0) v = Math.max(min, snap(v, grid))
  return v
}

// Build a fresh rows × cols table of empty rich-text cells.
export function createTable({
  x = 0,
  y = 0,
  rows = 2,
  cols = 2,
  colWidth = DEFAULT_COL_WIDTH,
  rowHeight = DEFAULT_ROW_HEIGHT,
  colWidths = null,
  rowHeights = null,
  borderColor = DEFAULT_BORDER_COLOR,
  borderWidth = DEFAULT_BORDER_WIDTH,
  headerRow = false,
  headerFill = null,    // custom header-row tint; null ⇒ default accent tint
  fill = null,
  grid = DEFAULT_TABLE_GRID,
  id = null,
} = {}) {
  const r = Math.max(1, Math.round(rows))
  const c = Math.max(1, Math.round(cols))
  const widths = (colWidths && colWidths.length === c ? colWidths : Array(c).fill(colWidth))
    .map(w => snapDim(w, MIN_COL_WIDTH, grid))
  const heights = (rowHeights && rowHeights.length === r ? rowHeights : Array(r).fill(rowHeight))
    .map(h => snapDim(h, MIN_ROW_HEIGHT, grid))
  const cells = Array.from({ length: r }, () =>
    Array.from({ length: c }, () => emptyDoc())
  )
  return {
    ...(id ? { id } : {}),
    x,
    y,
    rows: r,
    cols: c,
    colWidths: widths,
    rowHeights: heights,
    cells,
    borderColor,
    borderWidth,
    headerRow,
    headerFill,
    // Optional background fill. `null` ⇒ the renderer falls back to the canvas
    // background (transparent-looking), preserving the pre-fill appearance.
    fill,
  }
}

// Store a RichDoc into cell (r, c). Out-of-range coords are a no-op. Returns a
// new table (input untouched).
export function setCell(table, r, c, doc) {
  if (r < 0 || r >= table.rows || c < 0 || c >= table.cols) return table
  const cells = table.cells.map((row, ri) =>
    ri === r ? row.map((cell, ci) => (ci === c ? doc : cell)) : row
  )
  return { ...table, cells }
}

// Append a row of empty cells (at the bottom). Keeps rowHeights + cells rectangular.
export function addRow(table, height = DEFAULT_ROW_HEIGHT, grid = DEFAULT_TABLE_GRID) {
  const newRow = Array.from({ length: table.cols }, () => emptyDoc())
  return {
    ...table,
    rows: table.rows + 1,
    rowHeights: [...table.rowHeights, snapDim(height, MIN_ROW_HEIGHT, grid)],
    cells: [...table.cells, newRow],
  }
}

// Append a column of empty cells (at the right). Keeps colWidths + cells rectangular.
export function addCol(table, width = DEFAULT_COL_WIDTH, grid = DEFAULT_TABLE_GRID) {
  return {
    ...table,
    cols: table.cols + 1,
    colWidths: [...table.colWidths, snapDim(width, MIN_COL_WIDTH, grid)],
    cells: table.cells.map(row => [...row, emptyDoc()]),
  }
}

// Insert an empty row at index `i` (0..rows). Out-of-range clamps to an append/
// prepend. Keeps rowHeights + cells rectangular.
export function insertRow(table, i, height = DEFAULT_ROW_HEIGHT, grid = DEFAULT_TABLE_GRID) {
  const at = Math.max(0, Math.min(table.rows, i))
  const newRow = Array.from({ length: table.cols }, () => emptyDoc())
  const rowHeights = [...table.rowHeights]
  rowHeights.splice(at, 0, snapDim(height, MIN_ROW_HEIGHT, grid))
  const cells = [...table.cells]
  cells.splice(at, 0, newRow)
  return { ...table, rows: table.rows + 1, rowHeights, cells }
}

// Insert an empty column at index `i` (0..cols). Keeps colWidths + cells rectangular.
export function insertCol(table, i, width = DEFAULT_COL_WIDTH, grid = DEFAULT_TABLE_GRID) {
  const at = Math.max(0, Math.min(table.cols, i))
  const colWidths = [...table.colWidths]
  colWidths.splice(at, 0, snapDim(width, MIN_COL_WIDTH, grid))
  const cells = table.cells.map(row => {
    const next = [...row]
    next.splice(at, 0, emptyDoc())
    return next
  })
  return { ...table, cols: table.cols + 1, colWidths, cells }
}

// Move row `from` to index `to` (reorder). No-op for out-of-range/same index.
export function moveRow(table, from, to) {
  if (from < 0 || from >= table.rows || to < 0 || to >= table.rows || from === to) return table
  const rowHeights = [...table.rowHeights]
  const cells = [...table.cells]
  const [h] = rowHeights.splice(from, 1)
  const [row] = cells.splice(from, 1)
  rowHeights.splice(to, 0, h)
  cells.splice(to, 0, row)
  return { ...table, rowHeights, cells }
}

// Move column `from` to index `to` (reorder). No-op for out-of-range/same index.
export function moveCol(table, from, to) {
  if (from < 0 || from >= table.cols || to < 0 || to >= table.cols || from === to) return table
  const colWidths = [...table.colWidths]
  const [w] = colWidths.splice(from, 1)
  colWidths.splice(to, 0, w)
  const cells = table.cells.map(row => {
    const next = [...row]
    const [cell] = next.splice(from, 1)
    next.splice(to, 0, cell)
    return next
  })
  return { ...table, colWidths, cells }
}

// Remove row `r`. Refuses to drop the last row (a table keeps ≥1 row).
export function removeRow(table, r) {
  if (table.rows <= 1 || r < 0 || r >= table.rows) return table
  return {
    ...table,
    rows: table.rows - 1,
    rowHeights: table.rowHeights.filter((_, i) => i !== r),
    cells: table.cells.filter((_, i) => i !== r),
  }
}

// Remove column `c`. Refuses to drop the last column (a table keeps ≥1 column).
export function removeCol(table, c) {
  if (table.cols <= 1 || c < 0 || c >= table.cols) return table
  return {
    ...table,
    cols: table.cols - 1,
    colWidths: table.colWidths.filter((_, i) => i !== c),
    cells: table.cells.map(row => row.filter((_, i) => i !== c)),
  }
}

// Resize column `c` to width `w`, snapped to grid + floored at MIN_COL_WIDTH.
export function resizeCol(table, c, w, grid = DEFAULT_TABLE_GRID) {
  if (c < 0 || c >= table.cols) return table
  return {
    ...table,
    colWidths: table.colWidths.map((cw, i) => (i === c ? snapDim(w, MIN_COL_WIDTH, grid) : cw)),
  }
}

// Resize row `r` to height `h`, snapped to grid + floored at MIN_ROW_HEIGHT.
export function resizeRow(table, r, h, grid = DEFAULT_TABLE_GRID) {
  if (r < 0 || r >= table.rows) return table
  return {
    ...table,
    rowHeights: table.rowHeights.map((rh, i) => (i === r ? snapDim(h, MIN_ROW_HEIGHT, grid) : rh)),
  }
}

// Total {width, height} = sum of col widths / row heights.
export function tableSize(table) {
  return {
    width: (table.colWidths || []).reduce((a, b) => a + b, 0),
    height: (table.rowHeights || []).reduce((a, b) => a + b, 0),
  }
}
