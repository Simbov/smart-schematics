# Next Release — Staged Implementation Plan

> Hand this file to autonomous agents. Each **Stage** is a self-contained unit of work
> (≈ one PR) with explicit dependencies, files, implementation detail, and required Vitest
> specs. Stages are ordered so shared foundations land first. An agent should pick the
> lowest-numbered stage whose dependencies are all merged.

---

## 0. Ground rules for every agent (read first)

**The app is in the `smart-schematics/` subdirectory**, not the repo root. Run all `npm`
commands, tests, and find all `src/` from there. The single canonical architecture
reference is `CODEBASE.md` at the repo root — read it before touching code.

**Testing is mandatory and enforced.** A blocking `Stop` hook runs `npm run test:run`
(from `smart-schematics/`); a turn cannot finish while tests fail. Every stage below lists
the specs you must add. Follow the existing test conventions:
- Tests live next to source as `*.test.js`, run under Vitest in `environment: 'node'`.
- Pure logic (store actions, serializers, geometry, rich-text model) is unit-tested
  directly — **no jsdom/DOM**. Use `useSchematicStore.getState()` / `setState()` to drive
  the store in tests, mirroring `src/store/schematicStore.test.js`.
- Use/extend the helpers in `src/test/circuitBuilder.js` where relevant.
- Do **not** write tests that require a browser. UI behavior that can't be unit-tested is
  verified by the user manually (see "Verification" below) — keep the React layer thin and
  push logic into testable pure functions.

**Verification preference (from project memory):** no screenshots. Verify via DOM `eval`
through the preview tools, or hand a short manual-test script to the user. Keep UI logic
extractable into pure helpers so the bulk of behavior is covered by Vitest.

**Standards (from project memory):** any new schematic symbols/pins are held to IEC/IEEE/ISO
conventions — leads meet electrodes, pins land exactly on grid, verify arc/arrow directions.
Applies to Stage 5 (component box pins).

**Persistence is automatic.** `App.jsx` debounces `saveAll()` 2s after any `isDirty`
drawing + a 30s interval. Anything you add to the drawing/project shape is serialized for
free **only if** it lives inside the structures `_buildProjectSnapshot()` walks
(`project` + its `drawings[]`). New top-level fields need explicit save/load wiring.

**Two product decisions already made (do not re-litigate):**
1. **File format:** single bundled `.scpro` JSON. Images and attachments are embedded as
   base64 data — no external files, no folder-format. Keep it OneDrive-sync friendly.
2. **Text formatting:** full **per-run rich text** (mixed bold/italic/color/size within one
   box), not per-box uniform styling. See the shared rich-text spec below.

---

## Shared spec: the rich-text model (used by Stages 4 & 5)

Build this **once** as a standalone, fully-unit-tested module and reuse it. It is the
dependency that lets Stage 4 and Stage 5 proceed without duplicating work.

**File:** `src/lib/richText.js` (+ `src/lib/richText.test.js`)

**Document model (the canonical, serialized form):**
```js
// RichDoc — what gets stored on the annotation/component and saved into .scpro
{
  align: 'left' | 'center' | 'right',      // block-level, default 'left'
  paragraphs: [
    { runs: [ { text: string,
                bold?: boolean,
                italic?: boolean,
                underline?: boolean,
                color?: string,            // hex; omitted = inherit currentColor
                fontSize?: number } ] }    // px; omitted = element default
  ]
}
```

**Required exports (all pure, all unit-tested):**
- `emptyDoc()` → a one-empty-paragraph doc.
- `plainToDoc(str)` → splits on `\n` into paragraphs of one unstyled run. (Migration path
  for existing single-string `text` annotations — see Stage 4.)
- `docToPlain(doc)` → flattens to a `\n`-joined string (for search/export fallback,
  designator-style display, and SVG-export degradation).
- `docToHtml(doc)` → sanitized HTML string for the contentEditable editor. Only emits
  `<div>` (paragraph, with `text-align`), `<span style="...">`, `<b>`, `<i>`, `<u>`. No
  other tags/attributes ever.
- `htmlToDoc(html)` → parses the editor's HTML back into a `RichDoc`, dropping anything not
  in the whitelist (defense against pasted markup). Round-trips with `docToHtml`.
- `isEmptyDoc(doc)` → true when no run has non-whitespace text.

