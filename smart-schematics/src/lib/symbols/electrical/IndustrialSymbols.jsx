import React from 'react'
import {
  terminalStripDrawing,
  harnessConnectorDrawing,
  safetyRelayDrawing,
  safetyIoDrawing,
  selectorDrawing,
  indicatorLens,
} from '../../industrial'

// Industrial control-panel symbols. Every shape here is derived from the pure
// geometry helpers in lib/industrial.js — the same helpers that produce the pin
// set — so the picture and the connection points can never disagree.
//
// Contact drawing follows the convention already used by SwitchSymbols /
// ElectromechanicalSymbols: a filled dot at each fixed contact, and a blade that
// pivots off one of them and stands clear of the other when open.

const SW = 1.5

// PlacedComponent applies flipH/flipV as scale(-1,1)/scale(1,-1) to the whole
// symbol body, which mirrors text too. Wrapping labels in the inverse scale
// keeps terminal numbers readable on a mirrored part while the body and pin
// geometry still flip.
function CounterFlip({ flipH, flipV, children }) {
  if (!flipH && !flipV) return <>{children}</>
  return <g transform={`scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`}>{children}</g>
}

function Label({ x, y, size = 7, anchor = 'middle', weight, opacity, children }) {
  return (
    <text
      x={x} y={y} fontSize={size} fill="currentColor" textAnchor={anchor}
      dominantBaseline="central" fontWeight={weight} opacity={opacity}
      style={{ userSelect: 'none' }}
    >
      {children}
    </text>
  )
}

const Dot = ({ x, y, r = 2 }) => <circle cx={x} cy={y} r={r} fill="currentColor" />

// ── Terminal strip ──────────────────────────────────────────────────────────

export function TerminalStripSymbol({ params = {}, flipH, flipV }) {
  const d = terminalStripDrawing(params)
  const round = d.style === 'Round'
  return (
    <g>
      <rect
        x={d.rect.x} y={d.rect.y} width={d.rect.width} height={d.rect.height}
        stroke="currentColor" strokeWidth={SW} fill="none"
      />
      {d.cells.map((cell, i) => (
        <g key={i}>
          {/* Through-link: field conductor (below) to internal conductor (above). */}
          <line x1={cell.x} y1={-d.half} x2={cell.x} y2={d.half} stroke="currentColor" strokeWidth={SW} />
          <line x1={cell.x} y1={d.lead.top} x2={cell.x} y2={-d.half} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          <line x1={cell.x} y1={d.half} x2={cell.x} y2={d.lead.bottom} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          {/* Panel-rail style: a screw terminal sits on the bar at every way. */}
          {round && (
            <circle cx={cell.x} cy={0} r={3.4} stroke="currentColor" strokeWidth={SW} fill="var(--canvas-bg, #fff)" />
          )}
          {/* Knife-disconnect blade, drawn across the link when enabled. */}
          {d.disconnect && !round && (
            <line x1={cell.x - 1} y1={4} x2={cell.x + 5} y2={-4} stroke="currentColor" strokeWidth={1} strokeLinecap="round" />
          )}
          {/* A block rules off each way; a panel rail is one continuous bar. */}
          {!round && cell.separatorX != null && (
            <line
              x1={cell.separatorX} y1={-d.half} x2={cell.separatorX} y2={d.half}
              stroke="currentColor" strokeWidth={0.75} opacity={0.6}
            />
          )}
        </g>
      ))}
      {/* Internal jumpers — straps made off inside the plug, with a junction dot
          where each one lands on its terminal's conductor. */}
      {d.jumpers.map((j, i) => (
        <g key={`j${i}`}>
          <polyline
            points={`${j.xa},${-d.half} ${j.xa},${j.y} ${j.xb},${j.y} ${j.xb},${-d.half}`}
            fill="none" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" strokeLinecap="round"
          />
          <Dot x={j.xa} y={-d.half} r={1.8} />
          <Dot x={j.xb} y={-d.half} r={1.8} />
        </g>
      ))}
      <CounterFlip flipH={flipH} flipV={flipV}>
        {d.cells.map((cell, i) => (
          // Block: number inside its own cell. Panel rail: number printed just
          // under the bar. Either way it sits beside the conductor, never on it.
          <Label key={i} x={cell.x - 6} y={round ? d.half + 8 : 0} size={6.5}>
            {cell.number}
          </Label>
        ))}
      </CounterFlip>
    </g>
  )
}

