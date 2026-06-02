# Changelog

All notable changes to Smart Schematics are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and the
project adheres to [Semantic Versioning](https://semver.org/). The section for
each version is published verbatim as the GitHub Release notes (and shown in the
in-app "update available" dialog), so write it for end users.

Jot changes under **[Unreleased]** as you work. `npm run release` stamps that
section with the version and date and starts a fresh Unreleased block.

## [Unreleased]

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
