import React, { useRef } from 'react'
import {
  MousePointer2, Pencil, Type, MessageSquare, LayoutTemplate,
  ZoomIn, ZoomOut, Maximize2, Grid3X3,
  Undo2, Redo2, Activity,
  Trash2, RotateCw, FlipHorizontal, FlipVertical,
  Image, Square, Table,
} from 'lucide-react'
import useSchematicStore from '../store/schematicStore'
import { TOOLBAR_GROUPS, buttonTooltip } from '../lib/toolbarConfig'
import { aspectFitSize, defaultPlacement } from '../lib/imageUtils'
import { isRunningInTauri, openFileDialog, readImageAsDataUrl } from '../lib/tauriFs'

// Maps the string icon names in toolbarConfig to their lucide components.
const ICONS = {
  Undo2, Redo2, MousePointer2, Pencil, Type, MessageSquare, Image, Square, Table,
  LayoutTemplate, Trash2, RotateCw, FlipHorizontal, FlipVertical,
  ZoomIn, ZoomOut, Maximize2, Grid3X3, Activity,
}

const ToolButton = ({ icon: Icon, title, active, onClick, disabled }) => (
  <button
    className={[
      'flex items-center justify-center w-8 h-8 rounded transition-colors flex-shrink-0',
      active
        ? 'bg-blue-600 text-white'
        : 'text-gray-500 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10',
      disabled ? 'opacity-40 cursor-not-allowed' : '',
    ].join(' ')}
    onClick={onClick}
    disabled={disabled}
    title={title}
  >
    <Icon size={16} />
  </button>
)

// Vertical divider between button groups in the horizontal bar.
const Divider = () => (
  <div className="self-center mx-1 w-px h-5 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
)

