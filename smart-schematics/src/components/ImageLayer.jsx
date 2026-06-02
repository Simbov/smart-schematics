import React, { memo } from 'react'

// Renders inserted images inside the world <g>, BEHIND components and wires
// (images are backdrops). Each image rotates about its own center and applies
// its opacity. Locked images are inert: no pointer events, no selection ring.
//
// Pin dots / resize handles are NOT drawn here — Canvas owns the screen-space
// resize overlay (counter-scaled by 1/zoom) just like InteractiveControl.
function ImageLayer({ images, selectedIds, zoom, onImageClick, onImageMouseDown }) {
  return (
    <g>
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
            style={{ pointerEvents: img.locked ? 'none' : 'auto' }}
          >
            <image
              href={img.src}
              x={img.x}
              y={img.y}
              width={img.width}
              height={img.height}
              preserveAspectRatio="none"
              onMouseDown={img.locked ? undefined : (e) => onImageMouseDown?.(img.id, e)}
              onClick={img.locked ? undefined : (e) => onImageClick?.(img.id, e)}
              style={{ cursor: img.locked ? 'default' : 'move' }}
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
