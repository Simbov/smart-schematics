// Pure geometry for text-annotation boxes (Stage 10, v0.2.0). Shared by
// AnnotationLayer (rendering) and Canvas (resize handles + commit) so the
// rendered box and the resize handles can never drift apart. No DOM.
//
// A text annotation stores its baseline origin at (x, y). When it carries an
// explicit width/height it is a fixed-size, wrapping box; otherwise it autosizes
// to its content. `textOuterBox` returns the rendered OUTER box (top-left + size,
// padding included); `outerBoxToAnnotation` inverts a resized outer box back into
// the annotation's {x, y, width, height} fields.

export const TEXT_PAD = 3
export const MIN_TEXT_W = 20
export const MIN_TEXT_H = 12

export function textOuterBox(ann, plain = '') {
  const fs = ann.fontSize || 14
  const fixed = ann.width != null && ann.height != null
  const lines = String(plain).split('\n')
  const lineCount = Math.max(1, lines.length)
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 1)
  const W = fixed ? ann.width : Math.max(MIN_TEXT_W, longest * fs * 0.6)
  const H = fixed ? ann.height : lineCount * fs * 1.4 + 4
  return {
    x: ann.x - TEXT_PAD,
    y: ann.y - fs - TEXT_PAD,
    width: W + TEXT_PAD * 2,
    height: H + TEXT_PAD * 2,
  }
}

// Invert a resized outer box back to annotation fields. Returns {x, y, width,
// height} — `width`/`height` are the inner content size (floored at the minimum).
export function outerBoxToAnnotation(box, ann) {
  const fs = ann.fontSize || 14
  return {
    x: box.x + TEXT_PAD,
    y: box.y + fs + TEXT_PAD,
    width: Math.max(MIN_TEXT_W, box.width - TEXT_PAD * 2),
    height: Math.max(MIN_TEXT_H, box.height - TEXT_PAD * 2),
  }
}