// ── Harness connector ───────────────────────────────────────────────────────

export function HarnessConnectorSymbol({ params = {}, flipH, flipV }) {
  const d = harnessConnectorDrawing(params)
  const { x, y, width, height } = d.rect
  const keyed = d.style === 'Keyed'
  const chamfer = 6
  // Keyed housings get a chamfered top-right corner as the orientation key, so a
  // flipped mating half reads as the other end of the same connector. A plain
  // harness/loom housing is just a ruled rectangle of numbered ways.
  const outline = keyed
    ? [
        `M ${x} ${y}`,
        `L ${x + width - chamfer} ${y}`,
        `L ${x + width} ${y + chamfer}`,
        `L ${x + width} ${y + height}`,
        `L ${x} ${y + height}`,
        'Z',
      ].join(' ')
    : `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`

  return (
    <g>
      <path d={outline} stroke="currentColor" strokeWidth={SW} fill="none" strokeLinejoin="round" />
      {d.contacts.map((c, i) => (
        <g key={i}>
          {keyed && (d.gender === 'Pin'
            // Male contact: solid, pointing out of the shell.
            ? <path d={`M ${d.edge - 8} ${c.y - 3} L ${d.edge - 8} ${c.y + 3} L ${d.edge - 1} ${c.y} Z`} fill="currentColor" stroke="none" />
            // Female contact: an open cup facing the mating pin.
            : <path d={`M ${d.edge - 1} ${c.y - 3.5} L ${d.edge - 7} ${c.y} L ${d.edge - 1} ${c.y + 3.5}`}
                fill="none" stroke="currentColor" strokeWidth={SW} strokeLinejoin="round" strokeLinecap="round" />)}
          {/* Way divider — the numbered column reads as a way list. */}
          {!keyed && c.dividerY != null && (
            <line x1={x} y1={c.dividerY} x2={x + width} y2={c.dividerY}
              stroke="currentColor" strokeWidth={0.75} opacity={0.6} />
          )}
          <line x1={d.edge} y1={c.y} x2={d.pinX} y2={c.y} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
        </g>
      ))}
      <CounterFlip flipH={flipH} flipV={flipV}>
        {d.contacts.map((c, i) => (
          <Label key={i} x={keyed ? d.left + 4 : (x + d.edge) / 2} y={c.y} size={7}
            anchor={keyed ? 'start' : 'middle'}>{c.number}</Label>
        ))}
      </CounterFlip>
    </g>
  )
}

// ── Safety relay ────────────────────────────────────────────────────────────

// One output of a dual-channel safety relay: TWO redundant contacts in series,
// one per internal relay, riding the two armature bars that run across the whole
// output section. Each contact is the library's standard blade — clear of its
// fixed contact when normally-open, resting on it when normally-closed.
// Clear space kept below the top edge (and above the bottom edge) for the
// printed terminal number, so a conductor is never drawn through its own label.
const RELAY_NUMBER_ROW = 17

export function OutputContact({ x, kind, half, lead, c }) {
  const open = kind === 'NO'
  // Open: the blade swings away and stops well clear of its fixed contact.
  // Closed: it lies on the fixed contact, which also carries a stop face.
  const contact = (pivotY, fixedY, key) => (
    <g key={key}>
      <Dot x={x} y={fixedY} />
      <Dot x={x} y={pivotY} />
      {!open && (
        <line x1={x - 1} y1={fixedY} x2={x + 8} y2={fixedY}
          stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      )}
      <line
        x1={x} y1={pivotY}
        x2={x + (open ? 11 : 5)} y2={open ? pivotY - 12 : fixedY - 2}
        stroke="currentColor" strokeWidth={SW} strokeLinecap="round"
      />
    </g>
  )
  return (
    <g>
      {/* Terminal leads out of the housing */}
      <line x1={x} y1={-half} x2={x} y2={-half - lead} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1={x} y1={half} x2={x} y2={half + lead} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      {/* Top terminal → contact 1 → link → contact 2 → bottom terminal. The
          internal run starts below the printed terminal number. */}
      <line x1={x} y1={-half + RELAY_NUMBER_ROW} x2={x} y2={c.fixed1} stroke="currentColor" strokeWidth={SW} />
      <line x1={x} y1={c.pivot1} x2={x} y2={c.fixed2} stroke="currentColor" strokeWidth={SW} />
      <line x1={x} y1={c.pivot2} x2={x} y2={half - RELAY_NUMBER_ROW} stroke="currentColor" strokeWidth={SW} />
      {contact(c.pivot1, c.fixed1, 'k1')}
      {contact(c.pivot2, c.fixed2, 'k2')}
    </g>
  )
}

