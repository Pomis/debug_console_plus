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
  private _dartPackageRoots: vscode.Uri[] | undefined = undefined;

  constructor(
    private readonly _extensionUri: vscode.Uri,
  ) {
    // Invalidate Dart package root cache when workspace changes
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      this._dartPackageRoots = undefined;
    });

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
              await this.openFileAtLocation(message.filePath, message.line, message.column, message.scheme);
            }
            break;
          case 'openUrl':
            if (message.url) {
              vscode.env.openExternal(vscode.Uri.parse(message.url));
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

  public toggleCompact() {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'toggleCompact',
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

  private async tryStatUri(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  /** Returns workspace directories that contain pubspec.yaml (Dart package roots). Cached until workspace folders change. */
  private async getDartPackageRoots(): Promise<vscode.Uri[]> {
    if (this._dartPackageRoots !== undefined) {
      return this._dartPackageRoots;
    }
    const pubspecs = await vscode.workspace.findFiles('**/pubspec.yaml', '**/node_modules/**', 100);
    const roots = pubspecs.map((u) => vscode.Uri.joinPath(u, '..')).filter((u, i, arr) =>
      arr.findIndex((other) => other.fsPath === u.fsPath) === i
    );
    this._dartPackageRoots = roots;
    return roots;
  }

  private async openFileAtLocation(filePath: string, line?: number, column?: number, scheme?: string) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const tried: string[] = [];

    try {
      let uri: vscode.Uri | undefined;
      const workspaceFolders = vscode.workspace.workspaceFolders;

      // For Dart package: paths, first segment is package name; rest maps to lib/. e.g. package:log_example/... -> lib/...
      const libRelativePath =
        scheme === 'package' && normalizedPath.includes('/')
          ? `lib/${normalizedPath.split('/').slice(1).join('/')}`
          : undefined;

      // 1) Try Dart package roots first with lib/ path
      if (libRelativePath) {
        const dartRoots = await this.getDartPackageRoots();
        for (const root of dartRoots) {
          const full = vscode.Uri.joinPath(root, libRelativePath);
          tried.push(full.fsPath);
          if (await this.tryStatUri(full)) {
            uri = full;
            break;
          }
        }
      }

      // 2) Try each workspace folder with lib/ path, then raw path
      if (!uri && workspaceFolders) {
        const candidates = libRelativePath ? [libRelativePath, normalizedPath] : [normalizedPath];
        for (const candidate of candidates) {
          for (const folder of workspaceFolders) {
            const full = vscode.Uri.joinPath(folder.uri, candidate);
            tried.push(full.fsPath);
            if (await this.tryStatUri(full)) {
              uri = full;
              break;
            }
          }
          if (uri) break;
        }
      }

      // 3) Fallback: search workspace by filename (increased limit, prefer lib and trailing segments)
      if (!uri) {
        const fileName = normalizedPath.split('/').pop();
        if (fileName) {
          const found = await vscode.workspace.findFiles(`**/${fileName}`, '**/build/**', 50);
          if (found.length === 1) {
            uri = found[0];
          } else if (found.length > 1) {
            const pathSegments = normalizedPath.split('/');
            let bestMatch: vscode.Uri | undefined;
            let bestScore = -1;
            for (const f of found) {
              const fPath = f.path;
              const fSegments = fPath.split('/');
              let score = 0;
              for (let i = 1; i <= Math.min(pathSegments.length, fSegments.length); i++) {
                if (pathSegments[pathSegments.length - i] === fSegments[fSegments.length - i]) {
                  score++;
                } else {
                  break;
                }
              }
              if (fPath.includes('/lib/')) score += 10;
              if (score > bestScore) {
                bestScore = score;
                bestMatch = f;
              }
            }
            uri = bestMatch ?? found[0];
          }
        }
      }

      // 4) Last resort: try as absolute path
      if (!uri) {
        tried.push(vscode.Uri.file(normalizedPath).fsPath);
        uri = vscode.Uri.file(normalizedPath);
      }

      // Open with VS Code's standard command so line/column fragment is respected
      const lineNum = line !== undefined && line > 0 ? line : 1;
      const colNum = column !== undefined && column > 0 ? column : 1;
      const fragment = `L${lineNum},C${colNum}`;
      const uriWithFragment = uri.with({ fragment });

      await vscode.commands.executeCommand('vscode.open', uriWithFragment);
    } catch (error) {
      console.error('[Debug Console+] Failed to open file:', error);
      const triedNote = tried.length > 0 ? ` (tried workspace folders and Dart package roots)` : '';
      vscode.window.showErrorMessage(`Could not open file: "${filePath}"${triedNote}`);
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
