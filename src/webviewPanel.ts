import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
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
  private _packageConfig: Map<string, { rootUri: string; packageUri: string }> | undefined = undefined;
  private _flutterSdkPath: string | undefined | null = undefined;

  constructor(
    private readonly _extensionUri: vscode.Uri,
  ) {
    // Invalidate caches when workspace changes
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      this._dartPackageRoots = undefined;
      this._packageConfig = undefined;
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

  private async sendPackageInfo() {
    if (!this._view) return;
    const pkgConfig = await this.getPackageConfig();
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspacePaths = workspaceFolders?.map((f) => f.uri.fsPath.toLowerCase()) ?? [];
    const localPackageNames: string[] = [];
    for (const [name, entry] of pkgConfig) {
      try {
        const rootPath = vscode.Uri.parse(entry.rootUri).fsPath.toLowerCase();
        const underWorkspace = workspacePaths.some((wp) => rootPath === wp || rootPath.startsWith(wp + path.sep));
        if (underWorkspace) {
          localPackageNames.push(name);
        }
      } catch {
        // ignore invalid rootUri
      }
    }
    this._view.webview.postMessage({
      type: 'packageInfo',
      localPackageNames,
    } as WebviewMessage);
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
      this.sendPackageInfo();
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

  /** Loads .dart_tool/package_config.json from workspace roots and returns package name -> { rootUri, packageUri }. Cached until workspace folders change. */
  private async getPackageConfig(): Promise<Map<string, { rootUri: string; packageUri: string }>> {
    if (this._packageConfig !== undefined) {
      return this._packageConfig;
    }
    const map = new Map<string, { rootUri: string; packageUri: string }>();
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      this._packageConfig = map;
      return map;
    }
    for (const folder of folders) {
      const configUri = vscode.Uri.joinPath(folder.uri, '.dart_tool', 'package_config.json');
      try {
        const bytes = await vscode.workspace.fs.readFile(configUri);
        const json = JSON.parse(Buffer.from(bytes).toString('utf8')) as { packages?: Array<{ name: string; rootUri: string; packageUri?: string }> };
        const packages = json.packages ?? [];
        for (const pkg of packages) {
          if (pkg.name && pkg.rootUri) {
            const packageUri = pkg.packageUri ?? 'lib/';
            if (!map.has(pkg.name)) {
              map.set(pkg.name, { rootUri: pkg.rootUri, packageUri });
            }
          }
        }
      } catch {
        // No package_config in this folder or invalid JSON
      }
    }
    this._packageConfig = map;
    return map;
  }

  /** Returns Flutter SDK path (directory containing bin/flutter). Cached. */
  private async getFlutterSdkPath(): Promise<string | undefined> {
    if (this._flutterSdkPath !== undefined) {
      return this._flutterSdkPath ?? undefined;
    }
    let sdkPath: string | undefined;
    const config = vscode.workspace.getConfiguration('dart');
    sdkPath = config.get<string>('flutterSdkPath');
    if (sdkPath?.trim()) {
      this._flutterSdkPath = sdkPath.trim();
      return this._flutterSdkPath;
    }
    sdkPath = config.get<string>('sdkPath');
    if (sdkPath?.trim()) {
      const dartSdk = sdkPath.trim();
      const parent = path.dirname(dartSdk);
      if (path.basename(parent) === 'bin') {
        this._flutterSdkPath = path.dirname(parent);
        return this._flutterSdkPath ?? undefined;
      }
    }
    const env = process.env.FLUTTER_ROOT;
    if (env?.trim()) {
      this._flutterSdkPath = env.trim();
      return this._flutterSdkPath;
    }
    try {
      const which = process.platform === 'win32' ? 'where flutter' : 'which flutter';
      const out = execSync(which, { encoding: 'utf8', timeout: 2000 }).trim();
      const line = out.split(/[\r\n]/)[0];
      if (line) {
        let bin = line;
        try {
          bin = fs.realpathSync(line);
        } catch {
          // keep line as-is
        }
        const binDir = path.dirname(bin);
        const sdkDir = path.dirname(binDir);
        if (fs.existsSync(path.join(sdkDir, 'bin', 'flutter'))) {
          this._flutterSdkPath = sdkDir;
          return this._flutterSdkPath;
        }
      }
    } catch {
      // ignore
    }
    this._flutterSdkPath = null;
    return undefined;
  }

  private async openFileAtLocation(filePath: string, line?: number, column?: number, scheme?: string) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const tried: string[] = [];

    try {
      let uri: vscode.Uri | undefined;
      const workspaceFolders = vscode.workspace.workspaceFolders;

      // 1) Resolve dart: URIs via Flutter SDK (e.g. dart:ui/painting.dart -> sdk/bin/cache/pkg/sky_engine/lib/ui/painting.dart)
      if (scheme === 'dart' && normalizedPath) {
        const flutterSdk = await this.getFlutterSdkPath();
        if (flutterSdk) {
          const skyEngineLib = path.join(flutterSdk, 'bin', 'cache', 'pkg', 'sky_engine', 'lib');
          const fullPath = path.join(skyEngineLib, normalizedPath);
          const fileUri = vscode.Uri.file(fullPath);
          tried.push(fullPath);
          if (await this.tryStatUri(fileUri)) {
            uri = fileUri;
          }
        }
      }

      // 2) Resolve package: URIs via .dart_tool/package_config.json (e.g. package:flutter/src/... -> flutter SDK package path)
      if (!uri && scheme === 'package' && normalizedPath.includes('/')) {
        const segments = normalizedPath.split('/');
        const packageName = segments[0];
        const relativePath = segments.slice(1).join('/');
        const pkgConfig = await this.getPackageConfig();
        const entry = pkgConfig.get(packageName);
        if (entry) {
          const rootUriParsed = vscode.Uri.parse(entry.rootUri);
          const packageUri = entry.packageUri.endsWith('/') ? entry.packageUri.slice(0, -1) : entry.packageUri;
          const full = vscode.Uri.joinPath(rootUriParsed, packageUri, ...relativePath.split('/'));
          tried.push(full.fsPath);
          if (await this.tryStatUri(full)) {
            uri = full;
          }
        }
      }

      // For Dart package: paths (fallback), first segment is package name; rest maps to lib/.
      const libRelativePath =
        !uri && scheme === 'package' && normalizedPath.includes('/')
          ? `lib/${normalizedPath.split('/').slice(1).join('/')}`
          : undefined;

      // 3) Try Dart package roots with lib/ path (workspace packages)
      if (!uri && libRelativePath) {
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

      // 5) Try each workspace folder with lib/ path, then raw path
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

      // 6) Fallback: search workspace by filename (increased limit, prefer lib and trailing segments)
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

      // 7) Last resort: try as absolute path
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
