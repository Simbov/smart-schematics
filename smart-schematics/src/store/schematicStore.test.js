import { describe, it, expect, beforeEach } from 'vitest'
import useSchematicStore, { genId } from './schematicStore'

// A minimal 2-pin horizontal component def (pins at relX ±20, like switch_no).
const twoPinDef = {
  defaultDesignatorPrefix: 'S',
  defaultValue: '',
  pins: [
    { id: 'A', relX: -20, relY: 0, direction: 'W' },
    { id: 'B', relX: 20, relY: 0, direction: 'E' },
  ],
}

function setupDrawingWithBoundWire() {
  const store = useSchematicStore.getState()
  store.newProject('Test Project')
  const drawingId = useSchematicStore.getState().activeDrawingId
  const compId = useSchematicStore.getState().addComponent(drawingId, 'switch_no', 100, 100, twoPinDef)
  // Wire bound to pin A (left pin) at its rest position (80,100).
  const wire = {
    id: genId(),
    points: [{ x: 80, y: 100 }, { x: 40, y: 100 }],
    netName: '',
    style: 'solid',
    weight: 1,
    pinA: { componentId: compId, pinId: 'A' },
    pinB: null,
  }
  useSchematicStore.getState().addWire(drawingId, wire)
  return { drawingId, compId, wireId: wire.id }
}

const drawing = () => {
  const s = useSchematicStore.getState()
  return s.drawings.find(d => d.id === s.activeDrawingId)
}

describe('rotateComponent reattaches bound wires', () => {
  let ctx
  beforeEach(() => {
    ctx = setupDrawingWithBoundWire()
  })

  it('moves the bound wire endpoint to the rotated pin position', () => {
    const before = drawing().wires.find(w => w.id === ctx.wireId)
    expect(before.points[0]).toEqual({ x: 80, y: 100 })

    useSchematicStore.getState().rotateComponent(ctx.drawingId, ctx.compId, 90)

    const comp = drawing().components.find(c => c.id === ctx.compId)
    const pinA = comp.pins.find(p => p.id === 'A')
    // pin A (-20,0) rotated 90° about (100,100) → (100, 80)
    expect(pinA.absX).toBeCloseTo(100)
    expect(pinA.absY).toBeCloseTo(80)

    const after = drawing().wires.find(w => w.id === ctx.wireId)
    expect(after.points[0].x).toBeCloseTo(pinA.absX)
    expect(after.points[0].y).toBeCloseTo(pinA.absY)
    // The far (unbound) endpoint must stay put.
    expect(after.points[1]).toEqual({ x: 40, y: 100 })
  })

  it('flipComponent also reattaches the bound wire endpoint', () => {
    useSchematicStore.getState().flipComponent(ctx.drawingId, ctx.compId, 'H')
    const comp = drawing().components.find(c => c.id === ctx.compId)
    const pinA = comp.pins.find(p => p.id === 'A')
    // pin A (-20,0) flipped H about (100,100) → (120,100)
    expect(pinA.absX).toBeCloseTo(120)
    const after = drawing().wires.find(w => w.id === ctx.wireId)
    expect(after.points[0].x).toBeCloseTo(120)
    expect(after.points[0].y).toBeCloseTo(100)
  })

  it('leaves wires bound to other components untouched', () => {
    const otherWire = {
      id: genId(),
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      pinA: { componentId: 'someone-else', pinId: 'A' },
      pinB: null,
    }
    useSchematicStore.getState().addWire(ctx.drawingId, otherWire)
    useSchematicStore.getState().rotateComponent(ctx.drawingId, ctx.compId, 90)
    const after = drawing().wires.find(w => w.id === otherWire.id)
    expect(after.points).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }])
  })
})

// ─── Stage 5: component box ──────────────────────────────────────────────────

