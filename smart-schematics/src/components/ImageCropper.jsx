import React, { useRef, useState, useCallback } from 'react'
import { normalizeCrop } from '../lib/imageUtils'

// Interactive crop tool used in the Properties panel. Shows the full image with a
// draggable/resizable crop rectangle overlaid; reports the crop as a normalized
// {x,y,w,h} (0..1 of the source). Drag inside to move, drag a corner to resize.
// Pure-DOM (no SVG) — the canvas reflects the committed crop via ImageLayer.
export default function ImageCropper({ src, crop, onChange, onCommit }) {
  const boxRef = useRef(null)
  const dragRef = useRef(null)
  const [live, setLive] = useState(null)
  const c = live || normalizeCrop(crop)

  const begin = useCallback((mode) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = boxRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, rect, base: normalizeCrop(crop) }
    const onMove = (ev) => {
      const d = dragRef.current
      if (!d) return
      const dx = (ev.clientX - d.startX) / d.rect.width
      const dy = (ev.clientY - d.startY) / d.rect.height
      let { x, y, w, h } = d.base
      if (d.mode === 'move') {
        x = Math.min(Math.max(0, x + dx), 1 - w)
        y = Math.min(Math.max(0, y + dy), 1 - h)
      } else {
        // Corner resize — adjust the dragged edges, keeping the opposite anchored.
        if (d.mode.includes('w')) { const nx = Math.min(Math.max(0, x + dx), x + w - 0.02); w += x - nx; x = nx }
        if (d.mode.includes('n')) { const ny = Math.min(Math.max(0, y + dy), y + h - 0.02); h += y - ny; y = ny }
        if (d.mode.includes('e')) { w = Math.min(Math.max(0.02, w + dx), 1 - x) }
        if (d.mode.includes('s')) { h = Math.min(Math.max(0.02, h + dy), 1 - y) }
      }
      const next = normalizeCrop({ x, y, w, h })
      setLive(next)
      onChange?.(next)
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setLive(null)
      onCommit?.()
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [crop, onChange, onCommit])

  const pct = (v) => `${v * 100}%`
  const handle = (mode, style, cursor) => (
    <div onMouseDown={begin(mode)} style={{
      position: 'absolute', width: 12, height: 12, background: 'var(--selection-color, #2563eb)',
      border: '2px solid #fff', borderRadius: 2, cursor, ...style,
    }} />
  )

  return (
    <div ref={boxRef} style={{ position: 'relative', userSelect: 'none', maxWidth: '100%', margin: '0 auto', width: 'fit-content' }}>
      <img src={src} alt="crop source" draggable={false}
        style={{ display: 'block', maxWidth: '100%', maxHeight: 220, borderRadius: 3, background: 'rgba(0,0,0,0.04)' }} />
      {/* Dim outside the crop region with a big translucent ring via box-shadow. */}
      <div onMouseDown={begin('move')} style={{
        position: 'absolute', left: pct(c.x), top: pct(c.y), width: pct(c.w), height: pct(c.h),
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)', outline: '1px solid var(--selection-color, #2563eb)',
        cursor: 'move',
      }}>
        {handle('nw', { left: -6, top: -6 }, 'nwse-resize')}
        {handle('ne', { right: -6, top: -6 }, 'nesw-resize')}
        {handle('sw', { left: -6, bottom: -6 }, 'nesw-resize')}
        {handle('se', { right: -6, bottom: -6 }, 'nwse-resize')}
      </div>
    </div>
  )
}
