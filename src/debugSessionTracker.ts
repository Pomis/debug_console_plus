import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DapOutputGroup, ParsedLog } from './types';
import { parseLogEntry } from './logParser';

export class DebugSessionTracker implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private logs: ParsedLog[] = [];
  private currentSessionId: string | null = null;
  private onLogCallback?: (logs: ParsedLog[]) => void;
  private maxLogs: number;
  private logsDir: string | null = null;
  private logsFilePath: string | null = null;
  private writeTimeout: NodeJS.Timeout | null = null;
  private readonly WRITE_DEBOUNCE_MS = 500; // Debounce file writes by 500ms

  constructor(maxLogs: number = 10000, logsDir?: string) {
    this.maxLogs = maxLogs;
    if (logsDir) {
      this.setLogsDirectory(logsDir);
    }
    this.setupListeners();
  }

  /**
   * Set the directory where logs should be persisted
   */
  public setLogsDirectory(logsDir: string) {
    this.logsDir = logsDir;
    this.logsFilePath = path.join(logsDir, 'logs.json');

    // Ensure directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Write initial empty array if file doesn't exist
    if (!fs.existsSync(this.logsFilePath)) {
      this.writeLogsToFile();
    }
  }

  private setupListeners() {
    // Listen for debug session start
    const startDisposable = vscode.debug.onDidStartDebugSession((session) => {
      this.currentSessionId = session.id;
      this.logs = [];
      console.log(`[Debug Console+] Debug session started: ${session.id}`);
    });

    // Listen for debug session end
    const endDisposable = vscode.debug.onDidTerminateDebugSession((session) => {
      if (session.id === this.currentSessionId) {
        console.log(`[Debug Console+] Debug session ended: ${session.id}`);
        this.currentSessionId = null;
      }
    });

    // Register debug adapter tracker factory to intercept ALL DAP messages
    const trackerFactory = vscode.debug.registerDebugAdapterTrackerFactory('*', {
      createDebugAdapterTracker: (session: vscode.DebugSession) => {
        console.log(`[Debug Console+] Creating tracker for session: ${session.id}`);
        return new DebugAdapterTracker(session, this);
      }
    });

    this.disposables.push(startDisposable, endDisposable, trackerFactory);
  }

  /**
   * Handle output from DAP - called by the tracker.
   * @param group - DAP output body.group; group boundaries inherit level from the content line in the group.
   */
  public handleOutput(output: string, category: string, sessionId: string, group?: DapOutputGroup) {
    if (!output || output.trim().length === 0) {
      return;
    }

    const timestamp = Date.now();
    const log = parseLogEntry(output, category, sessionId, timestamp, group);

    // Skip empty messages after cleaning
    if (!log.message || log.message.trim().length === 0) {
      return;
    }

    // Add to logs array
    this.logs.push(log);

    // Level inheritance using DAP group: group boundaries (start/end) get level from the content line
    if (group === 'end') {
      // End of group: inherit level from the most recent content line (no group)
      for (let i = this.logs.length - 2; i >= 0; i--) {
        if (!this.logs[i].group) {
          log.level = this.logs[i].level;
          break;
        }
      }
    } else if (!group) {
      // Content line (no group): back-patch preceding group-start entries with this level
      const currentLevel = log.level;
      for (let i = this.logs.length - 2; i >= 0; i--) {
        const g = this.logs[i].group;
        if (g === 'start' || g === 'startCollapsed') {
          this.logs[i].level = currentLevel;
        } else {
          break;
        }
      }
    }
    // group === 'start' | 'startCollapsed': level will be set when the next content line arrives

    // Limit log count
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Notify callback
    if (this.onLogCallback) {
      this.onLogCallback([...this.logs]);
    }

    // Persist to file (debounced)
    this.scheduleFileWrite();
  }

  /**
   * Schedule a debounced write to the logs file
   */
  private scheduleFileWrite() {
    if (!this.logsFilePath) {
      return; // No file path set, skip persistence
    }

    // Clear existing timeout
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
    }

    // Schedule new write
    this.writeTimeout = setTimeout(() => {
      this.writeLogsToFile();
      this.writeTimeout = null;
    }, this.WRITE_DEBOUNCE_MS);
  }

  /**
   * Write current logs to JSON file
   */
  private writeLogsToFile() {
    if (!this.logsFilePath) {
      return;
    }

    try {
      fs.writeFileSync(this.logsFilePath, JSON.stringify(this.logs, null, 2), 'utf8');
    } catch (error) {
      console.error('[Debug Console+] Failed to write logs to file:', error);
    }
  }

  /**
   * Set callback for when new logs are received
   */
  public onLog(callback: (logs: ParsedLog[]) => void) {
    this.onLogCallback = callback;
  }

  /**
   * Get all current logs
   */
  public getLogs(): ParsedLog[] {
    return [...this.logs];
  }

  /**
   * Clear all logs
   */
  public clearLogs() {
    this.logs = [];
    if (this.onLogCallback) {
      this.onLogCallback([]);
    }
    // Also clear the file
    this.writeLogsToFile();
  }

  /**
   * Load logs from an external source (e.g., file)
   */
  public loadLogs(logs: ParsedLog[]) {
    this.logs = logs;
    if (this.onLogCallback) {
      this.onLogCallback([...this.logs]);
    }
    // Write to file so MCP server can access loaded logs
    this.writeLogsToFile();
  }

  /**
   * Get current session ID
   */
  public getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Dispose all listeners
   */
  public dispose() {
    // Write logs one final time before disposing
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
      this.writeLogsToFile();
    }

    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}

/**
 * Debug Adapter Tracker - intercepts all DAP messages
 */
class DebugAdapterTracker implements vscode.DebugAdapterTracker {
  constructor(
    private session: vscode.DebugSession,
    private tracker: DebugSessionTracker
  ) {}

  /**
   * Called when a message is received from the debug adapter
   */
  onDidSendMessage(message: any): void {
    // Check if this is an output event
    if (message.type === 'event' && message.event === 'output') {
      const body = message.body;
      if (body && body.output) {
        const category = body.category || 'console';
        const group = body.group; // 'start' | 'startCollapsed' | 'end' for grouped output (e.g. box borders)
        this.tracker.handleOutput(body.output, category, this.session.id, group);
      }
    }
  }

  onWillStartSession(): void {
    console.log(`[Debug Console+] Tracker will start for: ${this.session.id}`);
  }

  onWillStopSession(): void {
    console.log(`[Debug Console+] Tracker will stop for: ${this.session.id}`);
  }

  onError(error: Error): void {
    console.error(`[Debug Console+] Tracker error:`, error);
  }

  onExit(code: number | undefined, signal: string | undefined): void {
    console.log(`[Debug Console+] Debug adapter exited: code=${code}, signal=${signal}`);
  }
}
