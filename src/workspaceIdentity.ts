import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Slugify a workspace folder name for safe use as a directory name.
 * Replaces anything outside [A-Za-z0-9._-] with `_` and trims length.
 */
export function slugifyWorkspaceName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  const trimmed = cleaned.slice(0, 50);
  return trimmed.length > 0 ? trimmed : 'workspace';
}

export function workspaceHash(fsPath: string, length = 8): string {
  return crypto.createHash('sha256').update(fsPath).digest('hex').slice(0, length);
}

/**
 * Same folder name segment as under globalStorage/workspaces/ for logs
 * (first workspace folder, or no-workspace).
 */
export function getWorkspaceStorageFolderName(): string {
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (!ws) {
    return 'no-workspace';
  }
  const baseName = slugifyWorkspaceName(path.basename(ws.uri.fsPath));
  const shortHash = workspaceHash(ws.uri.fsPath);
  return `${baseName}-${shortHash}`;
}
