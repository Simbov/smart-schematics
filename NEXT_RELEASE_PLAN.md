# Next Release — Staged Implementation Plan (v0.2.0)

> Hand this file to autonomous agents. Each **Stage** is a self-contained unit of work
> (≈ one PR) with explicit dependencies, files, implementation detail, data-model changes,
> acceptance criteria, and the exact Vitest specs to add. Stages are ordered so shared
> foundations land first. An agent should pick the lowest-numbered stage whose dependencies
> are all merged.

---

## 0. Ground rules for every agent (read first)

**The app is in the `smart-schematics/` subdirectory**, not the repo root. Run all `npm`
commands, tests, and find all `src/` from there. The single canonical architecture
reference is `CODEBASE.md` at the repo root — **read it before touching code.**

**One worktree per agent.** You are running in your own git worktree. Create your own
`feat/<stage>` branch off `main` and never touch another agent's branch/checkout.

**Testing is mandatory and enforced.** A blocking `Stop` hook runs `npm run test:run`
(from `smart-schematics/`); a turn cannot finish while tests fail. Every stage lists the
specs you must add. Conventions:
- Tests live next to source as `*.test.js`, run under Vitest in `environment: 'node'`.
- Pure logic (store actions, serializers, geometry, models) is unit-tested directly —
  **no jsdom/DOM.** Drive the store via `useSchematicStore.getState()` / `setState()`,
  mirroring `src/store/schematicStore.test.js` and `schematicSerialization.test.js`.
- Keep the React layer thin; push logic into pure helpers so the bulk of behavior is
  covered by Vitest. `document.execCommand`/contentEditable cannot be unit-tested under
  node — extract and test the pure decision logic, leave the DOM call uncovered.

**Definition of done for every stage:** `npm run test:run` green **and** `npm run build`
clean, then push your branch and open a PR with a short **manual-verification checklist**
(no screenshots — the maintainer verifies UI by hand or via DOM eval). Note in the PR which
stage you implemented and which stages it depends on.

**Verification preference (project memory):** no screenshots. Verify via DOM `eval` or hand
the maintainer a short manual-test script.

**Symbol standards (project memory):** any new schematic symbols/pins are held to
IEC/IEEE/ISO conventions — leads meet electrodes, pins land exactly on the grid, verify
arc/arrow directions. Applies to Stage 4 (connectors) and Stage 8 (resistor variants).

**Persistence is automatic** *only if* your data lives inside the structures
`_buildProjectSnapshot()` walks (`project` + its `drawings[]`). New persisted fields must be
added to the drawing/project/component/box shapes and covered by a serialization
round-trip test. New top-level store fields need explicit save/load wiring. **All new
persisted shape lands in Stage 1** so later UI stages never fight over the save format.

**Hot files — keep edits surgical.** `Canvas.jsx` is touched by Stages 7, 9, 10 and
`schematicStore.js` by Stages 1, 5. Add new render layers as their own components, put new
handlers in clearly-commented regions, and avoid sweeping reformatting so the maintainer's
merges stay clean.

**Four product decisions already made (do not re-litigate):**
1. **Box fields:** boxes carry flexible property rows `box.fields: [{id,label,value,unit}]`
   instead of the generic `value` field. One generic model for every module.
2. **Tables:** a dedicated `drawing.tables[]` element type with its own renderer + plumbing.
3. **Right panel:** a single right rail shows the **Properties** panel when something is
   selected and falls back to the **Component Library** when nothing is selected.
4. **Resistor style:** per-component `component.resistorStyle` override (`'IEC'` | `'IEEE'`)
   that falls back to the global `settings.resistorStyle` default.

---

## Waves & dependency graph

```
WAVE 1 (no dependencies — start immediately, in parallel):
  Stage 1  Schema & serialization foundation        ← blocks 6,7,8,9,10
  Stage 2  Image paste / reliable selection / unlock
  Stage 3  Rich-text fixes: font size + active-format highlight
  Stage 4  Connector symbol library
  Stage 5  Grid sizing + save-on-open prompt

WAVE 2 (start once Stage 1 is merged — all four depend only on Stage 1):
  Stage 6  Properties panel: relocate to right rail + new editors
  Stage 7  Component-box rendering: pin labels, image, single-pin centering
  Stage 8  Resistor symbol variants (IEC/IEEE) wired to component.resistorStyle
  Stage 9  Tables: renderer + insert tool + cell editing
  Stage 10 Resizable text boxes + bigger ref label
```

