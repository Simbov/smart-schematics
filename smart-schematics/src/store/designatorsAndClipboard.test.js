import { describe, it, expect, beforeEach } from 'vitest'
import useSchematicStore from './schematicStore'
import { getElectricalDef } from '../lib/components/electrical'

// Store-level cover for two schematic-correctness bugs and one data-loss bug:
//
//   * a designator handed out twice (after a delete, or on paste/duplicate) —
//     two parts on a sheet claiming to be R1, and, worse, two coils claiming to
//     be K1, which the simulator uses to drive every K1 contact;
//   * copy/paste silently dropping junctions out of the copied region.

const store = () => useSchematicStore.getState()
const drawing = () => store().drawings.find(d => d.id === store().activeDrawingId)

const RES = getElectricalDef('resistor')
const COIL = getElectricalDef('relay_coil')

function addResistor(x = 0, y = 0) {
  return store().addComponent(store().activeDrawingId, 'resistor', x, y, RES)
}

beforeEach(() => {
  store().newProject('Designator Test')
})

describe('designator allocation', () => {
  it('numbers sequentially on a fresh sheet', () => {
    addResistor(0, 0); addResistor(40, 0); addResistor(80, 0)
    expect(drawing().components.map(c => c.designator)).toEqual(['R1', 'R2', 'R3'])
  })

  it('reuses the freed number instead of colliding after a delete', () => {
    addResistor(0, 0)
    const second = addResistor(40, 0)
    expect(drawing().components.map(c => c.designator)).toEqual(['R1', 'R2'])

    store().deleteIds(store().activeDrawingId, [second])
    addResistor(80, 0)

    const designators = drawing().components.map(c => c.designator)
    expect(designators).toEqual(['R1', 'R2'])
    expect(new Set(designators).size).toBe(designators.length)
  })

  it('does not collide when the FIRST of a run is deleted', () => {
    const first = addResistor(0, 0)
    addResistor(40, 0)
    store().deleteIds(store().activeDrawingId, [first])
    addResistor(80, 0)

    const designators = drawing().components.map(c => c.designator).sort()
    expect(designators).toEqual(['R1', 'R2'])
  })

  it('keeps prefixes independent across types', () => {
    addResistor(0, 0)
    store().addComponent(store().activeDrawingId, 'relay_coil', 40, 0, COIL)
    expect(drawing().components.map(c => c.designator)).toEqual(['R1', 'K1'])
  })
})

describe('copy / paste', () => {
  it('renumbers pasted components instead of duplicating the designator', () => {
    const id = addResistor(0, 0)
    store().copyToClipboard(store().activeDrawingId, [id])
    store().pasteFromClipboard(store().activeDrawingId)

    const designators = drawing().components.map(c => c.designator)
    expect(designators).toEqual(['R1', 'R2'])
    expect(new Set(designators).size).toBe(2)
  })

  it('keeps designators unique when the same clipboard is pasted twice', () => {
    const id = addResistor(0, 0)
    store().copyToClipboard(store().activeDrawingId, [id])
    store().pasteFromClipboard(store().activeDrawingId)
    store().pasteFromClipboard(store().activeDrawingId)

    const designators = drawing().components.map(c => c.designator)
    expect(designators).toHaveLength(3)
    expect(new Set(designators).size).toBe(3)
  })

  it('renumbers a multi-component paste without self-collision', () => {
    const a = addResistor(0, 0)
    const b = addResistor(40, 0)
    store().copyToClipboard(store().activeDrawingId, [a, b])
    store().pasteFromClipboard(store().activeDrawingId)

    const designators = drawing().components.map(c => c.designator)
    expect(designators).toEqual(['R1', 'R2', 'R3', 'R4'])
  })

  it('carries junctions through a copy/paste (regression: they were dropped)', () => {
    const did = store().activeDrawingId
    const jid = store().addJunctionNode(did, { x: 50, y: 50 })
    store().updateJunction(did, jid, { label: 'SPLICE A' })

    store().copyToClipboard(did, [jid])
    store().pasteFromClipboard(did)

    const junctions = drawing().junctions
    expect(junctions).toHaveLength(2)
    const pasted = junctions.find(j => j.id !== jid)
    expect(pasted.label).toBe('SPLICE A')
    expect(pasted.x).toBe(70)
    expect(pasted.y).toBe(70)
    expect(store().selectedIds).toContain(pasted.id)
  })

  it('leaves the drawing untouched when the clipboard holds nothing', () => {
    const did = store().activeDrawingId
    addResistor(0, 0)
    store().copyToClipboard(did, ['no-such-id'])
    store().pasteFromClipboard(did)
    expect(drawing().components).toHaveLength(1)
  })
})
