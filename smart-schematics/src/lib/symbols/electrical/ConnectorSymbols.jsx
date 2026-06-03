import React from 'react'

const SW = 1.5
// Cavity electrode sits at the housing's right edge (x=10); the on-line lead runs
// from there out to the pin at x=20. Pin Y positions match the def `pins[]` relY.
const EDGE = 10 // right edge of the housing (where leads meet the contacts)
const PIN_X = 20 // pin electrode (lead endpoint)

// A single contact cavity: a small open circle on the housing edge plus the
// on-line lead out to the pin, and the cavity number printed inside the housing.
function Cavity({ y, n }) {
  return (
    <g>
      {/* cavity ring (female contact) */}
      <circle cx={EDGE - 3} cy={y} r={2.4} stroke="currentColor" strokeWidth={SW} fill="none" />
      {/* on-line lead: contact → pin */}
      <line x1={EDGE} y1={y} x2={PIN_X} y2={y} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      {/* cavity number */}
      <text
        x={EDGE - 9}
        y={y}
        fontSize={7}
        fill="currentColor"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {n}
      </text>
    </g>
  )
}

// Deutsch DT housing: rounded rectangle with a keyed (chamfered) top-right corner
// so plug orientation reads at a glance. `pinYs` are the cavity centre lines.
function DeutschHousing({ pinYs }) {
  const top = pinYs[0] - 10
  const bot = pinYs[pinYs.length - 1] + 10
  const left = -16
  const chamfer = 6
  // outline: rounded-ish box with a chamfer on the top-right corner (the key)
  const d = [
    `M ${left} ${top}`,
    `L ${EDGE - chamfer} ${top}`,
    `L ${EDGE} ${top + chamfer}`,
    `L ${EDGE} ${bot}`,
    `L ${left} ${bot}`,
    'Z',
  ].join(' ')
  return (
    <>
      <path d={d} stroke="currentColor" strokeWidth={SW} fill="none" strokeLinejoin="round" />
      {pinYs.map((y, i) => (
        <Cavity key={i} y={y} n={i + 1} />
      ))}
    </>
  )
}

// M12 A-code circular connector: a circle housing with a small keyway notch on
// the left, contacts laid out vertically and led out to the right-edge pins.
function ACodeHousing({ pinYs }) {
  const cy = (pinYs[0] + pinYs[pinYs.length - 1]) / 2
  const r = (pinYs[pinYs.length - 1] - pinYs[0]) / 2 + 12
  return (
    <>
      <circle cx={-2} cy={cy} r={r} stroke="currentColor" strokeWidth={SW} fill="none" />
      {/* keyway notch (orientation key) at the left of the shell */}
      <line x1={-2 - r} y1={cy} x2={-2 - r + 4} y2={cy} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <text
        x={-2}
        y={pinYs[0] - 7}
        fontSize={6}
        fill="currentColor"
        textAnchor="middle"
        dominantBaseline="central"
      >
        A
      </text>
      {pinYs.map((y, i) => (
        <Cavity key={i} y={y} n={i + 1} />
      ))}
    </>
  )
}

// Generic n-way pin header: plain rectangular shroud with square contact pads.
function HeaderHousing({ pinYs }) {
  const top = pinYs[0] - 10
  const bot = pinYs[pinYs.length - 1] + 10
  const left = -16
  return (
    <>
      <rect
        x={left}
        y={top}
        width={EDGE - left}
        height={bot - top}
        rx={1}
        stroke="currentColor"
        strokeWidth={SW}
        fill="none"
      />
      {pinYs.map((y, i) => (
        <g key={i}>
          {/* square contact pad */}
          <rect x={EDGE - 5} y={y - 2.4} width={4.8} height={4.8} stroke="currentColor" strokeWidth={SW} fill="none" />
          <line x1={EDGE} y1={y} x2={PIN_X} y2={y} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          <text
            x={left + 6}
            y={y}
            fontSize={7}
            fill="currentColor"
            textAnchor="middle"
            dominantBaseline="central"
          >
            {i + 1}
          </text>
        </g>
      ))}
    </>
  )
}

export function ConnDT2Symbol() {
  return <DeutschHousing pinYs={[-10, 10]} />
}
export function ConnDT3Symbol() {
  return <DeutschHousing pinYs={[-20, 0, 20]} />
}
export function ConnDT4Symbol() {
  return <DeutschHousing pinYs={[-30, -10, 10, 30]} />
}

export function ConnACode3Symbol() {
  return <ACodeHousing pinYs={[-20, 0, 20]} />
}
export function ConnACode4Symbol() {
  return <ACodeHousing pinYs={[-30, -10, 10, 30]} />
}

export function ConnHeader2Symbol() {
  return <HeaderHousing pinYs={[-10, 10]} />
}
export function ConnHeader4Symbol() {
  return <HeaderHousing pinYs={[-30, -10, 10, 30]} />
}
