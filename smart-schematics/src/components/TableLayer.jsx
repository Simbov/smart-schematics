import React, { memo } from 'react'
import { docToHtml, isEmptyDoc } from '../lib/richText'
import { tableSize } from '../lib/tableModel'

// Renders drawing.tables[] inside the world <g> (Stage 9). Each table is a grid
// of rich-text cells (foreignObject + docToHtml, matching the AnnotationLayer /
// BoxSymbol contract) with ruled borders, an optional tinted header row, a
// selection highlight, and a transparent hit area for select/drag. Double-
// clicking a cell opens the shared RichTextEditor (handled by Canvas).
//
// Cell content is pointer-transparent; the wrapping <g> owns mouse handlers so a
// click anywhere on the table selects/drags it. Double-click resolves the cell
// under the cursor from the column/row offsets.

function TableComp({ table, sel, zoom, editingCell, onClick, onMouseDown, onCellDoubleClick }) {
  const { width, height } = tableSize(table)
  const { x, y, rows, cols, colWidths, rowHeights } = table

  // Prefix sums for column x-offsets and row y-offsets (relative to table x/y).
  const colX = [0]
  for (let c = 0; c < cols; c++) colX.push(colX[c] + colWidths[c])
  const rowY = [0]
  for (let r = 0; r < rows; r++) rowY.push(rowY[r] + rowHeights[r])

  const handleDoubleClick = (e) => {
    e.stopPropagation()
    // Resolve the cell under the cursor from the local offset. The event's
    // world point isn't available here, so derive from the rendered geometry via
    // the bounding client rect of the table group.
    const rect = e.currentTarget.getBoundingClientRect()
    const lx = ((e.clientX - rect.left) / rect.width) * width
    const ly = ((e.clientY - rect.top) / rect.height) * height
    let col = 0; while (col < cols - 1 && lx >= colX[col + 1]) col++
    let row = 0; while (row < rows - 1 && ly >= rowY[row + 1]) row++
    onCellDoubleClick?.(table.id, row, col, {
      x: x + colX[col], y: y + rowY[row],
      width: colWidths[col], height: rowHeights[row],
      doc: table.cells?.[row]?.[col],
    })
  }

  return (
    <g
      onClick={e => { e.stopPropagation(); onClick?.(table.id, e) }}
      onMouseDown={e => { e.stopPropagation(); onMouseDown?.(table.id, e) }}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: 'move' }}
    >
      {/* Background + header tint */}
      <rect x={x} y={y} width={width} height={height} fill={table.fill || 'var(--canvas-bg)'} />
      {table.headerRow && rows > 0 && (
        <rect x={x} y={y} width={width} height={rowHeights[0]} fill={table.headerFill || 'rgba(37,99,235,0.08)'} />
      )}

      {/* Cell content */}
      {table.cells?.map((rowCells, r) =>
        rowCells.map((doc, c) => {
          if (!doc || isEmptyDoc(doc)) return null
          const cw = colWidths[c], ch = rowHeights[r]
          // Hide the cell being edited so the inline editor doesn't double up.
          const cellEditing = editingCell && editingCell.row === r && editingCell.col === c
          return (
            <foreignObject
              key={`cell-${r}-${c}`}
              x={x + colX[c] + 2}
              y={y + rowY[r] + 2}
              width={Math.max(1, cw - 4)}
              height={Math.max(1, ch - 4)}
              style={{ overflow: 'hidden', pointerEvents: 'none', visibility: cellEditing ? 'hidden' : 'visible' }}
            >
              <div
                xmlns="http://www.w3.org/1999/xhtml"
                style={{
                  fontFamily: 'sans-serif', fontSize: 11, lineHeight: 1.25,
                  color: '#0f172a', width: '100%', height: '100%', overflow: 'hidden',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', userSelect: 'none',
                  fontWeight: (table.headerRow && r === 0) ? 600 : 400,
                }}
                dangerouslySetInnerHTML={{ __html: docToHtml(doc) }}
              />
            </foreignObject>
          )
        })
      )}

      {/* Grid lines */}
      {colX.map((cx, i) => (
        <line key={`v-${i}`} x1={x + cx} y1={y} x2={x + cx} y2={y + height}
          stroke={table.borderColor || '#334155'} strokeWidth={(table.borderWidth || 1) / zoom} />
      ))}
      {rowY.map((ry, i) => (
        <line key={`h-${i}`} x1={x} y1={y + ry} x2={x + width} y2={y + ry}
          stroke={table.borderColor || '#334155'} strokeWidth={(table.borderWidth || 1) / zoom} />
      ))}

      {sel && (
        <rect x={x} y={y} width={width} height={height}
          fill="rgba(37,99,235,0.06)" stroke="#2563eb"
          strokeWidth={1.5 / zoom} strokeDasharray={`${3 / zoom},${2 / zoom}`}
          style={{ pointerEvents: 'none' }} />
      )}
    </g>
  )
}

function TableLayer({ tables = [], selectedIds = [], zoom = 1, editingCell = null, onTableClick, onTableMouseDown, onCellDoubleClick }) {
  return (
    <g>
      {tables.map(t => (
        <TableComp
          key={t.id}
          table={t}
          sel={selectedIds.includes(t.id)}
          zoom={zoom}
          editingCell={editingCell && editingCell.tableId === t.id ? editingCell : null}
          onClick={onTableClick}
          onMouseDown={onTableMouseDown}
          onCellDoubleClick={onCellDoubleClick}
        />
      ))}
    </g>
  )
}

export default memo(TableLayer)
