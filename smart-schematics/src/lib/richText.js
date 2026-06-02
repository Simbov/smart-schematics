// richText.js — the shared rich-text model used by Stage 4 (text boxes) and
// Stage 5 (component box labels). Pure, dependency-free, fully unit-tested.
//
// Document model (the canonical serialized form stored on annotations/components
// and saved into .scpro):
//
//   RichDoc = {
//     align: 'left' | 'center' | 'right',          // block-level, default 'left'
//     paragraphs: [
//       { runs: [ { text: string,
//                   bold?: boolean,
//                   italic?: boolean,
//                   underline?: boolean,
//                   color?: string,                 // hex; omitted = inherit currentColor
//                   fontSize?: number } ] }         // px; omitted = element default
//     ]
//   }
//
// Rendering contract: rich text renders on the SVG canvas via a single
// <foreignObject> wrapping a styled HTML <div> built from docToHtml(doc). The
// editor is a contentEditable seeded with docToHtml and committed via htmlToDoc.
//
// IMPORTANT: htmlToDoc is a *pure string parser* (no DOMParser / browser APIs) so
// it runs under Vitest's node environment and serves as the sanitizer for pasted
// markup — only the whitelisted tags/attributes survive.

const ALIGNS = new Set(['left', 'center', 'right'])

/** A one-empty-paragraph doc. */
export function emptyDoc() {
  return { align: 'left', paragraphs: [{ runs: [] }] }
}

/** Split a plain string on `\n` into paragraphs of one unstyled run. */
export function plainToDoc(str) {
  const s = str == null ? '' : String(str)
  const lines = s.split('\n')
  return {
    align: 'left',
    paragraphs: lines.map(line => ({ runs: line === '' ? [] : [{ text: line }] })),
  }
}

/** Flatten a doc to a `\n`-joined plain string. */
export function docToPlain(doc) {
  if (!doc || !Array.isArray(doc.paragraphs)) return ''
  return doc.paragraphs
    .map(p => (p.runs || []).map(r => r.text || '').join(''))
    .join('\n')
}

/** True when no run has non-whitespace text. */
export function isEmptyDoc(doc) {
  if (!doc || !Array.isArray(doc.paragraphs)) return true
  for (const p of doc.paragraphs) {
    for (const r of (p.runs || [])) {
      if (r.text && r.text.trim() !== '') return false
    }
  }
  return true
}

// ---- HTML escaping ---------------------------------------------------------

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function unescapeHtml(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

// ---- doc → html ------------------------------------------------------------

function runToHtml(run) {
  const styles = []
  if (run.color) styles.push(`color:${run.color}`)
  if (run.fontSize) styles.push(`font-size:${run.fontSize}px`)
  let html = escapeHtml(run.text || '')
  if (styles.length) html = `<span style="${styles.join(';')}">${html}</span>`
  if (run.underline) html = `<u>${html}</u>`
  if (run.italic) html = `<i>${html}</i>`
  if (run.bold) html = `<b>${html}</b>`
  return html
}

/**
 * Sanitized HTML for the contentEditable editor / foreignObject renderer.
 * Only emits <div> (paragraph, with text-align), <span style>, <b>, <i>, <u>.
 */
export function docToHtml(doc) {
  if (!doc || !Array.isArray(doc.paragraphs)) doc = emptyDoc()
  const align = ALIGNS.has(doc.align) ? doc.align : 'left'
  const alignStyle = align !== 'left' ? ` style="text-align:${align}"` : ''
  return doc.paragraphs
    .map(p => {
      const runs = (p.runs || [])
      const inner = runs.length ? runs.map(runToHtml).join('') : '<br>'
      return `<div${alignStyle}>${inner}</div>`
    })
    .join('')
}

// ---- html → doc (pure parser + sanitizer) ----------------------------------

// Whitelisted inline tags and how they map onto run attributes.
const INLINE_TAGS = {
  b: 'bold',
  strong: 'bold',
  i: 'italic',
  em: 'italic',
  u: 'underline',
}

// Parse the `style="..."` attribute of a <span>, keeping only color/font-size.
function parseSpanStyle(attrs) {
  const out = {}
  const m = /style\s*=\s*"([^"]*)"|style\s*=\s*'([^']*)'/i.exec(attrs)
  const style = m ? (m[1] ?? m[2]) : ''
  if (!style) return out
  for (const decl of style.split(';')) {
    const idx = decl.indexOf(':')
    if (idx === -1) continue
    const prop = decl.slice(0, idx).trim().toLowerCase()
    const val = decl.slice(idx + 1).trim()
    if (!val) continue
    if (prop === 'color') {
      out.color = val
    } else if (prop === 'font-size') {
      const px = parseFloat(val)
      if (!Number.isNaN(px)) out.fontSize = px
    }
  }
  return out
}

