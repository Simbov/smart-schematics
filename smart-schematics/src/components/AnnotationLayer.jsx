import React from 'react'
import { docToHtml, docToPlain, plainToDoc, richExportFallback } from '../lib/richText'

// Renders text and callout annotations as rich text. Per the shared rich-text
// spec, content renders via a single <foreignObject> wrapping a styled XHTML
// <div> built from docToHtml(doc) — the only way to get true per-run styling +
// alignment + wrapping inside SVG.
//
// Export note: some SVG/PNG rasterizers don't render <foreignObject>, so behind
// each rich element we also draw an off-screen plain <text> fallback layer
// (richExportFallback). Modern browsers' canvas drawImage of the SVG handles the
// foreignObject; the <text> layer is a safety net captured if the foreignObject
// is dropped. See FileMenu.jsx export code.

export default function AnnotationLayer({
  annotations = [],
  selectedIds = [],
  zoom = 1,
  onAnnotationClick,
  onAnnotationMouseDown,
  onAnnotationDoubleClick,
}) {
  return (
    <g style={{ color: 'var(--component-color)' }}>
      {annotations.map(ann => {
        const sel = selectedIds.includes(ann.id)
        if (ann.type === 'text') return (
          <TextAnnotation key={ann.id} ann={ann} sel={sel} zoom={zoom}
            onClick={onAnnotationClick}
            onMouseDown={onAnnotationMouseDown}
            onDoubleClick={onAnnotationDoubleClick}
          />
        )
        if (ann.type === 'callout') return (
          <CalloutAnnotation key={ann.id} ann={ann} sel={sel} zoom={zoom}
            onClick={onAnnotationClick}
            onMouseDown={onAnnotationMouseDown}
            onDoubleClick={onAnnotationDoubleClick}
          />
        )
        return null
      })}
    </g>
  )
}

// Resolve a doc from an annotation, tolerating legacy text-only annotations.
function annDoc(ann) {
  return ann.doc || plainToDoc(ann.text || '')
}

// Off-screen plain-text fallback drawn behind the foreignObject for export safety.
function FallbackText({ doc, x, y, fontSize, anchor = 'start' }) {
  const { lines } = richExportFallback(doc)
  return (
    <text
      x={x}
      y={y}
      fontSize={fontSize}
      fill="currentColor"
      textAnchor={anchor}
      aria-hidden="true"
      style={{ userSelect: 'none', pointerEvents: 'none', opacity: 0 }}
    >
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : fontSize * 1.3}>{line}</tspan>
      ))}
    </text>
  )
}

function TextAnnotation({ ann, sel, zoom, onClick, onMouseDown, onDoubleClick }) {
  const fs = ann.fontSize || 14
  const doc = annDoc(ann)
  const plain = docToPlain(doc)
  // Estimate a content box: width from longest line, height from line count.
  const lineCount = Math.max(1, doc.paragraphs?.length || 1)
  const longest = plain.split('\n').reduce((m, l) => Math.max(m, l.length), 1)
  const W = Math.max(20, longest * fs * 0.6)
  const H = lineCount * fs * 1.4 + 4
  const PAD = 3

  return (
    <g
      onClick={e => { e.stopPropagation(); onClick?.(ann.id, e) }}
      onMouseDown={e => { e.stopPropagation(); onMouseDown?.(ann.id, e) }}
      onDoubleClick={e => { e.stopPropagation(); onDoubleClick?.(ann.id, e) }}
      style={{ cursor: 'move' }}
    >
      {/* Transparent hit area */}
      <rect x={ann.x - PAD} y={ann.y - fs - PAD} width={W + PAD * 2} height={H + PAD * 2} fill="transparent" />
      <FallbackText doc={doc} x={ann.x} y={ann.y} fontSize={fs} />
      <foreignObject
        x={ann.x - PAD}
        y={ann.y - fs - PAD}
        width={W + PAD * 2}
        height={H + PAD * 2}
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          style={{
            fontFamily: 'sans-serif',
            fontSize: fs,
            lineHeight: 1.4,
            color: sel ? '#2563eb' : 'currentColor',
            whiteSpace: 'pre-wrap',
            userSelect: 'none',
          }}
          dangerouslySetInnerHTML={{ __html: docToHtml(doc) }}
        />
      </foreignObject>
      {sel && (
        <rect
          x={ann.x - PAD}
          y={ann.y - fs - PAD}
          width={W + PAD * 2}
          height={H + PAD * 2}
          fill="rgba(37,99,235,0.06)"
          stroke="#2563eb"
          strokeWidth={1 / zoom}
          strokeDasharray={`${3 / zoom},${2 / zoom}`}
          rx={2 / zoom}
          style={{ pointerEvents: 'none' }}
        />
      )}
    </g>
  )
}

function CalloutAnnotation({ ann, sel, zoom, onClick, onMouseDown, onDoubleClick }) {
  const W = ann.width || 120
  const H = ann.height || 60
  const fs = ann.fontSize || 12
  const PAD = 6
  const doc = annDoc(ann)

  return (
    <g
      onClick={e => { e.stopPropagation(); onClick?.(ann.id, e) }}
      onMouseDown={e => { e.stopPropagation(); onMouseDown?.(ann.id, e) }}
      onDoubleClick={e => { e.stopPropagation(); onDoubleClick?.(ann.id, e) }}
      style={{ cursor: 'move' }}
    >
      <rect
        x={ann.x}
        y={ann.y}
        width={W}
        height={H}
        fill="var(--canvas-bg)"
        stroke={sel ? '#2563eb' : 'currentColor'}
        strokeWidth={(sel ? 1.5 : 1) / zoom}
        rx={3 / zoom}
      />
      <FallbackText doc={doc} x={ann.x + PAD} y={ann.y + PAD + fs} fontSize={fs} />
      {/* Rich content, clipped to the fixed box and scrolled if it overflows. */}
      <foreignObject
        x={ann.x + PAD}
        y={ann.y + PAD}
        width={W - PAD * 2}
        height={H - PAD * 2}
        style={{ overflow: 'hidden', pointerEvents: 'none' }}
      >
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          style={{
            fontFamily: 'sans-serif',
            fontSize: fs,
            lineHeight: 1.3,
            color: sel ? '#2563eb' : 'currentColor',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            userSelect: 'none',
          }}
          dangerouslySetInnerHTML={{ __html: docToHtml(doc) }}
        />
      </foreignObject>
    </g>
  )
}
