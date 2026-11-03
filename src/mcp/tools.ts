// Tool descriptions say what a tool does, never what a good plan looks like.
// That knowledge belongs in the agents and skills under .opencode/.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import * as repo from '../db/repo.ts';
import { COURSES, DIETARY_PREFERENCES, RSVP_STATUSES } from '../db/types.ts';

const id = z.coerce.number().int().positive();

const guestFields = {
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string(),
  jobTitle: z.string().nullable().describe('null for guests who are not employees'),
  department: z.string().nullable().describe('null for guests who are not employees'),
  isBoss: z.boolean(),
  partnerId: id.nullable().describe('id of the guest they are coming with, or null'),
  rsvpStatus: z.enum(RSVP_STATUSES as [string, ...string[]]),
  dietaryPreference: z.enum(DIETARY_PREFERENCES as [string, ...string[]]),
  allergies: z.string().describe('free text, as written by the guest'),
  notes: z.string().describe('free text, as written by the guest'),
};

const eventFields = {
  name: z.string(),
  hostCompany: z.string(),
  theme: z.string(),
  dressCode: z.string(),
  venueName: z.string(),
  venueAddress: z.string(),
  startsAt: z.string().describe('YYYY-MM-DDTHH:mm'),
  endsAt: z.string().nullable().describe('YYYY-MM-DDTHH:mm or null'),
  rsvpDeadline: z.string().describe('YYYY-MM-DD'),
};

const menuItem = z.object({
  course: z.enum(COURSES as [string, ...string[]]),
  name: z.string().min(1),
  description: z.string().default(''),
  allergens: z.array(z.string()).default([]),
  dietaryTags: z.array(z.string()).default([]),
  notes: z.string().default(''),
});

const track = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  note: z.string().default(''),
});

function partial<T extends Record<string, z.ZodType>>(shape: T) {
  return Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, v.optional()])) as {
    [K in keyof T]: z.ZodOptional<T[K]>;
  };
}

function respond(fn: () => unknown): CallToolResult {
  try {
    const result = fn();
    return { content: [{ type: 'text', text: JSON.stringify(result === undefined ? { ok: true } : result, null, 2) }] };
  } catch (err) {
    if (err instanceof repo.ValidationError) {
      return { isError: true, content: [{ type: 'text', text: err.message }] };
    }
    throw err;
  }
}

export function registerTools(server: McpServer, db: DatabaseSync): void {
  // --- event ---
  server.registerTool('get_event', {
    description: 'Get the party event settings: name, host company, theme, dress code, venue, start/end time and RSVP deadline.',
  }, () => respond(() => repo.getEvent(db)));

  server.registerTool('update_event', {
    description: 'Change one or more event settings. Only the fields you pass are changed.',
    inputSchema: partial(eventFields),
  }, (args) => respond(() => repo.updateEvent(db, args as never)));

  // --- guests ---
  server.registerTool('list_guests', {
    description: 'List every guest with their RSVP status, partner, dietary preference, allergies and notes.',
  }, () => respond(() => repo.listGuests(db)));

  server.registerTool('get_guest', {
    description: 'Get one guest by id.',
    inputSchema: { id },
  }, ({ id }) => respond(() => repo.getGuest(db, id)));

  server.registerTool('add_guest', {
    description: 'Add a guest to the guest list.',
    inputSchema: {
      ...guestFields,
      email: guestFields.email.default(''),
      jobTitle: guestFields.jobTitle.default(null),
      department: guestFields.department.default(null),
      isBoss: guestFields.isBoss.default(false),
      partnerId: guestFields.partnerId.default(null),
      rsvpStatus: guestFields.rsvpStatus.default('pending'),
      dietaryPreference: guestFields.dietaryPreference.default('none'),
      allergies: guestFields.allergies.default(''),
      notes: guestFields.notes.default(''),
    },
  }, (args) => respond(() => repo.addGuest(db, args as never)));

  server.registerTool('update_guest', {
    description: 'Change one or more fields of a guest. Only the fields you pass are changed. Setting partnerId links both guests to each other.',
    inputSchema: { id, ...partial(guestFields) },
  }, ({ id, ...patch }) => respond(() => repo.updateGuest(db, id, patch as never)));

  server.registerTool('remove_guest', {
    description: 'Remove a guest from the guest list. Their seat, if any, becomes empty.',
    inputSchema: { id },
  }, ({ id }) => respond(() => repo.removeGuest(db, id)));

  // --- seating ---
  server.registerTool('get_seating_plan', {
    description: 'Get the current seating plan for the horseshoe table: seat count, the middle seat number, and who sits in each seat.',
  }, () => respond(() => repo.getSeatingPlan(db)));

  server.registerTool('set_seating_plan', {
    description: 'Replace the whole seating plan. guestIds[i] sits in seat i+1 around a horseshoe table, numbered from one tip, around the curve, to the other tip. The table has exactly as many seats as ids you pass. An empty list clears the plan.',
    inputSchema: { guestIds: z.array(id) },
  }, ({ guestIds }) => respond(() => repo.setSeatingPlan(db, guestIds)));

  server.registerTool('clear_seating_plan', {
    description: 'Remove the seating plan entirely.',
  }, () => respond(() => repo.clearSeatingPlan(db)));

  // --- menu ---
  server.registerTool('get_menu', {
    description: 'Get the current menu, in serving order.',
  }, () => respond(() => repo.getMenu(db)));

  server.registerTool('set_menu', {
    description: 'Replace the whole menu. Items are shown grouped by course (starter, main, dessert, drinks) in the order given.',
    inputSchema: { items: z.array(menuItem) },
  }, ({ items }) => respond(() => repo.setMenu(db, items as never)));

  // --- playlist ---
  server.registerTool('get_playlist', {
    description: 'Get the current playlist, in play order.',
  }, () => respond(() => repo.getPlaylist(db)));

  server.registerTool('set_playlist', {
    description: 'Replace the whole playlist. Tracks play in the order given.',
    inputSchema: { tracks: z.array(track) },
  }, ({ tracks }) => respond(() => repo.setPlaylist(db, tracks)));

  // --- invitation ---
  server.registerTool('get_invitation', {
    description: 'Get the current invitation (subject and plain-text body), or null if none has been written.',
  }, () => respond(() => repo.getInvitation(db)));

  server.registerTool('set_invitation', {
    description: 'Replace the invitation. The body is shown as-is and copied into an email by the organiser.',
    inputSchema: { subject: z.string().min(1), body: z.string().min(1) },
  }, (inv) => respond(() => repo.setInvitation(db, inv)));

  // --- speeches ---
  server.registerTool('get_speeches', {
    description: 'Get the speech setup chosen by the organiser: whether speeches are switched on, and each speech in running order with its settings (role, optional speaker guest id, tone, length, cringe level 1-5, things to mention) and its current text, if written.',
  }, () => respond(() => repo.getSpeeches(db)));

  server.registerTool('list_public_guests', {
    description: 'List the attending guests with public details only: id, name, job title, department, whether they are the boss, and partner id.',
  }, () => respond(() => repo.listPublicGuests(db)));

  server.registerTool('set_speech_text', {
    description: 'Write or replace the text of one speech. The body is plain text and is shown as-is to the organiser.',
    inputSchema: { id, body: z.string().min(1) },
  }, ({ id, body }) => respond(() => repo.setSpeechText(db, id, body)));
}
