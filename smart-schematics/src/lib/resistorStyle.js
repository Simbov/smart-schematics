// Resolve the effective resistor body style for a component (Stage 8, v0.2.0).
//
// Per-component `component.resistorStyle` overrides the global
// `settings.resistorStyle`; an unknown / missing value falls back to 'IEC'
// (the rectangular IEC body, the app's historical default). Pure + testable.
//
//   'IEC'  → rectangular box body
//   'IEEE' → zig-zag (ANSI/IEEE) body

export const RESISTOR_STYLES = ['IEC', 'IEEE']

export function resolveResistorStyle(component, settings) {
  const candidate = component?.resistorStyle ?? settings?.resistorStyle ?? 'IEC'
  return RESISTOR_STYLES.includes(candidate) ? candidate : 'IEC'
}
