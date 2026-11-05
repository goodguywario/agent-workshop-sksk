// Input shapes for every write. The API validates request bodies with these, and the MCP
// server reuses them as tool input schemas, so both front doors accept exactly the same data.
// Shape only: rules about what makes a GOOD plan live in .opencode/, not here.

import { z } from 'zod';
import { ValidationError } from '../db/repo.ts';
import { COURSES, DIETARY_PREFERENCES, RSVP_STATUSES } from '../db/types.ts';

export const id = z.coerce.number().int().positive();

export const guestFields = {
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

/** A new guest: only the name is required. */
export const newGuestFields = {
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
};

export const eventFields = {
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

export const menuItem = z.object({
  course: z.enum(COURSES as [string, ...string[]]),
  name: z.string().min(1),
  description: z.string().default(''),
  allergens: z.array(z.string()).default([]),
  dietaryTags: z.array(z.string()).default([]),
  notes: z.string().default(''),
});

export const track = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  note: z.string().default(''),
});

export const seatingFields = { guestIds: z.array(id) };
export const menuFields = { items: z.array(menuItem) };
export const playlistFields = { tracks: z.array(track) };
export const invitationFields = { subject: z.string().min(1), body: z.string().min(1) };

export function partial<T extends Record<string, z.ZodType>>(shape: T) {
  return Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, v.optional()])) as {
    [K in keyof T]: z.ZodOptional<T[K]>;
  };
}

/** Parses `body` against `shape`, or throws a ValidationError that says what is wrong. */
export function parse<T extends Record<string, z.ZodType>>(shape: T, body: unknown): z.infer<z.ZodObject<T>> {
  const result = z.object(shape).safeParse(body ?? {});
  if (!result.success) throw new ValidationError(z.prettifyError(result.error));
  return result.data;
}
