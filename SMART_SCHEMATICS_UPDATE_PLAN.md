# Smart Schematics Update — Implementation Plan

> Sequenced plan for the feedback roadmap (3 pages). Reorder phases/items freely.
> Sizing: **S** ≈ ½ day · **M** ≈ 1–2 days · **L** ≈ 3+ days.
> Every logic change ships with Vitest specs (enforced-testing rule).

---

## Phase 0 — 🔴 SAVE SAFETY (do first, blocks everything)

**The bug that ate 2 days of work.** `saveAll()` writes the *active* project to a
single global `currentFilePath`. `newProject()` switches the active project but
leaves `currentFilePath` pointing at the old file → the next 2 s autosave writes a
blank project over your old `.scpro`.

**Fix — per-project file paths (M):**
- Add `filePath` to the Project shape; `currentFilePath` becomes a *derived mirror*
  of the active project's `filePath`.
- `_buildProjectSnapshot()` / `saveAll()` write the active project to **its own**
  `filePath` — never another project's.
- `newProject()` → `filePath: null` (saves to localStorage / prompts on first real
  save, never clobbers an existing file).
- `setActiveProject()` / `deleteProject()` / `_loadProjectFromPath()` /
  `saveProjectFileAs()` keep `filePath` in sync.
- Files: `src/store/schematicStore.js`, `src/lib/projectFile.js`.
- Tests: new spec proving New-Project-then-autosave cannot overwrite an existing
  file path; switching projects writes to the correct path.

**Extra durability (S, recommended):**
- Write a `.scpro.bak` rotation on each successful save (keep last 1–3), so even a
  future bug is recoverable locally without relying on OneDrive.
- Optional: a "crash/blank-overwrite guard" — refuse to autosave an *empty* project
  over a non-empty file without confirmation.

---

## Phase 1 — ⭐ INLINE TEXT EDITING (lead feature)

Goal: type **directly on the canvas**, no pop-out box. Today editing uses a
`RichTextEditor` overlay (`Canvas.jsx` `richEdit` state, lines ~1089–1195) that's
positioned over the canvas but reads as a separate box.

**Make it feel in-place (M–L):**
- Render the editor overlay so it *exactly* overlaps the rendered text:
  transparent background, identical font family/size/line-height/alignment, same
  world→screen transform — so the `foreignObject` text and the editable div are
  pixel-aligned (extend the existing `blend` mode, which already does this for box
  labels, to annotations + table cells).
- Reduce friction: single-click-to-edit (or `F2`/Enter on selection) instead of
  double-click; auto-enter edit mode the moment a new text/callout is placed.
- Keep the floating format toolbar but anchor it *outside* the text flow so it never
  shifts the text being edited.
- Files: `RichTextEditor.jsx`, `Canvas.jsx`, `AnnotationLayer.jsx`.
- Tests: doc round-trips (`htmlToDoc`/`docToHtml`) unchanged; commit-on-blur/Esc
  paths; new-empty-discard path.
- Risk: font-metric drift between SVG `foreignObject` and the HTML overlay in the
  Tauri WebKit webview — needs in-app visual confirmation on Win + Mac.

---

## Phase 2 — COMPONENTS (PLC consolidation, fuse, relay, DI/DO)

**2a. PLC In/Out consolidation + auto-migration (M):**
- One `plc_input` with a Digital/Analogue mode; one `plc_output` with a
  Digital/PWM mode (mode = a simParam/select, symbol switches on it).
- Migration: `migrateDrawing` maps existing `plc_digital_input`/`plc_analog_input`
  → `plc_input` (mode preset), `plc_digital_output`/`plc_pwm_output` →
  `plc_output` (mode preset) — zero data loss, same as prior phase migrations.
- Files: `electrical.js`, `PLCSymbols.jsx`, `dcSolver.js` (type sets),
  `schematicStore.js` (migration). Tests: migration fixture + symbol mode render.

**2b. DI/DO fields — pin address + name + notes (S–M):**
- Add structured fields (pin address, name shown on schematic, free notes) to PLC
  I/O; render address+name on the symbol, notes in Properties.
