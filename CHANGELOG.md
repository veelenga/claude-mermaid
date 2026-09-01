# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Artifact preview backend: run with `--preview artifact` or `CLAUDE_MERMAID_PREVIEW=artifact` to have `mermaid_preview` write a self-contained HTML page for publishing as a Claude artifact instead of starting the local live server
- Copy SVG button in the diagram viewer toolbar

### Changed

- Split the preview page script into a shared viewer (pan, zoom, copy) and live-server-only features (websocket reload, export, editor links)

### Security

- Validate theme, format, width, height and scale before rendering to prevent command injection via `cmd.exe /c` on Windows; re-render paths (`mermaid_save`, `/export/`) are validated too

## [1.6.5] - 2026-08-08

### Security

- Validate diagram ID in `/view/` route to prevent path traversal in `handleViewRequest` (#136)
- Restricted CI `GITHUB_TOKEN` to `contents: read` (#137)
- Patched transitive advisories in `dompurify`, `hono`, `@hono/node-server`, `mermaid`, `nanoid`, `js-yaml`, `postcss`, `fast-uri`, `ip-address`, and `body-parser`

### Added

- Project website served via GitHub Pages
- `llms.txt` and a Markdown version of the website for AI agents

### Fixed

- Mobile layout on the project landing page (#155)

### Changed

- Bumped `pako` to 3.0.1
- Bumped `@mermaid-js/mermaid-cli` to 11.16.0
- Bumped `@modelcontextprotocol/sdk` to 1.30.0
- Bumped `ws` to 8.21.1
- Bumped development tooling to TypeScript 7.0.2, `@types/node` 26.1.2, Prettier 3.9.6, and Vitest 4.1.10

## [1.6.4] - 2026-05-28

### Security

- Bind live reload server to `127.0.0.1` to prevent LAN exposure of the unauthenticated gallery and `DELETE /api/diagrams` endpoint (#135)
- Bumped `qs` transitive dependency to 6.15.2

### Fixed

- Windows browser-open crash (`spawn start ENOENT`) in MCP and `--serve` paths (#130)

### Changed

- Bumped `@mermaid-js/mermaid-cli` to 11.15.0
- Bumped `ws` to 8.21.0
- Normalized `package.json` bin path and repository URL

## [1.6.3] - 2026-05-16

### Fixed

- Invoke `npx` through `cmd.exe /c` on Windows to avoid spawn failures

### Changed

- Bumped `@mermaid-js/mermaid-cli` to 11.14.0
- Various dependency and security updates

## [1.6.2] - 2026-03-19

### Fixed

- Use non-blocking spawn for browser open to prevent CLI freezing on WSL2

## [1.6.1] - 2026-03-11

### Fixed

- Propagate mermaid-cli stderr in rendering errors for better error messages

### Changed

- Improved test structure and coverage

## [1.6.0] - 2026-03-05

### Added

- Zoom controls in diagram preview (scroll wheel, +/- buttons, zoom level indicator)
- Touch support for panning diagrams on mobile devices

### Fixed

- Improved mobile layout for diagram preview (responsive status bar, better diagram sizing)
- Gallery card actions now visible on touch devices without hover

### Removed

- Automatic diagram removal functionality

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
