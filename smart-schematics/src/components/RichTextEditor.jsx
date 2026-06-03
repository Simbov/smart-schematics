import React, { useEffect, useRef, useState, useCallback } from 'react'
import { docToHtml, htmlToDoc, emptyDoc } from '../lib/richText'
import { activeMarks } from '../lib/richTextEditing'

// Floating contentEditable rich-text editor. Extends InlineEditor.jsx's overlay
// positioning (absolutely positioned in the Canvas wrapper, seeded with HTML).
// A small formatting toolbar (popover above the box) drives Bold/Italic/Underline,
// font-size, color and L/C/R alignment via document.execCommand on the live
// selection. Commits htmlToDoc(html) on blur / Escape / Cmd-Enter.
//
// `doc` in → seeded as HTML; `onCommit(doc)` / `onCancel()` out. All sanitization
// happens in htmlToDoc on commit, so pasted markup is stripped to the whitelist.
//
// Toolbar highlighting (Stage 3): the active B/I/U + alignment state is seeded
// from the incoming doc via activeMarks() and refreshed live from
// document.queryCommandState on selectionchange / keyup / mouseup while focused.

const FONT_SIZES = [10, 12, 14, 18, 24, 32, 48]
const COLORS = ['#000000', '#e2e8f0', '#dc2626', '#2563eb', '#16a34a', '#d97706', '#7c3aed']

export default function RichTextEditor({
  x, y, width, height, zoom = 1, doc, fixedSize = false, onCommit, onCancel,
}) {
  const ref = useRef(null)
  const committedRef = useRef(false)
  const [color, setColor] = useState('#dc2626')

  // Active toolbar state — seeded from the doc, refreshed from queryCommandState.
  const seeded = activeMarks(doc || emptyDoc())
  const [active, setActive] = useState({
    bold: seeded.bold,
    italic: seeded.italic,
    underline: seeded.underline,
    align: seeded.align,
    fontSize: seeded.fontSize,
  })

  // Read live formatting from the current selection. document.queryCommandState
  // is the most reliable cross-browser way to reflect B/I/U at the caret; the
  // alignment + font-size are derived from the nearest element via computed style.
  const refreshActive = useCallback(() => {
    const el = ref.current
    if (!el) return
    // Bail if the selection isn't inside the editor (e.g. focus moved away).
    const sel = window.getSelection && window.getSelection()
    if (sel && sel.rangeCount && !el.contains(sel.anchorNode)) return
    let bold = false, italic = false, underline = false
    try {
      bold = document.queryCommandState('bold')
      italic = document.queryCommandState('italic')
      underline = document.queryCommandState('underline')
    } catch { /* queryCommandState unsupported */ }

    let align = 'left'
    let fontSize = null
    const node = sel && sel.anchorNode
    const startEl = node && node.nodeType === 3 ? node.parentElement : (node || el)
    if (startEl && startEl.nodeType === 1) {
      try {
        const cs = window.getComputedStyle(startEl)
        const ta = cs.textAlign
        if (ta === 'center' || ta === 'right' || ta === 'left') align = ta
        const px = parseFloat(cs.fontSize)
        if (!Number.isNaN(px)) fontSize = Math.round(px)
      } catch { /* getComputedStyle unavailable */ }
    }
    setActive({ bold, italic, underline, align, fontSize })
  }, [])

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

    const onSelectionChange = () => refreshActive()
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [refreshActive])

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
    refreshActive()
  }

  // Robustly apply a px font size to the current selection by wrapping the
  // Range's contents in a <span style="font-size:Npx">. This avoids the legacy
  // execCommand('fontSize','7') path, which the browser may render as a <span>
  // (not a <font>) — making the old querySelectorAll('font[size="7"]') miss and
  // silently drop the size. Round-trips through htmlToDoc (keeps span font-size).
  function setFontSize(px) {
    const el = ref.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    // Only operate when the selection lives inside the editor.
    if (!el.contains(range.commonAncestorContainer)) return

    const span = document.createElement('span')
    span.style.fontSize = `${px}px`

    if (range.collapsed) {
      // No text selected: insert a zero-width-styled span and drop the caret
      // inside it so subsequently typed text inherits the size.
      span.appendChild(document.createTextNode('​')) // zero-width space
      range.insertNode(span)
      const newRange = document.createRange()
      newRange.setStart(span.firstChild, 1)
      newRange.collapse(true)
      sel.removeAllRanges()
      sel.addRange(newRange)
    } else {
      // Wrap the selected contents. extractContents pulls the Range out of the
      // DOM (splitting partially-selected nodes), then we re-insert it inside
      // the styled span and reselect it so chained edits keep working.
      const contents = range.extractContents()
      span.appendChild(contents)
      range.insertNode(span)
      const newRange = document.createRange()
      newRange.selectNodeContents(span)
      sel.removeAllRanges()
      sel.addRange(newRange)
    }
    refreshActive()
  }

  function setColorCmd(c) {
    setColor(c)
    ref.current?.focus()
    document.execCommand('styleWithCSS', false, true)
    document.execCommand('foreColor', false, c)
    refreshActive()
  }

  function setAlign(a) {
    ref.current?.focus()
    const map = { left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight' }
    document.execCommand(map[a])
    refreshActive()
  }

  const btn = {
    border: 'none', background: 'transparent', cursor: 'pointer',
    padding: '2px 6px', borderRadius: 3, fontSize: 13, lineHeight: 1,
    color: 'var(--component-color, #111)',
  }
  // Active styling mirrors PropertiesPanel.jsx's qsBtn(active).
  const btnActive = {
    ...btn,
    background: 'rgba(37,99,235,0.15)',
    boxShadow: 'inset 0 0 0 1px #2563eb',
  }
  const tb = (on, extra) => ({ ...(on ? btnActive : btn), ...extra })

  // Value shown in the size dropdown: the live uniform size if it's one of the
  // offered options, otherwise the placeholder.
  const sizeSelectValue =
    active.fontSize != null && FONT_SIZES.includes(active.fontSize)
      ? String(active.fontSize)
      : ''

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
        <button type="button" title="Bold (⌘B)" style={tb(active.bold, { fontWeight: 700 })} onClick={() => exec('bold')}>B</button>
        <button type="button" title="Italic (⌘I)" style={tb(active.italic, { fontStyle: 'italic' })} onClick={() => exec('italic')}>I</button>
        <button type="button" title="Underline (⌘U)" style={tb(active.underline, { textDecoration: 'underline' })} onClick={() => exec('underline')}>U</button>
        <span style={{ width: 1, height: 16, background: 'var(--panel-border,#ddd)', margin: '0 2px' }} />
        <select
          title="Font size"
          value={sizeSelectValue}
          style={{ ...btn, padding: '1px 2px' }}
          onChange={e => { if (e.target.value) setFontSize(Number(e.target.value)) }}
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
        <button type="button" title="Align left" style={tb(active.align === 'left')} onClick={() => setAlign('left')}>⬅</button>
        <button type="button" title="Align center" style={tb(active.align === 'center')} onClick={() => setAlign('center')}>↔</button>
        <button type="button" title="Align right" style={tb(active.align === 'right')} onClick={() => setAlign('right')}>➡</button>
      </div>

      {/* The editable box */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onKeyUp={refreshActive}
        onMouseUp={refreshActive}
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
