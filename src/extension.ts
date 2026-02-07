import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DebugConsolePlusViewProvider } from './webviewPanel';
import { DebugSessionTracker } from './debugSessionTracker';
import { ParsedLog } from './types';

let tracker: DebugSessionTracker | null = null;
let viewProvider: DebugConsolePlusViewProvider | null = null;

export function activate(context: vscode.ExtensionContext) {
  console.log('[Debug Console+] Extension activating...');

  // Get configuration
  const config = vscode.workspace.getConfiguration('debugConsolePlus');
  const maxLogs = config.get<number>('maxLogs', 10000);

  // Determine logs directory path
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  let logsDir: string | undefined;

  if (workspaceFolder) {
    logsDir = path.join(workspaceFolder.uri.fsPath, '.debug_console_plus');
    // Ensure directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  // Create debug session tracker
  tracker = new DebugSessionTracker(maxLogs, logsDir);
  console.log('[Debug Console+] Debug session tracker created');

  // Create webview view provider
  viewProvider = new DebugConsolePlusViewProvider(context.extensionUri);
  console.log('[Debug Console+] View provider created');

  // Register the webview view provider
  const providerRegistration = vscode.window.registerWebviewViewProvider(
    DebugConsolePlusViewProvider.viewType,
    viewProvider,
    {
      webviewOptions: {
        retainContextWhenHidden: true,
      }
    }
  );
  context.subscriptions.push(providerRegistration);
  console.log('[Debug Console+] View provider registered with type:', DebugConsolePlusViewProvider.viewType);

  // Set up log callback
  tracker.onLog((logs) => {
    if (viewProvider) {
      viewProvider.sendLogs(logs);
    }
  });

  // Register commands
  const focusCommand = vscode.commands.registerCommand('debugConsolePlus.focus', () => {
    if (viewProvider) {
      viewProvider.reveal();
    }
  });

  const clearCommand = vscode.commands.registerCommand('debugConsolePlus.clear', () => {
    if (tracker) {
      tracker.clearLogs();
    }
    if (viewProvider) {
      viewProvider.clearLogs();
    }
  });

  const toggleTimestampsCommand = vscode.commands.registerCommand(
    'debugConsolePlus.toggleTimestamps',
    () => {
      if (viewProvider) {
        viewProvider.toggleTimestamps();
      }
    }
  );

  const copyAllCommand = vscode.commands.registerCommand('debugConsolePlus.copyAll', () => {
    if (viewProvider) {
      viewProvider.copyAllLogs();
    }
  });

  const toggleCompactCommand = vscode.commands.registerCommand('debugConsolePlus.toggleCompact', () => {
    if (viewProvider) {
      viewProvider.toggleCompact();
    }
  });

  const toggleTagsCommand = vscode.commands.registerCommand('debugConsolePlus.toggleTags', () => {
    if (viewProvider) {
      viewProvider.toggleTags();
    }
  });

  const diagnoseCommand = vscode.commands.registerCommand('debugConsolePlus.diagnose', () => {
    const info = [
      `[Debug Console+] Diagnostic Information:`,
      `- Extension activated: ${tracker !== null && viewProvider !== null}`,
      `- View provider type: ${DebugConsolePlusViewProvider.viewType}`,
      `- View provider instance: ${viewProvider ? 'exists' : 'null'}`,
      `- Tracker instance: ${tracker ? 'exists' : 'null'}`,
    ].join('\n');
    console.log(info);
    vscode.window.showInformationMessage('Diagnostic info logged to console. Filter by "Debug Console+"');
  });

  const setupMcpCommand = vscode.commands.registerCommand('debugConsolePlus.setupMcp', async () => {
    const isCursor = vscode.env.appName.toLowerCase().includes('cursor');
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder found. Please open a workspace first.');
      return;
    }

    // Get the extension's out directory path (absolute path)
    const extensionPath = context.extensionPath;
    const mcpServerPath = path.join(extensionPath, 'out', 'mcpServer.js');
    const logsDir = '.debug_console_plus';

    // Use absolute path for the MCP server since it's bundled with the extension
    const mcpConfig = {
      mcpServers: {
        'debug-console-plus': {
          command: 'node',
          args: [mcpServerPath, '--logs-dir', logsDir],
        },
      },
    };

    const configJson = JSON.stringify(mcpConfig, null, 2);

    if (isCursor) {
      // Cursor: Show dialog with "Set Up MCP" button
      const message = `MCP (Model Context Protocol) allows AI agents in Cursor to query your debug logs.\n\n` +
        `For example, agents can:\n` +
        `• Check only error logs\n` +
        `• Find logs containing "users" AND errors\n` +
        `• Filter by log level and search terms\n\n` +
        `Click "Set Up MCP" to automatically configure this.`;

      const action = await vscode.window.showInformationMessage(
        message,
        { modal: true },
        'Set Up MCP'
      );

      if (action === 'Set Up MCP') {
        try {
          // Create .cursor directory if it doesn't exist
          const cursorDir = path.join(workspaceFolder.uri.fsPath, '.cursor');
          if (!fs.existsSync(cursorDir)) {
            fs.mkdirSync(cursorDir, { recursive: true });
          }

          // Create or update mcp.json
          const mcpJsonPath = path.join(cursorDir, 'mcp.json');
          fs.writeFileSync(mcpJsonPath, configJson, 'utf8');

          // Open the file in the editor
          const doc = await vscode.workspace.openTextDocument(mcpJsonPath);
          await vscode.window.showTextDocument(doc);

          vscode.window.showInformationMessage(
            'MCP configured! Restart Cursor to activate.',
            'OK'
          );
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to create MCP configuration: ${error}`,
            'OK'
          );
        }
      }
    } else {
      // VS Code or other editor: Show dialog with config snippet and copy button
      const message = `MCP (Model Context Protocol) allows AI agents to query your debug logs.\n\n` +
        `To use this MCP server, add the following configuration to your MCP-compatible tool:\n\n` +
        `\`\`\`json\n${configJson}\n\`\`\`\n\n` +
        `Click "Copy Config" to copy this configuration to your clipboard.`;

      const action = await vscode.window.showInformationMessage(
        message,
        { modal: true },
        'Copy Config'
      );

      if (action === 'Copy Config') {
        await vscode.env.clipboard.writeText(configJson);
        vscode.window.showInformationMessage('MCP configuration copied to clipboard!');
      }
    }
  });

  const saveLogsCommand = vscode.commands.registerCommand('debugConsolePlus.saveLogs', async () => {
    if (!tracker) {
      vscode.window.showErrorMessage('Debug Console+ tracker is not available.');
      return;
    }

    const logs = tracker.getLogs();
    if (logs.length === 0) {
      vscode.window.showInformationMessage('No logs to save.');
      return;
    }

    const fileUri = await vscode.window.showSaveDialog({
      filters: {
        'JSON': ['json']
      },
      defaultUri: vscode.Uri.file('debug-logs.json'),
      saveLabel: 'Save Logs'
    });

    if (!fileUri) {
      return; // User cancelled
    }

    try {
      const jsonContent = JSON.stringify(logs, null, 2);
      await vscode.workspace.fs.writeFile(fileUri, Buffer.from(jsonContent, 'utf8'));
      vscode.window.showInformationMessage(`Saved ${logs.length} log${logs.length === 1 ? '' : 's'} to ${path.basename(fileUri.fsPath)}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save logs: ${error}`);
    }
  });

  const loadLogsCommand = vscode.commands.registerCommand('debugConsolePlus.loadLogs', async () => {
    if (!tracker) {
      vscode.window.showErrorMessage('Debug Console+ tracker is not available.');
      return;
    }

    const fileUris = await vscode.window.showOpenDialog({
      filters: {
        'JSON': ['json']
      },
      canSelectMany: false,
      openLabel: 'Load Logs'
    });

    if (!fileUris || fileUris.length === 0) {
      return; // User cancelled
    }

    const fileUri = fileUris[0];

    try {
      const fileContent = await vscode.workspace.fs.readFile(fileUri);
      const jsonContent = fileContent.toString();
      const parsedData = JSON.parse(jsonContent);

      // Validate that it's an array
      if (!Array.isArray(parsedData)) {
        vscode.window.showErrorMessage('Invalid log file format: expected an array of log entries.');
        return;
      }

      // Validate that each entry has the expected ParsedLog structure
      const validLogs: ParsedLog[] = [];
      for (let i = 0; i < parsedData.length; i++) {
        const entry = parsedData[i];
        if (
          typeof entry === 'object' &&
          entry !== null &&
          typeof entry.id === 'string' &&
          typeof entry.timestamp === 'number' &&
          typeof entry.level === 'string' &&
          typeof entry.message === 'string' &&
          typeof entry.category === 'string' &&
          typeof entry.sessionId === 'string'
        ) {
          validLogs.push(entry as ParsedLog);
        } else {
          console.warn(`[Debug Console+] Skipping invalid log entry at index ${i}`);
        }
      }

      if (validLogs.length === 0) {
        vscode.window.showErrorMessage('No valid log entries found in the file.');
        return;
      }

      tracker.loadLogs(validLogs);
      vscode.window.showInformationMessage(`Loaded ${validLogs.length} log${validLogs.length === 1 ? '' : 's'} from ${path.basename(fileUri.fsPath)}`);
    } catch (error) {
      if (error instanceof SyntaxError) {
        vscode.window.showErrorMessage(`Failed to parse JSON file: ${error.message}`);
      } else {
        vscode.window.showErrorMessage(`Failed to load logs: ${error}`);
      }
    }
  });

  context.subscriptions.push(focusCommand, clearCommand, toggleTimestampsCommand, copyAllCommand, toggleCompactCommand, toggleTagsCommand, diagnoseCommand, setupMcpCommand, saveLogsCommand, loadLogsCommand, tracker);

  // Auto-show view when debug session starts
  vscode.debug.onDidStartDebugSession(() => {
    if (viewProvider) {
      viewProvider.reveal();
    }
  });
}

export function deactivate() {
  if (tracker) {
    tracker.dispose();
    tracker = null;
  }
  viewProvider = null;
}
