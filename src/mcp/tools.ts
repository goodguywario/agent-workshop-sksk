// Tool descriptions say what a tool does, never what a good plan looks like.
// That knowledge belongs in the agents and skills under .opencode/.
// Every tool is a call to the party API; the MCP server never opens the database itself.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  eventFields, guestFields, id, invitationFields, menuFields, newGuestFields, partial, playlistFields, seatingFields,
} from '../api/schemas.ts';
import { ApiError, type ApiRequest } from './api-client.ts';

async function respond(call: Promise<unknown>): Promise<CallToolResult> {
  try {
    const result = await call;
    return { content: [{ type: 'text', text: JSON.stringify(result === undefined ? { ok: true } : result, null, 2) }] };
  } catch (err) {
    if (err instanceof ApiError) return { isError: true, content: [{ type: 'text', text: err.message }] };
    throw err;
  }
}

export function registerTools(server: McpServer, api: ApiRequest): void {
  // --- event ---
  server.registerTool('get_event', {
    description: 'Get the party event settings: name, host company, theme, dress code, venue, start/end time and RSVP deadline.',
  }, () => respond(api('GET', '/event')));

  server.registerTool('update_event', {
    description: 'Change one or more event settings. Only the fields you pass are changed.',
    inputSchema: partial(eventFields),
  }, (args) => respond(api('PUT', '/event', args)));

  // --- guests ---
  server.registerTool('list_guests', {
    description: 'List every guest with their RSVP status, partner, dietary preference, allergies and notes.',
  }, () => respond(api('GET', '/guests')));

  server.registerTool('get_guest', {
    description: 'Get one guest by id.',
    inputSchema: { id },
  }, ({ id }) => respond(api('GET', `/guests/${id}`)));

  server.registerTool('add_guest', {
    description: 'Add a guest to the guest list.',
    inputSchema: newGuestFields,
  }, (args) => respond(api('POST', '/guests', args)));

  server.registerTool('update_guest', {
    description: 'Change one or more fields of a guest. Only the fields you pass are changed. Setting partnerId links both guests to each other.',
    inputSchema: { id, ...partial(guestFields) },
  }, ({ id, ...patch }) => respond(api('PUT', `/guests/${id}`, patch)));

  server.registerTool('remove_guest', {
    description: 'Remove a guest from the guest list. Their seat, if any, becomes empty.',
    inputSchema: { id },
  }, ({ id }) => respond(api('DELETE', `/guests/${id}`)));

  // --- seating ---
  server.registerTool('get_seating_plan', {
    description: 'Get the current seating plan for the horseshoe table: seat count, the middle seat number, and who sits in each seat.',
  }, () => respond(api('GET', '/seating')));

  server.registerTool('set_seating_plan', {
    description: 'Replace the whole seating plan. guestIds[i] sits in seat i+1 around a horseshoe table, numbered from one tip, around the curve, to the other tip. The table has exactly as many seats as ids you pass. An empty list clears the plan.',
    inputSchema: seatingFields,
  }, ({ guestIds }) => respond(api('PUT', '/seating', { guestIds })));

  server.registerTool('clear_seating_plan', {
    description: 'Remove the seating plan entirely.',
  }, () => respond(api('DELETE', '/seating')));

  // --- menu ---
  server.registerTool('get_menu', {
    description: 'Get the current menu, in serving order.',
  }, () => respond(api('GET', '/menu')));

  server.registerTool('set_menu', {
    description: 'Replace the whole menu. Items are shown grouped by course (starter, main, dessert, drinks) in the order given.',
    inputSchema: menuFields,
  }, ({ items }) => respond(api('PUT', '/menu', { items })));

  // --- playlist ---
  server.registerTool('get_playlist', {
    description: 'Get the current playlist, in play order.',
  }, () => respond(api('GET', '/playlist')));

  server.registerTool('set_playlist', {
    description: 'Replace the whole playlist. Tracks play in the order given.',
    inputSchema: playlistFields,
  }, ({ tracks }) => respond(api('PUT', '/playlist', { tracks })));

  // --- invitation ---
  server.registerTool('get_invitation', {
    description: 'Get the current invitation (subject and plain-text body), or null if none has been written.',
  }, () => respond(api('GET', '/invitation')));

  server.registerTool('set_invitation', {
    description: 'Replace the invitation. The body is shown as-is and copied into an email by the organiser.',
    inputSchema: invitationFields,
  }, (inv) => respond(api('PUT', '/invitation', inv)));
}
