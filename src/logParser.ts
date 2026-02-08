import { DapOutputGroup, LogLevel, ParsedLog } from './types';

// Flutter prefix pattern: "flutter: " at the start of the message
const FLUTTER_PREFIX_REGEX = /^flutter:\s*/gm;

// Android logcat prefix pattern: I/flutter (12345): or D/SomeTag(12345):
// Made more flexible to handle variations
const LOGCAT_PREFIX_REGEX = /[VDIWEF]\/[\w.-]+\s*\(\s*\d+\s*\):\s*/g;

// ANSI escape codes pattern (actual escape character \x1b or \033)
const ANSI_ESCAPE_REGEX = /\x1b\[[0-9;]*m/g;

// Alternative ANSI format that might appear as literal text: [38;5;75m, [0m, [1;31m, etc.
const ANSI_LITERAL_REGEX = /\[\d+(?:;\d+)*m/g;

/**
 * Cleans up log message by removing platform prefixes and escape codes
 * Preserves indentation and structure
 */
function cleanMessage(message: string): string {
  let cleaned = message;

  // Remove Flutter prefix: "flutter: " at the start
  cleaned = cleaned.replace(FLUTTER_PREFIX_REGEX, '');

  // Remove Android logcat prefix anywhere in the string (I/flutter (27893): )
  cleaned = cleaned.replace(LOGCAT_PREFIX_REGEX, '');

  // Remove ANSI escape codes (actual escape sequences)
  cleaned = cleaned.replace(ANSI_ESCAPE_REGEX, '');

  // Remove literal ANSI-like codes that weren't parsed as escapes
  // e.g., [38;5;75m or [0m
  cleaned = cleaned.replace(ANSI_LITERAL_REGEX, '');

  // Only remove trailing whitespace, preserve ALL leading indentation
  cleaned = cleaned.trimEnd();

  return cleaned;
}

/**
 * Detects if this is an error-level message based on content
 */
function isErrorContent(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  // Check for exception indicators
  if (/exception:|error:|failed:|failure:/i.test(message)) {
    return true;
  }

  // Check for common exception class names
  if (/\b(exception|error)\b/i.test(message) && /:/.test(message)) {
    return true;
  }

  // Check for [exception] tag
  if (/\[exception\]/i.test(message)) {
    return true;
  }

  // Check for stack trace patterns
  if (/^#\d+\s+/.test(message.trim())) {
    return true;
  }

  // Check for "at package:" pattern (stack traces)
  if (/\(package:[^)]+\)$/.test(message.trim())) {
    return true;
  }

  // Check for dart stack trace format
  if (/^\s*#\d+\s+\S+\s+\(/.test(message)) {
    return true;
  }

  return false;
}

/**
 * Detects log level from embedded tags in message content.
 * Priority: embedded tags > level prefix (HH:mm:ss.SSS LEVEL) > error detection > logcat prefix > DAP category
 */
export function detectLevelFromContent(message: string, dapCategory: string): LogLevel {
  // FIRST: Check for embedded level tags: [debug], [DEBUG], [info], etc.
  // These take highest priority as they're explicitly set by the app
  const levelMatch = message.match(/\[(debug|info|warn|warning|error|trace|exception)\]/i);
  if (levelMatch) {
    const level = levelMatch[1].toLowerCase();
    if (level === 'exception') {
      return 'error';
    }
    return normalizeLevel(level);
  }

  // SECOND: Check for level prefix pattern: HH:mm:ss.SSS LEVEL message
  // Matches formats like: "22:36:00.446 WARNING [APP] message" or "22:36:00.446 DEBUG message"
  const levelPrefixMatch = message.match(/^\d{1,2}:\d{2}:\d{2}\.\d{3}\s+(DEBUG|INFO|WARN|WARNING|ERROR|TRACE)\s+/i);
  if (levelPrefixMatch) {
    const level = levelPrefixMatch[1].toLowerCase();
    return normalizeLevel(level);
  }

  // THIRD: Check for error content (exceptions, stack traces)
  if (isErrorContent(message)) {
    return 'error';
  }

  // FOURTH: Check Android logcat level prefix
  const logcatMatch = message.match(/([VDIWEF])\/[\w.-]+\s*\(/);
  if (logcatMatch) {
    const logcatLevel = logcatMatch[1];
    switch (logcatLevel) {
      case 'V': return 'debug'; // Verbose -> debug
      case 'D': return 'debug';
      case 'I': return 'info';
      case 'W': return 'warn';
      case 'E': return 'error';
      case 'F': return 'error'; // Fatal -> error
    }
  }

  // LAST: Fallback to DAP category mapping
  return mapDapCategory(dapCategory);
}

/**
 * Normalizes level strings to standard LogLevel type
 */
function normalizeLevel(level: string): LogLevel {
  const normalized = level.toLowerCase();
  if (normalized === 'warning') {
    return 'warn';
  }
  if (normalized === 'trace') {
    return 'debug'; // Map trace to debug
  }
  if (['debug', 'info', 'warn', 'error'].includes(normalized)) {
    return normalized as LogLevel;
  }
  return 'info'; // default fallback
}

/**
 * Maps DAP output category to log level
 */
function mapDapCategory(category: string): LogLevel {
  switch (category) {
    case 'stderr':
      return 'error';
    case 'stdout':
      return 'info';
    case 'console':
      return 'info';
    default:
      return 'info';
  }
}

/**
 * Parses a DAP output event into a ParsedLog.
 * @param group - DAP output event body.group; used so tracker can inherit level for group boundaries.
 */
export function parseLogEntry(
  output: string,
  category: string,
  sessionId: string,
  timestamp: number = Date.now(),
  group?: DapOutputGroup
): ParsedLog {
  // Clean message FIRST so level detection works on the normalized content
  // (without flutter:/logcat prefixes that break anchored regex patterns)
  const cleanedMessage = cleanMessage(output);
  const level = detectLevelFromContent(cleanedMessage, category);
  const id = `${sessionId}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;

  // Skip empty messages after cleaning
  if (!cleanedMessage) {
    return {
      id,
      timestamp,
      level,
      message: '',
      category,
      sessionId,
      group,
    };
  }

  return {
    id,
    timestamp,
    level,
    message: cleanedMessage,
    category,
    sessionId,
    group,
  };
}

/**
 * Formats timestamp for display
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const millis = date.getMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${millis}`;
}
