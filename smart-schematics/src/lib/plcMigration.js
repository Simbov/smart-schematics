// Pure migration for the consolidated PLC I/O components (Smart Schematics
// update). The four legacy types collapse into two mode-switchable ones, exactly
// like prior "make any old part the new type with the right option chosen"
// migrations. No DOM, no store — unit-tested in isolation.
//
//   plc_digital_input  → plc_input  (mode 'Digital')
//   plc_analog_input   → plc_input  (mode 'Analogue')
//   plc_digital_output → plc_output (mode 'Digital')
//   plc_pwm_output     → plc_output (mode 'PWM')
//
// The old `value` (which held the pin address, e.g. "I0.0") is moved into
// simParams.address so it keeps showing on the schematic. Existing simParams
// (voltage, threshold, …) are preserved.

const PLC_MAP = {
  plc_digital_input: { type: 'plc_input', mode: 'Digital' },
  plc_analog_input: { type: 'plc_input', mode: 'Analogue' },
  plc_digital_output: { type: 'plc_output', mode: 'Digital' },
  plc_pwm_output: { type: 'plc_output', mode: 'PWM' },
}

// True for a legacy PLC type that needs converting.
export function isLegacyPlcType(type) {
  return Object.prototype.hasOwnProperty.call(PLC_MAP, type)
}

// Mutates and returns the component if it is a legacy PLC part; otherwise returns
// it untouched. Idempotent — running it twice is a no-op (the second pass sees a
// non-legacy type).
export function migratePlcComponent(c) {
  if (!c || !isLegacyPlcType(c.type)) return c
  const { type, mode } = PLC_MAP[c.type]
  c.simParams = { ...(c.simParams || {}) }
  // Preserve the pin address that used to live in `value`.
  if (c.simParams.address == null || c.simParams.address === '') {
    c.simParams.address = c.value || c.simParams.address || ''
  }
  if (c.simParams.mode == null) c.simParams.mode = mode
  c.type = type
  return c
}