- Files: `PLCSymbols.jsx`, `PropertiesPanel.jsx`, component def.

**2c. Fix DI/DO (and similar) mirroring (S):**
- Mirrored PLC parts render backwards. Fix flip handling so the symbol body stays
  readable while pins/leads mirror correctly (counter-flip text/labels).
- Files: `PLCSymbols.jsx` (+ audit other asymmetric symbols), `PlacedComponent.jsx`.

**2d. Improve fuse symbol + options (S):**
- Redraw to IEC with style options (IEC rectangle / cartridge / etc.) via a
  simParam variant. Files: `PassiveSymbols.jsx`, `electrical.js`.

**2e. Solenoid-operated relay with simulation (M):**
- New component: coil + solenoid actuation that drives contacts, wired into the
  existing relay feedback loop in `dcSolver.js`. Files: symbols, `electrical.js`,
  `dcSolver.js`. Tests: coil energise → contact change.

---

## Phase 3 — TABLES OVERHAUL

**3a. Row/col resize + header tint (M):** drag handles for `rowHeights`/`colWidths`;
header-row tint colour. Files: `tableModel.js`, table renderer, `PropertiesPanel.jsx`.

**3b. Insert/move rows & cols (M):** insert at any index; reorder rows/cols in an
edit mode. Files: `tableModel.js` (+ specs), table UI.

**3c. Copy table → paste into Word (M):** export selection as HTML table to the
clipboard (`text/html`) so Word receives a real table. Files: table UI + a
`tableClipboard.js` helper. Tests: HTML serialization.

**3d. Table inside box properties (M–L):** allow a `table` block type in the box
`blocks[]` model. Files: `boxBlocks.js`, `PropertiesPanel.jsx` `ContentBlocks`.

---

## Phase 4 — WIRES & IMAGES

**4a. Drag wires longer/shorter after placing (M):** endpoint + segment drag
handles on a selected wire (re-route, keep pin bindings). Files: `WireLayer.jsx`,
`Canvas.jsx`, `wireUtils.js`. Tests: endpoint move keeps `pinA/pinB` valid.

**4b. Component values dodge wires (M):** auto-offset the value/label so it doesn't
sit on a wire (collision check against nearby wire segments). Files:
`PlacedComponent.jsx`, label-placement helper. Tests: offset logic.

**4c. Crop images — canvas + properties (M):** crop rect stored on the image
(source-rect clip); UI in both canvas and Properties. Files: image schema,
`ImageLayer.jsx`/renderer, `PropertiesPanel.jsx`, `imageUtils.js`.

**4d. Zoom expanded images in Properties (S):** add pan/zoom to the existing
`Lightbox` overlay. Files: `Lightbox`/`PropertiesPanel.jsx`.

---

## Phase 5 — UX POLISH

- **Mirror via "M" key (S):** bind `M` to flip; fold into the flip fix from 2c.
  Files: `Canvas.jsx`/`App.jsx` keymap.
- **Links back to Properties pane / link text (S–M):** a `link` that targets a
  component/box/drawing, surfaced in Properties. Files: `boxBlocks.js`,
  `PropertiesPanel.jsx`.
- **Nicer file-tree UI (S–M):** visual polish of `FileTree.jsx`/`FileTreeNode.jsx`
  (icons, spacing, hover, drag affordances).
- **External paste into canvas (M):** today external paste only lands in Properties.
  Wire a window-level paste handler on the canvas (image/text from OS clipboard).
  Files: `Canvas.jsx`, clipboard helper. Risk: Tauri WebKit clipboard quirks —
  needs Windows verification.

---

## Suggested release grouping
- **v0.5.0** — Phase 0 (save safety) + Phase 1 (inline editing). Ship fast.
- **v0.6.0** — Phase 2 (components).
- **v0.7.0** — Phase 3 (tables).
- **v0.8.0** — Phase 4 + 5.

## Cross-cutting notes
- Anything touching flip/mirror, paste, or webview fonts needs **in-app Windows
  verification** (per testing preference — no screenshots; hand off manual checks).
- Each phase: bump suite, keep build green, release via `npm run release -- X.Y.Z`.
