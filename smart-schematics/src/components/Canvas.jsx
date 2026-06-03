import React, { useRef, useCallback, useEffect, useState, useMemo, memo } from 'react'
import useSchematicStore from '../store/schematicStore'
import useSimulationStore from '../store/simulationStore'
import { TOGGLE_TYPES } from '../lib/simulation/electricalSim'
import { MANUAL_DCV_TYPES, defaultDCVPosition } from '../lib/simulation/hydraulicSim'
import { genId } from '../store/schematicStore'
import GridOverlay from './GridOverlay'
import PlacedComponent from './PlacedComponent'
import WireLayer from './WireLayer'
import WireInProgress from './WireInProgress'
import HydraulicFlowLayer from './HydraulicFlowLayer'
import MeasurementOverlay from './MeasurementOverlay'
import InteractiveControl, { isControllable } from './InteractiveControl'
import AnnotationLayer from './AnnotationLayer'
import ImageLayer from './ImageLayer'
import TitleBlock from './TitleBlock'
import InlineEditor from './InlineEditor'
import { resizeBox, snapBox, RESIZE_HANDLES, topImageAt, aspectFitSize, defaultPlacement } from '../lib/imageUtils'
import { boxPinLabelPos } from '../lib/boxComponent'
import RichTextEditor from './RichTextEditor'
import { emptyDoc, plainToDoc, isEmptyDoc, docToPlain } from '../lib/richText'
import { textOuterBox, outerBoxToAnnotation } from '../lib/annotationLayout'
import { ELECTRICAL_SYMBOL_MAP } from '../lib/symbols/electrical'
import { HYDRAULIC_SYMBOL_MAP } from '../lib/symbols/HydraulicSymbols'
import { getElectricalDef } from '../lib/components/electrical'
import { getHydraulicDef } from '../lib/components/hydraulic'
import { getCustomDef } from '../lib/components/custom'
import { chooseLabelSide } from '../lib/labelPlacement'
import CustomSymbol from '../lib/symbols/CustomSymbol'

const SYMBOL_MAP_ALL = { ...ELECTRICAL_SYMBOL_MAP, ...HYDRAULIC_SYMBOL_MAP }
function getAnyDef(type) { return getElectricalDef(type) || getHydraulicDef(type) || getCustomDef(type) }

// Minimum pointer travel (screen px) before a background drag is treated as a
// rubber-band box-select. Below this, the gesture is a plain click — important
// on trackpads where ordinary clicks jitter several pixels.
const RUBBER_BAND_MIN_PX = 8
import { snapToGrid, screenToWorld } from '../lib/utils'
import {
  routeWire,
  dedupPoints,
  getBestSnap,
  isPointOnWireMiddle,
} from '../lib/wireUtils'

const GhostComponent = memo(function GhostComponent({ type, x, y }) {
  const isCustom = type.startsWith('custom_')
  const SymbolComponent = isCustom ? null : SYMBOL_MAP_ALL[type]
  const customDef = isCustom ? getCustomDef(type) : null
  if (!isCustom && !SymbolComponent) return null
  if (isCustom && !customDef) return null
  return (
    <g transform={`translate(${x},${y})`} opacity="0.5" style={{ pointerEvents: 'none' }}>
      <g style={{ color: 'var(--component-color)' }}>
        {isCustom
          ? <CustomSymbol svgPathData={customDef.svgPathData} />
          : <SymbolComponent />
        }
      </g>
    </g>
  )
})

