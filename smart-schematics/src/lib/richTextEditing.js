// richTextEditing.js — pure, testable decision logic for the floating rich-text
// editor's toolbar highlighting (Stage 3, v0.2.0). No DOM / jsdom required.
//
// The contentEditable + document.execCommand calls live in RichTextEditor.jsx and
// can't be unit-tested under node. These helpers derive the *initial* toolbar
// highlight from the seeded RichDoc; live selection state is refreshed from
// document.queryCommandState in the component.

/**
 * The shared font size (px) across all non-empty runs of a doc, or null when the
 * runs disagree (mixed sizes) or any non-empty run carries no explicit size. A
 * run with empty text is ignored. Returns null for an empty doc.
 */
export function uniformFontSize(doc) {
  if (!doc || !Array.isArray(doc.paragraphs)) return null
  let seen = null
  let any = false
  for (const p of doc.paragraphs) {
    for (const r of (p.runs || [])) {
      if (!r.text || r.text === '') continue // ignore runs with no visible text
      any = true
      const fs = r.fontSize ?? null
      if (fs === null) return null // a sizeless run breaks uniformity
      if (seen === null) seen = fs
      else if (seen !== fs) return null
    }
  }
  return any ? seen : null
}

/**
 * The active marks for whole-doc highlighting, derived from a RichDoc. Bold /
 * italic / underline are true only when EVERY non-empty run carries the mark
 * (uniform). `align` mirrors `doc.align`. `fontSize` is the uniform px or null.
 */
export function activeMarks(doc) {
  const align = doc && (doc.align === 'center' || doc.align === 'right') ? doc.align : 'left'
  const runs = []
  if (doc && Array.isArray(doc.paragraphs)) {
    for (const p of doc.paragraphs) {
      for (const r of (p.runs || [])) {
        if (r.text && r.text !== '') runs.push(r)
      }
    }
  }
  const allHave = key => runs.length > 0 && runs.every(r => r[key] === true)
  return {
    bold: allHave('bold'),
    italic: allHave('italic'),
    underline: allHave('underline'),
    align,
    fontSize: uniformFontSize(doc),
  }
}
