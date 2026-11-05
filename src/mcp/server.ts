// The party MCP server. opencode starts it over stdio (see opencode.json).
// It talks to the party API (PARTY_API_URL, default http://localhost:3001), so "npm run dev" must be running.
// Never write to stdout here: stdout carries the MCP protocol.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createApiClient } from './api-client.ts';
import { registerTools } from './tools.ts';

const server = new McpServer({ name: 'party', version: '1.0.0' });
registerTools(server, createApiClient());
await server.connect(new StdioServerTransport());