function parseAlignStyle(attrs) {
  const m = /text-align\s*:\s*(left|center|right)/i.exec(attrs || '')
  return m ? m[1].toLowerCase() : null
}

const BLOCK_TAGS = new Set(['div', 'p'])

// Tokenize HTML into tags and text. Drops comments/doctype. Self-closing <br>
// becomes a paragraph break.
function tokenize(html) {
  const tokens = []
  // strip HTML comments and <script>/<style> blocks entirely (defense vs paste)
  let s = String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)\/?>/g
  let last = 0
  let m
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', text: s.slice(last, m.index) })
    const raw = m[0]
    const name = m[1].toLowerCase()
    const closing = raw[1] === '/'
    tokens.push({ type: 'tag', name, closing, attrs: m[2] || '' })
    last = re.lastIndex
  }
  if (last < s.length) tokens.push({ type: 'text', text: s.slice(last) })
  return tokens
}

/**
 * Parse editor HTML back into a RichDoc, dropping anything not in the whitelist
 * (defense against pasted markup). Round-trips with docToHtml.
 */
export function htmlToDoc(html) {
  if (html == null || String(html).trim() === '') return emptyDoc()

  const tokens = tokenize(html)

  let docAlign = 'left'
  const paragraphs = []
  let curRuns = []
  // active inline formatting as a stack of {tag, attr-effects}
  const styleStack = [] // each entry: { bold, italic, underline, color, fontSize }
  let sawBlock = false

  function activeStyle() {
    const st = {}
    for (const s of styleStack) {
      if (s.bold) st.bold = true
      if (s.italic) st.italic = true
      if (s.underline) st.underline = true
      if (s.color != null) st.color = s.color
      if (s.fontSize != null) st.fontSize = s.fontSize
    }
    return st
  }

  function pushText(text) {
    const decoded = unescapeHtml(text)
    if (decoded === '') return
    const st = activeStyle()
    const run = { text: decoded }
    if (st.bold) run.bold = true
    if (st.italic) run.italic = true
    if (st.underline) run.underline = true
    if (st.color != null) run.color = st.color
    if (st.fontSize != null) run.fontSize = st.fontSize
    curRuns.push(run)
  }

  function endParagraph(align) {
    paragraphs.push({ runs: curRuns, _align: align })
    curRuns = []
  }

  for (const tok of tokens) {
    if (tok.type === 'text') {
      pushText(tok.text)
      continue
    }
    const { name, closing, attrs } = tok
    if (name === 'br') {
      // A <br> inside a block <div> is just an empty-line placeholder (docToHtml
      // emits `<div><br></div>` for an empty paragraph) — the enclosing block
      // already supplies the paragraph, so don't double-break. A *bare* <br>
      // (no open block, e.g. some pasted markup) acts as a line break.
      const inBlock = styleStack.some(s => '_blockAlign' in s)
      if (!inBlock) {
        sawBlock = true
        endParagraph(null)
      }
      continue
    }
    if (BLOCK_TAGS.has(name)) {
      if (!closing) {
        // opening a block: flush any pending inline content into a paragraph
        // (handles text before the first <div>)
        if (curRuns.length || paragraphs.length === 0 && sawBlock) {
          // nothing; we start fresh paragraph for the block content
        }
        if (curRuns.length) endParagraph(null)
        const a = parseAlignStyle(attrs)
        if (a) docAlign = a
        // remember align to stamp on the paragraph we close
        styleStack.push({ _blockAlign: a })
        sawBlock = true
      } else {
        // closing block: end paragraph, pop block marker
        let align = null
        for (let i = styleStack.length - 1; i >= 0; i--) {
          if ('_blockAlign' in styleStack[i]) {
            align = styleStack[i]._blockAlign
            styleStack.splice(i, 1)
            break
          }
        }
        endParagraph(align)
      }
      continue
    }
    if (name in INLINE_TAGS) {
      if (!closing) {
        styleStack.push({ [INLINE_TAGS[name]]: true })
      } else {
        // pop the nearest matching inline marker
        const want = INLINE_TAGS[name]
        for (let i = styleStack.length - 1; i >= 0; i--) {
          if (styleStack[i][want]) { styleStack.splice(i, 1); break }
        }
      }
      continue
    }
    if (name === 'span') {
      if (!closing) {
        styleStack.push({ ...parseSpanStyle(attrs), _span: true })
      } else {
        for (let i = styleStack.length - 1; i >= 0; i--) {
          if (styleStack[i]._span) { styleStack.splice(i, 1); break }
        }
      }
      continue
    }
    // any other tag (script already stripped, plus a/img/table/etc.) is dropped;
    // its text content (already emitted as text tokens) is preserved unstyled.
  }

  // flush trailing inline content
  if (curRuns.length) endParagraph(null)
  if (paragraphs.length === 0) paragraphs.push({ runs: [], _align: null })

  // resolve doc align: prefer first paragraph's block align if uniform, else docAlign
  let resolvedAlign = docAlign
  const aligns = paragraphs.map(p => p._align).filter(Boolean)
  if (aligns.length) resolvedAlign = aligns[0]
  if (!ALIGNS.has(resolvedAlign)) resolvedAlign = 'left'

  return {
    align: resolvedAlign,
    paragraphs: paragraphs.map(p => ({ runs: p.runs })),
  }
}

