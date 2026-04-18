# Changelog

All notable changes to this project are documented in this file.

## [0.0.9] - 2026-04-19

### Changed

- Runtime `logs.json` now lives in the extension's per-user global storage (`globalStorageUri`) under a per-workspace subdirectory, instead of in `<workspace>/.debug_console_plus/`. This avoids polluting Git, leaking absolute local paths into shared repos, and runaway log growth in the workspace.
- **Save Logs** now opens a save dialog so you choose where the export lands (defaults to your home directory) instead of always writing into the workspace.
- **Load Logs** no longer defaults its file picker to `<workspace>/.debug_console_plus/`.
- **Set Up MCP Server** now writes the absolute logs path into `.cursor/mcp.json`. **If you were using the MCP integration, re-run "Set Up MCP Server" after upgrading.**

### Added

- **Open Logs Folder** command (in the "..." submenu) that reveals this workspace's logs directory in your OS file manager.
- Per-workspace logs folders are now named `<workspace-name>-<short-hash>` (e.g. `debug_console_plus-0ba49f0b`) instead of an opaque hash, so they're recognizable when you browse them.

### Migration

- Any existing `<workspace>/.debug_console_plus/` folder is no longer written to. You can safely delete it and remove the entry from `.gitignore` if you added one.

## [0.0.8] - 2026-04-03

### Added

- Filter modes for text/regex matching: choose **AND**, **OR**, or a dedicated search-within-logs mode from the filter control (including via its context menu).

### Changed

- Search navigation tracks match line indices for more reliable next/previous movement through filtered results.

## [0.0.7] - 2026-04-01

### Added

- Focus filter command (**Debug Console+: Focus Filter / Search**) and search navigation improvements; use **Cmd+F** / **Ctrl+F** when the Debug Console+ view is focused.
- Further search enhancements for filtering debug console logs.

### Changed

- Title bar menu structure and related commands (including the “more” submenu).
- Internal log handling and callback wiring for more reliable updates.

## [0.0.6] - 2026-02-08

### Changed

- Various fixes and improvements (auto-scroll, DAP category, menu ordering, link resolution, saved logs format, and related polish).
