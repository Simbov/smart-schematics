import React from 'react'

const SW = 1.5

// Keep child text readable when the parent component is mirrored. PlacedComponent
// applies flipH/flipV as scale(-1,1)/scale(1,-1) on the whole symbol body, which
// also reverses any text. Wrapping text in the inverse scale cancels the mirror
// so labels (e.g. "DI") stay forward while the box/leads still flip to match the
// reattached pin geometry.
function CounterFlip({ flipH, flipV, children }) {
  if (!flipH && !flipV) return <>{children}</>
  const sx = flipH ? -1 : 1
  const sy = flipV ? -1 : 1
  return <g transform={`scale(${sx}, ${sy})`}>{children}</g>
}

// Shared module box (28×30) with a single field-side lead on the right (pin at x=20).
// `name` (signal name) renders above the box; `address` (pin address, e.g.
// I0.0/Q0.0) renders below — the component's designator is NOT drawn for PLC I/O
// (PlacedComponent suppresses it), so these two labels never collide with a ref.
// Both are kept upright on mirror. No flow-direction arrows — the DI/DO/AI/PWM
// glyphs already say which way the signal goes.
function IOFrame({ glyph, label, labelSize = 9, state, params = {}, flipH, flipV }) {
  // Energised I/O turns amber (color change only — no overlay rects).
  const energised = state?.on
  // Display toggles — what the symbol draws. name/address default ON, device/
  // current default OFF (older saved components have no flags → sensible default).
  const showName = params.showName !== false && params.name
  const showAddress = params.showAddress !== false && params.address
  const showDevice = params.showDevice === true && params.device
  const showCurrent = params.showCurrent === true && params.maxCurrent != null && params.maxCurrent !== ''
  return (
    <g style={energised ? { color: 'var(--sim-active-color, #f59e0b)' } : undefined}>
      <rect x="-18" y="-15" width="28" height="30" rx="2" stroke="currentColor" strokeWidth={SW} fill="none" />
      {glyph}
      <CounterFlip flipH={flipH} flipV={flipV}>
        <text x="-4" y="9" fontSize={labelSize} fill="currentColor" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">
          {label}
        </text>
      </CounterFlip>
      {/* field-side lead */}
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <CounterFlip flipH={flipH} flipV={flipV}>
        {showDevice && (
          <text x="-4" y="-29" fontSize={6} fill="currentColor" textAnchor="middle" opacity="0.75">{params.device}</text>
        )}
        {showName && (
          <text x="-4" y="-20" fontSize={7} fill="currentColor" textAnchor="middle">{params.name}</text>
        )}
        {showAddress && (
          <text x="-4" y="25" fontSize={7} fill="currentColor" textAnchor="middle" fontWeight="bold">{params.address}</text>
        )}
        {showCurrent && (
          <text x="-4" y="33" fontSize={6} fill="currentColor" textAnchor="middle" opacity="0.85">{`${params.maxCurrent} A`}</text>
        )}
      </CounterFlip>
    </g>
  )
}

// Square wave — digital (logic-level) signal.
const SquareWaveGlyph = (
  <polyline
    points="-13,-3 -10,-3 -10,-10 -4,-10 -4,-3 2,-3 2,-10 5,-10"
    stroke="currentColor"
    strokeWidth={SW}
    fill="none"
    strokeLinejoin="round"
    strokeLinecap="round"
  />
)

// Narrow high pulses — PWM (variable duty cycle).
const PWMGlyph = (
  <polyline
    points="-13,-3 -11,-3 -11,-10 -9,-10 -9,-3 -3,-3 -3,-10 -1,-10 -1,-3 3,-3 3,-10 5,-10"
    stroke="currentColor"
    strokeWidth={SW}
    fill="none"
    strokeLinejoin="round"
    strokeLinecap="round"
  />
)

// Sine wave — analogue (continuous) signal.
const SineGlyph = (
  <path
    d="M -13 -6 Q -10 -11 -7 -6 T -1 -6 T 5 -6"
    stroke="currentColor"
    strokeWidth={SW}
    fill="none"
    strokeLinecap="round"
  />
)

// ── Consolidated PLC I/O (mode-switchable) ───────────────────────────────────
// One input component toggles between Digital and Analogue; one output between
// Digital and PWM. The mode lives in params.mode; the glyph + label follow it.

export function PLCInputSymbol({ state, params = {}, flipH, flipV }) {
  const analogue = params.mode === 'Analogue'
  return (
    <IOFrame
      glyph={analogue ? SineGlyph : SquareWaveGlyph}
      label={analogue ? 'AI' : 'DI'}
      state={state}
      params={params}
      flipH={flipH}
      flipV={flipV}
    />
  )
}

export function PLCOutputSymbol({ state, params = {}, flipH, flipV }) {
  const pwm = params.mode === 'PWM'
  return (
    <IOFrame
      glyph={pwm ? PWMGlyph : SquareWaveGlyph}
      label={pwm ? 'PWM' : 'DO'}
      labelSize={pwm ? 7 : 9}
      state={state}
      params={params}
      flipH={flipH}
      flipV={flipV}
    />
  )
}

// Legacy exports — kept so any not-yet-migrated component (or external import)
// still renders. New drawings use PLCInputSymbol / PLCOutputSymbol.
export function PLCDigitalOutputSymbol({ state, ...rest }) {
  return <PLCOutputSymbol state={state} params={{ mode: 'Digital' }} {...rest} />
}
export function PLCPWMOutputSymbol({ state, ...rest }) {
  return <PLCOutputSymbol state={state} params={{ mode: 'PWM' }} {...rest} />
}
export function PLCDigitalInputSymbol({ ...rest }) {
  return <PLCInputSymbol params={{ mode: 'Digital' }} {...rest} />
}
export function PLCAnalogInputSymbol({ ...rest }) {
  return <PLCInputSymbol params={{ mode: 'Analogue' }} {...rest} />
}
