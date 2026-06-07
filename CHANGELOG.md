# Changelog

All notable changes to Smart Schematics are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and the
project adheres to [Semantic Versioning](https://semver.org/). The section for
each version is published verbatim as the GitHub Release notes (and shown in the
in-app "update available" dialog), so write it for end users.

Jot changes under **[Unreleased]** as you work. `npm run release` stamps that
section with the version and date and starts a fresh Unreleased block.

## [Unreleased]

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
