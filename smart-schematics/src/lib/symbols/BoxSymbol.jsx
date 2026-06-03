import React from 'react'
import { docToHtml, isEmptyDoc } from '../richText'

// Component-box symbol (Stage 5): a rounded rectangle with a clipped rich-text
// label rendered via the shared foreignObject/docToHtml contract (the only way
// to get true per-run styling + alignment + wrapping inside SVG).
//
// The box origin is its CENTER (like every component), so the rect spans
// [-w/2, -h/2] .. [w/2, h/2]. Pin DOTS are NOT drawn here — Canvas is the single
// source of truth for pin dots (consistent with the rest of the app).
//
// A unique clip-path id keeps the label inside the rounded rect even when the
// text overflows.
let _clipSeq = 0

export default function BoxSymbol({ box = {}, instanceId }) {
  const w = box.width || 80
  const h = box.height || 60
  const r = box.cornerRadius ?? 4
  const fill = box.fill || '#f1f5f9'
  const stroke = box.stroke || '#334155'
  const doc = box.doc
  const image = box.image || null
  const clipId = `boxclip_${instanceId || (_clipSeq++)}`
  const PAD = 4

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={-w / 2 + PAD} y={-h / 2 + PAD} width={w - PAD * 2} height={h - PAD * 2} rx={Math.max(0, r - PAD)} />
        </clipPath>
      </defs>
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={r}
        ry={r}
        fill={fill}
        stroke={stroke}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      {image && (
        <image
          href={image}
          x={-w / 2 + PAD}
          y={-h / 2 + PAD}
          width={w - PAD * 2}
          height={h - PAD * 2}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid meet"
          style={{ pointerEvents: 'none' }}
        />
      )}
      {doc && !isEmptyDoc(doc) && (
        <foreignObject
          x={-w / 2 + PAD}
          y={-h / 2 + PAD}
          width={w - PAD * 2}
          height={h - PAD * 2}
          clipPath={`url(#${clipId})`}
          style={{ overflow: 'hidden', pointerEvents: 'none' }}
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              fontFamily: 'sans-serif',
              fontSize: 11,
              lineHeight: 1.3,
              color: '#0f172a',
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              userSelect: 'none',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
            dangerouslySetInnerHTML={{ __html: docToHtml(doc) }}
          />
        </foreignObject>
      )}
    </g>
  )
}
