import React, { useEffect } from 'react'

// Full-screen image viewer (v0.2.0). Renders nothing when `src` is falsy.
// Clicking anywhere or pressing Escape closes it via `onClose`. Used to enlarge
// box reference images and the selected drawing image from the Properties panel.
export default function Lightbox({ src, alt = '', onClose }) {
  useEffect(() => {
    if (!src) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [src, onClose])

  if (!src) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'zoom-out', padding: 24,
      }}
    >
      <img
        src={src}
        alt={alt}
        onClick={onClose}
        style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain', borderRadius: 4, boxShadow: '0 4px 30px rgba(0,0,0,0.5)' }}
      />
      <button
        type="button"
        onClick={onClose}
        title="Close (Esc)"
        style={{
          position: 'absolute', top: 16, right: 20, width: 36, height: 36,
          borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 22, lineHeight: 1,
        }}
      >×</button>
    </div>
  )
}