describe('addBox + box wire reattachment on rotate (Stage 5)', () => {
  let drawingId, boxId

  beforeEach(() => {
    const store = useSchematicStore.getState()
    store.newProject('Box Project')
    drawingId = useSchematicStore.getState().activeDrawingId
    // Default box at (100,100): 80×60, pins W1 at (60,100) and E1 at (140,100).
    boxId = useSchematicStore.getState().addBox(drawingId, 100, 100)
  })

  it('creates a valid type:box component with edge pins', () => {
    const comp = drawing().components.find(c => c.id === boxId)
    expect(comp.type).toBe('box')
    expect(comp.box.width).toBe(80)
    expect(comp.box.height).toBe(60)
    const w1 = comp.pins.find(p => p.id === 'W1')
    const e1 = comp.pins.find(p => p.id === 'E1')
    expect(w1.absX).toBeCloseTo(60)   // 100 - 40
    expect(w1.absY).toBeCloseTo(100)
    expect(e1.absX).toBeCloseTo(140)  // 100 + 40
    expect(w1.direction).toBe('W')
    expect(e1.direction).toBe('E')
  })

  it('reattaches a bound wire to the new pin position after rotation', () => {
    // Wire bound to pin W1 at its rest position (60,100).
    const wire = {
      id: genId(),
      points: [{ x: 60, y: 100 }, { x: 20, y: 100 }],
      pinA: { componentId: boxId, pinId: 'W1' },
      pinB: null,
    }
    useSchematicStore.getState().addWire(drawingId, wire)

    useSchematicStore.getState().rotateComponent(drawingId, boxId, 90)

    const comp = drawing().components.find(c => c.id === boxId)
    const w1 = comp.pins.find(p => p.id === 'W1')
    // W1 rel(-40,0) rotated 90° about (100,100) → (100, 60).
    expect(w1.absX).toBeCloseTo(100)
    expect(w1.absY).toBeCloseTo(60)

    const after = drawing().wires.find(w => w.id === wire.id)
    expect(after.points[0].x).toBeCloseTo(w1.absX)
    expect(after.points[0].y).toBeCloseTo(w1.absY)
    // The far (unbound) endpoint stays put.
    expect(after.points[1]).toEqual({ x: 20, y: 100 })
  })

  it('updateBox rebuilds pins and reattaches bound wires on resize', () => {
    const wire = {
      id: genId(),
      points: [{ x: 140, y: 100 }, { x: 200, y: 100 }],
      pinA: { componentId: boxId, pinId: 'E1' },
      pinB: null,
    }
    useSchematicStore.getState().addWire(drawingId, wire)

    // Widen the box to 120 → E1 now at 100 + 60 = 160.
    useSchematicStore.getState().updateBox(drawingId, boxId, { width: 120 })

    const comp = drawing().components.find(c => c.id === boxId)
    const e1 = comp.pins.find(p => p.id === 'E1')
    expect(e1.absX).toBeCloseTo(160)
    const after = drawing().wires.find(w => w.id === wire.id)
    expect(after.points[0].x).toBeCloseTo(160)
  })
})

// ─── Stage 1: image elements in the store ────────────────────────────────────

const SAMPLE_SRC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='

function setupDrawingWithImage(imgOverrides = {}) {
  const store = useSchematicStore.getState()
  store.newProject('Image Project')
  const drawingId = useSchematicStore.getState().activeDrawingId
  const id = useSchematicStore.getState().addImage(drawingId, {
    id: 'img1', src: SAMPLE_SRC, x: 10, y: 20, width: 100, height: 50, ...imgOverrides,
  })
  return { drawingId, imageId: id }
}

