import { describe, it, expect } from 'vitest'
import { isLegacyPlcType, migratePlcComponent } from './plcMigration'

describe('PLC consolidation migration', () => {
  it('flags only the legacy PLC types', () => {
    expect(isLegacyPlcType('plc_digital_input')).toBe(true)
    expect(isLegacyPlcType('plc_analog_input')).toBe(true)
    expect(isLegacyPlcType('plc_digital_output')).toBe(true)
    expect(isLegacyPlcType('plc_pwm_output')).toBe(true)
    expect(isLegacyPlcType('plc_input')).toBe(false)
    expect(isLegacyPlcType('resistor')).toBe(false)
  })

  it('maps digital input → plc_input mode Digital, preserving the address', () => {
    const c = migratePlcComponent({ type: 'plc_digital_input', value: 'I0.0', simParams: { threshold: 11 } })
    expect(c.type).toBe('plc_input')
    expect(c.simParams.mode).toBe('Digital')
    expect(c.simParams.address).toBe('I0.0')
    expect(c.simParams.threshold).toBe(11)
  })

  it('maps analog input → plc_input mode Analogue', () => {
    const c = migratePlcComponent({ type: 'plc_analog_input', value: 'IW64', simParams: {} })
    expect(c.type).toBe('plc_input')
    expect(c.simParams.mode).toBe('Analogue')
    expect(c.simParams.address).toBe('IW64')
  })

  it('maps digital output → plc_output mode Digital', () => {
    const c = migratePlcComponent({ type: 'plc_digital_output', value: 'Q0.0' })
    expect(c.type).toBe('plc_output')
    expect(c.simParams.mode).toBe('Digital')
    expect(c.simParams.address).toBe('Q0.0')
  })

  it('maps pwm output → plc_output mode PWM', () => {
    const c = migratePlcComponent({ type: 'plc_pwm_output', value: 'Q0.1', simParams: { dutyCycle: 75 } })
    expect(c.type).toBe('plc_output')
    expect(c.simParams.mode).toBe('PWM')
    expect(c.simParams.dutyCycle).toBe(75)
  })

  it('leaves non-PLC components untouched', () => {
    const r = { type: 'resistor', value: '1k', simParams: { resistance: 1000 } }
    expect(migratePlcComponent(r)).toBe(r)
    expect(r.type).toBe('resistor')
  })

  it('is idempotent', () => {
    const once = migratePlcComponent({ type: 'plc_digital_input', value: 'I0.0' })
    const twice = migratePlcComponent({ ...once })
    expect(twice.type).toBe('plc_input')
    expect(twice.simParams.mode).toBe('Digital')
    expect(twice.simParams.address).toBe('I0.0')
  })

  it('does not clobber an existing address/mode on re-run', () => {
    const c = migratePlcComponent({ type: 'plc_input', value: 'old', simParams: { address: 'I5.0', mode: 'Analogue' } })
    // already-consolidated type → untouched
    expect(c.simParams.address).toBe('I5.0')
    expect(c.simParams.mode).toBe('Analogue')
  })
})