export default function Toolbar() {
  const activeTool = useSchematicStore(s => s.activeTool)
  const setActiveTool = useSchematicStore(s => s.setActiveTool)
  const settings = useSchematicStore(s => s.settings)
  const updateSettings = useSchematicStore(s => s.updateSettings)
  const activeDrawingId = useSchematicStore(s => s.activeDrawingId)
  const drawings = useSchematicStore(s => s.drawings)
  const setViewState = useSchematicStore(s => s.setViewState)
  const undoStack = useSchematicStore(s => s.undoStack)
  const redoStack = useSchematicStore(s => s.redoStack)
  const undo = useSchematicStore(s => s.undo)
  const redo = useSchematicStore(s => s.redo)
  const selectedIds = useSchematicStore(s => s.selectedIds)
  const deleteIds = useSchematicStore(s => s.deleteIds)
  const rotateComponent = useSchematicStore(s => s.rotateComponent)
  const flipComponent = useSchematicStore(s => s.flipComponent)
  const updateTitleBlock = useSchematicStore(s => s.updateTitleBlock)
  const addImage = useSchematicStore(s => s.addImage)
  const pushUndo = useSchematicStore(s => s.pushUndo)
  const setSelectedIds = useSchematicStore(s => s.setSelectedIds)
  const fileInputRef = useRef(null)

  const hasSelection = selectedIds.length > 0
  const drawing = drawings.find(d => d.id === activeDrawingId)
  const selectedComponents = drawing?.components.filter(c => selectedIds.includes(c.id)) || []
  const singleComp = selectedComponents.length === 1 ? selectedComponents[0] : null

  const zoomBy = (factor) => {
    if (!drawing) return
    const { panX, panY, zoom } = drawing.viewState
    const newZoom = Math.min(8, Math.max(0.1, zoom * factor))
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    setViewState(activeDrawingId, {
      zoom: newZoom,
      panX: cx - (cx - panX) * (newZoom / zoom),
      panY: cy - (cy - panY) * (newZoom / zoom),
    })
  }

  // Insert an image from a base64 data URL: measure it, aspect-fit-clamp the
  // size, center it in the current viewport (snapping the origin to grid), then
  // add it to the drawing and select it. All the geometry is pure (imageUtils).
  const insertImageFromDataUrl = (src) => {
    if (!src || !drawing || !activeDrawingId) return
    const probe = new window.Image()
    probe.onload = () => {
      const size = aspectFitSize(probe.naturalWidth, probe.naturalHeight)
      const { panX, panY, zoom } = drawing.viewState || { panX: 0, panY: 0, zoom: 1 }
      // Screen center → world coords (mirrors screenToWorld).
      const cx = (window.innerWidth / 2 - panX) / zoom
      const cy = (window.innerHeight / 2 - panY) / zoom
      const grid = settings.snapToGrid ? settings.gridSize : 0
      const origin = defaultPlacement(cx, cy, size, grid)
      pushUndo()
      const id = addImage(activeDrawingId, { src, x: origin.x, y: origin.y, width: size.width, height: size.height })
      setSelectedIds([id])
      setActiveTool('select')
    }
    probe.src = src
  }

  const handleInsertImage = async () => {
    if (isRunningInTauri()) {
      const path = await openFileDialog([
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] },
      ])
      if (!path) return
      const dataUrl = await readImageAsDataUrl(path)
      insertImageFromDataUrl(dataUrl)
    } else {
      fileInputRef.current?.click()
    }
  }

  const onFileChosen = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => insertImageFromDataUrl(reader.result)
    reader.readAsDataURL(file)
  }

  // Per-button behaviour/state, keyed by config id. The config controls which
  // buttons exist, their order, grouping, labels, and shortcut hints; this map
  // supplies what's stateful. Buttons with `comingSoon` (Insert Image, Box) are
  // reserved for later stages and rendered disabled with no handler.
  const controls = {
    undo: { onClick: undo, disabled: undoStack.length === 0 },
    redo: { onClick: redo, disabled: redoStack.length === 0 },
    select: { onClick: () => setActiveTool('select'), active: activeTool === 'select' },
    wire: { onClick: () => setActiveTool('wire'), active: activeTool === 'wire' },
    text: { onClick: () => setActiveTool('text'), active: activeTool === 'text' },
    callout: { onClick: () => setActiveTool('callout'), active: activeTool === 'callout' },
    insertImage: { onClick: handleInsertImage, disabled: !drawing },
    box: { onClick: () => setActiveTool('box'), active: activeTool === 'box', disabled: !drawing },
    table: { onClick: () => setActiveTool('table'), active: activeTool === 'table', disabled: !drawing },
    titleBlock: {
      active: drawing?.titleBlock?.visible,
      onClick: () => {
        if (drawing && activeDrawingId) {
          updateTitleBlock(activeDrawingId, { visible: !drawing.titleBlock?.visible })
        }
      },
    },
    delete: {
      disabled: !hasSelection,
      onClick: () => activeDrawingId && deleteIds(activeDrawingId, selectedIds),
    },
    rotate: {
      disabled: !singleComp,
      onClick: () => singleComp && rotateComponent(activeDrawingId, singleComp.id, 90),
    },
    flipH: {
      disabled: !singleComp,
      onClick: () => singleComp && flipComponent(activeDrawingId, singleComp.id, 'H'),
    },
    flipV: {
      disabled: !singleComp,
      onClick: () => singleComp && flipComponent(activeDrawingId, singleComp.id, 'V'),
    },
    zoomIn: { onClick: () => zoomBy(1.2) },
    zoomOut: { onClick: () => zoomBy(1 / 1.2) },
    zoomFit: {
      onClick: () => { if (activeDrawingId) setViewState(activeDrawingId, { panX: 0, panY: 0, zoom: 1 }) },
    },
    toggleGrid: {
      active: settings.showGrid,
      onClick: () => updateSettings({ showGrid: !settings.showGrid }),
    },
    simOverlay: {
      active: settings.showCurrentValues,
      onClick: () => updateSettings({ showCurrentValues: !settings.showCurrentValues }),
    },
  }

  return (
    <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto">
      {/* Hidden image picker (browser fallback; Tauri uses the native dialog) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onFileChosen}
      />
      {TOOLBAR_GROUPS.map((group, gi) => (
        <React.Fragment key={group.id}>
          {gi > 0 && <Divider />}
          {group.buttons.map(btn => {
            const ctrl = controls[btn.id] || {}
            return (
              <ToolButton
                key={btn.id}
                icon={ICONS[btn.icon]}
                title={buttonTooltip(btn)}
                active={ctrl.active}
                onClick={ctrl.onClick}
                disabled={btn.comingSoon || ctrl.disabled}
              />
            )
          })}
        </React.Fragment>
      ))}
    </div>
  )
}
