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

## Install (just run it)

Grab the installer for your OS from the
**[latest release](../../releases/latest)** — no terminal, no dependencies.

### macOS

1. Download the **`.dmg`**, open it, and drag **Smart Schematics** into **Applications**.
2. First launch only: the app is unsigned, so **right-click the app → Open → Open**.
   (macOS blocks unsigned apps on a normal double-click the first time.)
   - Alternative: run once in Terminal:
     `xattr -cr "/Applications/Smart Schematics.app"`
3. After that, open it normally from Applications/Launchpad.

The download is a **universal** build — it runs on both Apple Silicon (M-series)
and Intel Macs.

### Windows

1. Download the **`.msi`** (or **`.exe`** setup) and run it.
2. First launch only: if Microsoft Defender SmartScreen warns
   ("Windows protected your PC"), click **More info → Run anyway**.
   (This appears because the installer isn't code-signed yet.)
3. Launch **Smart Schematics** from the Start menu.

> These warnings are normal for an unsigned hobby release and don't mean
> anything is wrong — they go away once the app is code-signed in a future release.

---

## Developing

The source lives in the [`smart-schematics/`](smart-schematics/) subdirectory.

```bash
cd smart-schematics
npm install
```

**Run in the browser (dev):**

```bash
npm run dev
```

**Run as a native desktop app** (requires the [Rust toolchain](https://rustup.rs) +
[Tauri prerequisites](https://tauri.app/start/prerequisites/)):

```bash
npx tauri dev
```

The first native build compiles the Rust shell (~1–2 min); later runs are fast.

**Build installers locally:**

```bash
npx tauri build
```

Output lands in `src-tauri/target/release/bundle/`.

**Run the tests:**

```bash
npm run test:run
```

## Releasing

Installers are built automatically by GitHub Actions. To cut a release:

```bash
# bump the version in package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml
git tag v0.0.1
git push origin v0.0.1
```

The [`Release`](.github/workflows/release.yml) workflow then builds the macOS
(`.dmg`) and Windows (`.msi`/`.exe`) installers on hosted runners and attaches
them to a **draft** GitHub Release — review it, then publish.

## License

[MIT](LICENSE) © 2026 Simon Vollert
