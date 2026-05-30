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
