import { create } from 'zustand'
import { computePinAbsPositions } from '../lib/utils'
import { pruneJunctions } from '../lib/wireUtils'
import { plainToDoc, docToPlain } from '../lib/richText'
import { createBox } from '../lib/boxComponent'
import { normalizeBoxImages } from '../lib/boxImages'
import {
  isRunningInTauri,
  openFileDialog, saveFileDialog,
  readTextFile, writeTextFile, writeBinaryFile, base64ToBytes,
  getRecentFiles, addRecentFile, removeRecentFile,
  basename, askConfirm,
} from '../lib/tauriFs'
import { sanitizeLoadedProject } from '../lib/projectFile'

// ─── Stage 5: unsaved-work guard ──────────────────────────────────────────────
// Pure, testable decision helper: true when any drawing has unsaved edits.
// The actual prompt (Tauri ask / browser confirm) is the thin DOM edge below.
export function hasUnsavedWork(drawings) {
  return Array.isArray(drawings) && drawings.some(d => d && d.isDirty)
}

let idCounter = 0
export const genId = () => {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `id_${uuid}`
  // Fallback for environments without crypto.randomUUID — timestamp + counter +
  // random keeps IDs unique even across reloads (no resetting global counter).
  return `id_${Date.now().toString(36)}_${(idCounter++).toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// Derive a per-side pin-count spec from a box's existing pins (by `direction`).
// Used when resizing a box so the pin layout is preserved (counts unchanged,
// positions re-spaced on the new edges).
function pinSpecFromPins(pins = []) {
  const spec = { W: 0, E: 0, N: 0, S: 0 }
  for (const p of pins) if (p.direction in spec) spec[p.direction]++
  return spec
}

function snapshotDrawing(drawing) {
  return JSON.parse(JSON.stringify({
    components: drawing.components,
    wires: drawing.wires,
    junctions: drawing.junctions,
    annotations: drawing.annotations || [],
    images: drawing.images || [],
    // v0.2.0: tables undo/redo (deep-cloned so cell RichDocs are independent).
    tables: drawing.tables || [],
  }))
}

// Backfill new-schema fields on a drawing loaded from an older file. PURELY
// ADDITIVE: every new field is backfilled with a safe default and no existing
// field is ever renamed, dropped, or reshaped — so a v1/v2/v3 file (localStorage
// AND .scpro) opens and renders identically, then gains empty defaults.
// Mutates and returns the drawing.
function migrateDrawing(d) {
  d.images ??= []
  d.folderId ??= null
  // v0.2.0 (v3 → v4): drawings gain a `tables` array.
  d.tables ??= []
  // Stage 4: text/callout annotations gain a rich-text `doc`. A legacy annotation
  // that only has a plain `text` string is migrated to `doc = plainToDoc(text)`;
  // `text` is kept in sync (= docToPlain(doc)) for back-compat search/export.
  for (const a of (d.annotations || [])) {
    if ((a.type === 'text' || a.type === 'callout') && !a.doc) {
      a.doc = plainToDoc(a.text || '')
    }
  }
  // v0.2.0 (v3 → v4): every pin gains an optional `label` (default '').
  for (const c of (d.components || [])) {
    for (const p of (c.pins || [])) {
      p.label ??= ''
    }
    // v0.2.0: a box's reference pictures live in `box.images` (panel-only). Fold
    // any legacy single `box.image` (previously drawn on the canvas) into the
    // array so old schematics keep the picture with no data loss. `box.image`
    // is left in place (additive) but is no longer rendered on the canvas.
    if (c.type === 'box' && c.box) {
      c.box.images = normalizeBoxImages(c.box)
      // v0.2.0: a box's clickable reference links live in `box.links` (panel-only).
      c.box.links ??= []
    }
  }
  return d
}

// Backfill new-schema fields on a project loaded from an older file (v2 → v3).
function migrateProject(p) {
  p.folders ??= []
  p.attachments ??= []
  return p
}

const createBlankDrawing = (name = 'Drawing 1') => ({
  id: genId(),
  name,
  type: 'electrical',
  components: [],
  wires: [],
  junctions: [],
  annotations: [],
  images: [],            // image elements (base64 data URLs) — drawn behind components
  tables: [],            // free-floating rich-text grids (v0.2.0)
  folderId: null,        // file-tree folder this drawing sits in (null = root)
  titleBlock: {
    title: name,
    drawingNumber: '',
    revision: 'A',
    author: '',
    date: new Date().toISOString().split('T')[0],
    company: '',
    visible: false,
  },
  viewState: { panX: 0, panY: 0, zoom: 1 },
  isDirty: false,
  lastSaved: null,
})

const createBlankProject = (name = 'Project 1') => {
  const drawing = createBlankDrawing('Drawing 1')
  return {
    project: {
      id: genId(),
      name,
      drawingIds: [drawing.id],
      activeDrawingId: drawing.id,
      folders: [],        // nested file-tree folders: { id, name, parentId }
      attachments: [],    // embedded sub-files: { id, name, mime, data, addedAt }
      lastSaved: null,
    },
    drawing,
  }
}

const useSchematicStore = create((set, get) => ({
  // Projects layer
  projects: [],
  activeProjectId: null,

  // Drawings — flat array across all projects
  drawings: [],
  activeDrawingId: null,

  // UI state
  selectedIds: [],
  activeTool: 'select',
  placingComponentType: null,
  clipboard: [],
  undoStack: [],
  redoStack: [],
  theme: 'light',
  settings: {
    gridSize: 10,
    snapToGrid: true,
    resistorStyle: 'IEC',
    showGrid: true,
    showCurrentValues: false,
  },
  showProjectBrowser: false,

  // File state (Phase 15 / 16)
  currentFilePath: null,       // path of the active project's file on disk
  recentFiles: [],             // recently opened file paths
  externalChangeDetected: false, // set true by file watcher when OneDrive syncs

  // Theme
  toggleTheme() {
    const newTheme = get().theme === 'light' ? 'dark' : 'light'
    set({ theme: newTheme })
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  },

  // Project browser visibility
  setShowProjectBrowser(v) { set({ showProjectBrowser: v }) },

  // Helpers
  getActiveProject() {
    const { projects, activeProjectId } = get()
    return projects.find(p => p.id === activeProjectId) || projects[0] || null
  },

  getActiveDrawing() {
    const { drawings, activeDrawingId } = get()
    return drawings.find(d => d.id === activeDrawingId) || null
  },

  getProjectDrawings(projectId) {
    const { projects, drawings } = get()
    const project = projects.find(p => p.id === projectId)
    if (!project) return []
    return project.drawingIds.map(id => drawings.find(d => d.id === id)).filter(Boolean)
  },

  updateDrawing(drawingId, updater) {
    set(state => ({
      drawings: state.drawings.map(d =>
        d.id === drawingId ? { ...d, ...updater(d), isDirty: true } : d
      ),
    }))
  },

  // ─── Project management ────────────────────────────────────────────────────

  newProject(name = 'New Project') {
    const { project, drawing } = createBlankProject(name)
    set(state => ({
      projects: [...state.projects, project],
      drawings: [...state.drawings, drawing],
      activeProjectId: project.id,
      activeDrawingId: drawing.id,
      selectedIds: [],
      undoStack: [],
      redoStack: [],
    }))
  },

  setActiveProject(id) {
    const { projects } = get()
    const project = projects.find(p => p.id === id)
    if (!project) return
    set({
      activeProjectId: id,
      activeDrawingId: project.activeDrawingId,
      selectedIds: [],
      undoStack: [],
      redoStack: [],
    })
  },

  renameProject(id, name) {
    set(state => ({
      projects: state.projects.map(p => p.id === id ? { ...p, name } : p),
    }))
  },

  deleteProject(id) {
    const { projects } = get()
    if (projects.length <= 1) return
    const project = projects.find(p => p.id === id)
    if (!project) return
    const remaining = projects.filter(p => p.id !== id)
    const next = remaining[0]
    set(state => ({
      projects: remaining,
      drawings: state.drawings.filter(d => !project.drawingIds.includes(d.id)),
      activeProjectId: next.id,
      activeDrawingId: next.activeDrawingId,
      selectedIds: [],
      undoStack: [],
      redoStack: [],
    }))
  },

  // ─── Drawing management ────────────────────────────────────────────────────

  newDrawing(folderId = null) {
    const { activeProjectId, projects, drawings } = get()
    const project = projects.find(p => p.id === activeProjectId)
    if (!project) return
    const projectDrawings = project.drawingIds.map(id => drawings.find(d => d.id === id)).filter(Boolean)
    const name = `Drawing ${projectDrawings.length + 1}`
    const drawing = createBlankDrawing(name)
    if (folderId != null) drawing.folderId = folderId
    set(state => ({
      drawings: [...state.drawings, drawing],
      projects: state.projects.map(p =>
        p.id === activeProjectId
          ? { ...p, drawingIds: [...p.drawingIds, drawing.id], activeDrawingId: drawing.id }
          : p
      ),
      activeDrawingId: drawing.id,
    }))
  },

  setActiveDrawing(id) {
    const { activeProjectId } = get()
    set(state => ({
      activeDrawingId: id,
      selectedIds: [],
      projects: state.projects.map(p =>
        p.id === activeProjectId ? { ...p, activeDrawingId: id } : p
      ),
    }))
  },

  renameDrawing(id, name) {
    set(state => ({
      drawings: state.drawings.map(d =>
        d.id === id ? { ...d, name, isDirty: true } : d
      ),
    }))
  },

  closeDrawing(id) {
    const { projects, activeProjectId, activeDrawingId } = get()
    const project = projects.find(p => p.id === activeProjectId)
    if (!project || project.drawingIds.length <= 1) return
    const idx = project.drawingIds.indexOf(id)
    const newDrawingIds = project.drawingIds.filter(did => did !== id)
    let newActiveDrawingId = activeDrawingId
    if (activeDrawingId === id) {
      newActiveDrawingId = newDrawingIds[Math.max(0, idx - 1)] || newDrawingIds[0]
    }
    set(state => ({
      drawings: state.drawings.filter(d => d.id !== id),
      projects: state.projects.map(p =>
        p.id === activeProjectId
          ? { ...p, drawingIds: newDrawingIds, activeDrawingId: newActiveDrawingId }
          : p
      ),
      activeDrawingId: newActiveDrawingId,
      selectedIds: [],
    }))
  },

  duplicateDrawing(id) {
    const { drawings, activeProjectId } = get()
    const source = drawings.find(d => d.id === id)
    if (!source) return
    const copy = {
      ...JSON.parse(JSON.stringify(source)),
      id: genId(),
      name: `${source.name} (copy)`,
      isDirty: true,
      lastSaved: null,
    }
    set(state => ({
      drawings: [...state.drawings, copy],
      projects: state.projects.map(p =>
        p.id === activeProjectId
          ? { ...p, drawingIds: [...p.drawingIds, copy.id], activeDrawingId: copy.id }
          : p
      ),
      activeDrawingId: copy.id,
    }))
  },

  // ─── Export / Import ───────────────────────────────────────────────────────

  exportDrawingJSON(drawingId) {
    const drawing = get().drawings.find(d => d.id === drawingId)
    if (!drawing) return
    const blob = new Blob([JSON.stringify(drawing, null, 2)], { type: 'application/json' })
    _download(blob, `${drawing.name}.sch`)
  },

  importDrawingJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr)
      const { activeProjectId } = get()
      const drawing = { ...data, id: genId(), isDirty: true, lastSaved: null }
      set(state => ({
        drawings: [...state.drawings, drawing],
        projects: state.projects.map(p =>
          p.id === activeProjectId
            ? { ...p, drawingIds: [...p.drawingIds, drawing.id], activeDrawingId: drawing.id }
            : p
        ),
        activeDrawingId: drawing.id,
      }))
    } catch {
      alert('Invalid drawing file — could not import.')
    }
  },

  exportProjectJSON(projectId) {
    const { projects, drawings } = get()
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    const projectDrawings = project.drawingIds.map(id => drawings.find(d => d.id === id)).filter(Boolean)
    const blob = new Blob([JSON.stringify({ ...project, drawings: projectDrawings }, null, 2)], { type: 'application/json' })
    _download(blob, `${project.name}.scpro`)
  },

  importProjectJSON(jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr)
      // Drop malformed images/attachments so a corrupt embedded payload can't
      // crash the import (mirrors the file-open path).
      const { data } = sanitizeLoadedProject(parsed)
      const drawings = (data.drawings || []).map(d => migrateDrawing({ ...d, id: genId(), isDirty: false }))
      const project = migrateProject({
        id: genId(),
        name: data.name || 'Imported Project',
        drawingIds: drawings.map(d => d.id),
        activeDrawingId: drawings[0]?.id || null,
        folders: data.folders,
        attachments: data.attachments,
        lastSaved: null,
      })
      set(state => ({
        projects: [...state.projects, project],
        drawings: [...state.drawings, ...drawings],
        activeProjectId: project.id,
        activeDrawingId: project.activeDrawingId,
        selectedIds: [],
        undoStack: [],
        redoStack: [],
      }))
    } catch {
      alert('Invalid project file — could not import.')
    }
  },

  // ─── View state (pan/zoom) ─────────────────────────────────────────────────

  setViewState(drawingId, viewState) {
    set(state => ({
      drawings: state.drawings.map(d =>
        d.id === drawingId ? { ...d, viewState: { ...d.viewState, ...viewState } } : d
      ),
    }))
  },

  // ─── Tool ─────────────────────────────────────────────────────────────────

  setActiveTool(tool) {
    set({ activeTool: tool, placingComponentType: null })
  },

  startPlacing(componentType) {
    set({ activeTool: 'place', placingComponentType: componentType })
  },

  // ─── Selection ────────────────────────────────────────────────────────────

  setSelectedIds(ids) { set({ selectedIds: ids }) },
  addToSelection(id) {
    set(state => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds
        : [...state.selectedIds, id],
    }))
  },
  clearSelection() { set({ selectedIds: [] }) },

  // ─── Wire management ──────────────────────────────────────────────────────

  addWire(drawingId, wire) {
    set(state => ({
      drawings: state.drawings.map(d =>
        d.id === drawingId ? { ...d, wires: [...d.wires, wire], isDirty: true } : d
      ),
    }))
  },

  // Patch a single wire (e.g. color/style/weight from the Properties panel).
  updateWire(drawingId, wireId, patch) {
    set(state => ({
      drawings: state.drawings.map(d => {
        if (d.id !== drawingId) return d
        return {
          ...d,
          isDirty: true,
          wires: d.wires.map(w => (w.id !== wireId ? w : { ...w, ...patch })),
        }
      }),
    }))
  },

  addJunction(drawingId, junction) {
    set(state => ({
      drawings: state.drawings.map(d =>
        d.id === drawingId ? { ...d, junctions: [...d.junctions, junction], isDirty: true } : d
      ),
    }))
  },

  // ─── Component placement ──────────────────────────────────────────────────

  addComponent(drawingId, type, x, y, def) {
    const drawing = get().drawings.find(d => d.id === drawingId)
    if (!drawing) return null
    const prefix = def.defaultDesignatorPrefix
    const count = drawing.components.filter(c => c.type === type).length
    const designator = `${prefix}${count + 1}`
    const component = {
      id: genId(),
      type,
      designator,
      value: def.defaultValue || '',
      description: '',
      x,
      y,
      rotation: 0,
      flipH: false,
      flipV: false,
      pins: def.pins.map(p => ({ ...p, absX: x + p.relX, absY: y + p.relY })),
      simParams: Object.fromEntries(
        Object.entries(def.simParams || {}).map(([k, v]) => [k, v.default ?? ''])
      ),
      simState: {},
      labelOffset: { x: 0, y: -15 },
    }
    set(state => ({
      drawings: state.drawings.map(d =>
        d.id === drawingId
          ? { ...d, components: [...d.components, component], isDirty: true }
          : d
      ),
    }))
    return component.id
  },

  // Add a component-box (Stage 5). Boxes have no library def, so they bypass
  // addComponent and are built by the pure createBox factory. Designators use a
  // 'BX' prefix; the box gets a fresh id and pin abs positions seeded at origin.
  addBox(drawingId, x, y, opts = {}) {
    const drawing = get().drawings.find(d => d.id === drawingId)
    if (!drawing) return null
    const grid = get().settings.snapToGrid ? get().settings.gridSize : 0
    const count = drawing.components.filter(c => c.type === 'box').length
    const box = createBox({ x, y, grid, designator: `BX${count + 1}`, id: genId(), ...opts })
    set(state => ({
      drawings: state.drawings.map(d =>
        d.id === drawingId
          ? { ...d, components: [...d.components, box], isDirty: true }
          : d
      ),
    }))
    return box.id
  },

  // Update a box's `box` payload (size/doc/fill/stroke/cornerRadius/pin spec).
  // When width/height/pinSpec change, pins are recomputed from the new geometry
  // and their absolute positions re-derived from the component transform, then
  // bound wires are re-attached so they follow the moved pins.
  updateBox(drawingId, componentId, boxPatch, pinSpec = null) {
    set(state => ({
      drawings: state.drawings.map(d => {
        if (d.id !== drawingId) return d
        let updated = null
        const components = d.components.map(c => {
          if (c.id !== componentId || c.type !== 'box') return c
          const nextBox = { ...c.box, ...boxPatch }
          let pins = c.pins
          // Geometry or pin-count change ⇒ rebuild pins on the edges. When no
          // explicit pinSpec is given (e.g. a resize), preserve the current
          // per-side counts derived from the existing pins.
          if (pinSpec || boxPatch.width != null || boxPatch.height != null) {
            const spec = pinSpec || pinSpecFromPins(c.pins)
            const rebuilt = createBox({
              x: c.x, y: c.y,
              width: nextBox.width, height: nextBox.height,
              pinSpec: spec,
              grid: get().settings.snapToGrid ? get().settings.gridSize : 0,
            })
            pins = computePinAbsPositions(rebuilt.pins, c.x, c.y, c.rotation || 0, c.flipH, c.flipV)
          }
          updated = { ...c, box: nextBox, pins }
          return updated
        })
        return {
          ...d,
          isDirty: true,
          components,
          wires: updated ? get()._reattachWires(d.wires, updated) : d.wires,
        }
      }),
    }))
  },

  updateComponent(drawingId, componentId, patch) {
    set(state => ({
      drawings: state.drawings.map(d => {
        if (d.id !== drawingId) return d
        return {
          ...d,
          isDirty: true,
          components: d.components.map(c =>
            c.id !== componentId ? c : { ...c, ...patch }
          ),
        }
      }),
    }))
  },

  updateComponentSimParam(drawingId, componentId, key, value) {
    set(state => ({
      drawings: state.drawings.map(d => {
        if (d.id !== drawingId) return d
        return {
          ...d,
          isDirty: true,
          components: d.components.map(c =>
            c.id !== componentId ? c : { ...c, simParams: { ...c.simParams, [key]: value } }
          ),
        }
      }),
    }))
  },

  // ─── Settings ─────────────────────────────────────────────────────────────

  updateSettings(patch) {
    set(state => ({ settings: { ...state.settings, ...patch } }))
  },

  // ─── Undo / Redo ──────────────────────────────────────────────────────────

  pushUndo() {
    const { activeDrawingId, drawings } = get()
    const drawing = drawings.find(d => d.id === activeDrawingId)
    if (!drawing) return
    set(state => ({
      undoStack: [
        ...state.undoStack.slice(-49),
        { drawingId: activeDrawingId, snapshot: snapshotDrawing(drawing) },
      ],
      redoStack: [],
    }))
  },

  undo() {
    const { undoStack, drawings } = get()
    if (undoStack.length === 0) return
    const { drawingId, snapshot } = undoStack[undoStack.length - 1]
    const drawing = drawings.find(d => d.id === drawingId)
    if (!drawing) return
    const current = snapshotDrawing(drawing)
    set(state => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack.slice(-49), { drawingId, snapshot: current }],
      drawings: state.drawings.map(d =>
        d.id === drawingId ? { ...d, ...snapshot, isDirty: true } : d
      ),
      selectedIds: [],
    }))
  },

  redo() {
    const { redoStack, drawings } = get()
    if (redoStack.length === 0) return
    const { drawingId, snapshot } = redoStack[redoStack.length - 1]
    const drawing = drawings.find(d => d.id === drawingId)
    if (!drawing) return
    const current = snapshotDrawing(drawing)
    set(state => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack.slice(-49), { drawingId, snapshot: current }],
      drawings: state.drawings.map(d =>
        d.id === drawingId ? { ...d, ...snapshot, isDirty: true } : d
      ),
      selectedIds: [],
    }))
  },

  // ─── Move / Rotate / Flip / Delete ────────────────────────────────────────

  // After a component's pins move (rotate/flip), drag the endpoints of any wires
  // bound to those pins so they stay attached. points[0] follows pinA,
  // points[last] follows pinB.
  _reattachWires(wires, comp) {
    const pinPos = {}
    for (const p of comp.pins) pinPos[p.id] = { x: p.absX, y: p.absY }
    return wires.map(w => {
      const aPin = w.pinA?.componentId === comp.id ? pinPos[w.pinA.pinId] : null
      const bPin = w.pinB?.componentId === comp.id ? pinPos[w.pinB.pinId] : null
      if (!aPin && !bPin) return w
      const points = w.points.map((pt, i) => {
        if (aPin && i === 0) return { ...pt, ...aPin }
        if (bPin && i === w.points.length - 1) return { ...pt, ...bPin }
        return pt
      })
      return { ...w, points }
    })
  },

  // `imageIds` was appended (default []) so existing 6-arg callers keep working;
  // `tableIds` is appended last (default []) for the same reason (v0.2.0).
  moveItems(drawingId, compIds, wireIds, annotationIds, dx, dy, imageIds = [], tableIds = []) {
    get().pushUndo()
    set(state => ({
      drawings: state.drawings.map(d => {
        if (d.id !== drawingId) return d
        return {
          ...d,
          isDirty: true,
          components: d.components.map(c =>
            compIds.includes(c.id)
              ? {
                  ...c,
                  x: c.x + dx,
                  y: c.y + dy,
                  pins: c.pins.map(p => ({ ...p, absX: p.absX + dx, absY: p.absY + dy })),
                }
              : c
          ),
          wires: d.wires.map(w =>
            wireIds.includes(w.id)
              ? { ...w, points: w.points.map(p => ({ x: p.x + dx, y: p.y + dy })) }
              : w
          ),
          annotations: (d.annotations || []).map(a =>
            (annotationIds || []).includes(a.id) ? { ...a, x: a.x + dx, y: a.y + dy } : a
          ),
          images: (d.images || []).map(img =>
            (imageIds || []).includes(img.id) ? { ...img, x: img.x + dx, y: img.y + dy } : img
          ),
          tables: (d.tables || []).map(t =>
            (tableIds || []).includes(t.id) ? { ...t, x: t.x + dx, y: t.y + dy } : t
          ),
        }
      }),
    }))
  },

  rotateComponent(drawingId, id, delta = 90) {
    get().pushUndo()
    set(state => ({
      drawings: state.drawings.map(d => {
        if (d.id !== drawingId) return d
        let rotated = null
        const components = d.components.map(c => {
          if (c.id !== id) return c
          const newRot = ((c.rotation || 0) + delta + 360) % 360
          rotated = {
            ...c,
            rotation: newRot,
            pins: computePinAbsPositions(c.pins, c.x, c.y, newRot, c.flipH, c.flipV),
          }
          return rotated
        })
        return {
          ...d,
          isDirty: true,
          components,
          wires: rotated ? get()._reattachWires(d.wires, rotated) : d.wires,
        }
      }),
    }))
  },

  flipComponent(drawingId, id, axis) {
    get().pushUndo()
    set(state => ({
      drawings: state.drawings.map(d => {
        if (d.id !== drawingId) return d
        let flipped = null
        const components = d.components.map(c => {
          if (c.id !== id) return c
          const newFlipH = axis === 'H' ? !c.flipH : c.flipH
          const newFlipV = axis === 'V' ? !c.flipV : c.flipV
          flipped = {
            ...c,
            flipH: newFlipH,
            flipV: newFlipV,
            pins: computePinAbsPositions(c.pins, c.x, c.y, c.rotation || 0, newFlipH, newFlipV),
          }
          return flipped
        })
        return {
          ...d,
          isDirty: true,
          components,
          wires: flipped ? get()._reattachWires(d.wires, flipped) : d.wires,
        }
      }),
    }))
  },

  deleteIds(drawingId, ids) {
    if (ids.length === 0) return
    get().pushUndo()
    set(state => ({
      drawings: state.drawings.map(d => {
        if (d.id !== drawingId) return d
        const wires = d.wires.filter(w => !ids.includes(w.id))
        return {
          ...d,
          isDirty: true,
          components: d.components.filter(c => !ids.includes(c.id)),
          wires,
          // Drop explicitly-deleted junctions, then prune any that are no longer
          // real nodes because the wires meeting there were removed.
          junctions: pruneJunctions(
            d.junctions.filter(j => !ids.includes(j.id)),
            wires
          ),
          annotations: (d.annotations || []).filter(a => !ids.includes(a.id)),
          images: (d.images || []).filter(img => !ids.includes(img.id)),
          tables: (d.tables || []).filter(t => !ids.includes(t.id)),
        }
      }),
      selectedIds: [],
    }))
  },

  // ─── Copy / Paste ─────────────────────────────────────────────────────────

  copyToClipboard(drawingId, ids) {
    const drawing = get().drawings.find(d => d.id === drawingId)
    if (!drawing) return
    const components = drawing.components.filter(c => ids.includes(c.id))
    const wires = drawing.wires.filter(w => ids.includes(w.id))
    const annotations = (drawing.annotations || []).filter(a => ids.includes(a.id))
    const images = (drawing.images || []).filter(img => ids.includes(img.id))
    const tables = (drawing.tables || []).filter(t => ids.includes(t.id))
    set({ clipboard: JSON.parse(JSON.stringify({ components, wires, annotations, images, tables })) })
  },

  pasteFromClipboard(drawingId) {
    const { clipboard } = get()
    if (!clipboard) return
    const { components = [], wires = [], annotations = [], images = [], tables = [] } = clipboard
    if (!components.length && !wires.length && !annotations.length && !images.length && !tables.length) return
    get().pushUndo()
    const OFFSET = 20
    const idMap = {}
    // Deep-clone every pasted item so nested objects (a box's `box`/images/fields/
    // links, a component's `doc`/simParams, a table's cells) are fully independent.
    // Without this, pasting one clipboard twice yields items sharing nested
    // references, so a later edit to one leaks into the other (the "image applied
    // to both devices" bug).
    const clone = (o) => JSON.parse(JSON.stringify(o))
    const newComps = components.map(orig => {
      const c = clone(orig)
      const newId = genId()
      idMap[c.id] = newId
      return {
        ...c,
        id: newId,
        x: c.x + OFFSET,
        y: c.y + OFFSET,
        pins: (c.pins || []).map(p => ({ ...p, absX: p.absX + OFFSET, absY: p.absY + OFFSET })),
      }
    })
    const newWires = wires.map(orig => {
      const w = clone(orig)
      return {
        ...w,
        id: genId(),
        points: w.points.map(p => ({ x: p.x + OFFSET, y: p.y + OFFSET })),
        pinA: w.pinA ? { ...w.pinA, componentId: idMap[w.pinA.componentId] ?? w.pinA.componentId } : null,
        pinB: w.pinB ? { ...w.pinB, componentId: idMap[w.pinB.componentId] ?? w.pinB.componentId } : null,
      }
    })
    const newAnnotations = annotations.map(orig => ({ ...clone(orig), id: genId(), x: orig.x + OFFSET, y: orig.y + OFFSET }))
    const newImages = images.map(orig => ({ ...clone(orig), id: genId(), x: orig.x + OFFSET, y: orig.y + OFFSET }))
    const newTables = tables.map(orig => ({ ...clone(orig), id: genId(), x: orig.x + OFFSET, y: orig.y + OFFSET }))
    const newIds = [
      ...newComps.map(c => c.id),
      ...newWires.map(w => w.id),
      ...newAnnotations.map(a => a.id),
      ...newImages.map(img => img.id),
      ...newTables.map(t => t.id),
    ]
    set(state => ({
      drawings: state.drawings.map(d =>
        d.id !== drawingId
          ? d
          : {
              ...d,
              isDirty: true,
              components: [...d.components, ...newComps],
              wires: [...d.wires, ...newWires],
              annotations: [...(d.annotations || []), ...newAnnotations],
              images: [...(d.images || []), ...newImages],
              tables: [...(d.tables || []), ...newTables],
            }
      ),
      selectedIds: newIds,
    }))
  },

  // ─── Annotations ──────────────────────────────────────────────────────────

  addAnnotation(drawingId, annotation) {
    set(state => ({
      drawings: state.drawings.map(d =>
        d.id === drawingId
          ? { ...d, annotations: [...(d.annotations || []), annotation], isDirty: true }
          : d
      ),
    }))
  },

  updateAnnotation(drawingId, annotationId, patch) {
    set(state => ({
      drawings: state.drawings.map(d => {
        if (d.id !== drawingId) return d
        return {
          ...d,
          isDirty: true,
          annotations: (d.annotations || []).map(a => {
            if (a.id !== annotationId) return a
            const next = { ...a, ...patch }
            // Keep the plain `text` mirror in sync whenever the rich `doc` changes
            // so search/export and any legacy `.text` reader stays correct.
            if (patch.doc) next.text = docToPlain(patch.doc)
            return next
          }),
        }
      }),
    }))
  },

  updateTitleBlock(drawingId, patch) {
    set(state => ({
      drawings: state.drawings.map(d =>
        d.id !== drawingId ? d : {
          ...d,
          isDirty: true,
          titleBlock: { ...d.titleBlock, ...patch },
        }
      ),
    }))
  },

  // ─── Images ───────────────────────────────────────────────────────────────

  addImage(drawingId, image) {
    const img = { rotation: 0, opacity: 1, locked: false, ...image, id: image.id || genId() }
    set(state => ({
      drawings: state.drawings.map(d =>
        d.id === drawingId
          ? { ...d, images: [...(d.images || []), img], isDirty: true }
          : d
      ),
    }))
    return img.id
  },

  updateImage(drawingId, imageId, patch) {
    set(state => ({
      drawings: state.drawings.map(d => {
        if (d.id !== drawingId) return d
        return {
          ...d,
          isDirty: true,
          images: (d.images || []).map(img =>
            img.id !== imageId ? img : { ...img, ...patch }
          ),
        }
      }),
    }))
  },

  removeImage(drawingId, imageId) {
    set(state => ({
      drawings: state.drawings.map(d =>
        d.id !== drawingId ? d : {
          ...d,
          isDirty: true,
          images: (d.images || []).filter(img => img.id !== imageId),
        }
      ),
    }))
  },

  // ─── Tables (v0.2.0) ──────────────────────────────────────────────────────
  // Free-floating rich-text grids in drawing.tables[]. Table objects are built
  // by the pure tableModel.js helpers; the store just owns the array + dirty flag.

  addTable(drawingId, table) {
    const t = { ...table, id: table.id || genId() }
    set(state => ({
      drawings: state.drawings.map(d =>
        d.id === drawingId
          ? { ...d, tables: [...(d.tables || []), t], isDirty: true }
          : d
      ),
    }))
    return t.id
  },

  updateTable(drawingId, tableId, patch) {
    set(state => ({
      drawings: state.drawings.map(d => {
        if (d.id !== drawingId) return d
        return {
          ...d,
          isDirty: true,
          tables: (d.tables || []).map(t =>
            t.id !== tableId ? t : { ...t, ...patch }
          ),
        }
      }),
    }))
  },

  removeTable(drawingId, tableId) {
    set(state => ({
      drawings: state.drawings.map(d =>
        d.id !== drawingId ? d : {
          ...d,
          isDirty: true,
          tables: (d.tables || []).filter(t => t.id !== tableId),
        }
      ),
    }))
  },

  // ─── Folders (file tree) ──────────────────────────────────────────────────

  addFolder(name = 'New Folder', parentId = null) {
    const { activeProjectId } = get()
    const folder = { id: genId(), name, parentId }
    set(state => ({
      projects: state.projects.map(p =>
        p.id === activeProjectId
          ? { ...p, folders: [...(p.folders || []), folder] }
          : p
      ),
    }))
    return folder.id
  },

  renameFolder(folderId, name) {
    const { activeProjectId } = get()
    set(state => ({
      projects: state.projects.map(p =>
        p.id === activeProjectId
          ? { ...p, folders: (p.folders || []).map(f => f.id === folderId ? { ...f, name } : f) }
          : p
      ),
    }))
  },

  // Delete a folder and (recursively) its descendant folders. Drawings that lived
  // in any removed folder are re-parented to root (folderId = null) so nothing is
  // orphaned with a dangling folderId.
  deleteFolder(folderId) {
    const { activeProjectId, projects } = get()
    const project = projects.find(p => p.id === activeProjectId)
    if (!project) return
    const folders = project.folders || []
    // Collect the folder + all descendants.
    const toRemove = new Set([folderId])
    let grew = true
    while (grew) {
      grew = false
      for (const f of folders) {
        if (!toRemove.has(f.id) && toRemove.has(f.parentId)) {
          toRemove.add(f.id)
          grew = true
        }
      }
    }
    set(state => ({
      projects: state.projects.map(p =>
        p.id === activeProjectId
          ? { ...p, folders: (p.folders || []).filter(f => !toRemove.has(f.id)) }
          : p
      ),
      drawings: state.drawings.map(d =>
        toRemove.has(d.folderId) ? { ...d, folderId: null, isDirty: true } : d
      ),
    }))
  },

  // Re-parent a folder. Rejects cycles (can't drop a folder into itself or one
  // of its own descendants) — the FileTree validates via canMove() first, but we
  // guard here too so the store can never enter an inconsistent state.
  moveFolder(folderId, newParentId = null) {
    const { activeProjectId, projects } = get()
    const project = projects.find(p => p.id === activeProjectId)
    if (!project || folderId === newParentId) return
    const folders = project.folders || []
    // Walk up from newParentId; if we hit folderId, the move would form a cycle.
    let cursor = newParentId
    while (cursor != null) {
      if (cursor === folderId) return
      const parent = folders.find(f => f.id === cursor)
      cursor = parent ? parent.parentId : null
    }
    set(state => ({
      projects: state.projects.map(p =>
        p.id === activeProjectId
          ? { ...p, folders: (p.folders || []).map(f => f.id === folderId ? { ...f, parentId: newParentId ?? null } : f) }
          : p
      ),
    }))
  },

  moveDrawingToFolder(drawingId, folderId) {
    set(state => ({
      drawings: state.drawings.map(d =>
        d.id === drawingId ? { ...d, folderId: folderId ?? null, isDirty: true } : d
      ),
    }))
  },

  // ─── Attachments (embedded sub-files) ─────────────────────────────────────

  addAttachment(attachment) {
    const { activeProjectId } = get()
    const att = { id: genId(), addedAt: Date.now(), ...attachment }
    if (!att.id) att.id = genId()
    set(state => ({
      projects: state.projects.map(p =>
        p.id === activeProjectId
          ? { ...p, attachments: [...(p.attachments || []), att] }
          : p
      ),
    }))
    return att.id
  },

  removeAttachment(attachmentId) {
    const { activeProjectId } = get()
    set(state => ({
      projects: state.projects.map(p =>
        p.id === activeProjectId
          ? { ...p, attachments: (p.attachments || []).filter(a => a.id !== attachmentId) }
          : p
      ),
    }))
  },

  // Write an attachment's stored base64 payload back out to disk. In Tauri this
  // prompts for a path (saveFileDialog) and writes the decoded bytes; in the
  // browser it triggers a Blob download. Returns true on success.
  async exportAttachment(attachmentId) {
    const { activeProjectId, projects } = get()
    const project = projects.find(p => p.id === activeProjectId)
    const att = (project?.attachments || []).find(a => a.id === attachmentId)
    if (!att) return false
    try {
      if (isRunningInTauri()) {
        const ext = (att.name?.split('.').pop() || '').toLowerCase()
        const path = await saveFileDialog(
          att.name || 'attachment',
          ext ? [{ name: ext.toUpperCase(), extensions: [ext] }] : []
        )
        if (!path) return false
        await writeBinaryFile(path, base64ToBytes(att.data))
      } else {
        const bytes = base64ToBytes(att.data)
        const blob = new Blob([bytes], { type: att.mime || 'application/octet-stream' })
        _download(blob, att.name || 'attachment')
      }
      return true
    } catch (e) {
      console.error('Failed to export attachment', e)
      if (typeof alert === 'function') alert(`Could not export attachment: ${e.message || e}`)
      return false
    }
  },

  // Read a file from disk (Tauri) or a File object (browser) and embed it as a
  // base64 attachment. Tauri path prompts via openFileDialog. Returns the new
  // attachment id (or null if cancelled/failed).
  async attachFile() {
    try {
      if (isRunningInTauri()) {
        const path = await openFileDialog([])
        if (!path) return null
        const { readFile } = await import('@tauri-apps/plugin-fs')
        const bytes = await readFile(path)
        let binary = ''
        const CHUNK = 0x8000
        for (let i = 0; i < bytes.length; i += CHUNK) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
        }
        const data = btoa(binary)
        return get().addAttachment({ name: basename(path), mime: 'application/octet-stream', data })
      }
      // Browser path is driven by FileMenu's hidden <input>; nothing to do here.
      return null
    } catch (e) {
      console.error('Failed to attach file', e)
      if (typeof alert === 'function') alert(`Could not attach file: ${e.message || e}`)
      return null
    }
  },

  // ─── Persistence ──────────────────────────────────────────────────────────

  // Builds a serialisable snapshot of the active project
  _buildProjectSnapshot() {
    const { projects, drawings, activeProjectId } = get()
    const project = projects.find(p => p.id === activeProjectId)
    if (!project) return null
    const projectDrawings = project.drawingIds
      .map(id => drawings.find(d => d.id === id))
      .filter(Boolean)
    return { version: 4, ...project, drawings: projectDrawings }
  },

  // saveAll — writes to file (Tauri) or localStorage (browser).
  //
  // Save integrity (Stage 7): serialize FIRST, then write, then mark saved. If
  // JSON.stringify or the write throws (e.g. a corrupt image payload, disk full),
  // we surface a dialog and bail WITHOUT marking drawings clean and WITHOUT
  // having touched the existing good file — so a failed snapshot can never
  // overwrite a known-good one. Returns true on success, false on failure.
  async saveAll() {
    const { projects, drawings, currentFilePath } = get()
    const now = Date.now()

    try {
      if (isRunningInTauri() && currentFilePath) {
        const snapshot = get()._buildProjectSnapshot()
        if (snapshot) {
          // Serialize before any state mutation; a throw here leaves disk intact.
          const json = JSON.stringify(snapshot, null, 2)
          await writeTextFile(currentFilePath, json)
        }
      } else {
        const savedDrawings = drawings.map(d => ({ ...d, isDirty: false, lastSaved: now }))
        const savedProjects = projects.map(p => ({ ...p, lastSaved: now }))
        // Browser fallback: localStorage. Build the payload before writing so a
        // serialization error doesn't clobber the previously-stored project.
        const payload = JSON.stringify({
          version: 4,
          projects: savedProjects,
          drawings: savedDrawings,
        })
        localStorage.setItem('schematic_projects', payload)
      }
    } catch (e) {
      console.error('Failed to save project', e)
      if (typeof alert === 'function') {
        alert(
          `Could not save the project — your file was NOT changed.\n\n` +
          `${e.message || e}\n\n` +
          `This can happen if an embedded image or attachment is corrupt. ` +
          `Try removing recently added images/attachments and save again.`
        )
      }
      return false
    }

    // Only now mark everything clean/saved — the write succeeded.
    set({
      drawings: get().drawings.map(d => ({ ...d, isDirty: false, lastSaved: now })),
      projects: get().projects.map(p => ({ ...p, lastSaved: now })),
    })
    return true
  },

  // Open a .scpro file via native dialog (Tauri) or fall back to browser import
  async openProjectFile() {
    // Stage 5: guard unsaved work before replacing the open project.
    if (hasUnsavedWork(get().drawings)) {
      const proceed = await askConfirm(
        'You have unsaved changes. Opening another project will discard them. Continue?'
      )
      if (!proceed) return
    }
    if (!isRunningInTauri()) {
      // Trigger hidden file input in FileMenu — signal via a store flag
      set({ _triggerBrowserOpen: Date.now() })
      return
    }
    const path = await openFileDialog([
      { name: 'Schematic Project', extensions: ['scpro', 'json'] },
    ])
    if (!path) return
    await get()._loadProjectFromPath(path)
  },

  // Save active project to its current file path (or prompt if none)
  async saveProjectFile() {
    const { currentFilePath } = get()
    if (currentFilePath) {
      await get().saveAll()
    } else {
      await get().saveProjectFileAs()
    }
  },

  // Save active project, always prompting for a path
  async saveProjectFileAs() {
    if (!isRunningInTauri()) {
      // Fall back to existing JSON export
      const { activeProjectId } = get()
      if (activeProjectId) get().exportProjectJSON(activeProjectId)
      return
    }
    const { projects, activeProjectId } = get()
    const project = projects.find(p => p.id === activeProjectId)
    const path = await saveFileDialog(
      `${project?.name || 'project'}.scpro`,
      [{ name: 'Schematic Project', extensions: ['scpro'] }]
    )
    if (!path) return
    set({ currentFilePath: path })
    addRecentFile(path)
    set({ recentFiles: getRecentFiles() })
    await get().saveAll()
  },

  // Load project data from a file path
  async _loadProjectFromPath(path) {
    try {
      const raw = await readTextFile(path)
      const parsed = JSON.parse(raw)
      // Drop malformed images/attachments before they reach the store so one
      // corrupt payload can't crash the open. Surface a non-fatal warning.
      const { data, dropped } = sanitizeLoadedProject(parsed)
      if (dropped.images || dropped.attachments) {
        console.warn('Dropped malformed entries on load', dropped)
        if (typeof alert === 'function') {
          const bits = [
            dropped.images && `${dropped.images} image${dropped.images > 1 ? 's' : ''}`,
            dropped.attachments && `${dropped.attachments} attachment${dropped.attachments > 1 ? 's' : ''}`,
          ].filter(Boolean).join(' and ')
          alert(`Opened ${basename(path)} but skipped ${bits} that were corrupt or unreadable.`)
        }
      }
      // Migrate older (v2) files: backfill new-schema fields so they open unchanged.
      const drawings = (data.drawings || []).map(d => migrateDrawing({ ...d, isDirty: false }))
      const project = migrateProject({
        id: data.id || genId(),
        name: data.name || basename(path).replace(/\.scpro$/, ''),
        drawingIds: drawings.map(d => d.id),
        activeDrawingId: drawings[0]?.id || null,
        folders: data.folders,
        attachments: data.attachments,
        lastSaved: Date.now(),
      })
      set(state => ({
        projects: [...state.projects.filter(p => p.id !== project.id), project],
        drawings: [
          ...state.drawings.filter(d => !project.drawingIds.includes(d.id)),
          ...drawings,
        ],
        activeProjectId: project.id,
        activeDrawingId: project.activeDrawingId,
        currentFilePath: path,
        externalChangeDetected: false,
        selectedIds: [],
        undoStack: [],
        redoStack: [],
      }))
      addRecentFile(path)
      set({ recentFiles: getRecentFiles() })
    } catch (e) {
      console.error('Failed to open project file', e)
      alert(`Could not open file: ${basename(path)}\n\n${e.message}`)
    }
  },

  // Re-read the current file from disk (called when external change detected)
  async reloadFromCurrentFile() {
    const { currentFilePath } = get()
    if (!currentFilePath) return
    set({ externalChangeDetected: false })
    await get()._loadProjectFromPath(currentFilePath)
  },

  dismissExternalChange() {
    set({ externalChangeDetected: false })
  },

  setExternalChangeDetected(v) {
    set({ externalChangeDetected: v })
  },

  loadRecentFiles() {
    set({ recentFiles: getRecentFiles() })
  },

  removeRecentFile(path) {
    removeRecentFile(path)
    set({ recentFiles: getRecentFiles() })
  },

  loadFromStorage() {
    // In Tauri mode, try to re-open the last used file
    if (isRunningInTauri()) {
      set({ recentFiles: getRecentFiles() })
      const recent = getRecentFiles()
      if (recent.length > 0) {
        get()._loadProjectFromPath(recent[0])
        return
      }
      // No recent files — start blank
      const { project, drawing } = createBlankProject('Default Project')
      set({
        projects: [project],
        drawings: [drawing],
        activeProjectId: project.id,
        activeDrawingId: drawing.id,
        recentFiles: [],
      })
      return
    }

    // Browser mode — use localStorage
    try {
      const raw = localStorage.getItem('schematic_projects')
      if (raw) {
        const parsed = JSON.parse(raw)
        const projects = (parsed.projects || []).map(migrateProject)
        const drawings = (parsed.drawings || []).map(migrateDrawing)
        if (projects.length > 0 && drawings.length > 0) {
          const activeProject = projects[0]
          set({
            projects,
            drawings,
            activeProjectId: activeProject.id,
            activeDrawingId: activeProject.activeDrawingId,
          })
          return
        }
      }
      // Legacy migration — old flat drawings format
      const legacy = localStorage.getItem('schematic_drawings')
      if (legacy) {
        const drawings = (JSON.parse(legacy) || []).map(migrateDrawing)
        if (drawings.length > 0) {
          const project = migrateProject({
            id: genId(),
            name: 'Default Project',
            drawingIds: drawings.map(d => d.id),
            activeDrawingId: drawings[0].id,
            lastSaved: null,
          })
          set({
            projects: [project],
            drawings,
            activeProjectId: project.id,
            activeDrawingId: project.activeDrawingId,
          })
          return
        }
      }
    } catch (e) {
      console.warn('Failed to load from storage', e)
    }
    // Fresh start
    const { project, drawing } = createBlankProject('Default Project')
    set({
      projects: [project],
      drawings: [drawing],
      activeProjectId: project.id,
      activeDrawingId: drawing.id,
    })
  },
}))

function _download(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export default useSchematicStore