**Rendering contract:** rich text renders on the SVG canvas via a single
`<foreignObject>` wrapping a styled HTML `<div>` built from `docToHtml(doc)`
(`xmlns="http://www.w3.org/1999/xhtml"`). This is the only way to get true per-run styling
+ alignment + wrapping inside SVG. Two known consequences to handle, not ignore:
- **SVG/PNG export** (`FileMenu.jsx` clones `svg[data-schematic]`): `foreignObject` may not
  render in all rasterizers. The export path must detect rich-text elements and, if a
  foreignObject is present, leave it (modern browsers' canvas drawImage of the SVG handles
  it) — but add a `docToPlain` `<text>` fallback layer behind it for safety. Document this
  in the export code with a comment. Cover the fallback choice with a unit test on a small
  helper `richExportFallback(doc)`.
- **Editing:** reuse the floating-HTML-overlay pattern from `InlineEditor.jsx` — an
  absolutely-positioned `contentEditable` div in the Canvas wrapper, seeded with
  `docToHtml`, committed via `htmlToDoc` on blur/Escape/⌘-Enter.

**Tests for `richText.test.js` (minimum):** `plainToDoc`↔`docToPlain` round-trip incl.
multi-line; `docToHtml`/`htmlToDoc` round-trip preserving every run attribute; sanitizer
drops `<script>`/`onclick`/disallowed tags from pasted HTML; `isEmptyDoc` true/false cases;
`emptyDoc` shape.

---

## Stage 1 — Schema & serialization foundation (no UI)

**Goal:** extend the data model for *every* later feature in one place, with migration and
round-trip tests, so UI stages never fight over the save format. **Touches store + lib only.**

**Depends on:** nothing. **Do this first.**

**Data-model additions:**

1. **Image elements** live in a new per-drawing array `drawing.images[]`:
   ```js
   { id, src,            // base64 data URL ("data:image/png;base64,…")
     x, y, width, height,// world coords + size
     rotation,           // 0/90/180/270, default 0
     opacity,            // 0–1, default 1
     locked }            // bool, default false (locked = not draggable/selectable-through)
   ```
   Reasoning: a separate array (not an annotation `type`) keeps base64 blobs out of the hot
   annotation render path and makes culling/serialization explicit.

2. **Component-box** is a built-in component `type: 'box'` (Stage 5 renders it). It rides
   the existing `components[]` array so wire-snapping works for free. New optional fields on
   the component shape, ignored by every other type:
   ```js
   { …Component,
     type: 'box',
     box: { width, height,           // world size, grid-multiple
            doc: RichDoc,            // label content (rich text)
            fill, stroke,           // colors; default panel-ish
            cornerRadius },
     pins: Pin[] }                  // user-defined, on the box edges (Stage 5)
   ```
   `dcSolver.js` already no-ops unknown types (falls to `default`, no stamp) — confirm with
   a test that a `box` contributes nothing to the solve.

3. **Folders** for the file tree (Stage 6) live on the **project**:
   ```js
   project.folders = [ { id, name, parentId: string|null } ]   // nested; root = parentId null
   drawing.folderId = string | null                            // which folder a drawing sits in
   ```

4. **Attachments** ("sub files attached to a project") live on the **project**:
   ```js
   project.attachments = [ { id, name, mime, data /* base64 */, addedAt } ]
   ```
   Generic embedded files (datasheets, notes, reference images). Surfaced in Stage 6/7.

**Implementation:**
- Add the new fields to the drawing factory (around `schematicStore.js:26`, the
  `annotations: drawing.annotations || []` normalizer) and the project factory, all
  defaulting safely (`images: []`, `folders: []`, `attachments: []`, `folderId: null`).
- **Migration on load:** `_loadProjectFromPath` and `loadFromStorage` must backfill the new
  fields on old files (`d.images ??= []`, `p.folders ??= []`, etc.) so existing `.scpro`
  files open unchanged. Bump snapshot `version` 2 → 3; keep reading v2.
- `_buildProjectSnapshot` already spreads `...project` and `drawings`, so folders /
  attachments / images / box serialize automatically once they exist on those objects —
  **verify** this rather than assuming, and add a guard that base64 `src`/`data` survive
  `JSON.stringify`→`parse` intact.
