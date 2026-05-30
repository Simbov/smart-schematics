# Smart Schematics

A desktop app for drawing and simulating electrical schematics. Place standards-based
component symbols on an infinite SVG canvas, wire them together, and run a live
logic/power simulation — all in a native window.

> **v0.0.1** — first public release.

## Features

- **Schematic editor** — infinite pan/zoom SVG canvas with grid snap, selection,
  copy/paste, and multi-level undo/redo.
- **Component library** — resistors, capacitors, sources, switches, logic gates,
  LEDs, and more, drawn to IEC/IEEE/ISO conventions (resistor style switchable IEC/ANSI).
- **Wiring** — click-to-route wires with automatic junctions and net tracking.
- **Live simulation** — run a ~10 Hz power/logic tick; powered components light up,
  switches are interactive while running.
- **Projects & files** — multiple drawings per project, saved to `.scpro` files with
  autosave, recent-files, and external-change detection (e.g. cloud sync).
- **Export** — export drawings as `.svg`.
- **Light & dark themes.**

## Tech stack

React 19 · Vite 8 · Zustand · Tailwind v3 · SVG rendering · Tauri v2 (macOS + Windows).

## Getting started

The app lives in the [`smart-schematics/`](smart-schematics/) subdirectory.

```bash
cd smart-schematics
npm install
```

### Run in the browser (dev)

```bash
npm run dev
```

### Run as a native desktop app

```bash
npx tauri dev
```

The first native build compiles the Rust shell (~1–2 min); later runs are fast.

### Build a release binary

```bash
npx tauri build
```

### Tests

```bash
npm run test:run
```

## License

[MIT](LICENSE) © 2026 Simon Vollert