// A ⊠ legend cell — the crossed square a panel device uses for its status lamps
// and its mode legend.
function LegendCell({ x, y, size = 10, crossed = true }) {
  return (
    <g>
      <rect x={x} y={y - size / 2} width={size} height={size} stroke="currentColor" strokeWidth={1} fill="none" />
      {crossed && <>
        <line x1={x} y1={y - size / 2} x2={x + size} y2={y + size / 2} stroke="currentColor" strokeWidth={0.75} />
        <line x1={x} y1={y + size / 2} x2={x + size} y2={y - size / 2} stroke="currentColor" strokeWidth={0.75} />
      </>}
    </g>
  )
}

export function SafetyRelaySymbol({ params = {}, state = {}, flipH, flipV }) {
  const d = safetyRelayDrawing(params)
  const energised = !!state.on
  const brand = params.brand ?? ''
  const model = params.model ?? ''
  const tag = params.tag ?? ''
  const supply = params.supply ?? ''
  const topY = -d.half
  const botY = d.half
  // Status lamps sit in the gap between the last channel column and the first
  // output column, stacked down the middle of the housing.
  const indX = (d.x(d.supplyCols + d.channelCols - 1) + d.x(d.firstContactCol)) / 2
  const indY = i => topY + 34 + i * 16
  // Mode legend sits under the lamp stack, as a joined two-cell column.
  const modeY = i => indY(d.indicators.length - 1) + 22 + i * 10

  // Terminal stubs: a lead out to the pin plus a solid dot on the housing edge,
  // matching the way panel-device datasheets draw their terminal blocks.
  const stub = (x, top, key) => (
    <g key={key}>
      <line x1={x} y1={top ? topY : botY} x2={x} y2={top ? topY - d.lead : botY + d.lead}
        stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <Dot x={x} y={top ? topY : botY} />
    </g>
  )

  const supplyStubs = [
    stub(d.supply.xPos, true, 'a1'), stub(d.supply.xNeg, true, 'a2'),
    stub(d.supply.xPos, false, 'x1'), stub(d.supply.xNeg, false, 'x4'),
  ]

  return (
    <g style={energised ? { color: 'var(--sim-active-color, #f59e0b)' } : undefined}>
      <rect
        x={d.rect.x} y={d.rect.y} width={d.rect.width} height={d.rect.height}
        stroke="currentColor" strokeWidth={SW} fill="none"
      />
      {supplyStubs}
      {d.channels.map((ch, i) => (
        <g key={`ch${i}`}>
          {stub(ch.xT, true, `t${i}`)}
          {stub(ch.xR, true, `r${i}`)}
          {/* Legend for the monitored channel: the external contact that has to
              close between the test output and its return. */}
          <polyline
            points={`${ch.xT},${topY + 32} ${ch.xT + 7},${topY + 32} ${ch.xR - 7},${topY + 25} ${ch.xR},${topY + 25}`}
            fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round"
          />
        </g>
      ))}
      {/* The two internal relays' armature bars, drawn right across the output
          section — every contact hangs off them, which is what force-guided
          means. Drawn first so the contact blades sit on top. */}
      {d.armatures.map((a, i) => (
        <line key={`arm${i}`} x1={a.from} y1={a.y} x2={a.to} y2={a.y}
          stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      ))}
      {d.outputs.map((o, i) => (
        <OutputContact key={`o${i}`} x={o.x} kind={o.kind} half={d.half} lead={d.lead} c={d.contact} />
      ))}
      {/* Status indicators, stacked between the input and output sections. */}
      {d.indicators.map((name, i) => (
        <LegendCell key={`ind${i}`} x={indX - 20} y={indY(i)} />
      ))}
      {/* Mode legend: Manual over Auto, the selected one crossed. */}
      <LegendCell x={indX - 20} y={modeY(0)} size={9} crossed={d.modeSelect.active === 'M'} />
      <LegendCell x={indX - 20} y={modeY(1)} size={9} crossed={d.modeSelect.active === 'A'} />

      <CounterFlip flipH={flipH} flipV={flipV}>
        {/* Terminal designations, printed just inside the housing edge. */}
        <Label x={d.supply.xPos} y={topY + 9}>A1</Label>
        <Label x={d.supply.xNeg} y={topY + 9}>A2</Label>
        <Label x={d.supply.xPos} y={topY + 20} size={6} opacity={0.8}>(+)</Label>
        <Label x={d.supply.xNeg} y={topY + 20} size={6} opacity={0.8}>(−)</Label>
        {supply && (
          <Label x={(d.supply.xPos + d.supply.xNeg) / 2} y={topY + 33} size={6.5} opacity={0.8}>{supply}</Label>
        )}
        <Label x={d.supply.xPos} y={botY - 9}>X1</Label>
        <Label x={d.supply.xNeg} y={botY - 9}>X4</Label>
        {d.channels.map((ch, i) => (
          <g key={`chl${i}`}>
            <Label x={ch.xT} y={topY + 9}>{`T${i + 1}`}</Label>
            <Label x={ch.xR} y={topY + 9}>{`R${i + 1}`}</Label>
            <Label x={(ch.xT + ch.xR) / 2} y={topY + 44} size={6.5} opacity={0.85}>{ch.label}</Label>
          </g>
        ))}
        {d.outputs.map((o, i) => (
          <g key={`ol${i}`}>
            <Label x={o.x} y={topY + 9}>{o.top}</Label>
            <Label x={o.x} y={botY - 9}>{o.bottom}</Label>
          </g>
        ))}
        {d.indicators.map((name, i) => (
          <Label key={`indl${i}`} x={indX - 6} y={indY(i)} size={6.5} anchor="start">{name}</Label>
        ))}
        <Label x={indX - 6} y={modeY(0)} size={6.5} anchor="start">M</Label>
        <Label x={indX - 6} y={modeY(1)} size={6.5} anchor="start">A</Label>
        {/* Manufacturer and model read side by side, with the device tag called
            out in bold beneath — the way the device is captioned on the sheet. */}
        {brand && <Label x={d.rect.x + 56} y={botY - 62} size={10}>{brand}</Label>}
        {model && <Label x={d.rect.x + 132} y={botY - 62} size={10}>{model}</Label>}
        {tag && <Label x={d.rect.x + 94} y={botY - 40} size={12} weight="bold">{tag}</Label>}
      </CounterFlip>
    </g>
  )
}

