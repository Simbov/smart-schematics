import React from 'react'

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

function TextAnnotation({ ann, sel, zoom, onClick, onMouseDown, onDoubleClick }) {
  const fs = ann.fontSize || 14
  const PAD = 3
  const estimatedW = Math.max(20, (ann.text?.length || 1) * fs * 0.58)

  return (
    <g
      onClick={e => { e.stopPropagation(); onClick?.(ann.id, e) }}
      onMouseDown={e => { e.stopPropagation(); onMouseDown?.(ann.id, e) }}
      onDoubleClick={e => { e.stopPropagation(); onDoubleClick?.(ann.id, e) }}
      style={{ cursor: 'move' }}
    >
      {/* Transparent hit area */}
      <rect
        x={ann.x - PAD}
        y={ann.y - fs - PAD}
        width={estimatedW + PAD * 2}
        height={fs + PAD * 2}
        fill="transparent"
      />
      {sel && (
        <rect
          x={ann.x - PAD}
          y={ann.y - fs - PAD}
          width={estimatedW + PAD * 2}
          height={fs + PAD * 2}
          fill="rgba(37,99,235,0.06)"
          stroke="#2563eb"
          strokeWidth={1 / zoom}
          strokeDasharray={`${3 / zoom},${2 / zoom}`}
          rx={2 / zoom}
          style={{ pointerEvents: 'none' }}
        />
      )}
      <text
        x={ann.x}
        y={ann.y}
        fontSize={fs}
        fontWeight={ann.fontWeight || 'normal'}
        fontStyle={ann.fontStyle || 'normal'}
        fill={sel ? '#2563eb' : 'currentColor'}
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {ann.text || ''}
      </text>
    </g>
  )
}

function CalloutAnnotation({ ann, sel, zoom, onClick, onMouseDown, onDoubleClick }) {
  const W = ann.width || 120
  const H = ann.height || 60
  const fs = ann.fontSize || 12
  const PAD = 6
  const lines = (ann.text || '').split('\n')

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
      <clipPath id={`ann-clip-${ann.id}`}>
        <rect x={ann.x + PAD} y={ann.y + PAD} width={W - PAD * 2} height={H - PAD * 2} />
      </clipPath>
      <text
        x={ann.x + PAD}
        y={ann.y + PAD + fs}
        fontSize={fs}
        fill={sel ? '#2563eb' : 'currentColor'}
        clipPath={`url(#ann-clip-${ann.id})`}
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={ann.x + PAD} dy={i === 0 ? 0 : fs * 1.3}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  )
}
