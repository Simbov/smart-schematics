// Export a drawing table to the clipboard as a real HTML <table> (plus a
// tab-separated plain-text fallback) so it pastes into Word/Excel/Google Docs as
// an editable table rather than a flat string. Pure serializers are unit-tested;
// the async copy helper is a thin wrapper over the Clipboard API.

import { docToPlain, docToHtml } from './richText'

// Escape a string for safe inclusion in tab-separated plain text (strip the
// characters that would break row/column structure).
function tsvCell(s) {
  return String(s).replace(/\t/g, ' ').replace(/\r?\n/g, ' ')
}

// Serialize a table to an HTML string. The first row is emitted as <th> when the
// table has a header row, so Word styles it as a header. Borders are inlined so
// the pasted table keeps its ruled look.
export function tableToHtml(table) {
  const { cells = [], borderColor = '#334155', borderWidth = 1, headerRow = false } = table
  const border = `${borderWidth}px solid ${borderColor}`
  const rowsHtml = cells.map((row, r) => {
    const tag = headerRow && r === 0 ? 'th' : 'td'
    const cellsHtml = row.map(doc => {
      const inner = docToHtml(doc) || ''
      return `<${tag} style="border:${border};padding:4px 6px;">${inner}</${tag}>`
    }).join('')
    return `<tr>${cellsHtml}</tr>`
  }).join('')
  return `<table style="border-collapse:collapse;border:${border};">${rowsHtml}</table>`
}

// Tab-separated plain-text version (one row per line). Pastes into Excel cleanly
// and is the graceful fallback where rich HTML isn't accepted.
export function tableToTsv(table) {
  const { cells = [] } = table
  return cells.map(row => row.map(doc => tsvCell(docToPlain(doc))).join('\t')).join('\n')
}

// Copy a table to the clipboard with both text/html and text/plain flavours.
// Returns true on success. Falls back to writeText (TSV) when ClipboardItem or
// the rich path is unavailable (older webviews).
export async function copyTableToClipboard(table) {
  const html = tableToHtml(table)
  const tsv = tableToTsv(table)
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([tsv], { type: 'text/plain' }),
        }),
      ])
      return true
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(tsv)
      return true
    }
  } catch (e) {
    console.warn('Table clipboard copy failed', e)
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(tsv); return true }
    } catch { /* give up */ }
  }
  return false
}
