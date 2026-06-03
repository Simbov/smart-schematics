import { describe, it, expect } from 'vitest'
import { TOOLBAR_GROUPS, allToolbarButtons, buttonTooltip } from './toolbarConfig'

describe('toolbarConfig', () => {
  it('declares groups in the expected order', () => {
    expect(TOOLBAR_GROUPS.map(g => g.id)).toEqual([
      'history', 'tools', 'insert', 'edit', 'view', 'sim',
    ])
  })

  it('gives every button an id, label, and icon', () => {
    for (const btn of allToolbarButtons()) {
      expect(typeof btn.id).toBe('string')
      expect(btn.id.length).toBeGreaterThan(0)
      expect(typeof btn.label).toBe('string')
      expect(btn.label.length).toBeGreaterThan(0)
      expect(typeof btn.icon).toBe('string')
      expect(btn.icon.length).toBeGreaterThan(0)
    }
  })

  it('has no duplicate button ids', () => {
    const ids = allToolbarButtons().map(b => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('preserves every action the vertical toolbar exposed', () => {
    const ids = allToolbarButtons().map(b => b.id)
    for (const required of [
      'undo', 'redo', 'select', 'wire', 'text', 'callout', 'titleBlock',
      'delete', 'rotate', 'flipH', 'flipV',
      'zoomIn', 'zoomOut', 'zoomFit', 'toggleGrid', 'simOverlay',
    ]) {
      expect(ids).toContain(required)
    }
  })

  it('Insert Table (Stage 9) is present and live', () => {
    const byId = Object.fromEntries(allToolbarButtons().map(b => [b.id, b]))
    expect(byId.table).toBeTruthy()
    expect(byId.table.label).toBe('Insert Table')
    expect(byId.table.icon).toBe('Table')
    expect(byId.table.comingSoon).toBeUndefined()
    expect(buttonTooltip(byId.table)).toBe('Insert Table')
  })

  it('Insert Image (Stage 3) and Box (Stage 5) are both live (no longer reserved)', () => {
    const byId = Object.fromEntries(allToolbarButtons().map(b => [b.id, b]))
    expect(byId.insertImage.comingSoon).toBeUndefined()
    expect(byId.box.comingSoon).toBeUndefined()
  })

  it('reproduces the original tooltips (label + shortcut hint)', () => {
    const byId = Object.fromEntries(allToolbarButtons().map(b => [b.id, b]))
    expect(buttonTooltip(byId.undo)).toBe('Undo (Ctrl+Z)')
    expect(buttonTooltip(byId.redo)).toBe('Redo (Ctrl+Y)')
    expect(buttonTooltip(byId.select)).toBe('Select (V)')
    expect(buttonTooltip(byId.wire)).toBe('Wire (W)')
    expect(buttonTooltip(byId.text)).toBe('Text (T)')
    expect(buttonTooltip(byId.callout)).toBe('Callout Box (B)')
    expect(buttonTooltip(byId.titleBlock)).toBe('Toggle Title Block')
    expect(buttonTooltip(byId.delete)).toBe('Delete (Del)')
    expect(buttonTooltip(byId.rotate)).toBe('Rotate 90° (R)')
    expect(buttonTooltip(byId.flipH)).toBe('Flip Horizontal (X)')
    expect(buttonTooltip(byId.flipV)).toBe('Flip Vertical (Y)')
    expect(buttonTooltip(byId.zoomIn)).toBe('Zoom In (+)')
    expect(buttonTooltip(byId.zoomOut)).toBe('Zoom Out (-)')
    expect(buttonTooltip(byId.zoomFit)).toBe('Fit to Screen (0)')
    expect(buttonTooltip(byId.toggleGrid)).toBe('Toggle Grid')
    expect(buttonTooltip(byId.simOverlay)).toBe('Toggle Simulation Overlay')
  })

  it('tooltips for the live Insert Image and Box tools (no coming-soon note)', () => {
    const byId = Object.fromEntries(allToolbarButtons().map(b => [b.id, b]))
    expect(buttonTooltip(byId.insertImage)).toBe('Insert Image')
    expect(buttonTooltip(byId.box)).toBe('Box')
  })
})
