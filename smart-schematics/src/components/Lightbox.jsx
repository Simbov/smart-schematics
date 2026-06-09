import React, { useEffect, useRef, useState, useCallback } from 'react'

// Full-screen image viewer (v0.2.0; zoom/pan added in the Smart Schematics
// update). Renders nothing when `src` is falsy. Escape or the × closes it.
// Scroll-wheel (or +/−) zooms; drag pans while zoomed; double-click toggles
// fit ↔ 2×. Clicking the dim backdrop closes, but clicking the image does not
// (so you can pan without dismissing).
const MIN_ZOOM = 1
const MAX_ZOOM = 8

export default function Lightbox({ src, alt = '', onClose }) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef(null)

  // Reset view whenever a new image opens.
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }) }, [src])

  useEffect(() => {
    if (!src) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
      else if (e.key === '+' || e.key === '=') setZoom(z => Math.min(MAX_ZOOM, z * 1.25))
      else if (e.key === '-') setZoom(z => Math.max(MIN_ZOOM, z / 1.25))
      else if (e.key === '0') { setZoom(1); setPan({ x: 0, y: 0 }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [src, onClose])

  const onWheel = useCallback((e) => {
    e.preventDefault()
    setZoom(z => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
      if (next === 1) setPan({ x: 0, y: 0 })
      return next
    })
  }, [])

  const onImgMouseDown = useCallback((e) => {
    e.stopPropagation()
    if (zoom <= 1) return
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
    const onMove = (ev) => {
      const d = dragRef.current
      if (!d) return
      setPan({ x: d.panX + (ev.clientX - d.startX), y: d.panY + (ev.clientY - d.startY) })
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [zoom, pan])

  if (!src) return null

  const btnStyle = {
    width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
    background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 20, lineHeight: 1,
  }

  return (
    <div
      onClick={onClose}
      onWheel={onWheel}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'zoom-out', padding: 24, overflow: 'hidden',
      }}
    >
      <img
        src={src}
        alt={alt}
        onClick={e => e.stopPropagation()}
        onMouseDown={onImgMouseDown}
        onDoubleClick={e => { e.stopPropagation(); if (zoom > 1) { setZoom(1); setPan({ x: 0, y: 0 }) } else setZoom(2) }}
        draggable={false}
        style={{
          maxWidth: '95%', maxHeight: '95%', objectFit: 'contain', borderRadius: 4,
          boxShadow: '0 4px 30px rgba(0,0,0,0.5)',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          cursor: zoom > 1 ? 'grab' : 'zoom-in',
          transition: dragRef.current ? 'none' : 'transform 0.08s',
        }}
      />

      {/* Zoom controls */}
      <div onClick={e => e.stopPropagation()}
        style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" title="Zoom out (−)" style={btnStyle} onClick={() => setZoom(z => Math.max(MIN_ZOOM, z / 1.25))}>−</button>
        <span style={{ color: '#fff', fontSize: 12, minWidth: 44, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button type="button" title="Zoom in (+)" style={btnStyle} onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.25))}>+</button>
        <button type="button" title="Reset (0)" style={{ ...btnStyle, width: 'auto', padding: '0 12px', borderRadius: 18, fontSize: 13 }}
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>Fit</button>
      </div>

      <button type="button" onClick={onClose} title="Close (Esc)"
        style={{ ...btnStyle, position: 'absolute', top: 16, right: 20, fontSize: 22 }}>×</button>
    </div>
  )
}
