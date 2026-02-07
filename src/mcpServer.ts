import * as fs from 'fs';
import * as path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ParsedLog, LogLevel } from './types.js';

// Parse command line arguments
const args = process.argv.slice(2);
let logsDir = '.debug_console_plus';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--logs-dir' && i + 1 < args.length) {
    logsDir = args[i + 1];
    break;
  }
}

// Resolve logs directory relative to current working directory
const logsFilePath = path.resolve(process.cwd(), logsDir, 'logs.json');

/**
 * Read logs from the JSON file
 */
function readLogs(): ParsedLog[] {
  try {
    if (!fs.existsSync(logsFilePath)) {
      return [];
    }
    const content = fs.readFileSync(logsFilePath, 'utf8');
    const logs = JSON.parse(content);
    return Array.isArray(logs) ? logs : [];
  } catch (error) {
    console.error(`[MCP Server] Error reading logs: ${error}`);
    return [];
  }
}

/**
 * Filter logs based on criteria
 */
function filterLogs(
  logs: ParsedLog[],
  levels?: string[],
  search?: string,
  regex?: boolean,
  logic: 'AND' | 'OR' = 'AND',
  tail: boolean = true,
  limit: number = 100
): ParsedLog[] {
  let filtered = logs;

  // Filter by levels
  if (levels && levels.length > 0) {
    filtered = filtered.filter(log => levels.includes(log.level));
  }

  // Filter by search term
  if (search) {
    const searchFilter = (log: ParsedLog) => {
      if (regex) {
        try {
          const regexPattern = new RegExp(search, 'i');
          return regexPattern.test(log.message);
        } catch (error) {
          // Invalid regex, fall back to substring search
          return log.message.toLowerCase().includes(search.toLowerCase());
        }
      } else {
        return log.message.toLowerCase().includes(search.toLowerCase());
      }
    };

    if (logic === 'AND' && levels && levels.length > 0) {
      // Both level and search filters must match
      filtered = filtered.filter(searchFilter);
    } else if (logic === 'OR') {
      // Either level OR search must match
      const searchMatches = logs.filter(searchFilter);
      const combined = [...filtered, ...searchMatches];
      // Remove duplicates by id
      const seen = new Set<string>();
      filtered = combined.filter(log => {
        if (seen.has(log.id)) {
          return false;
        }
        seen.add(log.id);
        return true;
      });
    } else {
      // Only search filter (no levels specified)
      filtered = filtered.filter(searchFilter);
    }
  }

  // Sort by timestamp (most recent first if tail=true)
  filtered.sort((a, b) => tail ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);

  // Apply limit
  return filtered.slice(0, limit);
}

// Create MCP server
const server = new Server(
  {
    name: 'debug-console-plus',
    version: '0.0.1',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register the query_debug_logs tool
server.setRequestHandler(
  ListToolsRequestSchema,
  async () => {
    return {
      tools: [
        {
          name: 'query_debug_logs',
          description: 'Query and filter debug console logs. Supports filtering by log level (error, warn, info, debug), searching by text content (with optional regex), and combining filters with AND/OR logic.',
          inputSchema: {
            type: 'object',
            properties: {
              levels: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['error', 'warn', 'info', 'debug'],
                },
                description: 'Filter logs by level. Can specify multiple levels.',
              },
              search: {
                type: 'string',
                description: 'Text to search for in log messages. Case-insensitive substring match by default.',
              },
              regex: {
                type: 'boolean',
                description: 'If true, treat the search parameter as a regular expression pattern.',
                default: false,
              },
              logic: {
                type: 'string',
                enum: ['AND', 'OR'],
                description: 'How to combine level and search filters. AND: both must match. OR: either can match.',
                default: 'AND',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of logs to return.',
                default: 100,
              },
              tail: {
                type: 'boolean',
                description: 'If true, return the most recent logs (tail). If false, return oldest logs (head).',
                default: true,
              },
            },
          },
        },
      ],
    };
  }
);

// Handle tool calls
server.setRequestHandler(
  CallToolRequestSchema,
  async (request) => {
    if (request.params.name !== 'query_debug_logs') {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    const args = request.params.arguments || {};
    const levels = args.levels as string[] | undefined;
    const search = args.search as string | undefined;
    const regex = args.regex as boolean | undefined;
    const logic = (args.logic as 'AND' | 'OR') || 'AND';
    const limit = (args.limit as number) || 100;
    const tail = args.tail !== undefined ? (args.tail as boolean) : true;

    // Read logs from file
    const allLogs = readLogs();

    // Filter logs
    const filteredLogs = filterLogs(allLogs, levels, search, regex, logic, tail, limit);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              total: allLogs.length,
              filtered: filteredLogs.length,
              logs: filteredLogs,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP Server] Debug Console+ MCP server started');
}

main().catch((error) => {
  console.error('[MCP Server] Fatal error:', error);
  process.exit(1);
});


