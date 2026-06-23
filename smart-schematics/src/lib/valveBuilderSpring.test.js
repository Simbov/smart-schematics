import { describe, it, expect } from 'vitest'
import { valveConfig } from './valveBuilder'

describe('Valve builder spring-return option (issue #28)', () => {
  it('defaults to spring-returned', () => {
    expect(valveConfig({}).springReturn).toBe(true)
  })

  it('can be turned off for a detented valve', () => {
    expect(valveConfig({ springReturn: false }).springReturn).toBe(false)
  })
})