// ── Safety I/O module (terminal group) ──────────────────────────────────────

export function SafetyIoModuleSymbol({ params = {}, flipH, flipV }) {
  const d = safetyIoDrawing(params)
  return (
    <g>
      {/* Group boundary — dashed, the way a safety controller's terminal groups
          are fenced off on the manufacturer's diagram. */}
      <rect
        x={d.rect.x} y={d.rect.y} width={d.rect.width} height={d.rect.height}
        stroke="currentColor" strokeWidth={SW} strokeDasharray="5,3" fill="none"
      />
      {/* Signal designations get their own ruled strip along the group. */}
      <rect
        x={d.signalBox.x} y={d.signalBox.y} width={d.signalBox.width} height={d.signalBox.height}
        stroke="currentColor" strokeWidth={0.75} fill="none"
      />
      {d.terminals.map((t, i) => (
        <g key={i}>
          {/* Screw terminal: a ring with its stud, as the controller draws them. */}
          <circle cx={t.x} cy={d.rows.ring} r={3.2} stroke="currentColor" strokeWidth={SW} fill="none" />
          <line x1={t.x - 1.6} y1={d.rows.ring - 1.6} x2={t.x + 1.6} y2={d.rows.ring + 1.6}
            stroke="currentColor" strokeWidth={0.75} />
          {/* The conductor leaves the housing clear of every label, so nothing is
              ever drawn through a terminal number or a signal designation. */}
          <line
            x1={t.x} y1={d.leadFrom} x2={t.x} y2={d.leadTo}
            stroke="currentColor" strokeWidth={SW} strokeLinecap="round"
          />
        </g>
      ))}
      <CounterFlip flipH={flipH} flipV={flipV}>
        <Label x={d.labelX} y={d.labelY} size={11} anchor="start" weight="bold">{d.group}</Label>
        {d.terminals.map((t, i) => (
          <g key={i}>
            <Label x={t.x} y={d.rows.number} size={6.5}>{t.number}</Label>
            {t.signal && <Label x={t.x} y={d.rows.signal} size={6} opacity={0.8}>{t.signal}</Label>}
          </g>
        ))}
      </CounterFlip>
    </g>
  )
}

