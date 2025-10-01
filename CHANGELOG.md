# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `-v` and `--version` CLI flags to display version
- Theme support (`default`, `forest`, `dark`, `neutral`)
- Custom background color support (transparent, custom colors)
- Configurable diagram dimensions (`width`, `height`) and scale factor
- `save_path` parameter to save diagrams to project location

### Changed
- Tool renamed from `preview_mermaid` to `render_mermaid`
- Default output format changed from `png` to `svg`

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
