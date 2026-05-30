import React, { useEffect, useRef } from 'react'

export default function InlineEditor({ x, y, value, fontSize = 14, multiline = false, onCommit, onCancel }) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.focus()
      ref.current.select()
    }
  }, [])

  function handleKeyDown(e) {
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
      return
    }
    if (e.key === 'Enter' && (!multiline || !e.shiftKey)) {
      e.preventDefault()
      onCommit(ref.current.value)
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      onCommit(ref.current.value)
    }
  }

  const Tag = multiline ? 'textarea' : 'input'

  return (
    <div
      style={{ position: 'absolute', left: x, top: y, zIndex: 100, pointerEvents: 'all' }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <Tag
        ref={ref}
        defaultValue={value}
        onKeyDown={handleKeyDown}
        onBlur={e => onCommit(e.target.value)}
        style={{
          fontSize,
          fontFamily: 'monospace',
          color: 'var(--component-color)',
          background: 'var(--canvas-bg, white)',
          border: '2px solid #2563eb',
          borderRadius: 3,
          outline: 'none',
          padding: '1px 4px',
          minWidth: 80,
          display: 'block',
          ...(multiline ? { resize: 'both', minHeight: 60, width: 160 } : {}),
        }}
        rows={multiline ? 4 : undefined}
      />
    </div>
  )
}
