export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ParsedLog {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  category: string;
  sessionId: string;
}

export type TimestampMode = 'absolute' | 'relative' | 'hidden';

export interface WebviewMessage {
  type: 'logs' | 'clear' | 'config' | 'setFilter' | 'copyAll' | 'toggleCompact' | 'toggleTags' | 'packageInfo';
  logs?: ParsedLog[];
  config?: {
    timestampMode: TimestampMode;
    autoHideTimestampsWidth: number;
    defaultLevels?: string[];
  };
  filter?: string;
  /** Package names whose rootUri is under a workspace folder (user code). Sent so webview can style links. */
  localPackageNames?: string[];
}

export interface WebviewToExtensionMessage {
  type: 'ready' | 'toggleLevel' | 'search' | 'copyAll' | 'toggleTimestamps' | 'openFile' | 'openUrl';
  level?: LogLevel;
  searchQuery?: string;
  filePath?: string;
  line?: number;
  column?: number;
  scheme?: string;
  url?: string;
}

