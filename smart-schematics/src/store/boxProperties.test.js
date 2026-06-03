import { describe, it, expect, beforeEach } from 'vitest'
import useSchematicStore from './schematicStore'

// Stage 6 (v0.2.0): the Properties panel edits box fields/image/info and the
// per-component resistorStyle / labelScale. The UI is thin; this covers the
// store paths it drives + their persistence.

const store = () => useSchematicStore.getState()
const activeDrawing = () => {
  const s = store()
  return s.drawings.find(d => d.id === s.activeDrawingId)
}
function roundTrip() {
  const json = JSON.stringify(store()._buildProjectSnapshot(), null, 2)
  store().importProjectJSON(json)
  return activeDrawing()
}

describe('box property edits persist', () => {
  let did, boxId
  beforeEach(() => {
    store().newProject('Box Props')
    did = store().activeDrawingId
    boxId = store().addBox(did, 100, 100)
  })

  it('updateBox stores flexible field rows and round-trips', () => {
    const fields = [{ id: 'f1', label: 'Resistance', value: '4.7k', unit: 'Ω' }]
    store().updateBox(did, boxId, { fields })
    expect(activeDrawing().components.find(c => c.id === boxId).box.fields).toEqual(fields)
    expect(roundTrip().components.find(c => c.id === boxId).box.fields).toEqual(fields)
  })

  it('updateBox stores an assigned image and clears it', () => {
    const src = 'data:image/png;base64,AAAA'
    store().updateBox(did, boxId, { image: src })
    expect(activeDrawing().components.find(c => c.id === boxId).box.image).toBe(src)
    store().updateBox(did, boxId, { image: null })
    expect(activeDrawing().components.find(c => c.id === boxId).box.image).toBeNull()
  })

  it('updateBox stores free-text info', () => {
    store().updateBox(did, boxId, { info: 'Datasheet rev B' })
    expect(roundTrip().components.find(c => c.id === boxId).box.info).toBe('Datasheet rev B')
  })

  it('non-geometry box patches leave pins untouched', () => {
    const before = activeDrawing().components.find(c => c.id === boxId).pins
    store().updateBox(did, boxId, { info: 'x' })
    expect(activeDrawing().components.find(c => c.id === boxId).pins).toEqual(before)
  })
})

describe('component resistorStyle / labelScale persist', () => {
  it('updateComponent stores resistorStyle + labelScale and round-trips', () => {
    store().newProject('R Props')
    const did = store().activeDrawingId
    const id = store().addComponent(did, 'resistor', 0, 0, {
      pins: [{ id: 'A', relX: -20, relY: 0, direction: 'W' }, { id: 'B', relX: 20, relY: 0, direction: 'E' }],
    })
    store().updateComponent(did, id, { resistorStyle: 'IEEE', labelScale: 2 })
    const c = activeDrawing().components.find(c => c.id === id)
    expect(c.resistorStyle).toBe('IEEE')
    expect(c.labelScale).toBe(2)
    const after = roundTrip().components.find(c => c.id === id)
    expect(after.resistorStyle).toBe('IEEE')
    expect(after.labelScale).toBe(2)
  })
})
