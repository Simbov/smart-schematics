import React, { useEffect, useRef, useState } from 'react'
import { docToHtml, htmlToDoc, emptyDoc } from '../lib/richText'

// Floating contentEditable rich-text editor. Extends InlineEditor.jsx's overlay
// positioning (absolutely positioned in the Canvas wrapper, seeded with HTML).
// A small formatting toolbar (popover above the box) drives Bold/Italic/Underline,
// font-size, color and L/C/R alignment via document.execCommand on the live
// selection. Commits htmlToDoc(html) on blur / Escape / Cmd-Enter.
//
// `doc` in → seeded as HTML; `onCommit(doc)` / `onCancel()` out. All sanitization
// happens in htmlToDoc on commit, so pasted markup is stripped to the whitelist.

const FONT_SIZES = [10, 12, 14, 18, 24, 32, 48]
const COLORS = ['#000000', '#e2e8f0', '#dc2626', '#2563eb', '#16a34a', '#d97706', '#7c3aed']

export default function RichTextEditor({
  x, y, width, height, zoom = 1, doc, fixedSize = false, onCommit, onCancel,
}) {
  const ref = useRef(null)
  const committedRef = useRef(false)
  const [color, setColor] = useState('#dc2626')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.innerHTML = docToHtml(doc || emptyDoc())
    el.focus()
    // place caret at end
    const sel = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
  }, [])

  function doCommit() {
    if (committedRef.current) return
    committedRef.current = true
    onCommit(htmlToDoc(ref.current?.innerHTML || ''))
  }
  function doCancel() {
    if (committedRef.current) return
    committedRef.current = true
    onCancel()
  }

  function handleKeyDown(e) {
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      doCancel()
      return
    }
    // Cmd/Ctrl+Enter commits; plain Enter inserts a newline (paragraph)
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      doCommit()
      return
    }
    // Native shortcuts (⌘B/⌘I/⌘U) are handled by contentEditable/execCommand.
  }

  function exec(cmd, value) {
    ref.current?.focus()
    document.execCommand(cmd, false, value)
  }

  // contentEditable uses CSS px sizes via styleWithCSS so they round-trip through
  // span style="font-size:Npx" rather than legacy <font size> buckets.
  function setFontSize(px) {
    ref.current?.focus()
    document.execCommand('styleWithCSS', false, true)
    // execCommand fontSize only accepts 1-7; apply px directly to the selection.
    document.execCommand('fontSize', false, '7')
    // Replace the just-created font-size-7 elements with the requested px.
    const fonts = ref.current?.querySelectorAll('font[size="7"], [style*="xxx-large"]') || []
    fonts.forEach(f => {
      const span = document.createElement('span')
      span.style.fontSize = `${px}px`
      span.innerHTML = f.innerHTML
      f.replaceWith(span)
    })
  }

  function setColorCmd(c) {
    setColor(c)
    ref.current?.focus()
    document.execCommand('styleWithCSS', false, true)
    document.execCommand('foreColor', false, c)
  }

  function setAlign(a) {
    ref.current?.focus()
    const map = { left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight' }
    document.execCommand(map[a])
  }

  const btn = {
    border: 'none', background: 'transparent', cursor: 'pointer',
    padding: '2px 6px', borderRadius: 3, fontSize: 13, lineHeight: 1,
    color: 'var(--component-color, #111)',
  }

  return (
    <div
      style={{ position: 'absolute', left: x, top: y, zIndex: 100, pointerEvents: 'all' }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
    >
      {/* Formatting toolbar popover */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 2,
          marginBottom: 4, padding: '3px 4px',
          background: 'var(--panel-bg, #fff)',
          border: '1px solid var(--panel-border, #ddd)',
          borderRadius: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          whiteSpace: 'nowrap',
        }}
        onMouseDown={e => e.preventDefault() /* keep selection in the editor */}
      >
        <button type="button" title="Bold (⌘B)" style={{ ...btn, fontWeight: 700 }} onClick={() => exec('bold')}>B</button>
        <button type="button" title="Italic (⌘I)" style={{ ...btn, fontStyle: 'italic' }} onClick={() => exec('italic')}>I</button>
        <button type="button" title="Underline (⌘U)" style={{ ...btn, textDecoration: 'underline' }} onClick={() => exec('underline')}>U</button>
        <span style={{ width: 1, height: 16, background: 'var(--panel-border,#ddd)', margin: '0 2px' }} />
        <select
          title="Font size"
          defaultValue=""
          style={{ ...btn, padding: '1px 2px' }}
          onChange={e => { if (e.target.value) setFontSize(Number(e.target.value)); e.target.value = '' }}
        >
          <option value="">Size</option>
          {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          type="color"
          title="Text color"
          value={color}
          style={{ width: 22, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
          onChange={e => setColorCmd(e.target.value)}
        />
        <span style={{ width: 1, height: 16, background: 'var(--panel-border,#ddd)', margin: '0 2px' }} />
        <button type="button" title="Align left" style={btn} onClick={() => setAlign('left')}>⬅</button>
        <button type="button" title="Align center" style={btn} onClick={() => setAlign('center')}>↔</button>
        <button type="button" title="Align right" style={btn} onClick={() => setAlign('right')}>➡</button>
      </div>

      {/* The editable box */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onBlur={doCommit}
        style={{
          fontFamily: 'sans-serif',
          fontSize: 14 * zoom,
          lineHeight: 1.3,
          color: 'var(--component-color, #111)',
          background: 'var(--canvas-bg, #fff)',
          border: '2px solid #2563eb',
          borderRadius: 3,
          outline: 'none',
          padding: '2px 4px',
          minWidth: Math.max(80, (width || 0) * zoom),
          maxWidth: 600,
          ...(fixedSize && width
            ? { width: width * zoom, height: height * zoom, overflow: 'auto' }
            : { minHeight: 20 }),
        }}
      />
    </div>
  )
}
