# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.0] - 2026-02-24

### Added

- Simple server mode to browse and manage diagrams without Claude (`npx claude-mermaid serve`)

### Fixed

- Fixed PNG export failing with "tainted canvas" SecurityError by rendering PNG server-side via mermaid-cli instead of using browser canvas conversion

## [1.4.0] - 2026-02-04

### Added

- Export diagrams directly from browser preview (SVG and PNG)

## [1.3.0] - 2025-11-25

### Added

- Diagram gallery
- Ability to delete a diagram

### Fixed

- Fixed "could not determine executable to run" error when mermaid-cli is not installed globally by using the scoped package name `@mermaid-js/mermaid-cli` instead of `mmdc`

## [1.2.0] - 2025-11-01

### Added

- Claude plugin system support for easy installation via `/plugin install`
- Ability to open diagrams in Mermaid Live Editor

## [1.1.1] - 2025-10-03

### Security

- Added path traversal validation to prevent directory traversal attacks
- Implemented safe path resolution for file operations
- Enhanced input sanitization for file paths

## [1.1.0] - 2025-10-02

### Added

- `-v` and `--version` CLI flags to display version
- Theme support (`default`, `forest`, `dark`, `neutral`)
- Custom background color support (transparent, custom colors)
- Configurable diagram dimensions (`width`, `height`) and scale factor
- Live reload mode with automatic diagram refresh via WebSocket
- Default save location changed to `~/.config/claude-mermaid/`
- Interactive diagram preview with drag-to-pan functionality
- Reset position button (⊙) to recenter dragged diagrams
- Static view mode for `/view/` routes without live reload
- Browser native zoom support (pinch-to-zoom and Ctrl/Cmd + +/-)

### Changed

- Replaced custom zoom controls with native browser zoom
- Improved diagram fitting to automatically scale to viewport
- Status bar now shows "Static View" for non-live preview pages
- Removed scrollbars from preview (clean viewport with drag-to-pan)

## [1.0.1] - 2025-09-30

### Added

- Documentation for global MCP server installation using `--scope user` flag

### Fixed

- NPM package now excludes unnecessary files (src, assets, config files)

## [1.0.0] - 2025-09-30

### Added

- Initial release of Claude Mermaid MCP Server
- Preview Mermaid diagrams directly in Claude Code
- Support for multiple output formats (PNG, SVG, PDF)
- Browser mode with HTML wrapper for diagram viewing
- Automatic diagram rendering and opening in default viewer
- Command-line tool for MCP integration
- Test coverage for core functionality