---

# WAVE 1

## Stage 1 — Schema & serialization foundation

**Goal:** Define every new persisted field for this release, the pure helpers that operate
on them, the store actions, and the v3→v4 migration — with no UI. This unblocks the Wave-2
stages so they never touch the save format.

**Data-model changes (bump snapshot `version` to 4; keep reading v3):**

- **`Pin.label: string`** — optional human label for a pin (default `''`). Added to the
  `Pin` shape; serialized via the existing pins array.
- **Component box** gains, under `component.box`:
  - `fields: [{ id, label, value, unit }]` — flexible property rows (replaces generic
    `value` for boxes). `value` on a box component is no longer authoritative.
  - `image: string | null` — base64 data URL assigned to the box (default `null`).
  - `info: string` — free-text notes/details (default `''`).
- **Component** gains:
  - `resistorStyle?: 'IEC' | 'IEEE'` — per-component override; absent = use global default.
  - `labelScale?: number` — designator/ref font size multiplier (default `1`).
- **Text annotation** gains optional `width?`/`height?` (px, world) — `null`/absent =
  autosize (current behavior). Callouts already have width/height; this extends `type:'text'`.
- **Drawing** gains **`tables: Table[]`** (default `[]`). `Table` shape:
  ```js
  {
    id: string,
    x: number, y: number,        // world coords of top-left
    rows: number, cols: number,
    colWidths: number[],         // length === cols, world px
    rowHeights: number[],        // length === rows, world px
    cells: RichDoc[][],          // [row][col] rich-text doc (reuse richText.js)
    borderColor: string,         // default '#334155'
    borderWidth: number,         // default 1
    headerRow: boolean,          // default false (bold/tinted first row)
  }
  ```
  Tables reuse the existing `RichDoc` model from `richText.js` for cell content — **do not
  fork it.**

**Files:**
- `src/lib/boxComponent.js` — extend `createBox`/`boxPins` for pin labels + the
  single-pin-centering rule (below). Add `DEFAULT_BOX_FIELDS` / field helpers, or a new
  `src/lib/boxFields.js` (pure: `createField`, `addField`, `updateField`, `removeField`).
- `src/lib/tableModel.js` (new, pure) — `createTable(opts)`, `setCell(table,r,c,doc)`,
  `addRow/addCol/removeRow/removeCol`, `resizeCol(table,c,w)`, `resizeRow(table,r,h)`,
  `tableSize(table)` → `{width,height}`. No DOM. Snap dimensions to grid.
- `src/store/schematicStore.js` — store actions + migration:
  - `addTable(drawingId, table)`, `updateTable(drawingId, id, patch)`,
    `removeTable(drawingId, id)`.
  - `moveItems(...)` extended to translate `tableIds` (append a final default-`[]` arg so
    existing callers keep working, mirroring how `imageIds` was added).
  - `deleteIds` filters `tables` too; `snapshotDrawing` deep-clones `tables` (undo/redo).
  - `copyToClipboard`/`pasteFromClipboard` carry tables (clone with fresh ids, offset 20).
  - `updateBox` accepts `fields`/`image`/`info` non-geometry patches (leave pins untouched);
    `pinSpec` may now carry per-pin labels.
  - `migrateDrawing`: backfill `tables: []`; backfill `pin.label = ''` where missing; leave
    box `fields`/`image`/`info` absent-tolerant (default at read).
  - `_buildProjectSnapshot`: stamp `version: 4`.

**Single-bottom-pin centering rule (in `boxPins`):** when a side has exactly one pin it
must sit at the **center of that edge**, and after grid-snap it must remain exactly on the
edge line (snap the off-axis coordinate to the edge, snap the on-axis coordinate to the
nearest grid multiple from center). Even spacing already centers a lone pin; make this
explicit and grid-stable so a 1-pin bottom edge is dead-center and on a grid line.

**Dependencies:** none.