- Extend `snapshotDrawing` (undo) to deep-clone `images` alongside components/wires/
  junctions/annotations.
- Extend `moveItems`, `deleteIds`, `copyToClipboard`, `pasteFromClipboard`,
  rubber-band/selection paths to accept image ids (add an `imageIds` param to `moveItems`,
  mirror the `annotationIds` plumbing). Box, being a component, needs no new selection
  plumbing.
- New store actions: `addImage`, `updateImage`, `removeImage`; `addFolder`, `renameFolder`,
  `deleteFolder` (re-parent or orphan its drawings to root), `moveDrawingToFolder`;
  `addAttachment`, `removeAttachment`. All set `isDirty` where they mutate a drawing.

**Acceptance:** old `.scpro`/localStorage files load with no errors and gain empty
new-field defaults; a round-trip (`_buildProjectSnapshot` → stringify → parse → reload)
preserves images (incl. base64), folders, attachments, and a `box` component byte-for-byte.

**Tests — `src/store/schematicStore.test.js` (extend) + new `schematicSerialization.test.js`:**
- v2 file (no new fields) migrates to v3 with empty defaults; no throw.
- Add image → snapshot → reparse → image identical incl. `src`.
- Folder CRUD: create nested folder, move drawing into it, delete folder re-parents its
  drawings to root (no orphaned `folderId`).
- Attachment add/remove round-trips base64.
- Undo snapshot includes/restores images.
- `moveItems` with `imageIds` translates images; `deleteIds` removes them; paste remaps ids.
- (Solver) a `box` component added to an otherwise-valid circuit changes no node voltage.

---

## Stage 2 — Toolbar to top row + left-rail chassis (UI only)

**Goal:** move the vertical left toolbar to a horizontal top row, and free the left rail to
host the Stage 6 file tree. Pure layout/reflow; no behavior change to tools themselves.

**Depends on:** nothing (can run in parallel with Stage 1). **Coordinate with Stage 6**,
which fills the left rail — land Stage 2 first.

**Files:** `src/components/App.jsx`, `src/components/Toolbar.jsx`, possibly
`src/components/DrawingManager.jsx`/`SimulationControls.jsx` for vertical-space budget.

**Implementation:**
- In `App.jsx` (current layout at `App.jsx:119`), restructure the flex tree:
  - **Top region (stacked, flex-column):** existing title bar (36px) → a new **horizontal
    Toolbar row** → DrawingManager tabs → SimulationControls. Consider merging the title bar
    and toolbar into one 40–44px row to conserve vertical space (title/theme on the left,
    tool buttons inline) — agent's discretion, but keep total top chrome ≤ ~3 rows.
  - **Main region (flex-row, flex-1):** `[ LeftSidebar shell ] [ Canvas + PropertiesPanel ] [ ComponentLibrary ]`.
- Rewrite `Toolbar.jsx` from a 48px vertical strip to a horizontal flex bar: same buttons
  (Undo/Redo, Select V, Wire W, Text T, Callout B, Title Block, Delete, Rotate R, Flip X/Y,
  Zoom In/Out/Fit, Toggle Grid, Toggle Sim Overlay) + reserve a slot for the new
  **Insert Image** (Stage 3) and **Box** tool (Stage 5) buttons. Group with vertical
  dividers. Keep all `title=` tooltips and keyboard-shortcut hints.
- Add a **collapsible left sidebar shell** component `src/components/SidebarLeft.jsx`:
  mirror `ComponentLibrary.jsx`'s collapse pattern (~220px, collapse to a thin rail with a
  toggle). For this stage it renders an empty placeholder ("Files" header + empty body);
  Stage 6 fills it. Mount it as the first child of the main row in `App.jsx`.
- Ensure responsive behavior: top toolbar wraps/scrolls horizontally rather than overflowing
  on a narrow window (min window 900px per `tauri.conf.json`).

**Acceptance:** all toolbar actions still work from their new horizontal home; keyboard
shortcuts unchanged; canvas fills remaining space; left sidebar collapses/expands; no
console errors; min-width window doesn't clip toolbar.

**Tests:** layout is React/CSS — not unit-testable headless. Add a tiny pure helper if any
logic emerges (e.g. a `toolbarGroups` config array) and snapshot-test that. Otherwise this
stage's verification is a **manual checklist handed to the user** (toolbar on top, every
button fires its action, shortcuts work, sidebar toggles). Do not fake a passing test.

