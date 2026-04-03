# Changelog

All notable changes to this project are documented in this file.

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