**BACKWARD COMPATIBILITY IS A HARD REQUIREMENT (do not regress existing files):**
- Every new field is **optional with a safe default applied at read time**, never required.
- `migrateDrawing`/`migrateProject` must be **purely additive** — backfill missing fields,
  never rename, drop, or reshape existing ones. A v1/v2/v3 file (localStorage *or* `.scpro`)
  must open and render identically to before, then gain empty defaults.
- All consumers must tolerate the field being absent (`drawing.tables ?? []`,
  `box.fields ?? []`, `pin.label ?? ''`, `component.labelScale ?? 1`) so a half-migrated or
  hand-edited file never crashes a render or a save.
- The `value` field stays on the component object untouched for non-box types; for boxes it
  is simply no longer read (kept for forward/backward tolerance, not deleted).
- Do **not** raise the minimum readable version — keep reading v2 and v3 exactly as today;
  only the *written* snapshot bumps to v4.

**Acceptance criteria:**
- `npm run test:run` green, `npm run build` clean.
- A v3 `.scpro` (no `tables`, no box `fields`) loads without throwing and gains `tables: []`.
- A **realistic legacy fixture** — a v2 and a v3 project JSON containing components (incl. a
  box), wires, annotations, images, junctions, and a title block — round-trips through load →
  snapshot → reload with **zero data loss** and identical components/wires/annotations.
- Round-trip (`_buildProjectSnapshot` → stringify → parse → `importProjectJSON`) preserves
  tables, box `fields`/`image`/`info`, `pin.label`, `resistorStyle`, `labelScale`, and text
  annotation `width`/`height`.

**Vitest specs to add:**
- `src/lib/tableModel.test.js` — `createTable` shape + defaults; `setCell` stores a RichDoc;
  add/remove row & col keep `colWidths`/`rowHeights`/`cells` rectangular; `resizeCol`/`resizeRow`
  snap to grid and floor at a min; `tableSize` = sums of widths/heights.
- `src/lib/boxComponent.test.js` (extend existing if present) — pin labels flow through
  `createBox`/`boxPins`; **single bottom pin is centered on the edge and grid-aligned**;
  multi-pin edges stay evenly spaced + grid-snapped.
- `src/lib/boxFields.test.js` — field CRUD helpers (add/update/remove; unique ids).
- `src/store/schematicSerialization.test.js` (extend) — v3→v4 migration backfills `tables:[]`
  and `pin.label`; full round-trip of every new field listed above; snapshot `version:4`;
  **a legacy v2 and v3 fixture (with components incl. a box, wires, annotations, images,
  junctions, title block) loads with zero data loss and re-saves cleanly.**
- `src/store/schematicStore.test.js` (extend) — `addTable`/`updateTable`/`removeTable`;
  `moveItems` translates `tableIds`; `deleteIds` drops a table; undo restores a deleted table;
  copy/paste clones a table with a new id.

---

## Stage 2 — Image paste, reliable selection, unlock

**Goal:** Paste images from the clipboard, fix flaky image selection, and give locked images
a way back (unlock).

**Files:**
- `src/lib/imageUtils.js` — add a pure `imageHitTest(image, wx, wy)` (point-in-rect honoring
  rotation) and `topImageAt(images, wx, wy, { includeLocked })` (z-order-correct pick). The
  flaky-selection bug is almost certainly inconsistent hit-testing / z-order between Canvas
  click handling and the rendered rect — centralize it here and make Canvas use it.
- `src/components/Canvas.jsx` — (a) install a `paste` listener (on the wrapper / window while
  canvas focused) that reads `ClipboardEvent.clipboardData` image items, converts to a data
  URL, and calls `addImage` placed at the last cursor/world point; (b) route image selection
  through `topImageAt`; (c) **Alt/Option-click** (or right-click) selects a *locked* image so
  it can be unlocked, since locked images are normally select-through.
- `src/components/PropertiesPanel.jsx` — the existing image section already has a Lock
  checkbox; ensure once a locked image is selected (via Alt-click) the user can untick it.
  (If Stage 6 has merged, coordinate; otherwise this is a 2-line touch.)

**Data-model changes:** none (image `locked` already exists).

