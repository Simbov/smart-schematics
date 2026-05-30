import React from 'react'

const SW = 1.5

// Shared module box (28×30) with a single field-side lead on the right (pin at x=20).
// `dir` = 'out' (signal leaves the PLC → arrow toward the pin) or
//         'in'  (signal enters the PLC → arrow toward the box).
function IOFrame({ dir, glyph, label, labelSize = 9, state }) {
  const arrow =
    dir === 'out'
      ? '12,-3.5 18,0 12,3.5' // points right, toward the field pin
      : '18,-3.5 12,0 18,3.5' // points left, into the module
  // Energised outputs turn amber (color change only — no overlay rects).
  const energised = state?.on
  return (
    <g style={energised ? { color: 'var(--sim-active-color, #f59e0b)' } : undefined}>
      <rect x="-18" y="-15" width="28" height="30" rx="2" stroke="currentColor" strokeWidth={SW} fill="none" />
      {glyph}
      <text
        x="-4"
        y="9"
        fontSize={labelSize}
        fill="currentColor"
        textAnchor="middle"
        dominantBaseline="middle"
        fontWeight="bold"
      >
        {label}
      </text>
      {/* field-side lead + signal-direction arrow (arrowhead sits on the lead line) */}
      <line x1="10" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <polygon points={arrow} fill="currentColor" stroke="none" />
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

export function PLCDigitalOutputSymbol({ state }) {
  return <IOFrame dir="out" glyph={SquareWaveGlyph} label="DO" state={state} />
}

export function PLCPWMOutputSymbol({ state }) {
  return <IOFrame dir="out" glyph={PWMGlyph} label="PWM" labelSize={7} state={state} />
}

export function PLCDigitalInputSymbol() {
  return <IOFrame dir="in" glyph={SquareWaveGlyph} label="DI" />
}

export function PLCAnalogInputSymbol() {
  return <IOFrame dir="in" glyph={SineGlyph} label="AI" />
}
