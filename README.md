# Debug Console+

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/Pomisoft.debug-console-plus?label=VS%20Code%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=Pomisoft.debug-console-plus)
[![Open VSX](https://img.shields.io/open-vsx/v/pomisoft/debug-console-plus?label=Open%20VSX&logo=openvsx)](https://open-vsx.org/extension/pomisoft/debug-console-plus)

A better debug console for VS Code / forks. Filter, search, and let AI query your logs.

**Latest release:** 0.0.9 — see [CHANGELOG.md](CHANGELOG.md) for notes.

![Debug Console+ demo](recording.gif)

## Features

- **Level filtering** — toggle debug / info / warn / error with one click
- **Search** — search or filter logs by text or regex, combine with AND/OR logic
- **Save / load logs** — export or restore sessions from the **…** (more) menu in the view title bar
- **Timestamps** — show/hide, auto-hides on narrow panels
- **Compact** — strip timestamps, Android logcat tags, and box-drawing for clean output (experimental)
- **Auto-scroll** — follows new logs, pauses when you scroll up
- **Copy & clipboard**
  - **Copy All Logs** (Command Palette or the copy icon in the view title bar) — copies every line that currently passes your level and search filters (not the unfiltered session). Each line is timestamp (unless timestamps are hidden), level, and the stored message text.
  - **Copy up to here** / **Copy from here** — right-click any log line in the list. **Copy up to here** copies from the first filtered line through the line you clicked (inclusive). **Copy from here** copies from that line through the last filtered line (inclusive). Hovered ranges highlight so you can see what will be copied. Same filters and clipboard formatting as **Copy All Logs** (note: **Compact** only changes how lines are drawn in the view, not what gets copied).


![Debug Console+ screenshot](copy_from_here.png)

## MCP Integration

AI agents can query your debug logs using the built-in MCP server.

**Setup:** open the **…** (more) menu in the Debug Console+ title bar, then choose **Set Up MCP Server** (plug icon). The setup writes an absolute path to the per-workspace logs directory into `.cursor/mcp.json`, so re-run it if you move workspaces or upgrade from a version older than 0.0.9.

Example queries an agent can answer:
- "Show me only errors"
- "Find logs containing 'users' that are errors"
- "Show recent warnings"

## Where logs are stored

Live logs are written to the extension's per-user **global storage** (outside any workspace), under a per-workspace subdirectory. They are never placed in your project folder, so they don't pollute Git, leak local paths, or grow inside the repo.

Use the **Open Logs Folder** entry in the **…** (more) menu to reveal the current workspace's logs directory in your OS file manager. Typical locations:

- macOS: `~/Library/Application Support/<App>/User/globalStorage/pomisoft.debug-console-plus/workspaces/<workspace-name>-<hash>/`
- Linux: `~/.config/<App>/User/globalStorage/pomisoft.debug-console-plus/workspaces/<workspace-name>-<hash>/`
- Windows: `%APPDATA%\<App>\User\globalStorage\pomisoft.debug-console-plus\workspaces\<workspace-name>-<hash>\`

The folder name is the workspace's basename plus a short hash (so two projects with the same name still get separate folders).

If you upgraded from an older version, you can safely delete any `.debug_console_plus/` folder that was previously created in your workspace (and remove it from `.gitignore`).

## Install

```bash
npm install
npm run compile
```

## Build

```bash
npx --yes @vscode/vsce package
```

## License

MIT