export default function Canvas({ onCursorMove }) {
  const svgRef = useRef(null)

  // Pan tracking
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const lastPan = useRef({ x: 0, y: 0 })
  const spaceHeld = useRef(false)
  const mouseDownPos = useRef(null)
  const didDrag = useRef(false)
  // Last known cursor position in world coords — used as the paste anchor for
  // clipboard images. Updated on every mouse move over the canvas.
  const lastWorldPoint = useRef(null)

  // Wire tool state
  const wirePointsRef = useRef([])
  const [wirePoints, setWirePoints] = useState([])
  const [ghostPoint, setGhostPoint] = useState(null)
  const [snapTarget, setSnapTarget] = useState(null)
  const snapTargetRef = useRef(null)

  // Drag-to-move state
  const dragRef = useRef(null) // { compIds, wireIds, startWorld }
  const [dragDelta, setDragDelta] = useState({ dx: 0, dy: 0 })
  const isDraggingItems = useRef(false)

  // Rubber-band selection state
  const [rubberBand, setRubberBand] = useState(null) // { startWorld, endWorld }
  const rubberBandRef = useRef(null)
  const isRubberBanding = useRef(false)

  // Callout drag state
  const calloutDragRef = useRef(null)
  const [calloutDraft, setCalloutDraft] = useState(null)

  // Image resize state. resizeRef holds the in-progress gesture; resizeBoxState
  // mirrors the live box for rendering without mutating the store mid-drag.
  const resizeRef = useRef(null) // { imageId, handle, startWorld, startBox, keepAspect }
  const [resizeBoxState, setResizeBoxState] = useState(null) // { imageId, box }

  // Box resize state (Stage 5) — mirrors the image resize gesture but commits via
  // updateBox (center-coords) and recomputes pins. boxResizeState holds the live
  // top-left box for rendering the rect + handles without mutating the store.
  const boxResizeRef = useRef(null) // { boxId, handle, startBox(topleft), z, startClient, lastBox }
  const [boxResizeState, setBoxResizeState] = useState(null) // { boxId, box(topleft) }

  // Text-annotation resize state (Stage 10) — mirrors the image gesture but the
  // box is the rendered outer box (annotationLayout.textOuterBox) and commits via
  // updateAnnotation with outerBoxToAnnotation.
  const textResizeRef = useRef(null) // { annId, handle, startBox, z, startClient, lastBox, ann }
  const [textResizeState, setTextResizeState] = useState(null) // { annId, patch }

  // Inline editor state (title-block cells only)
  const [inlineEdit, setInlineEdit] = useState(null)
  // { titleBlockField, worldX, worldY, value, multiline, isNew? }
  // Rich-text editor state (text/callout annotations)
  const [richEdit, setRichEdit] = useState(null)
  // { annotationId, worldX, worldY, width?, height?, doc, fixedSize, isNew }

  const setWirePts = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(wirePointsRef.current) : updater
    wirePointsRef.current = next
    setWirePoints(next)
  }, [])

  // Simulation store
  const isRunning = useSimulationStore(s => s.isRunning)
  const componentStates = useSimulationStore(s => s.componentStates)
  const interactiveStates = useSimulationStore(s => s.interactiveStates)
  const toggleSwitch = useSimulationStore(s => s.toggleSwitch)
  const pressButton = useSimulationStore(s => s.pressButton)
  const releaseButton = useSimulationStore(s => s.releaseButton)
  const shiftDCV = useSimulationStore(s => s.shiftDCV)
  const dcvPositions = useSimulationStore(s => s.dcvPositions)
  const hydComponentStates = useSimulationStore(s => s.hydComponentStates)
  const cylinderPositions = useSimulationStore(s => s.cylinderPositions)

  // Store selectors
  const activeDrawingId = useSchematicStore(s => s.activeDrawingId)
  const drawings = useSchematicStore(s => s.drawings)
  const settings = useSchematicStore(s => s.settings)
  const setViewState = useSchematicStore(s => s.setViewState)
  const activeTool = useSchematicStore(s => s.activeTool)
  const placingComponentType = useSchematicStore(s => s.placingComponentType)
  const selectedIds = useSchematicStore(s => s.selectedIds)
  const setSelectedIds = useSchematicStore(s => s.setSelectedIds)
  const addToSelection = useSchematicStore(s => s.addToSelection)
  const clearSelection = useSchematicStore(s => s.clearSelection)
  const setActiveTool = useSchematicStore(s => s.setActiveTool)
  const addComponent = useSchematicStore(s => s.addComponent)
  const addWire = useSchematicStore(s => s.addWire)
  const addJunction = useSchematicStore(s => s.addJunction)
  const addAnnotation = useSchematicStore(s => s.addAnnotation)
  const updateAnnotation = useSchematicStore(s => s.updateAnnotation)
  const updateTitleBlock = useSchematicStore(s => s.updateTitleBlock)
  const pushUndo = useSchematicStore(s => s.pushUndo)
  const undo = useSchematicStore(s => s.undo)
  const redo = useSchematicStore(s => s.redo)
  const moveItems = useSchematicStore(s => s.moveItems)
  const rotateComponent = useSchematicStore(s => s.rotateComponent)
  const flipComponent = useSchematicStore(s => s.flipComponent)
  const deleteIds = useSchematicStore(s => s.deleteIds)
  const copyToClipboard = useSchematicStore(s => s.copyToClipboard)
  const pasteFromClipboard = useSchematicStore(s => s.pasteFromClipboard)
  const updateImage = useSchematicStore(s => s.updateImage)
  const addImage = useSchematicStore(s => s.addImage)
  const addBox = useSchematicStore(s => s.addBox)
  const updateBox = useSchematicStore(s => s.updateBox)
  const updateComponent = useSchematicStore(s => s.updateComponent)

  const drawing = drawings.find(d => d.id === activeDrawingId)
  const { panX, panY, zoom } = drawing?.viewState || { panX: 0, panY: 0, zoom: 1 }

  // Clear wire-in-progress when tool changes away from wire
  useEffect(() => {
    if (activeTool !== 'wire') {
      setWirePts([])
      setSnapTarget(null)
      snapTargetRef.current = null
    }
  }, [activeTool])

  const wrapperRef = useRef(null)

  const zoomToSelection = useCallback(() => {
    const { drawings, activeDrawingId: did, selectedIds: ids } = useSchematicStore.getState()
    const dr = drawings.find(d => d.id === did)
    if (!dr || ids.length === 0) return
    const xs = [], ys = []
    for (const c of dr.components.filter(c => ids.includes(c.id))) {
      xs.push(c.x - 40, c.x + 40); ys.push(c.y - 40, c.y + 40)
    }
    for (const w of dr.wires.filter(w => ids.includes(w.id))) {
      for (const p of w.points) { xs.push(p.x); ys.push(p.y) }
    }
    for (const a of (dr.annotations || []).filter(a => ids.includes(a.id))) {
      xs.push(a.x); ys.push(a.y)
      if (a.type === 'callout') { xs.push(a.x + (a.width || 120)); ys.push(a.y + (a.height || 60)) }
    }
    if (!xs.length) return
    const PAD = 40
    const minX = Math.min(...xs) - PAD, maxX = Math.max(...xs) + PAD
    const minY = Math.min(...ys) - PAD, maxY = Math.max(...ys) + PAD
    const contentW = maxX - minX, contentH = maxY - minY
    const vw = wrapperRef.current?.clientWidth || 800
    const vh = wrapperRef.current?.clientHeight || 600
    const newZoom = Math.min(8, Math.max(0.1, Math.min(vw / contentW, vh / contentH)))
    setViewState(did, {
      zoom: newZoom,
      panX: (vw - contentW * newZoom) / 2 - minX * newZoom,
      panY: (vh - contentH * newZoom) / 2 - minY * newZoom,
    })
  }, [setViewState])

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = e => {
      // Ignore canvas shortcuts while typing in any editor (inputs, textareas,
      // or the contentEditable rich-text box).
      if (e.target.matches('input,textarea') || e.target.isContentEditable) return

      if (e.code === 'Space') { e.preventDefault(); spaceHeld.current = true; return }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); return }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault(); redo(); return
      }

      // Copy / Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault()
        const { selectedIds: ids, activeDrawingId: did } = useSchematicStore.getState()
        if (ids.length > 0 && did) copyToClipboard(did, ids)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault()
        const { activeDrawingId: did } = useSchematicStore.getState()
        if (did) pasteFromClipboard(did)
        return
      }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        const { selectedIds: ids, activeDrawingId: did } = useSchematicStore.getState()
        if (ids.length > 0 && did) deleteIds(did, ids)
        return
      }

      // Select tool shortcuts for single selected component
      const { selectedIds: ids, activeDrawingId: did, drawings: drws } = useSchematicStore.getState()
      const dr = drws.find(d => d.id === did)
      const selComps = dr?.components.filter(c => ids.includes(c.id)) || []
      const selImgs = (dr?.images || []).filter(im => ids.includes(im.id))
      const singleImg = ids.length === 1 && selImgs.length === 1 ? selImgs[0] : null

      if (e.key === 'r' || e.key === 'R') {
        if (selComps.length === 1) rotateComponent(did, selComps[0].id, 90)
        // Images rotate in 90° steps about their center.
        else if (singleImg) { pushUndo(); updateImage(did, singleImg.id, { rotation: ((singleImg.rotation || 0) + 90) % 360 }) }
        return
      }
      if (e.key === 'x' || e.key === 'X') {
        if (selComps.length === 1 && !e.ctrlKey && !e.metaKey) flipComponent(did, selComps[0].id, 'H')
        return
      }
      if (e.key === 'y' || e.key === 'Y') {
        if (selComps.length === 1 && !e.ctrlKey && !e.metaKey) flipComponent(did, selComps[0].id, 'V')
        return
      }

      if (e.key === 'Escape') {
        if (wirePointsRef.current.length > 0) { setWirePts([]); return }
        clearSelection(); setActiveTool('select')
        return
      }
      if (e.key === 'Enter') {
        if (activeTool === 'wire' && wirePointsRef.current.length >= 2) {
          finishWire(wirePointsRef.current)
        }
        return
      }
      if (e.key === 'v' || e.key === 'V') { setActiveTool('select'); return }
      if (e.key === 'w' || e.key === 'W') { setActiveTool('wire'); return }
      if (e.key === 't' || e.key === 'T') { setActiveTool('text'); return }
      if (e.key === 'b' || e.key === 'B') { setActiveTool('callout'); return }
      if (e.key === '+' || e.key === '=') {
        const w = wrapperRef.current?.clientWidth || window.innerWidth
        const h = wrapperRef.current?.clientHeight || window.innerHeight
        zoomAt(1.15, w / 2, h / 2); return
      }
      if (e.key === '-') {
        const w = wrapperRef.current?.clientWidth || window.innerWidth
        const h = wrapperRef.current?.clientHeight || window.innerHeight
        zoomAt(1 / 1.15, w / 2, h / 2); return
      }
      if (e.key === '0') { resetView(); return }

      // Toggle grid snap
      if (e.key === 'g' || e.key === 'G') {
        const st = useSchematicStore.getState()
        st.updateSettings({ snapToGrid: !st.settings.snapToGrid })
        return
      }
      // Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        const { drawings, activeDrawingId: did } = useSchematicStore.getState()
        const dr = drawings.find(d => d.id === did)
        if (dr) {
          useSchematicStore.getState().setSelectedIds([
            ...(dr.components || []).map(c => c.id),
            ...(dr.wires || []).map(w => w.id),
            ...(dr.annotations || []).map(a => a.id),
            ...(dr.images || []).filter(im => !im.locked).map(im => im.id),
          ])
        }
        return
      }
      // Duplicate selection in-place
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault()
        const { selectedIds: ids, activeDrawingId: did } = useSchematicStore.getState()
        if (ids.length > 0 && did) { copyToClipboard(did, ids); pasteFromClipboard(did) }
        return
      }
      // Zoom to selection
      if (e.key === 'z' || e.key === 'Z') { zoomToSelection(); return }
    }
    const onKeyUp = e => { if (e.code === 'Space') spaceHeld.current = false }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [activeTool, wirePoints, undo, redo, deleteIds, copyToClipboard, pasteFromClipboard, rotateComponent, flipComponent, zoomToSelection, pushUndo, updateImage])

  // Paste an image from the clipboard onto the drawing (v0.2.0). Anchored at the
  // last cursor world point, else the viewport center; sized via aspectFitSize.
  // Ignored while editing text (contentEditable / inputs) so it never steals a
  // normal text paste. Mirrors Toolbar.insertImageFromDataUrl.
  useEffect(() => {
    function onPaste(e) {
      const state = useSchematicStore.getState()
      const did = state.activeDrawingId
      if (!did) return
      const t = e.target
      if (t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      const items = e.clipboardData?.items
      if (!items) return
      let file = null
      for (const it of items) {
        if (it.type && it.type.startsWith('image/')) { file = it.getAsFile(); break }
      }
      if (!file) return
      e.preventDefault()
      const reader = new FileReader()
      reader.onload = () => {
        const src = reader.result
        const probe = new window.Image()
        probe.onload = () => {
          const s2 = useSchematicStore.getState()
          const size = aspectFitSize(probe.naturalWidth, probe.naturalHeight)
          const grid = s2.settings.snapToGrid ? s2.settings.gridSize : 0
          let cx, cy
          if (lastWorldPoint.current) {
            cx = lastWorldPoint.current.x; cy = lastWorldPoint.current.y
          } else {
            const dr = s2.drawings.find(d => d.id === did)
            const { panX, panY, zoom } = dr?.viewState || { panX: 0, panY: 0, zoom: 1 }
            cx = (window.innerWidth / 2 - panX) / zoom
            cy = (window.innerHeight / 2 - panY) / zoom
          }
          const origin = defaultPlacement(cx, cy, size, grid)
          pushUndo()
          const id = addImage(did, { src, x: origin.x, y: origin.y, width: size.width, height: size.height })
          setSelectedIds([id])
          setActiveTool('select')
        }
        probe.src = src
      }
      reader.readAsDataURL(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [addImage, pushUndo, setSelectedIds, setActiveTool])

  const zoomAt = useCallback((factor, cx, cy) => {
    if (!activeDrawingId) return
    const vs = useSchematicStore.getState().drawings.find(d => d.id === activeDrawingId)?.viewState || { panX: 0, panY: 0, zoom: 1 }
    const newZoom = Math.min(8, Math.max(0.1, vs.zoom * factor))
    setViewState(activeDrawingId, {
      zoom: newZoom,
      panX: cx - (cx - vs.panX) * (newZoom / vs.zoom),
      panY: cy - (cy - vs.panY) * (newZoom / vs.zoom),
    })
  }, [activeDrawingId, setViewState])

  const resetView = useCallback(() => {
    if (activeDrawingId) setViewState(activeDrawingId, { panX: 0, panY: 0, zoom: 1 })
  }, [activeDrawingId, setViewState])

  const getSVGPos = useCallback(e => {
    const rect = svgRef.current.getBoundingClientRect()
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top }
  }, [])

  const toWorld = useCallback((sx, sy, snapped = false) => {
    const vs = useSchematicStore.getState().drawings.find(d => d.id === activeDrawingId)?.viewState || { panX: 0, panY: 0, zoom: 1 }
    const world = screenToWorld(sx, sy, vs.panX, vs.panY, vs.zoom)
    if (!snapped) return world
    const g = useSchematicStore.getState().settings.gridSize
    return { x: snapToGrid(world.x, g), y: snapToGrid(world.y, g) }
  }, [activeDrawingId])

  const finishWire = useCallback((pts) => {
    const clean = dedupPoints(pts)
    if (clean.length < 2) { setWirePts([]); return }

    const state = useSchematicStore.getState()
    const comps = state.drawings.find(d => d.id === activeDrawingId)?.components || []
    const existingWires = state.drawings.find(d => d.id === activeDrawingId)?.wires || []
    const existingJunctions = state.drawings.find(d => d.id === activeDrawingId)?.junctions || []

    const startPt = clean[0]
    const endPt = clean[clean.length - 1]

    const snap = (pt) => getBestSnap(pt.x, pt.y, comps, [], 3, 0, 0)
    const snapA = snap(startPt)
    const snapB = snap(endPt)

    const wire = {
      id: genId(),
      netName: '',
      points: clean,
      style: 'solid',
      weight: 1,
      pinA: snapA.type === 'pin' ? { componentId: snapA.componentId, pinId: snapA.pinId } : null,
      pinB: snapB.type === 'pin' ? { componentId: snapB.componentId, pinId: snapB.pinId } : null,
    }
    addWire(activeDrawingId, wire)

    const needsJunction = (pt) => {
      const alreadyHas = existingJunctions.some(
        j => Math.abs(j.x - pt.x) < 0.5 && Math.abs(j.y - pt.y) < 0.5
      )
      if (alreadyHas) return false
      if (existingWires.some(w => isPointOnWireMiddle(pt.x, pt.y, w))) return true
      const sharedCount = existingWires.filter(w => {
        const ep = [w.points[0], w.points[w.points.length - 1]]
        return ep.some(e => Math.abs(e.x - pt.x) < 0.5 && Math.abs(e.y - pt.y) < 0.5)
      }).length
      return sharedCount >= 2
    }

    for (const pt of [startPt, endPt]) {
      if (needsJunction(pt)) {
        addJunction(activeDrawingId, { id: genId(), x: pt.x, y: pt.y })
      }
    }

    setWirePts([])
  }, [activeDrawingId, addWire, addJunction, setWirePts])

  // --- Event handlers ---

  const onWheel = useCallback(e => {
    e.preventDefault()
    const rect = svgRef.current.getBoundingClientRect()
    zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - rect.left, e.clientY - rect.top)
  }, [zoomAt])

  const onMouseDown = useCallback(e => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY }
    didDrag.current = false

    if (e.button === 1 || (e.button === 0 && spaceHeld.current)) {
      e.preventDefault()
      isPanning.current = true
      panStart.current = { x: e.clientX, y: e.clientY }
      const vs = useSchematicStore.getState().drawings.find(d => d.id === activeDrawingId)?.viewState || {}
      lastPan.current = { x: vs.panX || 0, y: vs.panY || 0 }
      svgRef.current.style.cursor = 'grabbing'
    }
  }, [activeDrawingId])

  const onMouseMove = useCallback(e => {
    const { sx, sy } = getSVGPos(e)

    if (mouseDownPos.current) {
      const moved = Math.abs(e.clientX - mouseDownPos.current.x) > 4 ||
                    Math.abs(e.clientY - mouseDownPos.current.y) > 4
      if (moved) didDrag.current = true
    }

    if (isPanning.current) {
      setViewState(activeDrawingId, {
        panX: lastPan.current.x + (e.clientX - panStart.current.x),
        panY: lastPan.current.y + (e.clientY - panStart.current.y),
      })
      return
    }

    // Drag-to-move items
    if (isDraggingItems.current && dragRef.current && didDrag.current) {
      const worldNow = toWorld(sx, sy, true)
      const g = useSchematicStore.getState().settings.gridSize
      const rawDx = worldNow.x - dragRef.current.startWorld.x
      const rawDy = worldNow.y - dragRef.current.startWorld.y
      setDragDelta({
        dx: Math.round(rawDx / g) * g,
        dy: Math.round(rawDy / g) * g,
      })
      return
    }

    // Rubber-band selection — keep the ref updated continuously, but only show
    // (and later commit) the box once the pointer has travelled a deliberate
    // distance. This prevents trackpad click jitter from box-selecting items.
    if (isRubberBanding.current && rubberBandRef.current) {
      const worldNow = toWorld(sx, sy, false)
      rubberBandRef.current = { ...rubberBandRef.current, endWorld: worldNow }
      const start = mouseDownPos.current
      const movedPx = start
        ? Math.hypot(e.clientX - start.x, e.clientY - start.y)
        : 0
      if (movedPx > RUBBER_BAND_MIN_PX) setRubberBand({ ...rubberBandRef.current })
      return
    }

    // Callout drag preview
    if (calloutDragRef.current) {
      const worldNow = toWorld(sx, sy, true)
      calloutDragRef.current.endWorld = worldNow
      setCalloutDraft({ startWorld: calloutDragRef.current.startWorld, endWorld: worldNow })
    }

    const snapped = toWorld(sx, sy, true)
    setGhostPoint(snapped)
    onCursorMove?.(snapped)
    // Remember the raw (un-snapped) world point so a clipboard paste lands under
    // the cursor.
    lastWorldPoint.current = toWorld(sx, sy, false)

    const tool = useSchematicStore.getState().activeTool
    if (tool === 'wire') {
      const drawingState = useSchematicStore.getState().drawings.find(d => d.id === activeDrawingId)
      const comps = drawingState?.components || []
      const wires = drawingState?.wires || []
      const snap = getBestSnap(snapped.x, snapped.y, comps, wires)
      setSnapTarget(snap)
      snapTargetRef.current = snap
    } else {
      setSnapTarget(null)
      snapTargetRef.current = null
    }
  }, [activeDrawingId, getSVGPos, toWorld, setViewState, onCursorMove])

  const onMouseUp = useCallback(e => {
    const wasPanning = isPanning.current
    if (isPanning.current) {
      isPanning.current = false
      svgRef.current.style.cursor = getCursor(useSchematicStore.getState().activeTool)
    }

    // Finish callout drag — create annotation
    if (calloutDragRef.current) {
      const { startWorld, endWorld } = calloutDragRef.current
      calloutDragRef.current = null
      setCalloutDraft(null)
      const rawW = Math.abs(endWorld.x - startWorld.x)
      const rawH = Math.abs(endWorld.y - startWorld.y)
      const x = Math.min(startWorld.x, endWorld.x)
      const y = Math.min(startWorld.y, endWorld.y)
      const W = rawW < 10 ? 120 : rawW
      const H = rawH < 10 ? 60 : rawH
      const ann = { id: genId(), type: 'callout', x, y, width: W, height: H, text: '', doc: emptyDoc(), fontSize: 12 }
      pushUndo()
      addAnnotation(activeDrawingId, ann)
      setSelectedIds([ann.id])
      setRichEdit({ annotationId: ann.id, worldX: x, worldY: y, width: W, height: H, doc: ann.doc, fixedSize: true, isNew: true })
      setActiveTool('select')
      mouseDownPos.current = null
      // Leave didDrag.current as-is so onClick bails if a drag occurred
      return
    }

    // Commit drag-to-move
    if (isDraggingItems.current) {
      isDraggingItems.current = false
      if (didDrag.current && dragRef.current) {
        const { dx, dy } = dragDelta
        if ((dx !== 0 || dy !== 0) && activeDrawingId) {
          moveItems(
            activeDrawingId,
            dragRef.current.compIds,
            dragRef.current.wireIds,
            dragRef.current.annotationIds || [],
            dx, dy,
            dragRef.current.imageIds || []
          )
        }
      }
      dragRef.current = null
      setDragDelta({ dx: 0, dy: 0 })
      mouseDownPos.current = null
      // Leave didDrag.current as-is so onClick bails if a drag occurred
      return
    }

    // Commit rubber-band selection
    if (isRubberBanding.current) {
      isRubberBanding.current = false
      const rb = rubberBandRef.current
      const start = mouseDownPos.current
      const movedPx = start
        ? Math.hypot(e.clientX - start.x, e.clientY - start.y)
        : 0
      // Only box-select if the pointer travelled a deliberate distance. A small
      // jitter during a click (common on trackpads) is treated as a plain click
      // that clears the selection — not an accidental multi-select.
      if (rb && movedPx > RUBBER_BAND_MIN_PX) {
        const minX = Math.min(rb.startWorld.x, rb.endWorld.x)
        const maxX = Math.max(rb.startWorld.x, rb.endWorld.x)
        const minY = Math.min(rb.startWorld.y, rb.endWorld.y)
        const maxY = Math.max(rb.startWorld.y, rb.endWorld.y)
        const dr = useSchematicStore.getState().drawings.find(d => d.id === activeDrawingId)
        const inside = []
        for (const c of (dr?.components || [])) {
          if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY) inside.push(c.id)
        }
        for (const w of (dr?.wires || [])) {
          if (w.points.every(p => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY))
            inside.push(w.id)
        }
        for (const a of (dr?.annotations || [])) {
          if (a.type === 'text') {
            if (a.x >= minX && a.x <= maxX && a.y >= minY && a.y <= maxY) inside.push(a.id)
          } else if (a.type === 'callout') {
            const aw = a.width || 120, ah = a.height || 60
            if (a.x >= minX && a.x + aw <= maxX && a.y >= minY && a.y + ah <= maxY) inside.push(a.id)
          }
        }
        // Images: fully-enclosed (and not locked) by the band.
        for (const im of (dr?.images || [])) {
          if (im.locked) continue
          if (im.x >= minX && im.x + im.width <= maxX && im.y >= minY && im.y + im.height <= maxY)
            inside.push(im.id)
        }
        if (inside.length > 0) setSelectedIds(inside)
        else clearSelection()
        // Real drag occurred: keep didDrag true so onClick bails and doesn't
        // clobber the rubber-band result.
      } else {
        // Treat as a plain click on empty canvas → clear selection.
        clearSelection()
        didDrag.current = false
      }
      rubberBandRef.current = null
      setRubberBand(null)
      mouseDownPos.current = null
      return
    }

    if (wasPanning || didDrag.current) {
      mouseDownPos.current = null
      return
    }
    mouseDownPos.current = null
  }, [activeDrawingId, dragDelta, moveItems, setSelectedIds, clearSelection, pushUndo, addAnnotation])

  const onMouseLeave = useCallback(() => {
    if (isPanning.current) isPanning.current = false
    setGhostPoint(null)
    setSnapTarget(null)
    snapTargetRef.current = null
  }, [])

  // Main click handler
  const onClick = useCallback(e => {
    if (didDrag.current) return
    const { sx, sy } = getSVGPos(e)
    const snapped = toWorld(sx, sy, true)
    const state = useSchematicStore.getState()
    const tool = state.activeTool

    if (tool === 'place' && state.placingComponentType) {
      if (e.detail === 1) {
        const def = getAnyDef(state.placingComponentType)
        if (def && state.activeDrawingId) {
          addComponent(state.activeDrawingId, state.placingComponentType, snapped.x, snapped.y, def)
        }
      }
      return
    }

    if (tool === 'box') {
      if (e.detail === 1 && state.activeDrawingId) {
        pushUndo()
        const id = addBox(state.activeDrawingId, snapped.x, snapped.y)
        if (id) setSelectedIds([id])
        setActiveTool('select')
      }
      return
    }

    if (tool === 'wire') {
      const snap = snapTargetRef.current || { type: 'grid', x: snapped.x, y: snapped.y }
      const target = { x: snap.x, y: snap.y }
      const isHardSnap = snap.type === 'pin' || snap.type === 'wire'

      if (e.detail >= 2) {
        const clean = dedupPoints(wirePointsRef.current)
        finishWire(clean)
        return
      }

      const prev = wirePointsRef.current
      if (prev.length === 0) {
        setWirePts([target])
        return
      }
      const last = prev[prev.length - 1]
      const routed = routeWire(last, target)
      const newPts = routed.slice(1)
      const next = [...prev, ...newPts]
      if (isHardSnap && next.length >= 2) {
        finishWire(next)
        return
      }
      setWirePts(next)
      return
    }

    if (tool === 'text') {
      const ann = {
        id: genId(),
        type: 'text',
        x: snapped.x,
        y: snapped.y,
        text: '',
        doc: emptyDoc(),
        fontSize: 14,
      }
      pushUndo()
      addAnnotation(state.activeDrawingId, ann)
      setSelectedIds([ann.id])
      setRichEdit({
        annotationId: ann.id,
        worldX: snapped.x,
        worldY: snapped.y - 14,
        doc: ann.doc,
        fixedSize: false,
        isNew: true,
      })
      return
    }

    if (tool === 'callout') {
      // handled by onMouseUp for drag; this handles click-without-drag
      return
    }

    if (tool === 'select') {
      // Click on empty canvas — clear selection. Images are pointer-transparent
      // (ImageLayer), so a click that landed on an image bubbles here; the
      // mousedown image-pick already set the selection, so don't clear it. Match
      // the mousedown pick exactly (incl. Alt = include locked).
      const wpt = toWorld(sx, sy, false)
      const dr = state.drawings.find(d => d.id === state.activeDrawingId)
      if (topImageAt(dr?.images || [], wpt.x, wpt.y, { includeLocked: e.altKey })) return
      clearSelection()
    }
  }, [activeDrawingId, getSVGPos, toWorld, addComponent, addBox, setActiveTool, setSelectedIds, finishWire, clearSelection, pushUndo, addAnnotation])

  // Unified drag starter for components, wires, annotations, and images
  const startDrag = useCallback((id, e, alwaysDraggable = false) => {
    const tool = useSchematicStore.getState().activeTool
    // Components/wires only drag in select mode; annotations & images always do
    if (!alwaysDraggable && tool !== 'select') return
    e.stopPropagation()
    const { sx, sy } = getSVGPos(e)
    const worldStart = toWorld(sx, sy, true)
    const state = useSchematicStore.getState()
    const currentSelected = state.selectedIds

    let dragIds
    if (currentSelected.includes(id)) {
      dragIds = currentSelected
    } else {
      if (e.shiftKey) {
        useSchematicStore.getState().addToSelection(id)
        dragIds = [...currentSelected, id]
      } else {
        useSchematicStore.getState().setSelectedIds([id])
        dragIds = [id]
      }
    }

    const dr = state.drawings.find(d => d.id === activeDrawingId)
    const compIds = (dr?.components || []).filter(c => dragIds.includes(c.id)).map(c => c.id)
    const wireIds = (dr?.wires || []).filter(w => dragIds.includes(w.id)).map(w => w.id)
    const annotationIds = (dr?.annotations || []).filter(a => dragIds.includes(a.id)).map(a => a.id)
    const imageIds = (dr?.images || []).filter(im => dragIds.includes(im.id)).map(im => im.id)

    dragRef.current = { compIds, wireIds, annotationIds, imageIds, startWorld: worldStart }
    isDraggingItems.current = true
    mouseDownPos.current = { x: e.clientX, y: e.clientY }
    didDrag.current = false
  }, [activeDrawingId, getSVGPos, toWorld])

  // Interactive components no longer change state when clicked directly — clicking
  // just selects them, and a floating control (InteractiveControl) appears above
  // the selected component for actually changing state. This keeps select/drag and
  // state-change as distinct gestures.
  const handleComponentMouseDown = useCallback((id, e) => {
    startDrag(id, e, false)
  }, [startDrag])
  const handleAnnotationMouseDown = useCallback((id, e) => startDrag(id, e, true), [startDrag])
  // Images: select on click (unless locked — locked images get pointer-events:none
  // in ImageLayer so this never fires for them), drag like an annotation.
  const handleImageMouseDown = useCallback((id, e) => startDrag(id, e, true), [startDrag])
  const handleImageClick = useCallback((id, e) => {
    if (isDraggingItems.current) return
    setActiveTool('select')
    if (e?.shiftKey) addToSelection(id)
    else setSelectedIds([id])
  }, [setActiveTool, setSelectedIds, addToSelection])

  // Begin dragging an image resize handle. Math lives in imageUtils.resizeBox;
  // here we only translate pointer movement into world dx/dy and snap on commit.
  const startImageResize = useCallback((imageId, handle, e) => {
    e.stopPropagation()
    e.preventDefault()
    const dr = useSchematicStore.getState().drawings.find(d => d.id === activeDrawingId)
    const img = (dr?.images || []).find(im => im.id === imageId)
    if (!img) return
    const startBox = { x: img.x, y: img.y, width: img.width, height: img.height }
    const z = dr.viewState?.zoom || 1
    const startClient = { x: e.clientX, y: e.clientY }
    // `lastBox` on the ref is the source of truth for the commit, so we don't
    // run side effects inside a setState updater.
    resizeRef.current = { imageId, handle, startBox, z, startClient, lastBox: startBox }
    setResizeBoxState({ imageId, box: startBox })

    const onMove = (ev) => {
      const r = resizeRef.current
      if (!r) return
      const dx = (ev.clientX - r.startClient.x) / r.z
      const dy = (ev.clientY - r.startClient.y) / r.z
      const box = resizeBox(r.startBox, r.handle, dx, dy, ev.shiftKey)
      r.lastBox = box
      setResizeBoxState({ imageId: r.imageId, box })
    }
    const onUp = () => {
      const r = resizeRef.current
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      resizeRef.current = null
      setResizeBoxState(null)
      if (r) {
        const { gridSize, snapToGrid } = useSchematicStore.getState().settings
        const out = snapToGrid ? snapBox(r.lastBox, gridSize) : r.lastBox
        pushUndo()
        updateImage(activeDrawingId, r.imageId, out)
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [activeDrawingId, pushUndo, updateImage])

  // Begin dragging a text-annotation resize handle (Stage 10). The gesture works
  // on the rendered OUTER box (textOuterBox); on commit we invert it back to the
  // annotation's {x,y,width,height} via outerBoxToAnnotation — making the text a
  // fixed-size wrapping box.
  const startTextResize = useCallback((annId, handle, e) => {
    e.stopPropagation()
    e.preventDefault()
    const dr = useSchematicStore.getState().drawings.find(d => d.id === activeDrawingId)
    const ann = (dr?.annotations || []).find(a => a.id === annId)
    if (!ann) return
    const plain = docToPlain(ann.doc || plainToDoc(ann.text || ''))
    const startBox = textOuterBox(ann, plain)
    const z = dr.viewState?.zoom || 1
    const startClient = { x: e.clientX, y: e.clientY }
    textResizeRef.current = { annId, handle, startBox, z, startClient, lastBox: startBox, ann }

    const onMove = (ev) => {
      const r = textResizeRef.current
      if (!r) return
      const dx = (ev.clientX - r.startClient.x) / r.z
      const dy = (ev.clientY - r.startClient.y) / r.z
      const box = resizeBox(r.startBox, r.handle, dx, dy, false)
      r.lastBox = box
      setTextResizeState({ annId: r.annId, patch: outerBoxToAnnotation(box, r.ann) })
    }
    const onUp = () => {
      const r = textResizeRef.current
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      textResizeRef.current = null
      setTextResizeState(null)
      if (r) {
        pushUndo()
        updateAnnotation(activeDrawingId, r.annId, outerBoxToAnnotation(r.lastBox, r.ann))
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [activeDrawingId, pushUndo, updateAnnotation])

  // Begin dragging a box resize handle. Box geometry math lives in
  // boxComponent.resizeBoxGeometry (grid-snap + min-size); the box's stored x/y
  // is its CENTER, so we convert to a top-left box for the gesture, then back to
  // center on commit and let updateBox re-derive pins + reattach wires.
  const startBoxResize = useCallback((boxId, handle, e) => {
    e.stopPropagation()
    e.preventDefault()
    const dr = useSchematicStore.getState().drawings.find(d => d.id === activeDrawingId)
    const comp = (dr?.components || []).find(c => c.id === boxId)
    if (!comp || comp.type !== 'box') return
    const w = comp.box.width, h = comp.box.height
    const startBox = { x: comp.x - w / 2, y: comp.y - h / 2, width: w, height: h }
    const z = dr.viewState?.zoom || 1
    const startClient = { x: e.clientX, y: e.clientY }
    boxResizeRef.current = { boxId, handle, startBox, z, startClient, lastBox: startBox }
    setBoxResizeState({ boxId, box: startBox })

    const onMove = (ev) => {
      const r = boxResizeRef.current
      if (!r) return
      const dx = (ev.clientX - r.startClient.x) / r.z
      const dy = (ev.clientY - r.startClient.y) / r.z
      // Live preview is un-snapped for smoothness; snap happens on commit.
      const box = resizeBox(r.startBox, r.handle, dx, dy, ev.shiftKey)
      r.lastBox = box
      setBoxResizeState({ boxId: r.boxId, box })
    }
    const onUp = () => {
      const r = boxResizeRef.current
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      boxResizeRef.current = null
      setBoxResizeState(null)
      if (r) {
        const { gridSize, snapToGrid } = useSchematicStore.getState().settings
        const grid = snapToGrid ? gridSize : 0
        // Snap width/height to grid multiples (floor at the min box size).
        const snappedW = grid > 0 ? Math.max(10, Math.round(r.lastBox.width / grid) * grid) : Math.max(10, r.lastBox.width)
        const snappedH = grid > 0 ? Math.max(10, Math.round(r.lastBox.height / grid) * grid) : Math.max(10, r.lastBox.height)
        // New center = top-left + half new size, with the moved corner anchored.
        const cx = r.lastBox.x + snappedW / 2
        const cy = r.lastBox.y + snappedH / 2
        pushUndo()
        // Move the component origin to the new center, then update box size (which
        // recomputes pins + reattaches wires).
        updateComponent(activeDrawingId, r.boxId, {
          x: grid > 0 ? Math.round(cx / grid) * grid : cx,
          y: grid > 0 ? Math.round(cy / grid) * grid : cy,
        })
        updateBox(activeDrawingId, r.boxId, { width: snappedW, height: snappedH })
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [activeDrawingId, pushUndo, updateBox, updateComponent])

  const handleComponentClick = useCallback((id, e) => {
    if (isDraggingItems.current) return
    if (activeTool !== 'select') return
    if (e?.shiftKey) {
      addToSelection(id)
    } else {
      setSelectedIds([id])
    }
  }, [activeTool, setSelectedIds, addToSelection])

  // ── Floating-control state-change handlers ────────────────────────────────
  // Toggle switches / cycle DCVs — works whether or not the sim is running.
  const handleControlToggle = useCallback((id) => {
    const { drawings, activeDrawingId: adId } = useSchematicStore.getState()
    const dr = drawings.find(d => d.id === adId)
    const comp = dr?.components.find(c => c.id === id)
    if (!comp) return
    if (TOGGLE_TYPES.has(comp.type)) {
      toggleSwitch(id, comp.type, comp.simParams?.position)
    } else if (MANUAL_DCV_TYPES.has(comp.type)) {
      // Phase 12: while running, skip if DCV is solenoid-linked (the electrical
      // solenoid controls it instead).
      const isSolenoidLinked = isRunning && comp.simParams?.actuation === 'solenoid'
        && comp.simParams?.linkedDesignator
      if (!isSolenoidLinked) shiftDCV(id, comp.type)
    }
  }, [isRunning, toggleSwitch, shiftDCV])

  // Press-and-hold a momentary button; release on global mouseup.
  const handleControlPress = useCallback((id) => {
    pressButton(id)
    const onUp = () => { releaseButton(id); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mouseup', onUp)
  }, [pressButton, releaseButton])

  const handleAnnotationClick = useCallback((id, e) => {
    // Annotations are always clickable — switch to select and pick it
    setActiveTool('select')
    if (e?.shiftKey) {
      addToSelection(id)
    } else {
      setSelectedIds([id])
    }
  }, [setActiveTool, setSelectedIds, addToSelection])

  const handleAnnotationDoubleClick = useCallback((id, e) => {
    const state = useSchematicStore.getState()
    const dr = state.drawings.find(d => d.id === activeDrawingId)
    const ann = (dr?.annotations || []).find(a => a.id === id)
    if (!ann) return
    const doc = ann.doc || plainToDoc(ann.text || '')
    setRichEdit({
      annotationId: id,
      worldX: ann.x,
      worldY: ann.type === 'callout' ? ann.y : ann.y - (ann.fontSize || 14),
      width: ann.type === 'callout' ? (ann.width || 120) : undefined,
      height: ann.type === 'callout' ? (ann.height || 60) : undefined,
      doc,
      fixedSize: ann.type === 'callout',
      isNew: false,
    })
  }, [activeTool, activeDrawingId])

  // Double-clicking a box opens the rich-text editor on its label, sized to the
  // box interior. Commit/cancel route to updateBox (boxId branch in commitRichEdit).
  const handleComponentDoubleClick = useCallback((id, e) => {
    const state = useSchematicStore.getState()
    const dr = state.drawings.find(d => d.id === activeDrawingId)
    const comp = (dr?.components || []).find(c => c.id === id)
    if (!comp || comp.type !== 'box') return
    const w = comp.box?.width || 80
    const h = comp.box?.height || 60
    setRichEdit({
      boxId: id,
      worldX: comp.x - w / 2 + 4,
      worldY: comp.y - h / 2 + 4,
      width: w - 8,
      height: h - 8,
      doc: comp.box?.doc || emptyDoc(),
      fixedSize: true,
      isNew: false,
    })
  }, [activeDrawingId])

  const handleWireClick = useCallback((id, e) => {
    if (activeTool !== 'select') return
    if (e?.shiftKey) {
      addToSelection(id)
    } else {
      setSelectedIds([id])
    }
  }, [activeTool, setSelectedIds, addToSelection])

  // Title-block inline editor commit / cancel
  const commitInlineEdit = useCallback((newValue) => {
    if (!inlineEdit) return
    if (inlineEdit.titleBlockField) {
      updateTitleBlock(activeDrawingId, { [inlineEdit.titleBlockField]: newValue })
    }
    setInlineEdit(null)
  }, [inlineEdit, activeDrawingId, updateTitleBlock])

  const cancelInlineEdit = useCallback(() => {
    setInlineEdit(null)
  }, [])

  // Rich-text editor commit / cancel (text + callout annotations)
  const commitRichEdit = useCallback((doc) => {
    if (!richEdit) return
    if (richEdit.boxId) {
      // Box label edit — store the doc on the box payload.
      pushUndo()
      updateBox(activeDrawingId, richEdit.boxId, { doc })
    } else if (richEdit.isNew && isEmptyDoc(doc)) {
      // An empty new annotation is discarded (avoids stray invisible boxes).
      deleteIds(activeDrawingId, [richEdit.annotationId])
    } else {
      // updateAnnotation keeps the plain `text` mirror in sync with `doc`.
      updateAnnotation(activeDrawingId, richEdit.annotationId, { doc })
    }
    setActiveTool('select')
    setRichEdit(null)
  }, [richEdit, activeDrawingId, updateAnnotation, updateBox, deleteIds, pushUndo, setActiveTool])

  const cancelRichEdit = useCallback(() => {
    if (!richEdit) return
    if (!richEdit.boxId && richEdit.isNew) deleteIds(activeDrawingId, [richEdit.annotationId])
    setActiveTool('select')
    setRichEdit(null)
  }, [richEdit, activeDrawingId, deleteIds, setActiveTool])

  const handleTitleBlockEdit = useCallback((field, worldX, worldY, value) => {
    setInlineEdit({ titleBlockField: field, worldX, worldY, value, multiline: false, isNew: false })
  }, [])

  // Start rubber-band on canvas background mousedown (select tool, no pan)
  const onCanvasMouseDown = useCallback(e => {
    onMouseDown(e)
    if (e.button !== 0) return
    if (spaceHeld.current) return
    const tool = useSchematicStore.getState().activeTool

    if (tool === 'callout') {
      const { sx, sy } = getSVGPos(e)
      const worldStart = toWorld(sx, sy, true)
      calloutDragRef.current = { startWorld: worldStart, endWorld: worldStart }
      setCalloutDraft({ startWorld: worldStart, endWorld: worldStart })
      return
    }

    if (tool !== 'select') return
    // Only start rubber band if clicking on background (not on a component).
    // Components/annotations fire stopPropagation on their own mousedown, so this
    // fires for the background and for images (images are pointer-transparent —
    // picking is centralized here via topImageAt).
    const { sx, sy } = getSVGPos(e)
    const worldStart = toWorld(sx, sy, false)

    // Image pick (z-order-correct). Alt/Option-click includes locked images so a
    // locked image can be re-selected (and then unlocked in the Properties panel);
    // locked images are otherwise select-through.
    const dr = useSchematicStore.getState().drawings.find(d => d.id === activeDrawingId)
    const hit = topImageAt(dr?.images || [], worldStart.x, worldStart.y, { includeLocked: e.altKey })
    if (hit) {
      // Reuse the unified drag starter (selects + begins a move gesture).
      startDrag(hit.id, e, true)
      return
    }

    isRubberBanding.current = true
    rubberBandRef.current = { startWorld: worldStart, endWorld: worldStart }
    setRubberBand({ startWorld: worldStart, endWorld: worldStart })
  }, [onMouseDown, getSVGPos, toWorld, activeDrawingId, startDrag])

  // Cursor style
  useEffect(() => {
    if (svgRef.current) svgRef.current.style.cursor = getCursor(activeTool)
  }, [activeTool])

  // Compute effective components (with drag offset applied)
  const isDraggingNow = isDraggingItems.current && didDrag.current
  const effectiveComponents = (drawing?.components || []).map(c => {
    if (isDraggingNow && dragRef.current?.compIds.includes(c.id)) {
      return { ...c, x: c.x + dragDelta.dx, y: c.y + dragDelta.dy }
    }
    // Live box-resize preview: top-left box → center + size, without committing.
    if (boxResizeState && boxResizeState.boxId === c.id && c.type === 'box') {
      const b = boxResizeState.box
      return {
        ...c,
        x: b.x + b.width / 2,
        y: b.y + b.height / 2,
        box: { ...c.box, width: b.width, height: b.height },
      }
    }
    return c
  })
  const effectiveWires = (drawing?.wires || []).map(w => {
    if (isDraggingNow && dragRef.current?.wireIds.includes(w.id)) {
      return { ...w, points: w.points.map(p => ({ x: p.x + dragDelta.dx, y: p.y + dragDelta.dy })) }
    }
    return w
  })
  const effectiveAnnotations = (drawing?.annotations || []).map(a => {
    if (isDraggingNow && dragRef.current?.annotationIds?.includes(a.id)) {
      return { ...a, x: a.x + dragDelta.dx, y: a.y + dragDelta.dy }
    }
    // Live text-resize preview (Stage 10).
    if (textResizeState && textResizeState.annId === a.id) {
      return { ...a, ...textResizeState.patch }
    }
    return a
  })
  // Images carry the drag offset, plus the live resize box while a handle is dragged.
  const effectiveImages = (drawing?.images || []).map(im => {
    if (resizeBoxState && resizeBoxState.imageId === im.id) {
      return { ...im, ...resizeBoxState.box }
    }
    if (isDraggingNow && dragRef.current?.imageIds?.includes(im.id)) {
      return { ...im, x: im.x + dragDelta.dx, y: im.y + dragDelta.dy }
    }
    return im
  })

  // Resolve each component's designator side so labels dodge wires. Recomputes
  // only when components or wires actually change (not on every render), and we
  // pass the result down as a primitive string to keep PlacedComponent memoized.
  const comps = drawing?.components
  const wiresForLabels = drawing?.wires
  const labelSides = useMemo(() => {
    const map = {}
    ;(comps || []).forEach(c => {
      map[c.id] = chooseLabelSide(c, getAnyDef(c.type), wiresForLabels || [])
    })
    return map
  }, [comps, wiresForLabels])

  if (!drawing) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        No drawing open
      </div>
    )
  }

  // Virtual rendering: compute visible world rect, cull off-screen elements
  const _vw = wrapperRef.current?.clientWidth || 2000
  const _vh = wrapperRef.current?.clientHeight || 2000
  const visX = -panX / zoom, visY = -panY / zoom
  const visW = _vw / zoom, visH = _vh / zoom
  const COMP_MARGIN = 60

  const visibleComponents = effectiveComponents.filter(comp =>
    (isDraggingNow && dragRef.current?.compIds.includes(comp.id)) ||
    (comp.x + COMP_MARGIN >= visX && comp.x - COMP_MARGIN <= visX + visW &&
     comp.y + COMP_MARGIN >= visY && comp.y - COMP_MARGIN <= visY + visH)
  )
  const visibleAnnotations = effectiveAnnotations.filter(ann =>
    (isDraggingNow && dragRef.current?.annotationIds?.includes(ann.id)) ||
    (ann.x + Math.max(ann.width || 0, 120) >= visX && ann.x - 20 <= visX + visW &&
     ann.y + Math.max(ann.height || 0, 60) >= visY && ann.y - 20 <= visY + visH)
  )
  const IMG_MARGIN = 20
  const visibleImages = effectiveImages.filter(im =>
    (im.x + im.width + IMG_MARGIN >= visX && im.x - IMG_MARGIN <= visX + visW &&
     im.y + im.height + IMG_MARGIN >= visY && im.y - IMG_MARGIN <= visY + visH)
  )

  // Rubber band rect in world coords
  const rb = rubberBand
  const rbRect = rb ? {
    x: Math.min(rb.startWorld.x, rb.endWorld.x),
    y: Math.min(rb.startWorld.y, rb.endWorld.y),
    w: Math.abs(rb.endWorld.x - rb.startWorld.x),
    h: Math.abs(rb.endWorld.y - rb.startWorld.y),
  } : null

  // Callout draft rect
  const cd = calloutDraft
  const cdRect = cd ? {
    x: Math.min(cd.startWorld.x, cd.endWorld.x),
    y: Math.min(cd.startWorld.y, cd.endWorld.y),
    w: Math.max(10, Math.abs(cd.endWorld.x - cd.startWorld.x)),
    h: Math.max(10, Math.abs(cd.endWorld.y - cd.startWorld.y)),
  } : null

  // The single image (if any) that should show resize handles: exactly one
  // selected image, not locked, in select tool, not mid-rotation.
  const singleSelectedImage = (activeTool === 'select' && selectedIds.length === 1)
    ? effectiveImages.find(im => im.id === selectedIds[0] && !im.locked && !(im.rotation % 360))
    : null

  // The single box (if any) that should show resize handles: exactly one selected
  // box, in select tool, not mid-rotation. Returned as a top-left box for handle
  // placement (its stored x/y is the center).
  const singleSelectedBox = (() => {
    if (activeTool !== 'select' || selectedIds.length !== 1) return null
    const c = effectiveComponents.find(c => c.id === selectedIds[0] && c.type === 'box' && !(c.rotation % 360))
    if (!c) return null
    const w = c.box?.width || 80, h = c.box?.height || 60
    return { id: c.id, x: c.x - w / 2, y: c.y - h / 2, width: w, height: h }
  })()

  // The single text annotation (if any) that should show resize handles: exactly
  // one selected text annotation in select tool. Returns its rendered outer box.
  const singleSelectedText = (() => {
    if (activeTool !== 'select' || selectedIds.length !== 1) return null
    const a = effectiveAnnotations.find(a => a.id === selectedIds[0] && a.type === 'text')
    if (!a) return null
    const box = textOuterBox(a, docToPlain(a.doc || plainToDoc(a.text || '')))
    return { id: a.id, ...box }
  })()

  // Inline editor screen position
  const ieScreenX = inlineEdit ? inlineEdit.worldX * zoom + panX : 0
  const ieScreenY = inlineEdit ? inlineEdit.worldY * zoom + panY : 0
  // Rich-text editor screen position
  const reScreenX = richEdit ? richEdit.worldX * zoom + panX : 0
  const reScreenY = richEdit ? richEdit.worldY * zoom + panY : 0

  return (
    <div ref={wrapperRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
      <svg
        ref={svgRef}
        data-schematic
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          background: 'var(--canvas-bg)',
          display: 'block',
        }}
        onWheel={onWheel}
        onMouseDown={onCanvasMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      >
        {settings.showGrid && (
          <GridOverlay
            panX={panX} panY={panY} zoom={zoom}
            gridSize={settings.gridSize}
          />
        )}

        <g transform={`translate(${panX},${panY}) scale(${zoom})`}>
          {/* Images are backdrops: rendered first so components/wires sit on top. */}
          <ImageLayer
            images={visibleImages}
            selectedIds={selectedIds}
            zoom={zoom}
            onImageClick={handleImageClick}
            onImageMouseDown={handleImageMouseDown}
          />

          <TitleBlock
            titleBlock={drawing.titleBlock}
            onEditField={handleTitleBlockEdit}
            zoom={zoom}
          />

          <WireLayer
            wires={effectiveWires}
            junctions={drawing.junctions}
            selectedIds={selectedIds}
            onWireClick={handleWireClick}
            isRunning={isRunning}
            wireMode={activeTool === 'wire'}
          />

          <HydraulicFlowLayer wires={effectiveWires} isRunning={isRunning} />

          <MeasurementOverlay
            wires={effectiveWires}
            components={effectiveComponents}
            zoom={zoom}
          />

          {visibleComponents.map(comp => (
            <PlacedComponent
              key={comp.id}
              component={comp}
              selected={selectedIds.includes(comp.id)}
              showPins={activeTool === 'wire'}
              labelSide={labelSides[comp.id]}
              simState={componentStates[comp.id]}
              interactiveState={interactiveStates[comp.id]}
              hydSimState={hydComponentStates[comp.id]
                ? { ...hydComponentStates[comp.id], position: dcvPositions[comp.id] ?? defaultDCVPosition(comp.type) }
                : MANUAL_DCV_TYPES.has(comp.type)
                  ? { position: dcvPositions[comp.id] ?? defaultDCVPosition(comp.type) }
                  : undefined}
              isRunning={isRunning}
              resistorStyleDefault={settings.resistorStyle}
              onMouseDown={(e) => handleComponentMouseDown(comp.id, e)}
              onClick={(e) => handleComponentClick(comp.id, e)}
              onDoubleClick={(e) => handleComponentDoubleClick(comp.id, e)}
            />
          ))}

          {/* Floating state-change controls above selected interactive components */}
          {activeTool === 'select' && visibleComponents
            .filter(comp => selectedIds.includes(comp.id) && isControllable(comp.type))
            .map(comp => (
              <InteractiveControl
                key={`ctrl-${comp.id}`}
                component={comp}
                zoom={zoom}
                interactiveState={interactiveStates[comp.id]}
                dcvPosition={dcvPositions[comp.id] ?? defaultDCVPosition(comp.type)}
                onToggle={() => handleControlToggle(comp.id)}
                onPress={() => handleControlPress(comp.id)}
              />
            ))}

          <AnnotationLayer
            annotations={visibleAnnotations}
            selectedIds={selectedIds}
            zoom={zoom}
            onAnnotationClick={handleAnnotationClick}
            onAnnotationMouseDown={handleAnnotationMouseDown}
            onAnnotationDoubleClick={handleAnnotationDoubleClick}
          />

          {activeTool === 'place' && placingComponentType && ghostPoint && (
            <GhostComponent type={placingComponentType} x={ghostPoint.x} y={ghostPoint.y} />
          )}

          {activeTool === 'wire' && (
            <WireInProgress
              wirePoints={wirePoints}
              ghostPoint={ghostPoint}
              snapTarget={snapTarget}
            />
          )}

          {activeTool === 'wire' && drawing.components.map(comp =>
            (comp.pins || []).map(pin => {
              const isSnapped = snapTarget?.type === 'pin' &&
                snapTarget.componentId === comp.id && snapTarget.pinId === pin.id
              return (
                <circle
                  key={`${comp.id}-${pin.id}`}
                  cx={pin.absX ?? comp.x + pin.relX}
                  cy={pin.absY ?? comp.y + pin.relY}
                  r={isSnapped ? 4 : 3}
                  fill={isSnapped ? '#2563eb' : 'rgba(37,99,235,0.4)'}
                  stroke="#2563eb"
                  strokeWidth="0.5"
                  style={{ pointerEvents: 'none' }}
                />
              )
            })
          )}

          {/* Box pin labels (Stage 7) — always visible, drawn just inside the
              box from each labelled pin. Boxes only. */}
          {drawing.components.filter(c => c.type === 'box').map(comp =>
            (comp.pins || []).filter(p => p.label).map(pin => {
              const lp = boxPinLabelPos(pin)
              return (
                <text
                  key={`plabel-${comp.id}-${pin.id}`}
                  x={lp.x}
                  y={lp.y}
                  textAnchor={lp.anchor}
                  dominantBaseline={lp.baseline}
                  fontSize={8}
                  fill="var(--component-color)"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {pin.label}
                </text>
              )
            })
          )}

          {/* Rubber-band selection rectangle */}
          {rbRect && rbRect.w > 2 && rbRect.h > 2 && (
            <rect
              x={rbRect.x}
              y={rbRect.y}
              width={rbRect.w}
              height={rbRect.h}
              fill="rgba(37,99,235,0.06)"
              stroke="#2563eb"
              strokeWidth={1 / zoom}
              strokeDasharray={`${4 / zoom},${2 / zoom}`}
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Callout box draft ghost */}
          {cdRect && (
            <rect
              x={cdRect.x}
              y={cdRect.y}
              width={cdRect.w}
              height={cdRect.h}
              fill="rgba(37,99,235,0.06)"
              stroke="#2563eb"
              strokeWidth={1 / zoom}
              strokeDasharray={`${4 / zoom},${2 / zoom}`}
              rx={3 / zoom}
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Image resize handles — screen-space sized via 1/zoom counter-scale */}
          {singleSelectedImage && (() => {
            const im = singleSelectedImage
            const HS = 8 / zoom // handle side in world units → constant on-screen
            const pos = {
              nw: [im.x, im.y], n: [im.x + im.width / 2, im.y], ne: [im.x + im.width, im.y],
              e: [im.x + im.width, im.y + im.height / 2], se: [im.x + im.width, im.y + im.height],
              s: [im.x + im.width / 2, im.y + im.height], sw: [im.x, im.y + im.height],
              w: [im.x, im.y + im.height / 2],
            }
            const cursors = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }
            return RESIZE_HANDLES.map(h => {
              const [hx, hy] = pos[h]
              return (
                <rect
                  key={`rh-${h}`}
                  x={hx - HS / 2}
                  y={hy - HS / 2}
                  width={HS}
                  height={HS}
                  fill="var(--panel-bg)"
                  stroke="var(--selection-color)"
                  strokeWidth={1 / zoom}
                  style={{ cursor: cursors[h] }}
                  onMouseDown={(e) => startImageResize(im.id, h, e)}
                />
              )
            })
          })()}

          {/* Box resize handles (Stage 5) — same screen-space sizing as images */}
          {singleSelectedBox && (() => {
            const bx = singleSelectedBox
            const HS = 8 / zoom
            const pos = {
              nw: [bx.x, bx.y], n: [bx.x + bx.width / 2, bx.y], ne: [bx.x + bx.width, bx.y],
              e: [bx.x + bx.width, bx.y + bx.height / 2], se: [bx.x + bx.width, bx.y + bx.height],
              s: [bx.x + bx.width / 2, bx.y + bx.height], sw: [bx.x, bx.y + bx.height],
              w: [bx.x, bx.y + bx.height / 2],
            }
            const cursors = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }
            return RESIZE_HANDLES.map(h => {
              const [hx, hy] = pos[h]
              return (
                <rect
                  key={`brh-${h}`}
                  x={hx - HS / 2}
                  y={hy - HS / 2}
                  width={HS}
                  height={HS}
                  fill="var(--panel-bg)"
                  stroke="var(--selection-color)"
                  strokeWidth={1 / zoom}
                  style={{ cursor: cursors[h] }}
                  onMouseDown={(e) => startBoxResize(bx.id, h, e)}
                />
              )
            })
          })()}

          {/* Text-annotation resize handles (Stage 10) — same screen-space sizing */}
          {singleSelectedText && (() => {
            const tx = singleSelectedText
            const HS = 8 / zoom
            const pos = {
              nw: [tx.x, tx.y], n: [tx.x + tx.width / 2, tx.y], ne: [tx.x + tx.width, tx.y],
              e: [tx.x + tx.width, tx.y + tx.height / 2], se: [tx.x + tx.width, tx.y + tx.height],
              s: [tx.x + tx.width / 2, tx.y + tx.height], sw: [tx.x, tx.y + tx.height],
              w: [tx.x, tx.y + tx.height / 2],
            }
            const cursors = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }
            return RESIZE_HANDLES.map(h => {
              const [hx, hy] = pos[h]
              return (
                <rect
                  key={`trh-${h}`}
                  x={hx - HS / 2}
                  y={hy - HS / 2}
                  width={HS}
                  height={HS}
                  fill="var(--panel-bg)"
                  stroke="var(--selection-color)"
                  strokeWidth={1 / zoom}
                  style={{ cursor: cursors[h] }}
                  onMouseDown={(e) => startTextResize(tx.id, h, e)}
                />
              )
            })
          })()}
        </g>
      </svg>

      {/* Floating inline editor overlay (title-block cells) */}
      {inlineEdit && (
        <InlineEditor
          x={ieScreenX}
          y={ieScreenY}
          value={inlineEdit.value}
          fontSize={(inlineEdit.multiline ? 12 : 14) * zoom}
          multiline={inlineEdit.multiline}
          onCommit={commitInlineEdit}
          onCancel={cancelInlineEdit}
        />
      )}

      {/* Floating rich-text editor overlay (text + callout annotations) */}
      {richEdit && (
        <RichTextEditor
          x={reScreenX}
          y={reScreenY}
          width={richEdit.width}
          height={richEdit.height}
          zoom={zoom}
          doc={richEdit.doc}
          fixedSize={richEdit.fixedSize}
          onCommit={commitRichEdit}
          onCancel={cancelRichEdit}
        />
      )}
    </div>
  )
}

function getCursor(tool) {
  if (tool === 'wire') return 'crosshair'
  if (tool === 'place') return 'crosshair'
  if (tool === 'text') return 'text'
  if (tool === 'callout') return 'crosshair'
  if (tool === 'box') return 'crosshair'
  return 'default'
}