describe('image store actions', () => {
  it('addImage applies rotation/opacity/locked defaults', () => {
    const { drawingId } = setupDrawingWithImage()
    const img = drawing().images[0]
    expect(img).toMatchObject({
      id: 'img1', src: SAMPLE_SRC, x: 10, y: 20, width: 100, height: 50,
      rotation: 0, opacity: 1, locked: false,
    })
  })

  it('updateImage patches fields and marks dirty', () => {
    const { drawingId, imageId } = setupDrawingWithImage()
    useSchematicStore.getState().updateImage(drawingId, imageId, { opacity: 0.5, locked: true })
    const img = drawing().images[0]
    expect(img.opacity).toBe(0.5)
    expect(img.locked).toBe(true)
    expect(drawing().isDirty).toBe(true)
  })

  it('moveItems translates images via imageIds', () => {
    const { drawingId, imageId } = setupDrawingWithImage()
    useSchematicStore.getState().moveItems(drawingId, [], [], [], 5, 7, [imageId])
    const img = drawing().images[0]
    expect(img.x).toBe(15)
    expect(img.y).toBe(27)
  })

  it('moveItems leaves images alone when their id is not passed', () => {
    const { drawingId } = setupDrawingWithImage()
    useSchematicStore.getState().moveItems(drawingId, [], [], [], 5, 7)
    const img = drawing().images[0]
    expect(img.x).toBe(10)
    expect(img.y).toBe(20)
  })

  it('deleteIds removes images', () => {
    const { drawingId, imageId } = setupDrawingWithImage()
    useSchematicStore.getState().deleteIds(drawingId, [imageId])
    expect(drawing().images).toHaveLength(0)
  })

  it('undo restores a deleted image (snapshot includes images)', () => {
    const { drawingId, imageId } = setupDrawingWithImage()
    useSchematicStore.getState().deleteIds(drawingId, [imageId])
    expect(drawing().images).toHaveLength(0)
    useSchematicStore.getState().undo()
    const img = drawing().images[0]
    expect(img.id).toBe('img1')
    expect(img.src).toBe(SAMPLE_SRC)
  })

  it('copy/paste an image clones it with a new id and the same src', () => {
    const { drawingId } = setupDrawingWithImage()
    useSchematicStore.getState().copyToClipboard(drawingId, ['img1'])
    useSchematicStore.getState().pasteFromClipboard(drawingId)
    const images = drawing().images
    expect(images).toHaveLength(2)
    expect(images[1].id).not.toBe('img1')
    expect(images[1].src).toBe(SAMPLE_SRC)
    // pasted clone is offset by the paste OFFSET (20)
    expect(images[1].x).toBe(30)
    expect(images[1].y).toBe(40)
  })
})

// ─── Stage 1 (v0.2.0): table store actions ──────────────────────────────────
import { createTable, setCell } from '../lib/tableModel.js'
import { plainToDoc, docToPlain } from '../lib/richText.js'

function setupDrawingWithTable() {
  const store = useSchematicStore.getState()
  store.newProject('Table Project')
  const drawingId = useSchematicStore.getState().activeDrawingId
  const table = createTable({ x: 50, y: 60, rows: 2, cols: 2, grid: 10 })
  const id = useSchematicStore.getState().addTable(drawingId, table)
  return { drawingId, tableId: id }
}

const tdrawing = () => {
  const s = useSchematicStore.getState()
  return s.drawings.find(d => d.id === s.activeDrawingId)
}

describe('table store actions (v0.2.0)', () => {
  it('addTable appends a table with a generated id and marks dirty', () => {
    const { tableId } = setupDrawingWithTable()
    expect(tdrawing().tables).toHaveLength(1)
    expect(tdrawing().tables[0].id).toBe(tableId)
    expect(tdrawing().isDirty).toBe(true)
  })

  it('updateTable patches a table (e.g. a cell doc)', () => {
    const { drawingId, tableId } = setupDrawingWithTable()
    const t = tdrawing().tables[0]
    const next = setCell(t, 0, 1, plainToDoc('Hi'))
    useSchematicStore.getState().updateTable(drawingId, tableId, { cells: next.cells })
    expect(docToPlain(tdrawing().tables[0].cells[0][1])).toBe('Hi')
  })

  it('removeTable drops a table', () => {
    const { drawingId, tableId } = setupDrawingWithTable()
    useSchematicStore.getState().removeTable(drawingId, tableId)
    expect(tdrawing().tables).toHaveLength(0)
  })

  it('moveItems translates a table by tableIds', () => {
    const { drawingId, tableId } = setupDrawingWithTable()
    useSchematicStore.getState().moveItems(drawingId, [], [], [], 15, 25, [], [tableId])
    const t = tdrawing().tables[0]
    expect(t.x).toBe(65)
    expect(t.y).toBe(85)
  })

  it('deleteIds removes a table', () => {
    const { drawingId, tableId } = setupDrawingWithTable()
    useSchematicStore.getState().deleteIds(drawingId, [tableId])
    expect(tdrawing().tables).toHaveLength(0)
  })

  it('undo restores a deleted table (snapshot includes tables)', () => {
    const { drawingId, tableId } = setupDrawingWithTable()
    useSchematicStore.getState().deleteIds(drawingId, [tableId])
    expect(tdrawing().tables).toHaveLength(0)
    useSchematicStore.getState().undo()
    expect(tdrawing().tables).toHaveLength(1)
    expect(tdrawing().tables[0].id).toBe(tableId)
  })

  it('copy/paste clones a table with a new id', () => {
    const { drawingId, tableId } = setupDrawingWithTable()
    useSchematicStore.getState().copyToClipboard(drawingId, [tableId])
    useSchematicStore.getState().pasteFromClipboard(drawingId)
    const tables = tdrawing().tables
    expect(tables).toHaveLength(2)
    expect(tables[1].id).not.toBe(tableId)
    expect(tables[1].x).toBe(70) // 50 + OFFSET(20)
    expect(tables[1].y).toBe(80)
  })
})