---

## Stage 3 — Insert & manipulate images

**Goal:** insert an image onto a drawing, move/resize/rotate/delete it, snapped to grid; it
saves with the project (Stage 1 already stores it).

**Depends on:** Stage 1 (image schema + actions), Stage 2 (toolbar slot for the button).

**Files:** `src/components/FileMenu.jsx` (or Toolbar "Insert Image"), `src/lib/tauriFs.js`
(read image as base64), `src/components/Canvas.jsx` (render + interaction), new
`src/components/ImageLayer.jsx`, `src/lib/imageUtils.js` (+ test).

**Implementation:**
- **Insert:** add "Insert Image…" to the toolbar/FileMenu.
  - Tauri: `openFileDialog([{ name:'Images', extensions:['png','jpg','jpeg','gif','svg','webp'] }])`
    → read bytes → base64 data URL. Add a `readBinaryFile`/`readImageAsDataUrl` helper to
    `tauriFs.js` behind the `isRunningInTauri()` guard.
  - Browser: hidden `<input type="file" accept="image/*">` → `FileReader.readAsDataURL`.
  - Compute natural dimensions; place centered in the current viewport; snap origin to grid;
    cap initial size (e.g. fit within 400 world-units, preserve aspect). Put helpers
    (aspect-fit math, grid-snap of a box, default placement point) in `imageUtils.js`.
  - Call `addImage` (Stage 1).
- **Render:** `ImageLayer.jsx` renders `drawing.images` as `<image href={src} …>` inside the
  world `<g>` in `Canvas.jsx`, **behind** components/wires (images are backdrops). Apply
  `transform` for rotation about center, `opacity`. Respect viewport culling like components
  (reuse the culling margin pattern).
- **Select/move:** images participate in selection. Clicking selects (unless `locked`);
  drag uses the existing `dragRef`/`dragDelta`/`effective*` system — add
  `effectiveImages` mirroring `effectiveComponents`, and pass `imageIds` to `moveItems`.
  Snap to grid on commit.
- **Resize:** when a single image is selected, render 8 resize handles (corner/edge) in the
  Canvas overlay (screen-space, counter-scaled by `1/zoom` like `InteractiveControl`).
  Dragging a handle updates width/height (Shift = preserve aspect); commit via `updateImage`
  + `pushUndo`. Keep the handle/resize math in `imageUtils.js` (`resizeBox(box, handle, dx,
  dy, keepAspect)`) so it's unit-testable.
- **Properties:** add an image section to `PropertiesPanel.jsx` (x/y/w/h, opacity, rotation,
  lock toggle, replace-image, delete).
- **Rotate/flip/delete/copy-paste:** wire images into the existing R/X/Y/Del/⌘C/⌘V handlers.

**Acceptance:** insert PNG/JPG/SVG; it renders behind the schematic; move snaps to grid;
resize handles work with/without aspect lock; rotate 90° steps; opacity/lock/delete work;
save → reopen restores the image pixel-for-pixel; locked images don't drag.

**Tests — `src/lib/imageUtils.test.js`:** aspect-fit clamps oversize images preserving
ratio; `resizeBox` for each handle (incl. Shift aspect-lock, and min-size floor);
grid-snap of placement point; default-placement centering math. Store-level move/delete/
copy of images is covered by Stage 1's specs — extend if Stage 1 didn't add image paste.

---

## Stage 4 — Improved text-box creation & rich-text editing

**Goal:** replace the single-line text-annotation editor with a true rich-text box: create
by click (or drag for a sized box), edit with bold/italic/underline/size/color/alignment,
multi-line. Applies to the existing `text` (and optionally `callout`) annotation.

**Depends on:** Shared `richText.js` spec (build it here if not already), Stage 2 (toolbar).

**Files:** `src/lib/richText.js` (+ test) — **the shared module**; `src/components/
AnnotationLayer.jsx`; `src/components/InlineEditor.jsx` (or a new `RichTextEditor.jsx`);
`src/components/Canvas.jsx` (text tool flow); `src/components/PropertiesPanel.jsx`;
`src/store/schematicStore.js` (annotation migration).

