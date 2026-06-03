import React, { memo } from 'react'

// Renders inserted images inside the world <g>, BEHIND components and wires
// (images are backdrops). Each image rotates about its own center and applies
// its opacity.
//
// Presentation only: this layer has NO pointer handlers. Image picking/selection
// is owned entirely by Canvas, which hit-tests with `topImageAt` (imageUtils) on
// the SVG-level mouse handlers — a single z-order-correct code path. Routing
// clicks through per-<image> handlers used to double-fire with the canvas
// background click (select then immediately clear), which was the flaky-selection
// bug. So every <image> is pointer-transparent here.
//
// Pin dots / resize handles are NOT drawn here — Canvas owns the screen-space
// resize overlay (counter-scaled by 1/zoom) just like InteractiveControl.
function ImageLayer({ images, selectedIds, zoom }) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      {images.map(img => {
        const selected = selectedIds.includes(img.id)
        const cx = img.x + img.width / 2
        const cy = img.y + img.height / 2
        const rot = img.rotation || 0
        return (
          <g
            key={img.id}
            transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined}
            opacity={img.opacity ?? 1}
          >
            <image
              href={img.src}
              x={img.x}
              y={img.y}
              width={img.width}
              height={img.height}
              preserveAspectRatio="none"
            />
            {selected && (
              <rect
                x={img.x}
                y={img.y}
                width={img.width}
                height={img.height}
                fill="none"
                stroke="var(--selection-color)"
                strokeWidth={1.5 / zoom}
                strokeDasharray={`${4 / zoom},${2 / zoom}`}
                style={{ pointerEvents: 'none' }}
              />
            )}
          </g>
        )
      })}
    </g>
  )
}

export default memo(ImageLayer)
