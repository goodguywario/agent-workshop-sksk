// The party MCP server. opencode starts it over stdio (see opencode.json).
// Never write to stdout here: stdout carries the MCP protocol.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ensureDb } from '../db/connection.ts';
import { registerTools } from './tools.ts';

const server = new McpServer({ name: 'party', version: '1.0.0' });
registerTools(server, ensureDb());
await server.connect(new StdioServerTransport());