**Implementation:**
- **Model migration:** text/callout annotations currently store a plain `text` string
  (`AnnotationLayer.jsx:36–79`). Add an optional `doc: RichDoc` field. On load (Stage 1
  migration hook), if an annotation has `text` but no `doc`, set `doc = plainToDoc(text)`.
  Keep writing `text = docToPlain(doc)` alongside `doc` so search/export and any code still
  reading `.text` keeps working. New annotations get a `doc`.
- **Render:** in `AnnotationLayer.jsx`, render `doc` via the `<foreignObject>` + `docToHtml`
  contract from the shared spec, replacing the current `<text>`/`<tspan>` block. Keep the
  selection highlight rect and transparent hit-area. Size: text grows to content; callout
  keeps its fixed `width/height` with the div clipped/scrolled. Keep an off-screen plain
  `<text>` fallback per the export note.
- **Create flow (Canvas, `text` tool):** click places an empty rich box and opens the
  editor; (nice-to-have) click-drag pre-sizes a fixed-width box. Snap origin to grid.
- **Editor:** `RichTextEditor.jsx` — a floating `contentEditable` HTML div positioned over
  the annotation (extend `InlineEditor.jsx`'s overlay positioning). A small **formatting
  toolbar** (popover above the box) with Bold/Italic/Underline (⌘B/⌘I/⌘U via
  `document.execCommand` or a manual range-style applier), font-size select, color swatch,
  and L/C/R align. Seed from `docToHtml(doc)`; commit `htmlToDoc(html)` on blur/Escape/
  ⌘-Enter via `updateAnnotation`. Sanitize on commit.
- **Properties:** when a text/callout is selected (not editing), show font-size, B/I/U,
  color, alignment controls in `PropertiesPanel.jsx` that patch the whole `doc` (or the
  current selection if you support it) — keep it simple: whole-box quick styles here, fine
  per-run styling in the inline editor.

**Acceptance:** create text, type multiple lines, make one word bold + another red + change
a line's size, center-align — all persist through save/reopen and undo/redo; old drawings'
plain text still render (migrated to `doc`); paste from a browser strips disallowed markup.

**Tests:** primarily `richText.test.js` (see shared spec — round-trips, sanitizer, plain
migration). Add a store test: creating a text annotation stores a valid `doc`; updating its
`doc` round-trips through a save snapshot; legacy `text`-only annotation gains a `doc` on
load via the migration hook.

---

## Stage 5 — Component box (connectable, formatted, grid-snapped, no sim)

**Goal:** a built-in "box" you place to represent an arbitrary component: a rectangle with
rich-text label inside, snaps to grid sizes, resizable, and **wires connect to pins on its
sides** — but it has no simulation model.

**Depends on:** Stage 1 (`box` component schema), Stage 4/shared `richText.js` (label
formatting), Stage 2 (toolbar "Box" tool button). Stage 3's `resizeBox` helper is reusable.

**Files:** new `src/lib/symbols/BoxSymbol.jsx` (or render inline in PlacedComponent); new
`src/lib/boxComponent.js` (factory + pin geometry, + test); `src/components/
PlacedComponent.jsx`; `src/components/Canvas.jsx` (box placement tool + resize + pin edit);
`src/components/PropertiesPanel.jsx`; touch `src/lib/electrical.js` *only* to register a def
lookup, or special-case `type==='box'` in `getAnyDef` — **do not** give it `simParams`.

**Design (IEC/IEEE-consistent, per memory standards):**
- A box is a `Component` with `type:'box'` and a `box:{ width,height,doc,fill,stroke,
  cornerRadius }` payload (Stage 1). Default size a clean grid multiple (e.g. 80×60 at
  grid 10). Resizing snaps W/H to grid multiples (reuse `resizeBox` + grid-snap).
- **Pins:** user-configurable, sitting exactly on the box edges and on grid. Default e.g. 2
  pins (left/right) so it behaves like a 2-terminal block; user can add pins per side via
  the properties panel. Pin geometry: `boxPins(box, spec)` in `boxComponent.js` computes
  `relX/relY` on the edge midpoints/even spacing, with `direction` = the edge normal
  (`W`/`E`/`N`/`S`). `absX/absY` come from the existing `computePinAbsPositions` on
  place/move/rotate/flip — so **wire snapping, rotation, and flip all work for free** via
  the existing `findNearestPin`/`_reattachWires` machinery. Verify leads/pins land on grid.
- **No sim:** `box` is absent from every Set in `electricalSim.js` and every stamp in
  `dcSolver.js` (already no-ops). Add a solver test asserting a box is inert.
- **Render:** `BoxSymbol` draws the rounded rect (`fill`/`stroke`/`cornerRadius`) + the rich
  label via the shared `foreignObject`/`docToHtml` renderer, clipped to the box. Pin stubs +
  dots drawn by the existing Canvas pin-rendering path (Canvas is the single source of truth
  for pin dots — don't render them in the symbol).
- **Place:** add a "Box" tool (or place via the library) — clicking drops a default box,
  snapped to grid. Double-click opens the rich-text editor from Stage 4. Resize handles when
  selected (reuse Stage 3 overlay).
- **Properties:** width/height (grid-snapped numeric), per-side pin counts, fill/stroke/
  corner radius, and the label quick-styles. Designator/value/description still apply
  (it's a component) so it can be labeled like a real part.

**Acceptance:** place a box; it snaps to grid; type a formatted multi-line label; add pins
to each side; draw a wire and have it snap to a box pin; rotate/flip the box and wires stay
attached; resize snaps to grid; running the simulation ignores the box entirely (no glow, no
effect on the circuit); save/reopen restores box + pins + label.

**Tests — `src/lib/boxComponent.test.js`:** factory produces a valid `Component` with
`type:'box'`, grid-multiple size, and pins on edges with correct `direction`; `boxPins`
spacing for N pins per side lands on grid and on the edge line; `resizeBox` snaps to grid
multiples and respects a min size. **Solver test** (`dcSolver.test.js` extend): a box placed
across a live circuit draws no current and changes no node voltage; its pins create no net
short. **Store test:** rotating a box re-attaches bound wires to the new pin positions
(reuse the existing rotate/flip reattachment spec pattern).

---

## Stage 6 — File tree sidebar with subfolders

**Goal:** a persistent left-side file tree (in Stage 2's `SidebarLeft` shell): Projects →
nested Folders → Drawings, with create/rename/delete/drag-to-reorganize. Replaces the modal
`ProjectBrowser` as the primary navigation (keep the modal or fold its actions in).

**Depends on:** Stage 1 (folders model + actions), Stage 2 (sidebar shell).

**Files:** `src/components/SidebarLeft.jsx` (fill it), new `src/components/FileTree.jsx` +
`src/components/FileTreeNode.jsx`, `src/lib/fileTree.js` (+ test) for the pure tree-building
logic, `src/store/schematicStore.js` (folder actions from Stage 1).

**Implementation:**
- **Pure tree builder** `src/lib/fileTree.js`: `buildTree(project, drawings)` →
  a nested node array `{ type:'folder'|'drawing', id, name, children? }` from the flat
  `project.folders[]` (with `parentId`) + `drawings[]` (with `folderId`). Handle: drawings
  with `folderId:null` at root; nested folders to arbitrary depth; cycle-safety
  (a folder can't be its own ancestor — guard `moveFolder`). All logic here is unit-tested;
  the React components are thin renderers.
- **FileTree UI:** expand/collapse folders (persist expansion in component state or
  `settings`); click a drawing → `setActiveDrawing`; context actions per node (rename inline,
  delete with confirm, new folder, new drawing-in-folder). Show the active project; allow
  switching projects at the top (or list all projects as top-level roots).
- **Drag & drop:** drag a drawing into a folder → `moveDrawingToFolder`; drag a folder into
  another → re-parent via a `moveFolder(id, newParentId)` action (add it; reject cycles).
  Use HTML5 DnD; keep the validity check (`canMove(tree, dragId, dropId)`) pure + tested.
- **Attachments (from Stage 1)**: show a project-level "Attachments" node listing
  `project.attachments`; "Add file…" (base64-embed via the Stage 3 binary reader) and remove.
  This is the visible half of feature "sub files attached to a project".
- Keep `DrawingManager.jsx` tabs working in tandem (tabs = open drawings; tree = full
  hierarchy). Deleting/renaming in the tree reflects in tabs.

**Acceptance:** tree shows nested folders and drawings; create/rename/delete folder; move a
drawing between folders by drag; deleting a folder re-parents its drawings to root (no
orphans); switching drawings from the tree works; attachments list adds/removes files; all
survive save/reopen; can't drop a folder into its own descendant.

**Tests — `src/lib/fileTree.test.js`:** `buildTree` nests correctly incl. deep nesting and
root-level drawings; `canMove` rejects self/descendant drops, allows valid ones; moving a
drawing updates `folderId`; deleting a folder re-parents children (mirror the Stage 1 folder
action test, but assert tree shape). Store-level folder CRUD is covered in Stage 1.

---

## Stage 7 — Project-file & attachment UX polish ("sub files attached to a project")

**Goal:** finish the file-saving improvements: make the single-bundled `.scpro` robust with
the new payloads, surface attachments/images in save, and tighten autosave/feedback. Most of
the *format* work is in Stage 1; this stage is the **UX + safety net** around it.

**Depends on:** Stage 1 (format), Stage 6 (attachments UI), Stage 3 (images).

**Files:** `src/store/schematicStore.js` (save/load hardening), `src/components/
FileMenu.jsx`, `src/components/StatusBar.jsx`, `src/lib/tauriFs.js`.

**Implementation:**
- **Size awareness:** base64 images/attachments bloat `.scpro`. Add a computed project size
  indicator (StatusBar or FileMenu) and warn past a threshold (e.g. >25 MB) suggesting the
  user delete unused images/attachments. Keep the size calc a pure helper + test.
- **Save integrity:** wrap `saveAll` writes so a serialization error (e.g. a corrupt image)
  surfaces a dialog instead of silently losing data; never overwrite a good file with a
  failed snapshot. Add a load-time validation that drops malformed images/attachments with a
  warning rather than crashing the open.
- **Attachments management** in `FileMenu.jsx`: "Attach File…", "Export Attachment…",
  "Manage Attachments…" (list + remove) — complementing the Stage 6 tree view. Export writes
  an attachment's base64 back out to disk via a `saveFileDialog` + binary write helper.
- **Version & migration:** finalize snapshot `version:3`; ensure v2 → v3 migration covers
  images/folders/attachments/box and is covered by a test using a realistic v2 fixture.
- **Recent files / window title / watcher** already exist — just confirm they still behave
  with the larger payloads and the new fields (no regressions).

**Acceptance:** a project with images + attachments + nested folders saves and reopens
identically (Tauri *and* browser/localStorage paths); a deliberately corrupt image is
dropped with a warning, not a crash; size warning appears past threshold; attachment export
writes a usable file; v2 fixtures still open.

**Tests:** `projectSize(snapshot)` pure helper test; v2→v3 migration test against a checked-in
v2 fixture JSON (`src/test/fixtures/project_v2.scpro.json`) asserting all new fields default
and existing content is intact; malformed-image pruning helper test
(`sanitizeLoadedProject(data)` drops bad entries, keeps good ones).

---

## Suggested execution order & parallelism

```
Stage 1 (schema)  ─┬─────────────────────────────► Stage 7 (file UX)  ◄─┐
                   │                                                     │
Stage 2 (layout) ──┼─► Stage 6 (file tree) ─────────────────────────────┘
                   │
   richText.js ────┼─► Stage 4 (text boxes)
   (build in 4)    │
                   ├─► Stage 3 (images) ──────────► (resizeBox reused by 5)
                   └─► Stage 5 (component box)  [needs richText + Stage 1]
```

- **Stage 1** and **Stage 2** have no deps → can start immediately, in parallel.
- **Stage 4** builds the shared `richText.js`; **Stage 5** consumes it → run 4 before 5 (or
  have whoever starts first build `richText.js` to the shared spec).
- **Stage 3** and **Stage 4** are independent once 1 & 2 land.
- **Stage 6** needs 1 (folders) + 2 (sidebar). **Stage 7** is last — needs 1, 3, 6.

## Definition of done (every stage)

1. `npm run test:run` green (the Stop hook enforces this).
2. New specs from the stage's "Tests" section added and passing.
3. No regression in existing specs (`dcSolver`, `parseValue`, `labelPlacement`,
   `wireUtils`, `updater`, `schematicStore`).
4. `CODEBASE.md` updated for any new file/store-field/action (there is a Stop hook that
   maintains codebase docs — let it run, then sanity-check the diff).
5. For UI-heavy stages with no headless test, a short manual-verification checklist handed
   to the user (no screenshots; DOM-eval or manual per project memory).
```
