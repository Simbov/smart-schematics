// Declarative description of the top toolbar's button groups.
//
// The React <Toolbar> maps over this config to render the horizontal button
// row, looking up each button's handler/active/disabled state by `id`. Keeping
// the button set, grouping, labels, and keyboard-shortcut hints as pure data
// lets the structure be unit-tested so it can't silently drift, and keeps the
// React layer a thin renderer (per the project's "push logic into testable
// pure functions" rule).
//
// `comingSoon: true` reserves a slot for a tool that lands in a later stage
// (Insert Image = Stage 3, Box = Stage 5). Such buttons render disabled.

export const TOOLBAR_GROUPS = [
  {
    id: 'history',
    buttons: [
      { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', icon: 'Undo2' },
      { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Y', icon: 'Redo2' },
    ],
  },
  {
    id: 'tools',
    buttons: [
      { id: 'select', label: 'Select', shortcut: 'V', icon: 'MousePointer2' },
      { id: 'wire', label: 'Wire', shortcut: 'W', icon: 'Pencil' },
    ],
  },
  {
    id: 'insert',
    buttons: [
      { id: 'text', label: 'Text', shortcut: 'T', icon: 'Type' },
      { id: 'callout', label: 'Callout Box', shortcut: 'B', icon: 'MessageSquare' },
      { id: 'insertImage', label: 'Insert Image', icon: 'Image' },
      { id: 'box', label: 'Box', icon: 'Square' },
      { id: 'titleBlock', label: 'Toggle Title Block', icon: 'LayoutTemplate' },
    ],
  },
  {
    id: 'edit',
    buttons: [
      { id: 'delete', label: 'Delete', shortcut: 'Del', icon: 'Trash2' },
      { id: 'rotate', label: 'Rotate 90°', shortcut: 'R', icon: 'RotateCw' },
      { id: 'flipH', label: 'Flip Horizontal', shortcut: 'X', icon: 'FlipHorizontal' },
      { id: 'flipV', label: 'Flip Vertical', shortcut: 'Y', icon: 'FlipVertical' },
    ],
  },
  {
    id: 'view',
    buttons: [
      { id: 'zoomIn', label: 'Zoom In', shortcut: '+', icon: 'ZoomIn' },
      { id: 'zoomOut', label: 'Zoom Out', shortcut: '-', icon: 'ZoomOut' },
      { id: 'zoomFit', label: 'Fit to Screen', shortcut: '0', icon: 'Maximize2' },
      { id: 'toggleGrid', label: 'Toggle Grid', icon: 'Grid3X3' },
    ],
  },
  {
    id: 'sim',
    buttons: [
      { id: 'simOverlay', label: 'Toggle Simulation Overlay', icon: 'Activity' },
    ],
  },
]

// Flat list of every button, in render order.
export function allToolbarButtons() {
  return TOOLBAR_GROUPS.flatMap(g => g.buttons)
}

// The `title=` tooltip text for a button: label, plus a parenthesised shortcut
// hint when one exists, plus a "coming soon" note for reserved slots. This
// reproduces the exact tooltips the vertical toolbar used (e.g. "Select (V)",
// "Fit to Screen (0)", "Toggle Grid").
export function buttonTooltip(btn) {
  let t = btn.label
  if (btn.shortcut) t += ` (${btn.shortcut})`
  if (btn.comingSoon) t += ' — coming soon'
  return t
}