// ---- whole-box quick styles (PropertiesPanel) ------------------------------

/**
 * Apply a uniform run-style patch to every run in the doc (whole-box quick
 * style). Pass a boolean for bold/italic/underline, a hex string for color, a
 * number for fontSize. Passing `false`/`null`/`undefined` for an attribute
 * *removes* it from every run (so unchecking Bold clears bold). Returns a new
 * doc; the input is not mutated. An empty doc keeps its single empty paragraph.
 */
export function applyDocStyle(doc, patch = {}) {
  const base = doc && Array.isArray(doc.paragraphs) ? doc : emptyDoc()
  const setKeys = Object.keys(patch)
  return {
    align: ALIGNS.has(base.align) ? base.align : 'left',
    paragraphs: base.paragraphs.map(p => ({
      runs: (p.runs || []).map(r => {
        const next = { ...r }
        for (const k of setKeys) {
          const v = patch[k]
          if (v === false || v == null || v === '') delete next[k]
          else next[k] = v
        }
        return next
      }),
    })),
  }
}

/** Return a copy of the doc with a new block alignment. */
export function setDocAlign(doc, align) {
  const base = doc && Array.isArray(doc.paragraphs) ? doc : emptyDoc()
  return { ...base, align: ALIGNS.has(align) ? align : 'left' }
}

// ---- export fallback -------------------------------------------------------

/**
 * Export degradation helper. SVG/PNG rasterizers may not render <foreignObject>,
 * so the export path draws a plain <text> fallback behind the rich element. This
 * returns the per-line plain strings + the block alignment a <text> layer needs.
 * See FileMenu.jsx export code for the consumer + rationale.
 */
export function richExportFallback(doc) {
  return {
    align: doc && ALIGNS.has(doc.align) ? doc.align : 'left',
    lines: docToPlain(doc).split('\n'),
  }
}