// ── Mode / selector switch ──────────────────────────────────────────────────

export function SelectorSwitchSymbol({ params = {}, flipH, flipV }) {
  const d = selectorDrawing(params)
  return (
    <g>
      {d.contacts.map((c, i) => (
        <g key={i}>
          {/* Legs down to the two terminals this contact bridges */}
          <line x1={c.left} y1={d.contactY} x2={c.left} y2={d.pinY} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          <line x1={c.right} y1={d.contactY} x2={c.right} y2={d.pinY} stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
          <Dot x={c.left} y={d.contactY} />
          <Dot x={c.right} y={d.contactY} />
          {/* Blade: lying across both contacts when made, swung clear when not */}
          <line
            x1={c.left} y1={d.contactY}
            x2={c.made ? c.right : c.right - 2} y2={c.made ? d.contactY : d.contactY - 14}
            stroke="currentColor" strokeWidth={SW} strokeLinecap="round"
          />
          {/* Tie from the shaft down to this contact's blade */}
          {d.gang && (
            <line x1={c.x} y1={d.gangY} x2={c.x} y2={d.contactY - (c.made ? 0 : 7)}
              stroke="currentColor" strokeWidth={1} strokeDasharray="3,2" />
          )}
        </g>
      ))}
      {/* One shaft throws every contact together. */}
      {d.gang && (
        <line
          x1={d.gang.from} y1={d.gang.y} x2={d.gang.to} y2={d.gang.y}
          stroke="currentColor" strokeWidth={1} strokeDasharray="3,2"
        />
      )}
      <CounterFlip flipH={flipH} flipV={flipV}>
        {d.contacts.map((c, i) => (
          <g key={i}>
            {/* Terminal numbers sit beside their own leg, never on it. */}
            <Label x={c.left - 6} y={d.pinY - 9} size={6.5}>{c.numberA}</Label>
            <Label x={c.right - 6} y={d.pinY - 9} size={6.5}>{c.numberB}</Label>
          </g>
        ))}
      </CounterFlip>
    </g>
  )
}

// ── Panel indicator ─────────────────────────────────────────────────────────

export function PanelIndicatorSymbol({ params = {}, state = {} }) {
  const lit = !!state.on
  const lens = indicatorLens(params.colour)
  const style = params.style === 'Panel' ? 'Panel' : params.style === 'LED' ? 'LED' : 'Lamp'
  // Unlit indicators stay monochrome (no fill) so a printed drawing reads as
  // line art; lighting one fills the lens with its colour rather than adding a
  // glow overlay.
  const fill = lit ? lens : 'none'

  // A status light driven from an electronic output is drawn as an LED: the
  // diode triangle against its cathode bar, with the two emission arrows.
  if (style === 'LED') {
    return (
      <g>
        <line x1="-20" y1="0" x2="-7" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
        <line x1="7" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
        <path d="M -7 -7 L -7 7 L 7 0 Z" stroke="currentColor" strokeWidth={SW} fill={fill} strokeLinejoin="round" />
        <line x1="7" y1="-8" x2="7" y2="8" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
        {[0, 1].map(i => (
          <g key={i} transform={`translate(${-2 + i * 6}, -9)`}>
            <line x1="0" y1="0" x2="5" y2="-6" stroke="currentColor" strokeWidth={1} strokeLinecap="round" />
            <path d="M 5 -6 L 1.6 -4.4 L 3.4 -2.4 Z" fill="currentColor" stroke="none" />
          </g>
        ))}
      </g>
    )
  }

  const panel = style === 'Panel'
  return (
    <g>
      <line x1="-20" y1="0" x2={panel ? -9 : -8} y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1={panel ? 9 : 8} y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      {panel
        ? <rect x="-9" y="-9" width="18" height="18" stroke="currentColor" strokeWidth={SW} fill={fill} />
        : <circle cx="0" cy="0" r="9" stroke="currentColor" strokeWidth={SW} fill={fill} />}
      {/* IEC 60617 signal-lamp cross. */}
      <line x1="-6.4" y1="-6.4" x2="6.4" y2="6.4" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
      <line x1="-6.4" y1="6.4" x2="6.4" y2="-6.4" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" />
    </g>
  )
}