// ─── Stage 5 (v0.2.0): unsaved-work guard ───────────────────────────────────
import { hasUnsavedWork } from './schematicStore'

describe('hasUnsavedWork', () => {
  it('is true when any drawing is dirty, false otherwise', () => {
    expect(hasUnsavedWork([{ isDirty: false }, { isDirty: true }])).toBe(true)
    expect(hasUnsavedWork([{ isDirty: false }, { isDirty: false }])).toBe(false)
    expect(hasUnsavedWork([])).toBe(false)
    expect(hasUnsavedWork(null)).toBe(false)
  })
})

describe('pasteFromClipboard deep-clones nested box data (no cross-instance leak)', () => {
  it('editing one pasted box does not affect another paste of the same clipboard', () => {
    const store = useSchematicStore.getState()
    store.newProject('Paste Test')
    const did = useSchematicStore.getState().activeDrawingId
    const boxId = useSchematicStore.getState().addBox(did, 100, 100)
    useSchematicStore.getState().updateBox(did, boxId, { images: [{ id: 'bimg_1', src: 'data:a', heading: 'orig' }] })

    // Copy the box, then paste it twice from the same clipboard.
    useSchematicStore.getState().copyToClipboard(did, [boxId])
    useSchematicStore.getState().pasteFromClipboard(did)
    const firstPasteId = useSchematicStore.getState().selectedIds[0]
    useSchematicStore.getState().pasteFromClipboard(did)
    const secondPasteId = useSchematicStore.getState().selectedIds[0]
    expect(firstPasteId).not.toBe(secondPasteId)

    // Mutate the first paste's reference images.
    useSchematicStore.getState().updateBox(did, firstPasteId, { images: [{ id: 'bimg_x', src: 'data:b', heading: 'changed' }] })

    const d = useSchematicStore.getState().drawings.find(x => x.id === did)
    const second = d.components.find(c => c.id === secondPasteId)
    // The second paste must keep the original image — no shared reference.
    expect(second.box.images).toEqual([{ id: 'bimg_1', src: 'data:a', heading: 'orig' }])
  })
})

describe('updateWire patches a single wire', () => {
  it('sets color/style/weight without touching other wires', () => {
    const store = useSchematicStore.getState()
    store.newProject('Wire Test')
    const did = useSchematicStore.getState().activeDrawingId
    const w1 = { id: genId(), points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], netName: '', style: 'solid', weight: 1, pinA: null, pinB: null }
    const w2 = { id: genId(), points: [{ x: 0, y: 5 }, { x: 10, y: 5 }], netName: '', style: 'solid', weight: 1, pinA: null, pinB: null }
    useSchematicStore.getState().addWire(did, w1)
    useSchematicStore.getState().addWire(did, w2)

    useSchematicStore.getState().updateWire(did, w1.id, { color: '#ff0000', style: 'dashed', weight: 2 })

    const d = useSchematicStore.getState().drawings.find(x => x.id === did)
    expect(d.wires.find(w => w.id === w1.id)).toMatchObject({ color: '#ff0000', style: 'dashed', weight: 2 })
    expect(d.wires.find(w => w.id === w2.id).color).toBeUndefined()
  })
})
