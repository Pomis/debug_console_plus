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
  type: 'logs' | 'clear' | 'config' | 'setFilter' | 'copyAll' | 'toggleNormalize' | 'toggleTags';
  logs?: ParsedLog[];
  config?: {
    timestampMode: TimestampMode;
    autoHideTimestampsWidth: number;
    defaultLevels?: string[];
  };
  filter?: string;
}

export interface WebviewToExtensionMessage {
  type: 'ready' | 'toggleLevel' | 'search' | 'copyAll' | 'toggleTimestamps' | 'openFile';
  level?: LogLevel;
  searchQuery?: string;
  filePath?: string;
  line?: number;
  column?: number;
}

