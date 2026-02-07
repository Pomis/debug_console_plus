# Debug Console+

A better debug console for VS Code / Cursor. Filter, search, and let AI query your logs.

## Features

- **Level filtering** — toggle debug / info / warn / error with one click
- **Smart parsing** — detects `[debug]`, `[error]`, etc. tags in log messages automatically
- **Search** — filter logs by text or regex, combine with AND/OR logic
- **Timestamps** — show/hide, auto-hides on narrow panels
- **Normalize** — strip tags and timestamps for clean output
- **Copy all** — copies filtered logs to clipboard
- **Auto-scroll** — follows new logs, pauses when you scroll up
- **MCP server** — exposes a `query_debug_logs` tool so AI agents in Cursor can search and filter your logs

## MCP Integration

AI agents can query your debug logs using the built-in MCP server.

**Setup:** click the plug icon in the Debug Console+ title bar.

Example queries an agent can answer:
- "Show me only errors"
- "Find logs containing 'users' that are errors"
- "Show recent warnings"

## Install

```bash
npm install
npm run compile
```

Press `F5` to launch the Extension Development Host, or `npm run package` to build a `.vsix`.

## License

MIT
