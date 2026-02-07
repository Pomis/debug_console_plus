import * as vscode from 'vscode';
import { ParsedLog, TimestampMode, WebviewMessage, WebviewToExtensionMessage } from './types';
import { formatTimestamp } from './logParser';

export class DebugConsolePlusViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'debugConsolePlusView';

  private _view?: vscode.WebviewView;
  private timestampMode: TimestampMode = 'absolute';
  private autoHideTimestampsWidth: number = 200;
  private searchQuery: string = '';
  private currentLogs: ParsedLog[] = [];

  constructor(
    private readonly _extensionUri: vscode.Uri,
  ) {
    // Load initial configuration
    const config = vscode.workspace.getConfiguration('debugConsolePlus');
    this.timestampMode = config.get<boolean>('showTimestamps', true) ? 'absolute' : 'hidden';
    this.autoHideTimestampsWidth = config.get<number>('autoHideTimestampsWidth', 200);

    // Update config when it changes
    vscode.workspace.onDidChangeConfiguration(
      (e) => {
        if (e.affectsConfiguration('debugConsolePlus')) {
          const config = vscode.workspace.getConfiguration('debugConsolePlus');
          const showTs = config.get<boolean>('showTimestamps', true);
          // Only reset to absolute/hidden if currently in those modes (don't override relative)
          if (this.timestampMode !== 'relative') {
            this.timestampMode = showTs ? 'absolute' : 'hidden';
          }
          this.autoHideTimestampsWidth = config.get<number>('autoHideTimestampsWidth', 200);
          this.sendConfig();
        }
      }
    );
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    console.log('[Debug Console+] Resolving webview view...');
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'out')
      ],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    console.log('[Debug Console+] Webview HTML set, view resolved');

    // Listen for messages from the webview
    webviewView.webview.onDidReceiveMessage(
      async (message: WebviewToExtensionMessage) => {
        switch (message.type) {
          case 'ready':
            // Send initial config
            this.sendConfig();
            break;
          case 'toggleTimestamps':
            this.cycleTimestampMode();
            this.sendConfig();
            break;
          case 'openFile':
            if (message.filePath) {
              await this.openFileAtLocation(message.filePath, message.line, message.column);
            }
            break;
        }
      }
    );
  }

  public sendLogs(logs: ParsedLog[]) {
    this.currentLogs = logs;
    if (this._view) {
      this._view.webview.postMessage({
        type: 'logs',
        logs: logs.map((log) => ({
          ...log,
          formattedTimestamp: formatTimestamp(log.timestamp),
        })),
      } as WebviewMessage);
    }
  }

  public clearLogs() {
    this.currentLogs = [];
    if (this._view) {
      this._view.webview.postMessage({
        type: 'clear',
      } as WebviewMessage);
    }
  }

  public getSearchQuery(): string {
    return this.searchQuery;
  }

  public setSearchQuery(query: string) {
    this.searchQuery = query;
    if (this._view) {
      this._view.webview.postMessage({
        type: 'setFilter',
        filter: query,
      });
    }
  }

  public copyAllLogs() {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'copyAll',
      });
    }
  }

  private sendConfig() {
    if (this._view) {
      const config = vscode.workspace.getConfiguration('debugConsolePlus');
      const defaultLevels = config.get<string[]>('defaultLevels', ['info', 'warn', 'error']);

      this._view.webview.postMessage({
        type: 'config',
        config: {
          timestampMode: this.timestampMode,
          autoHideTimestampsWidth: this.autoHideTimestampsWidth,
          defaultLevels: defaultLevels,
        },
      } as WebviewMessage);
    }
  }

  private cycleTimestampMode() {
    switch (this.timestampMode) {
      case 'absolute': this.timestampMode = 'relative'; break;
      case 'relative': this.timestampMode = 'hidden'; break;
      case 'hidden': this.timestampMode = 'absolute'; break;
    }
  }

  public toggleTimestamps() {
    this.cycleTimestampMode();
    this.sendConfig();
  }

  public toggleNormalize() {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'toggleNormalize',
      });
    }
  }

  public toggleTags() {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'toggleTags',
      });
    }
  }

  public reveal() {
    if (this._view) {
      this._view.show(true);
    }
  }

  private async openFileAtLocation(filePath: string, line?: number, column?: number) {
    try {
      // Try to find the file in workspace folders
      const workspaceFolders = vscode.workspace.workspaceFolders;
      let uri: vscode.Uri | undefined;

      if (workspaceFolders) {
        for (const folder of workspaceFolders) {
          const fullPath = vscode.Uri.joinPath(folder.uri, filePath);
          try {
            await vscode.workspace.fs.stat(fullPath);
            uri = fullPath;
            break;
          } catch {
            // File doesn't exist in this folder, try next
          }
        }
      }

      // If not found in workspace, try as absolute path
      if (!uri) {
        uri = vscode.Uri.file(filePath);
      }

      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);

      // Go to specific line and column if provided
      if (line !== undefined && line > 0) {
        const position = new vscode.Position(line - 1, (column || 1) - 1);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
      }
    } catch (error) {
      console.error('[Debug Console+] Failed to open file:', error);
      vscode.window.showErrorMessage(`Could not open file: ${filePath}`);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get paths to resources
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'main.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'styles.css')
    );

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleUri}" rel="stylesheet">
				<title>Debug Console+</title>
			</head>
			<body>
				<div class="toolbar">
					<div class="level-filters" id="levelFilters">
						<button class="level-btn" data-level="debug" title="Toggle DEBUG logs">D</button>
						<button class="level-btn active" data-level="info" title="Toggle INFO logs">I</button>
						<button class="level-btn active" data-level="warn" title="Toggle WARN logs">W</button>
						<button class="level-btn active" data-level="error" title="Toggle ERROR logs">E</button>
					</div>
					<button class="logic-toggle active" id="logicToggle" title="Toggle filter logic: AND/OR">&&</button>
					<input type="text" class="filter-input" placeholder="Filter" id="filterInput" title="Filter logs - supports regex">
				</div>
				<div class="logs-container" id="logsContainer"></div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
