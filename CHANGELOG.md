# Changelog

All notable changes to Smart Schematics are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and the
project adheres to [Semantic Versioning](https://semver.org/). The section for
each version is published verbatim as the GitHub Release notes (and shown in the
in-app "update available" dialog), so write it for end users.

Jot changes under **[Unreleased]** as you work. `npm run release` stamps that
section with the version and date and starts a fresh Unreleased block.

## [Unreleased]

### Added
- **Industrial Control section in the component library** — six new panel and
  machine-wiring symbols, each one configurable rather than fixed:
  - **Terminal Strip** — 1–40 ways, as either a DIN-rail block or a panel plug
    rail with round screw terminals. Set the first terminal number to match the
    panel (19, 20, 21 …), and optionally draw knife disconnects. Every way links
    its field terminal to its internal one, so a circuit routed through the strip
    actually runs in the simulator.
  - **Harness Connector** — a multi-way plug or receptacle with 1–40 numbered
    contacts. Plain by default (a ruled column of numbered ways, as a loom
    drawing shows it), or switch it to a keyed housing with pin/socket contacts
    for a connector detail view.
  - **Safety Relay** — a dual-channel, force-guided safety relay drawn the way the
    device's own diagram shows it: A1/A2 supply, T/R channel inputs, X1/X4 reset
    loop, status lamps, a Manual/Auto legend, and every output carrying two
    redundant contacts in series off a pair of armature bars. 1–4 NO safety
    contacts plus up to two NC auxiliaries, numbered to IEC (13/14, 23/24, 33/34,
    then 41/42) and renumbering themselves as you add or remove them. The
    manufacturer, model and device tag are all editable.
  - **Safety I/O Group** — one terminal group of a safety controller (DI, DO, TO,
    AI, AO or PWR) with 1–16 channels, a first-terminal number, and your own
    signal designations in their own ruled strip. Choose whether the conductors
    leave upward or downward, so output groups along the top of a module and
    input banks along the bottom both read correctly.
  - **Selector Switch** — a mode or cam switch drawn as its contact development:
    a bank of up to 12 contact pairs bridging a plug's terminals, all thrown by
    one shaft. Paste in a row of your truth table ("1,2,5") and exactly those
    contacts close, so you can draw the switch in whichever state the sheet is
    meant to show.
  - **Panel Indicator** — a pilot light as a round IEC signal lamp, a square
    panel-legend plate, or an LED, in five lens colours. It lights in simulation
    like a lamp.

### Fixed
- **A reference designator is never handed out twice.** Placing a part after
  deleting one no longer reuses a number that is still on the sheet, and
  copy/paste and Ctrl+D now renumber what they paste. Duplicated coil references
  had also been driving the wrong contacts in simulation.
- **Copying a region keeps its junctions.** Documented junction nodes now travel
  with a copy/paste instead of being silently dropped.
- **Select All and box-select no longer skip things.** Ctrl+A now includes tables
  and junctions, and dragging a selection box picks up tables.
- **Configurable parts no longer keep the wrong outline.** A manifold, valve
  builder or terminal block that grew or shrank kept its original selection box,
  click area and label spacing — and exported cropped. All of them now follow the
  part's actual size.
- **Fit to Screen actually fits.** The toolbar button and `0` used to just reset
  to 100% at the sheet origin, which on a big drawing left the whole thing
  off-screen. Both now zoom and centre so the entire drawing is in view. Zoom to
  selection (`Z`) also takes tables and junctions into account.

## [0.11.0] - 2026-06-23

### Added
- **PLC CAN block.** A new PLC component for CAN-bus connections, switchable
  between **CAN High** and **CAN Low**, with a selectable bit rate. It binds to a
  device's CAN pins just like the input/output blocks. The **PLC I/O** section of
  the component library now sits **above** Logic.
- **Per-device schematic lock.** Each PLC device can now choose, on its own,
  whether its signals are **editable on the schematic** or **locked to the PLC
  Devices page** — set it per device, or leave it on the project default. When a
  device is schematic-editable you can re-assign pins on the symbol and the signal
  name follows the pin.
- **Spring-return option in the Valve Builder**, so you can draw detented valves
  (no return springs) as well as spring-centred ones.
- **View datasheets without downloading.** PLC device datasheets and docs now open
  in an in-app viewer (PDFs and images); a separate button still downloads them.

### Fixed
- **Datasheet downloads are no longer corrupt.** Downloading a datasheet from a PLC
  device now writes the real file instead of a broken one.
- **Linking a Component Box to a PLC device now sticks.** Picking a device from the
  box's dropdown actually links it and shows the device badge.
- **Stopping the simulation depowers the circuit.** Solenoids drop out and
  spring-return valves snap back to their home position when you stop the sim
  (cylinder positions and switch settings are kept so resuming continues cleanly).
- **Sharper PDF & PNG exports.** Exports now render at a higher resolution so small
  drawings are no longer pixelated when scaled to the page.

### Changed
- **One clean PDF title block.** The PDF title block now fills in from the drawing's
  own title-block fields (title, number, revision, author, date) instead of
  duplicating a generic one.
- **Connector reads inline with the pin address** on the PLC symbol — "X1 I0.0" on
  one line — so it scans as connector → pin.
- **Cleaner shuttle valve symbol** drawn as the standard two seats with a ball, and
  tidier crossed-flow arrows in the Valve Builder.

## [0.10.0] - 2026-06-22

### Added
- **Valve builder.** A single configurable directional valve replaces the fixed
  list of DCV types: choose **2 or 3 positions**, **2/3/4 ports**, and the
  **centre condition** (closed / open / tandem / float). It draws itself, wires
  into the simulation, and works with solenoid linking just like the fixed valves.
- **Manifold component.** A distribution block with a configurable number of work
  ports (2–16) that grows to fit — tap a common pressure gallery to as many ports
  as you need.
- **Solenoid symbol options.** Pick the solenoid style — **Box** (standard IEC
  actuator, now the default), **Coil**, or **Proportional** — and the symbol is
  cleaner across the board.
- **Link a Component Box to a PLC device.** Tie a box to a device from the PLC
  registry for high-level controller diagrams; the box shows the device name,
  location, and pin count, with a one-click "use device name as title".
- **More PLC pin types.** Added **TEMP**, **RHEO**, **PWR+** and **PWR-** so the
  registry, CSV, and bindings cover temperature, rheostat, and power-rail pins.

### Fixed
- **Exporting works on Windows.** PDF export no longer hangs on "Building PDF…"
  forever — it now renders reliably and lets you choose where to save the file.
  PNG and SVG exports also save through the native Save dialog on the desktop app.
- **PLC pin picking selects the right pin.** Picking a pin for a bound symbol no
  longer grabs the wrong one when two pins share an address across connectors
  (e.g. C1 P19 vs C2 P19) — pins are matched by identity.
- **PLC output → input in simulation.** Turning on an output now powers an input
  that's wired to it, so chained controllers respond in the simulation.
- **CSV device import just works.** Importing a CSV with several devices splits
  them out correctly, tolerating spreadsheet byte-order marks and a range of
  column-header names.
- **Cleaner check & shuttle valve symbols**, with the check-valve flow arrow
  pointing the correct way.

### Changed
- **PLC device name shows on the schematic by default**, and a pin's **connector**
  now sits under the symbol next to the pin so it reads connector → pin.
- **Bind any capable pin.** A pin set to one type (e.g. an output) can be assigned
  to a block it's *capable* of (e.g. an input) and switched in the schematic; the
  Type list defaults to a capable value and is grouped to be less cluttered.
- **PLC Devices page: minimise device cards** (so you don't scroll past 50 pins)
  and, when sorting by connector, pins are grouped under connector headings.

## [0.9.0] - 2026-06-21

### Fixed
- **Typing in the PLC connector / address / channel boxes works again.** They no
  longer drop focus after a single character — you can type a whole value in one go.
- **"Couldn't find my project" on every launch (OneDrive/Dropbox).** If your project
  file is still syncing from the cloud when the app starts, it now retries, and if it
  still can't be read it opens a blank project and shows a **Retry** banner instead of
  failing — your file is no longer forgotten.
- **Exports look right.** Missing wires, wrong/garbled colours, dropped images and odd
  artifacts in PNG/SVG/PDF exports are fixed — colours are resolved properly, the
  background is clean white, and pictures/tables/wide parts are no longer cropped out.
- **Digital input simulation.** Toggling a PLC digital input High/Low now actually
  drives its pin, so anything wired to it (a lamp, relay, etc.) responds in the
  simulation.

### Added
- **Export progress feedback.** A small toast confirms an export is running and when it
  finishes (including "page X of N" for multi-page project PDFs), so you know it worked.
- **Import / export individual PLC devices.** Download any single device as a portable
  **CSV** (pin list) or lossless **JSON** (keeps its photos and datasheets), and
  **Import** a device into another project from the PLC Devices page — reuse your PLC
  setups across projects.
- **More on the schematic.** New show-on-schematic toggles for a PLC symbol's
  **Connector** and **Channel**, alongside the existing signal name / address / device.
- **Edit signal name + I/O type on the schematic.** A per-project **Signal master**
  setting (PLC Manager or Schematic) lets you choose where a bound symbol's signal name
  and I/O type are edited; in **Schematic** mode, editing them on the symbol updates the
  PLC registry, so swapping pins is quick.
- **Channel shown when picking a pin.** The pin picker now shows the connector and
  channel alongside the address and signal name.
- **More pin types** — **FREQ**, **CANH**, **CANL** and **CANSH** join DI/DO/AI/PWM,
  with a clearer capability/type interface (the Type list only offers what a pin is
  actually capable of).
- **More device info.** PLC devices can now carry **notes** and attached **datasheets /
  documents** in addition to location photos.

## [0.8.0] - 2026-06-15

### Fixed
- **PLC devices no longer disappear.** Reopening a saved project (or importing one)
  was silently wiping the PLC device registry — your devices, pins and wiring
  notes are now kept through every open and import.

### Added
- **Read-only / Edit modes on the PLC Devices page.** The page now opens as a
  clean, read-only connector/pin list; click **Edit** to add, change, reorder or
  delete devices and pins, then **Done** to lock it back to a tidy view.
- **Sort PLC pins** by whatever you're after — manual order, connector → pin,
  channel, or type (DI/DO/AI/PWM) — from a sort selector at the top of the page.
- **Current rating per pin.** Each PLC pin has a **Max A** field for its current
  rating; it shows on the page, exports to CSV, and appears on placed PLC
  inputs/outputs that are bound to that pin.
- **Connector column** is now editable directly on the PLC Devices page, so
  devices with several connectors are easy to lay out and read.

### Changed
- **Horn symbol** redrawn so both terminals enter from the same (left) side and
  the trumpet faces right — matching how a horn is actually wired and where the
  sound comes out.

## [0.7.0] - 2026-06-14

### Added
- **Steering cylinder.** New double-acting **through-rod** cylinder (Hydraulic →
  Actuators) — the rigid rod passes through both ends and strokes left/right
  while the simulation runs. All cylinders (single/double/telescopic/steering)
  now visibly move their rod during simulation, not just a fill bar.
- **PLC devices export to CSV.** The PLC Devices page has an **Export CSV** button
  that writes the whole connector/pin list (device, location, connector, address,
  channel, type, capabilities, signal name, notes) as a spreadsheet-ready file.
- **Channel column** on every PLC pin, and **pin capabilities** — mark what a pin
  *can* do (DI/DO/AI/PWM) separately from what it's currently set to (e.g. a
  PWM-capable pin used as a DO).
- **Reorder PLC pins** with ▲/▼ buttons; the page now groups pins under their
  **connector** so it reads like a real connector list.
- **Location photos on a PLC** — attach pictures of where each device physically
  sits, shown on the PLC Devices page (click to zoom).
- **Show / hide on the symbol.** Each placed PLC input/output has toggles for
  signal name, pin address, device name, and (outputs) the **current rating** —
  so you control exactly what's drawn on the schematic.
- **Colour presets.** Wire and component colour pickers now offer a palette of
  default swatches plus your own saved colours, shared across the whole program.
- **Export to PDF.** **File → Export Page as PDF** (the current drawing) and
  **Export Project as PDF** (one page per drawing), each with a clean title block.

### Changed
- **PLC registry is now the single source of truth.** When a PLC input/output is
  linked to a device pin, its signal name, connector, channel, location and notes
  come live from the PLC Devices page and are read-only on the component — edit
  them once on the device page and every linked symbol updates. Unlink (set the
  device to *manual*) to type values directly.
- **Relief and check valves redrawn** to the standard ball-on-seat (poppet) style.
  The check valve is now **directional** in simulation — it passes forward flow
  and blocks reverse — and both valves animate their ball when flowing.

### Fixed
- Existing PLC pins and device bindings are preserved unchanged when opening files
  from earlier versions (new fields are added, nothing is overwritten).

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
