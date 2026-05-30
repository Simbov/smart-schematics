import React from 'react'
import {
  MousePointer2, Pencil, Type, MessageSquare, LayoutTemplate,
  ZoomIn, ZoomOut, Maximize2, Grid3X3,
  Undo2, Redo2, Activity,
  Trash2, RotateCw, FlipHorizontal, FlipVertical,
} from 'lucide-react'
import useSchematicStore from '../store/schematicStore'

const ToolButton = ({ icon: Icon, label, active, onClick, disabled }) => (
  <button
    className={[
      'flex items-center justify-center w-9 h-9 rounded transition-colors',
      active
        ? 'bg-blue-600 text-white'
        : 'text-gray-500 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/10',
      disabled ? 'opacity-40 cursor-not-allowed' : '',
    ].join(' ')}
    onClick={onClick}
    disabled={disabled}
    title={label}
  >
    <Icon size={16} />
  </button>
)

const Divider = () => (
  <div className="my-1 h-px bg-gray-200 dark:bg-gray-700 mx-2" />
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

  return (
    <div
      className="flex flex-col items-center py-2 gap-0.5 border-r overflow-y-auto flex-shrink-0"
      style={{
        width: 48,
        background: 'var(--toolbar-bg)',
        borderColor: 'var(--panel-border)',
      }}
    >
      <ToolButton icon={Undo2} label="Undo (Ctrl+Z)" onClick={undo} disabled={undoStack.length === 0} />
      <ToolButton icon={Redo2} label="Redo (Ctrl+Y)" onClick={redo} disabled={redoStack.length === 0} />

      <Divider />

      <ToolButton
        icon={MousePointer2}
        label="Select (V)"
        active={activeTool === 'select'}
        onClick={() => setActiveTool('select')}
      />
      <ToolButton
        icon={Pencil}
        label="Wire (W)"
        active={activeTool === 'wire'}
        onClick={() => setActiveTool('wire')}
      />

      <Divider />

      <ToolButton
        icon={Type}
        label="Text (T)"
        active={activeTool === 'text'}
        onClick={() => setActiveTool('text')}
      />
      <ToolButton
        icon={MessageSquare}
        label="Callout Box (B)"
        active={activeTool === 'callout'}
        onClick={() => setActiveTool('callout')}
      />
      <ToolButton
        icon={LayoutTemplate}
        label="Toggle Title Block"
        active={drawing?.titleBlock?.visible}
        onClick={() => {
          if (drawing && activeDrawingId) {
            updateTitleBlock(activeDrawingId, { visible: !drawing.titleBlock?.visible })
          }
        }}
      />

      <Divider />

      <ToolButton
        icon={Trash2}
        label="Delete (Del)"
        disabled={!hasSelection}
        onClick={() => activeDrawingId && deleteIds(activeDrawingId, selectedIds)}
      />
      <ToolButton
        icon={RotateCw}
        label="Rotate 90° (R)"
        disabled={!singleComp}
        onClick={() => singleComp && rotateComponent(activeDrawingId, singleComp.id, 90)}
      />
      <ToolButton
        icon={FlipHorizontal}
        label="Flip Horizontal (X)"
        disabled={!singleComp}
        onClick={() => singleComp && flipComponent(activeDrawingId, singleComp.id, 'H')}
      />
      <ToolButton
        icon={FlipVertical}
        label="Flip Vertical (Y)"
        disabled={!singleComp}
        onClick={() => singleComp && flipComponent(activeDrawingId, singleComp.id, 'V')}
      />

      <Divider />

      <ToolButton icon={ZoomIn} label="Zoom In (+)" onClick={() => zoomBy(1.2)} />
      <ToolButton icon={ZoomOut} label="Zoom Out (-)" onClick={() => zoomBy(1 / 1.2)} />
      <ToolButton
        icon={Maximize2}
        label="Fit to Screen (0)"
        onClick={() => {
          if (activeDrawingId) setViewState(activeDrawingId, { panX: 0, panY: 0, zoom: 1 })
        }}
      />
      <ToolButton
        icon={Grid3X3}
        label="Toggle Grid"
        active={settings.showGrid}
        onClick={() => updateSettings({ showGrid: !settings.showGrid })}
      />

      <Divider />

      <ToolButton
        icon={Activity}
        label="Toggle Simulation Overlay"
        active={settings.showCurrentValues}
        onClick={() => updateSettings({ showCurrentValues: !settings.showCurrentValues })}
      />
    </div>
  )
}
