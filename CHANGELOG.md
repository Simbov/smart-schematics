# Changelog

All notable changes to Smart Schematics are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and the
project adheres to [Semantic Versioning](https://semver.org/). The section for
each version is published verbatim as the GitHub Release notes (and shown in the
in-app "update available" dialog), so write it for end users.

Jot changes under **[Unreleased]** as you work. `npm run release` stamps that
section with the version and date and starts a fresh Unreleased block.

## [Unreleased]

## [0.6.0] - 2026-06-10

### Added
- **PLC Devices page.** Every project now has a **PLC Devices** page in the file
  tree (also under **File → PLC Devices…** or **Manage…** in a PLC component's
  Properties): define each PLC once — name, location, and its connector/pin list
  (address, DI/DO/AI/PWM, connector, signal name, notes). Any placed PLC
  input/output can then pick a Device and Pin and its device, location, pin
  address, signal name and mode fill in automatically.
- **CAN bus wires.** A wire's new **Skin** option renders it as a yellow/green
  twisted pair.
- **Junction display options.** Toggle a junction's name on/off on the schematic,
  and mark which end of a cable it is with an end-style marker — plain dot,
  pin (male), receptacle (female), or clevis (fork).
- **Horn** component (PWR/GND) — the sound arcs pulse while it's powered.
- **Valve (Electronic)** component — proportional-valve driver block with the
  standard Us / Error / GND / Udc pins; powering Us–GND simulates.
- **Device colours.** Any component can be given its own colour in Properties
  (the simulation's powered-amber still wins while running).
- **File tree keeps your order.** Drawings are no longer sorted alphabetically —
  drag a drawing onto another to reorder it (drops before it; dropping onto a
  drawing in a folder also moves it there).
- **Device & Location fields** on every PLC input/output.
- **Digital inputs are simulatable.** Select a digital PLC input while the
  simulation runs and toggle it **High/Low** with the floating pill — the
  symbol lights up amber when high (outputs keep their On/Off toggle).

### Changed
- **PLC properties read like a document.** Selecting a PLC input/output shows a
  clean summary — signal name, pin address, device, location and the relevant
  electrical values — with an **Edit** button that flips to grouped fields.
- **Mode-aware fields.** A Digital input no longer shows analogue range or
  resolution (it gains an Input Voltage instead); an Analogue input hides the
  digital voltage/threshold; a Digital output no longer shows PWM frequency or
  duty cycle.
- **Cleaner PLC symbols.** The signal name now sits above the symbol and the
  pin address below — nothing overlaps. The reference designator is no longer
  drawn for PLC I/O, and the flow-direction arrows are gone (the DI/DO/AI/PWM
  glyphs already say which way the signal goes).

### Fixed
- **VCC/VSS rails no longer show two headings** — the designator is suppressed
  (the symbol's own VCC/VSS text plus the voltage remain).
- **Multi-select dragging is reliable** — dragging across text on the canvas no
  longer starts a text selection instead of moving the items.

## [0.5.0] - 2026-06-09

### Fixed
- **Lost work when creating a New Project.** Making a new project could overwrite
  the previously-open project's file with a blank one on the next autosave. Every
  project now saves to its own file, and a `.scpro.bak` of the previous save is
  kept alongside each file for local recovery.

### Added
- **Inline text editing.** Editing text, callouts and table cells now happens
  directly on the canvas — a transparent editor sits exactly over the text instead
  of popping out a separate box.
- **PLC I/O simplified.** PLC Input switches between Digital and Analogue; PLC
  Output switches between Digital and PWM — one component each, chosen via a Mode
  dropdown. Existing PLC parts are converted automatically. Inputs/outputs gain a
  Pin Address and Signal Name (shown on the schematic) plus a Notes field.
- **Solenoid Relay** component (coil + SPDT contact) with full simulation — energising the coil throws the contact.
- **Fuse styles** — choose IEC, cartridge, or ANSI symbol.
- **Tables**: insert/move/resize rows & columns at any position, a custom header-row
  tint, **Copy for Word** (pastes as a real table into Word/Excel/Docs), and tables
  can now be embedded in a component box's or junction's Properties.
- **Wires** can be lengthened or reshaped after placing — drag the vertex handles
  on a selected wire.
- **Image crop** in the Properties panel (drag a crop box), reflected on the canvas;
  the enlarged-image viewer now supports zoom and pan.
- **Component values** now avoid wires too (not just the reference designator).
- **Mirror with the `M` key**, and mirrored PLC symbols (DI/DO etc.) now stay
  readable instead of rendering backwards.
- **Paste external text** straight onto the canvas (not only into Properties).
- **Links** can be added to box/junction documentation; file-tree styling polished.

## [0.4.0] - 2026-06-08

### Added
- **Junctions you can document.** A new **Junction** tool (toolbar, shortcut `J`)
  lets you click anywhere on a wire to drop a connection node. Select a junction
  to give it a name and attach photos, properties and notes in its Properties
  panel — handy for documenting splices, terminals or test points.
- **Junctions move with their wire.** Wires are now draggable, and any junction
  sitting on a wire moves along with it instead of being left behind.
- **Boxes read like a document.** A component box's Properties panel is now a
  clean, formatted info sheet: a big **Title** of its own, the reference shown
  smaller and italic beneath it, a **Description**, then anything you like —
  headings, property rows, paragraphs and images — mixed in any order.
- **Reorder and resize content.** Use the ▲ / ▼ buttons to reorder any block, and
  give headings and image captions a small / medium / large size.
- **Tidier settings.** All the technical box controls (size, colours, pins,
  on-canvas label size) are tucked under a single **⚙ Configure** section, hidden
  until you need them.

### Fixed
- **Box pin labels survive a resize** and now sit clear of any wire attached to
  the pin, instead of being hidden underneath it.
- **Edits no longer jump to the next item.** Typing in a field and then clicking
  another component no longer applies your half-typed edit to the new selection.
- **Editing a box label happens in place** on the box, rather than in a separate
  pop-up box.

## [0.3.0] - 2026-06-07

### Added
- **Resizable Properties panel.** Drag the panel's left edge to make it wider or
  narrower; the width is remembered between sessions.
- **Click to enlarge images.** Click any reference image (on a box, or a selected
  image) to view it full-screen. Press Esc or click to close.
- **Clean view / edit mode for boxes.** A component box now shows its properties,
  images, links and description as a tidy read-only summary. Press **Edit** to
  reveal text boxes, delete buttons and drag handles; press **Done** to go back.
- **Reorder box content by dragging.** In edit mode, drag the handle on any
  property, image or link to change its order.
- **Links on a box.** Add clickable reference links (e.g. a datasheet URL) to a
  box, alongside its properties and images.
- **One-tap add menu.** A single row at the bottom of a box's settings adds a
  property, image, link or description — and a **Paste image** button drops an
  image straight from your clipboard.
- **Wire colour.** Select a wire to set its colour (with a one-click reset to the
  default), line style and weight.
- **Table formatting.** Select a table to add or remove rows and columns, toggle
  a header row, and set the border colour, fill and line weight.

### Fixed
- **Box label font size now works.** Setting the label size in a box's settings
  resizes the whole label as expected.
- **Reference images no longer leak between boxes.** Adding or pasting an image to
  one box (including duplicated/pasted boxes) no longer affects another.
- **Pin names no longer overlap a box's centre text** — they now sit just outside
  the box edge.

### Compatibility
- Projects saved in older versions open unchanged; new fields (box links, wire
  colour, table fill) are added with safe defaults and a legacy on-box picture is
  carried over into the panel's reference images.

## [0.2.0] - 2026-06-03

### Added
- **Properties panel.** Select any component, wire, image, text box, or box and
  its settings open in a panel on the right; deselect and the component library
  returns. The panel is organised into clear sections so it's easy to scan.
- **Richer component boxes.** Boxes now carry a flexible list of **properties**
  (name / value / unit rows you can add and remove), free-form **details**, and
  per-pin **labels**. A box with a single pin on a side now sits centred on that
  edge.
- **Reference images on a box.** Attach one or more pictures (photo, pinout,
  datasheet snippet) to a box as documentation. They show only in the Properties
  panel — each under its own heading — and never change the schematic itself.
- **Resistor symbol style.** Choose IEC (rectangle) or IEEE (zig-zag) per
  resistor, or set a default for the whole drawing.
- **Connector library.** New connector symbols: Deutsch DT (2/3/4-way), M12
  A-coded (3/4-pin), and pin headers (2/4-pin).
- **Tables.** Insert a table onto a drawing and edit each cell as rich text —
  handy for pin maps and wiring legends.
- **Resizable text boxes** with eight drag handles, plus an adjustable reference
  label size on components.
- **Grid sizing.** Pick the grid spacing (5, 10, 20, 25, or 50) from the status
  bar; the canvas re-tiles and snapping follows.

### Changed
- **Paste images.** Copy an image anywhere and paste it straight onto the canvas
  at your cursor.
- **Unsaved-work prompt.** Opening another project now warns you first if the
  current one has unsaved changes.
- The text formatting toolbar now highlights the active bold/italic/underline
  and alignment state for what you've selected.

### Fixed
- **Reliable image selection.** Clicking an image now selects it every time, and
  a locked image can be unlocked again from the Properties panel.
- **Font size** in the text editor now applies correctly to a selection.
- **Dragging a drawing into a subfolder now works on Windows.** The desktop
  webview was intercepting the drag; the file tree handles it directly now.

## [0.1.1] - 2026-06-02

### Fixed
- The "update available" dialog no longer hides its buttons when the release
  notes are long: the notes shown in the prompt are now trimmed (the full
  changelog stays on the releases page), so **Update** and **Later** are always
  reachable.

## [0.1.0] - 2026-06-02

### Added
- **Images on schematics.** Insert PNG/JPG/SVG images onto a drawing as a
  backdrop — move, resize (with optional aspect-lock), rotate, set opacity, and
  lock them in place. Images are saved inside the project file.
- **Rich text in labels.** Text and callout boxes now support full formatting:
  bold, italic, underline, font size, colour, alignment, and multiple lines —
  mix styles within a single box.
- **Component boxes.** Place a labelled box to represent any part: format the
  text inside it, snap it to the grid, and connect wires to pins on its sides.
  Boxes are drawing-only and are ignored by the simulator.
- **Project file tree.** A new left-hand panel shows your project as a tree of
  folders and drawings. Create nested subfolders, drag drawings between them,
  and rename, add, or delete from one place.
- **Project attachments.** Attach files (datasheets, notes, reference images)
  to a project. They travel inside the project file and can be exported back out.

### Changed
- **Toolbar moved to the top.** All tools now sit in a single row across the top
  of the window.
- **Drawing tabs replaced by the file tree.** The old tab strip is gone; switch
  and manage drawings from the new file tree, and find the **File** menu in the
  top toolbar.
- **Sturdier project files.** Projects now bundle images and attachments; a size
  indicator warns when a project grows large (past ~25 MB). A failed save no
  longer overwrites a good file, and damaged images/attachments are skipped when
  opening instead of blocking the whole project from loading.

### Fixed
- Dragging a drawing into a folder is now reliable — the whole folder area
  accepts the drop, not just its single-line label.

## [0.0.3]

### Added
- **In-app auto-update.** On launch the app now checks GitHub Releases for a
  newer signed build and offers to download, install, and relaunch. You can also
  check on demand via **File → Check for Updates…**.

## [0.0.2]

### Fixed
- Multi-ground nets are now treated as a single node during simulation.
- Simulation parameters are wired up for diodes, Zener diodes, and potentiometers.
- Pin dots and wire snapping now respect component rotation and z-order.

## [0.0.1]

### Added
- Initial release: draw and simulate electrical schematics with multi-drawing
  projects, a component library, JSON import/export, and native macOS and
  Windows builds.
