# Changelog

All notable changes to Smart Schematics are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and the
project adheres to [Semantic Versioning](https://semver.org/). The section for
each version is published verbatim as the GitHub Release notes (and shown in the
in-app "update available" dialog), so write it for end users.

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