**Dependencies:** none. (Light touch on `PropertiesPanel.jsx` — keep it to the lock control.)

**Acceptance criteria:** paste of a clipboard image adds it to the drawing; clicking an
unlocked image selects it every time; a locked image can be re-selected (Alt-click) and
unlocked. Tests green, build clean.

**Vitest specs to add:**
- `src/lib/imageUtils.test.js` (extend) — `imageHitTest` inside/outside incl. a rotated
  image; `topImageAt` returns the topmost hit, skips locked unless `includeLocked`, returns
  null on a miss.

---

## Stage 3 — Rich-text fixes: font size + active-format highlight

**Goal:** Make the font-size control in the floating editor actually work, and highlight the
active B/I/U/alignment buttons based on the current selection.

**Files:**
- `src/components/RichTextEditor.jsx` — replace the brittle `setFontSize` (it relies on
  `querySelectorAll('font[size="7"]')`, which misses in many cases) with a robust
  selection-wrapping approach: wrap the current Range's contents in a `<span style="font-size:Npx">`
  (or apply to the collapsed caret's typing context). On `selectionchange`/`keyup`/`mouseup`
  while focused, read `document.queryCommandState('bold'|'italic'|'underline')` and the
  current block alignment, and set an `active` state used to style the toolbar buttons
  (mirror `qsBtn` active styling from `PropertiesPanel`). Show the current font size in the
  size dropdown rather than always resetting to the "Size" placeholder.
- `src/lib/richTextEditing.js` (new, pure) — extract the testable decision logic. Given a
  `RichDoc`, `uniformFontSize(doc)` / `activeMarks(doc)` →
  `{bold,italic,underline,align,fontSize|null}` (a value when uniform across runs, else
  `null`/false). Wire the toolbar's initial highlight off the seeded doc via these, and
  refresh from `queryCommandState` for live selection.

**Data-model changes:** none.

**Dependencies:** none. (Touches only `RichTextEditor.jsx` + a new pure module — no conflict
with the annotation schema, which is unchanged here.)

**Acceptance criteria:** choosing a size in the floating editor changes the selected text's
size and round-trips through `htmlToDoc`; B/I/U and alignment buttons visibly reflect the
caret's current formatting. Tests green, build clean.

**Vitest specs to add:**
- `src/lib/richTextEditing.test.js` — `uniformFontSize`/`activeMarks` over docs with uniform
  vs mixed runs (returns the shared value or `null`/false when mixed); alignment reported
  from `doc.align`.

---

## Stage 4 — Connector symbol library (Deutsch DT / A-code, etc.)

**Goal:** Add a set of basic connector components (Deutsch DT family, A-code style, generic
n-way headers) to the electrical library under a new **Connectors** category.

**Files:**
- `src/lib/components/electrical.js` — add a `Connectors` category with new defs:
  e.g. `conn_dt_2`, `conn_dt_3`, `conn_dt_4`, `conn_acode_3`, `conn_acode_4`, plus a generic
  `conn_header_2`/`conn_header_4`. Each def: width/height, `pins[]` with grid-aligned
  `relX/relY` + `direction` + sensible default labels, `category: 'Connectors'`. No DC-solver
  model (interface/terminal symbols — the solver no-ops unknown types).
- `src/lib/symbols/electrical/ConnectorSymbols.jsx` (new) — IEC/IEEE-faithful connector
  glyphs (housing outline + numbered pin cavities + on-line leads meeting the pins). Use
  `stroke="currentColor"`.
- `src/lib/symbols/electrical/index.js` — register the new symbols in
  `ELECTRICAL_SYMBOL_MAP`.
- `src/components/ComponentLibrary.jsx` — the Electrical tab groups by `def.category`, so the
  new category surfaces automatically; update any hardcoded category counts/labels.

**Data-model changes:** none (new defs only; instances ride the existing component shape).

**Dependencies:** none.

**Acceptance criteria:** the Connectors category appears in the Electrical tab; placing a
connector drops a component with grid-aligned, labeled pins that accept wires; pins meet
their leads. Tests green, build clean.

**Vitest specs to add:**
- `src/lib/components/connectors.test.js` — every new connector def has a unique `type`,
  `category:'Connectors'`, ≥2 pins, all pin `relX/relY` on the grid multiple, unique pin ids,
  and a registered entry in `ELECTRICAL_SYMBOL_MAP`. (If a spec already enumerates electrical
  defs, extend it instead.)

---

## Stage 5 — Grid sizing + save-on-open prompt

**Goal:** Let the user change the grid size, and prompt to save unsaved work before opening a
different project/file.

**Files:**
- `src/lib/gridOptions.js` (new, pure) — `GRID_SIZES = [5,10,20,25,50]`, `clampGridSize(n)`
  → nearest valid option. Keep this pure + tested.
- `src/components/StatusBar.jsx` (or a tiny `GridSizeControl`) — a small dropdown bound to
  `settings.gridSize` via `updateSettings({ gridSize })`. Grid render + snap already read
  `settings.gridSize`, so changing it live re-tiles `GridOverlay` and re-snaps new placements.
- `src/store/schematicStore.js` — guard the open-file paths: `openProjectFile()` /
  `_loadProjectFromPath()` should, when any drawing `isDirty`, surface a save-or-discard
  prompt before replacing the project. Extract the decision into a pure helper
  `hasUnsavedWork(drawings)` so it's testable; the actual prompt (Tauri `ask` / `confirm`) is
  the thin DOM edge. Keep the store touch localized (clearly commented region) to ease the
  merge with Stage 1.

**Data-model changes:** none (`settings.gridSize` already exists).

**Dependencies:** none. (Shares `schematicStore.js` with Stage 1 — keep edits surgical.)

**Acceptance criteria:** changing grid size updates the dot grid and snapping immediately;
opening a project while there are unsaved changes prompts the user first. Tests green, build
clean.

**Vitest specs to add:**
- `src/lib/gridOptions.test.js` — `clampGridSize` maps arbitrary inputs to the nearest valid
  option; valid options pass through.
- `src/store/schematicStore.test.js` (extend) — `hasUnsavedWork` true when any drawing is
  dirty, false otherwise.

---

# WAVE 2 — all depend on Stage 1 (start once Stage 1 is merged)

## Stage 6 — Properties panel: relocate to right rail + new editors

**Goal:** Move the Properties panel from the sticky bottom to the **right rail**, where it
shows when something is selected and falls back to the Component Library when nothing is
selected. Add the new per-selection editors enabled by Stage 1.

**Files:**
- `src/components/App.jsx` — remove `PropertiesPanel` from under the canvas; render a single
  right rail that conditionally shows `PropertiesPanel` (when `selectedIds.length > 0`) or
  `ComponentLibrary` (when empty). Keep the existing collapse behavior; widen to ~280px.
- `src/components/PropertiesPanel.jsx` — restyle from a short bottom strip to a tall vertical
  right-rail panel (sections stacked, scrollable). Add:
  - **Component box editors:** flexible **property rows** (`box.fields`) — add/edit/remove
    rows (label, value, unit) via the Stage-1 `boxFields` helpers + `updateBox({fields})`;
    an **image assign/replace/remove** control (`updateBox({image})`, file input → data URL);
    an **info/details** textarea (`updateBox({info})`). The generic "Value" field is hidden
    for `type:'box'`.
  - **Resistor style selector** for resistor components: a select bound to
    `component.resistorStyle` (`IEC`/`IEEE`/"Default") via `updateComponent`.
  - **Ref size** control: numeric `labelScale` (or S/M/L) bound via `updateComponent`.
- Keep all commits blur/undo-based per the existing PropertiesPanel convention.

**Data-model changes:** none beyond Stage 1 (consumes `box.fields/image/info`,
`resistorStyle`, `labelScale`).

**Dependencies:** **Stage 1.** Owns `PropertiesPanel.jsx` + the right-rail region of
`App.jsx` for this release — other stages must not restructure those.

**Acceptance criteria:** selecting a component shows Properties on the right; deselecting
shows the Library; a box's property rows, image, and info edit + persist; resistor style and
ref size edit + persist. Tests green, build clean.

**Vitest specs to add:** logic is mostly in Stage-1 helpers/store. Add
`src/store/boxProperties.test.js` — `updateBox({fields})` persists rows and round-trips;
`updateBox({image})`/`updateBox({info})` persist; `updateComponent({resistorStyle})` and
`updateComponent({labelScale})` persist + round-trip. (Drive the store directly — no DOM.)

---

## Stage 7 — Component-box rendering: pin labels, image, single-pin centering

**Goal:** Render the new box data: pin labels on the canvas, the assigned image inside the
box, and the visually-centered single bottom pin.

**Files:**
- `src/lib/symbols/BoxSymbol.jsx` — render `box.image` clipped inside the rounded rect
  (layered sensibly with the rich-text label), still gated by the existing clip-path. Keep
  pin dots out of here (Canvas owns them).
- `src/components/Canvas.jsx` — where pin dots/labels render, draw each pin's `pin.label`
  next to its dot for boxes (small text, sizing consistent with existing pin rendering). Keep
  the edit surgical (new, clearly-commented block).
- Pin geometry (centering, grid-snap) already lands in Stage 1's `boxComponent.js`; this
  stage only renders it. Ensure a box with an assigned image is clickable (not
  select-through) so selecting it pulls its info into the Properties panel (Stage 6).

**Data-model changes:** none beyond Stage 1.

**Dependencies:** **Stage 1.** (Renders Stage-6 data too, but reads the box shape directly so
it doesn't require Stage 6 to build.) Shares `Canvas.jsx` with Stages 9/10 — isolate edits.

**Acceptance criteria:** a box with pin labels shows them; a box with an assigned image shows
it inside the box; a lone bottom pin renders dead-center on the edge. Tests green, build
clean.

**Vitest specs to add:** rendering is DOM; cover the pure side in Stage 1. If any label-layout
math is added here, put it in a pure helper (`boxPinLabelPos`) with a small unit test.

---

## Stage 8 — Resistor symbol variants (IEC/IEEE) wired to component.resistorStyle

**Goal:** Render the resistor in the chosen style — IEC (rectangular box) or IEEE/ANSI
(zig-zag) — driven by `component.resistorStyle` with a fallback to `settings.resistorStyle`.

**Files:**
- `src/lib/symbols/electrical/PassiveSymbols.jsx` — add the second resistor body variant
  (whichever isn't already drawn) and select between them by a `style` prop.
- `src/components/PlacedComponent.jsx` — resolve the effective style
  (`component.resistorStyle ?? settings.resistorStyle ?? 'IEC'`) and pass it to the resistor
  symbol. Use the pure helper below for resolution.
- `src/lib/resistorStyle.js` (new, pure) — `resolveResistorStyle(component, settings)` →
  `'IEC' | 'IEEE'`.

**Data-model changes:** none beyond Stage 1.

**Dependencies:** **Stage 1** (defines `component.resistorStyle`). Independent of Stage 6 (the
selector); until Stage 6 ships, the style still resolves from the global default.

**Acceptance criteria:** a resistor renders IEC vs IEEE per its `resistorStyle`; with no
override it follows the global setting. Tests green, build clean.

**Vitest specs to add:**
- `src/lib/resistorStyle.test.js` — override wins; absent override falls back to global;
  unknown values default to `'IEC'`.

---

## Stage 9 — Tables: renderer + insert tool + cell editing

**Goal:** Insert and edit tables on the canvas.

**Files:**
- `src/components/TableLayer.jsx` (new) — render `drawing.tables[]`: a grid of cells
  (`<line>`s for borders + a `<foreignObject>` rich-text cell per cell via `docToHtml`,
  matching the AnnotationLayer/BoxSymbol contract), header-row styling, selection highlight +
  transparent hit area. Rendered inside the world `<g>` in `Canvas.jsx`.
- `src/components/Canvas.jsx` — add a `table` tool mode (click or click-drag to place a
  default table via `tableModel.createTable` → `addTable`); selection/move/delete plumbing for
  tables (they ride `selectedIds`, `moveItems` with `tableIds`, `deleteIds`); double-click a
  cell opens the existing `RichTextEditor` overlay seeded with that cell's doc, commit →
  `updateTable` via `tableModel.setCell`. Keep edits in a clearly-commented region.
- `src/lib/toolbarConfig.js` + `src/components/Toolbar.jsx` — add an **Insert Table** button
  (new tool id, icon). Update `toolbarConfig.test.js`.
- Optionally surface row/col add-remove + border toggle in `PropertiesPanel` when a table is
  selected (coordinate with Stage 6's panel; additive section).

**Data-model changes:** none beyond Stage 1 (`drawing.tables[]` + `tableModel`).

**Dependencies:** **Stage 1.** Shares `Canvas.jsx` with Stages 7/10 — isolate edits.

**Acceptance criteria:** insert a table, type into cells (rich text), move/select/delete it,
add/remove rows & columns; it saves and reloads. Tests green, build clean.

**Vitest specs to add:**
- `src/lib/toolbarConfig.test.js` (extend) — Insert Table button present with id/label/icon,
  no duplicate ids.
- `src/store/tableEditing.test.js` — integration: place → `setCell` via `updateTable` →
  round-trip preserves cell docs (the `tableModel` itself is covered by Stage 1).

---

## Stage 10 — Resizable text boxes + bigger ref label

**Goal:** Let text annotations be resized with handles, and let the component designator
("ref") be scaled up.

**Files:**
- `src/components/Canvas.jsx` — add resize handles for a single selected `type:'text'`
  annotation (mirror the existing box/image resize-handle gesture: 8 handles, screen-space
  sizing via `8/zoom`, commit `width`/`height` via `updateAnnotation` on mouseup).
- `src/components/AnnotationLayer.jsx` — honor optional `width`/`height` on text annotations
  (clip/wrap within the box, like callouts do); absent = autosize as today.
- `src/components/PlacedComponent.jsx` — apply `component.labelScale` to the designator
  label's font size (the "make the ref size bigger" feature; pairs with Stage 6's control).
  Default `labelScale` to 1 so this is inert until set.
- Extract any new resize math into a pure helper (reuse `imageUtils.resizeBox`) with a test.

**Data-model changes:** none beyond Stage 1 (text `width`/`height`, `labelScale`).

**Dependencies:** **Stage 1.** Shares `Canvas.jsx` with Stages 7/9 — isolate edits.

**Acceptance criteria:** a text box can be dragged to a fixed size and wraps within it; a
component's ref label can be enlarged via `labelScale`. Tests green, build clean.

**Vitest specs to add:**
- A resize-math unit test (if a new helper is added). Annotation width/height persistence is
  covered by Stage 1's serialization spec; add a focused store test for any new behavior.

---

## Release wrap-up (maintainer)

After all stages merge in dependency order (Wave 1 — Stage 1 first within it — then Wave 2),
run the full suite + `npm run build` after each merge. Then write user-facing notes under
`## [Unreleased]` in `CHANGELOG.md` and run `npm run release -- minor` (this is a feature
release). Watch CI to completion and confirm the signed GitHub Release published with its
updater artifacts.

---

## Feature → Stage traceability

| Requested feature | Stage(s) |
|---|---|
| Properties panel opens on the right when a component is clicked | 6 |
| Assign image + details/properties/info to component box | 1 (schema), 6 (UI), 7 (render) |
| Add pins with labels to component boxes | 1 (model), 7 (render) |
| Remove generic "Value"; use specific fields (resistance, …) | 1 (model), 6 (UI) |
| Pins on boxes always snap to grid | 1 |
| Single bottom pin centered + on a line | 1 |
| Assign pictures to boxes → click for more info | 1, 6, 7 |
| Choice of resistor symbol in properties | 1 (field), 6 (selector), 8 (render) |
| Basic connectors (Deutsch DT, A-code, …) | 4 |
| Paste images in | 2 |
| Fix: selecting images unreliable | 2 |
| Unlock a picture after locking | 2 |
| Fix: font size setting not working | 3 |
| Highlight active selections (B/I/U/centering) | 3 |
| Resize text boxes | 1 (fields), 10 |
| Make the ref size bigger | 1 (field), 6 (control), 10 (render) |
| Change grid sizing | 5 |
| Insert tables | 1 (model), 9 (UI) |
| Autosave + prompt to save when opening a new directory | 5 |
