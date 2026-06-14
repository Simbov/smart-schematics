// Pure geometry helpers for PDF export (A4 landscape, mm units). The actual
// jsPDF document is assembled in FileMenu.jsx; keeping the layout maths here
// makes them unit-testable without a DOM or the jsPDF runtime.

export const A4_LANDSCAPE = { width: 297, height: 210 } // mm
export const PAGE_MARGIN = 10                            // mm around the artwork
export const TITLE_BLOCK_HEIGHT = 22                     // mm footer band

// Scale an image of `imgW × imgH` (any units — only the ratio matters) to fit
// inside the artwork area of a page, centred. Returns the placement rect in mm.
// `titleH` reserves a footer band; the artwork never overlaps it.
export function fitImageToArea(imgW, imgH, page = A4_LANDSCAPE, margin = PAGE_MARGIN, titleH = TITLE_BLOCK_HEIGHT) {
  const availW = Math.max(1, page.width - margin * 2)
  const availH = Math.max(1, page.height - margin * 2 - titleH)
  if (!imgW || !imgH) return { x: margin, y: margin, w: availW, h: availH }
  const scale = Math.min(availW / imgW, availH / imgH)
  const w = imgW * scale
  const h = imgH * scale
  return {
    x: margin + (availW - w) / 2,
    y: margin + (availH - h) / 2,
    w,
    h,
  }
}

// Geometry of the footer title-block band: the outer frame plus the x positions
// of the three labelled cells (drawing | project | date / page).
export function titleBlockLayout(page = A4_LANDSCAPE, margin = PAGE_MARGIN, titleH = TITLE_BLOCK_HEIGHT) {
  const x = margin
  const y = page.height - margin - titleH
  const w = page.width - margin * 2
  return {
    x, y, w, h: titleH,
    cells: [
      { x, w: w * 0.5 },              // drawing name
      { x: x + w * 0.5, w: w * 0.3 }, // project name
      { x: x + w * 0.8, w: w * 0.2 }, // date + page X of N
    ],
  }
}

// "Page 2 of 5"
export function pageLabel(index, total) {
  return `Page ${index + 1} of ${total}`
}
