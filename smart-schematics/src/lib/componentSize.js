// The on-canvas footprint of a *placed* component.
//
// `def.width`/`def.height` describe the component as it ships in the library —
// i.e. at its DEFAULT parameters. Parametric components (the manifold, the valve
// builder, the industrial terminal blocks) change size when a port/way/channel
// count changes, so anything that reasons about a component's box — the
// selection outline, the click hit area, label placement, the interactive
// control pill, export bounds — must ask the def for the size at the
// component's CURRENT parameters instead of reading the static field.
//
// A def opts in by exporting `sizeFor(simParams) -> { width, height }`. Defs
// without it keep the static footprint, so this is a no-op for the ~150 fixed
// symbols.

import { getElectricalDef } from './components/electrical'
import { getHydraulicDef } from './components/hydraulic'
import { getCustomDef } from './components/custom'

export function getAnyDef(type) {
  return getElectricalDef(type) || getHydraulicDef(type) || getCustomDef(type) || null
}

// Fallback footprint for a component whose type has no library def at all
// (a stale file referencing a deleted custom symbol). Matches the historical
// `def?.width || 40` / `def?.height || 20` defaults.
const FALLBACK = { width: 40, height: 20 }

// Boxes carry their own geometry on the instance rather than in a def.
const BOX_FALLBACK = { width: 80, height: 60 }

export function componentSize(component, def) {
  if (!component) return { ...FALLBACK }

  if (component.type === 'box') {
    return {
      width: component.box?.width || BOX_FALLBACK.width,
      height: component.box?.height || BOX_FALLBACK.height,
    }
  }

  // `def` is passed in by callers that already looked it up; `undefined` means
  // "look it up for me". An explicit `null` means "there is no def" — respect it
  // rather than re-resolving.
  const d = def === undefined ? getAnyDef(component.type) : def
  if (d?.sizeFor) {
    const s = d.sizeFor(component.simParams || {})
    if (s && Number.isFinite(s.width) && Number.isFinite(s.height) && s.width > 0 && s.height > 0) {
      return { width: s.width, height: s.height }
    }
  }
  return { width: d?.width || FALLBACK.width, height: d?.height || FALLBACK.height }
}
