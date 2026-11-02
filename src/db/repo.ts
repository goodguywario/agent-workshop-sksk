// This layer rejects broken data only: unknown ids, duplicates, malformed values.
// Rules about what makes a GOOD plan (boss in the middle, allergy-safe menus,
// only seating attending guests, ...) live in .opencode/ — that's the workshop.
// Do not add them here.

import type { DatabaseSync } from 'node:sqlite';
import type {
  Guest, GuestInput, Invitation, MenuItem, PartyEvent, SeatingPlan, Track,
} from './types.ts';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

type Row = Record<string, unknown>;

function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// --- event -----------------------------------------------------------------

const EVENT_COLUMNS: Record<keyof PartyEvent, string> = {
  name: 'name',
  hostCompany: 'host_company',
  theme: 'theme',
  dressCode: 'dress_code',
  venueName: 'venue_name',
  venueAddress: 'venue_address',
  startsAt: 'starts_at',
  endsAt: 'ends_at',
  rsvpDeadline: 'rsvp_deadline',
};

export function getEvent(db: DatabaseSync): PartyEvent {
  const row = db.prepare('SELECT * FROM event WHERE id = 1').get() as Row;
  const event = {} as Record<string, unknown>;
  for (const [key, column] of Object.entries(EVENT_COLUMNS)) event[key] = row[column];
  return event as unknown as PartyEvent;
}

export function updateEvent(db: DatabaseSync, patch: Partial<PartyEvent>): PartyEvent {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  for (const [key] of entries) {
    if (!(key in EVENT_COLUMNS)) throw new ValidationError(`unknown event field "${key}"`);
  }
  if (entries.length > 0) {
    const sets = entries.map(([key]) => `${EVENT_COLUMNS[key as keyof PartyEvent]} = ?`).join(', ');
    db.prepare(`UPDATE event SET ${sets} WHERE id = 1`).run(...entries.map(([, v]) => v as string | null));
  }
  return getEvent(db);
}

// --- guests ----------------------------------------------------------------

const GUEST_COLUMNS: Record<keyof GuestInput, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  email: 'email',
  jobTitle: 'job_title',
  department: 'department',
  isBoss: 'is_boss',
  partnerId: 'partner_id',
  rsvpStatus: 'rsvp_status',
  dietaryPreference: 'dietary_preference',
  allergies: 'allergies',
  notes: 'notes',
};

function toGuest(row: Row): Guest {
  return {
    id: Number(row.id),
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    email: row.email as string,
    jobTitle: (row.job_title as string | null) ?? null,
    department: (row.department as string | null) ?? null,
    isBoss: Boolean(row.is_boss),
    partnerId: row.partner_id == null ? null : Number(row.partner_id),
    rsvpStatus: row.rsvp_status as Guest['rsvpStatus'],
    dietaryPreference: row.dietary_preference as Guest['dietaryPreference'],
    allergies: row.allergies as string,
    notes: row.notes as string,
  };
}

function guestExists(db: DatabaseSync, id: number): boolean {
  return db.prepare('SELECT 1 FROM guests WHERE id = ?').get(id) !== undefined;
}

function assertGuestExists(db: DatabaseSync, id: number): void {
  if (!guestExists(db, id)) throw new ValidationError(`guest id ${id} does not exist`);
}

export function listGuests(db: DatabaseSync): Guest[] {
  return (db.prepare('SELECT * FROM guests ORDER BY id').all() as Row[]).map(toGuest);
}

export function getGuest(db: DatabaseSync, id: number): Guest {
  const row = db.prepare('SELECT * FROM guests WHERE id = ?').get(id) as Row | undefined;
  if (!row) throw new ValidationError(`guest id ${id} does not exist`);
  return toGuest(row);
}

/** Partner links are symmetric: linking A↔B unlinks any previous partners of both. */
function linkPartner(db: DatabaseSync, id: number, partnerId: number | null): void {
  if (partnerId === id) throw new ValidationError(`guest id ${id} cannot be their own partner`);
  if (partnerId !== null) assertGuestExists(db, partnerId);
  const unlink = db.prepare('UPDATE guests SET partner_id = NULL WHERE partner_id = ? OR id = ?');
  unlink.run(id, id);
  if (partnerId !== null) {
    unlink.run(partnerId, partnerId);
    const link = db.prepare('UPDATE guests SET partner_id = ? WHERE id = ?');
    link.run(partnerId, id);
    link.run(id, partnerId);
  }
}

function writeGuestFields(db: DatabaseSync, id: number, patch: Partial<GuestInput>): void {
  const entries = Object.entries(patch).filter(([key, v]) => v !== undefined && key !== 'partnerId');
  for (const [key] of entries) {
    if (!(key in GUEST_COLUMNS)) throw new ValidationError(`unknown guest field "${key}"`);
  }
  if (entries.length > 0) {
    const sets = entries.map(([key]) => `${GUEST_COLUMNS[key as keyof GuestInput]} = ?`).join(', ');
    const values = entries.map(([, v]) => (typeof v === 'boolean' ? Number(v) : (v as string | number | null)));
    db.prepare(`UPDATE guests SET ${sets} WHERE id = ?`).run(...values, id);
  }
  if (patch.partnerId !== undefined) linkPartner(db, id, patch.partnerId);
}

export function addGuest(db: DatabaseSync, input: GuestInput): Guest {
  return transaction(db, () => {
    const result = db.prepare('INSERT INTO guests (first_name, last_name) VALUES (?, ?)')
      .run(input.firstName, input.lastName);
    const id = Number(result.lastInsertRowid);
    writeGuestFields(db, id, input);
    return getGuest(db, id);
  });
}

export function updateGuest(db: DatabaseSync, id: number, patch: Partial<GuestInput>): Guest {
  return transaction(db, () => {
    assertGuestExists(db, id);
    writeGuestFields(db, id, patch);
    return getGuest(db, id);
  });
}

export function removeGuest(db: DatabaseSync, id: number): void {
  transaction(db, () => {
    assertGuestExists(db, id);
    db.prepare('DELETE FROM guests WHERE id = ?').run(id);
  });
}

// --- seating ---------------------------------------------------------------

export function getSeatingPlan(db: DatabaseSync): SeatingPlan {
  const { seat_count } = db.prepare('SELECT seat_count FROM seating WHERE id = 1').get() as { seat_count: number };
  const rows = db.prepare(`
    SELECT s.seat_number, g.id, g.first_name, g.last_name, g.rsvp_status
    FROM seat_assignments s JOIN guests g ON g.id = s.guest_id
  `).all() as Row[];
  const bySeat = new Map(rows.map((r) => [Number(r.seat_number), r]));
  const seats = Array.from({ length: seat_count }, (_, i) => {
    const r = bySeat.get(i + 1);
    return {
      seatNumber: i + 1,
      guestId: r ? Number(r.id) : null,
      guestName: r ? `${r.first_name} ${r.last_name}` : null,
      rsvpStatus: r ? (r.rsvp_status as Guest['rsvpStatus']) : null,
    };
  });
  return { seatCount: seat_count, middleSeat: seat_count ? Math.ceil(seat_count / 2) : null, seats };
}

export function setSeatingPlan(db: DatabaseSync, guestIds: number[]): SeatingPlan {
  return transaction(db, () => {
    const seen = new Set<number>();
    for (const id of guestIds) {
      if (seen.has(id)) throw new ValidationError(`guest id ${id} appears more than once in the seating plan`);
      seen.add(id);
      assertGuestExists(db, id);
    }
    db.exec('DELETE FROM seat_assignments');
    const insert = db.prepare('INSERT INTO seat_assignments (seat_number, guest_id) VALUES (?, ?)');
    guestIds.forEach((id, i) => insert.run(i + 1, id));
    db.prepare('UPDATE seating SET seat_count = ? WHERE id = 1').run(guestIds.length);
    return getSeatingPlan(db);
  });
}

export function clearSeatingPlan(db: DatabaseSync): void {
  setSeatingPlan(db, []);
}

// --- menu ------------------------------------------------------------------

export function getMenu(db: DatabaseSync): MenuItem[] {
  return (db.prepare('SELECT * FROM menu_items ORDER BY sort_order').all() as Row[]).map((r) => ({
    course: r.course as MenuItem['course'],
    name: r.name as string,
    description: r.description as string,
    allergens: JSON.parse(r.allergens as string),
    dietaryTags: JSON.parse(r.dietary_tags as string),
    notes: r.notes as string,
  }));
}

export function setMenu(db: DatabaseSync, items: MenuItem[]): MenuItem[] {
  return transaction(db, () => {
    db.exec('DELETE FROM menu_items');
    const insert = db.prepare(`INSERT INTO menu_items
      (sort_order, course, name, description, allergens, dietary_tags, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    items.forEach((item, i) => insert.run(i + 1, item.course, item.name, item.description,
      JSON.stringify(item.allergens), JSON.stringify(item.dietaryTags), item.notes));
    return getMenu(db);
  });
}

// --- playlist --------------------------------------------------------------

export function getPlaylist(db: DatabaseSync): Track[] {
  return (db.prepare('SELECT * FROM playlist_tracks ORDER BY position').all() as Row[]).map((r) => ({
    position: Number(r.position),
    title: r.title as string,
    artist: r.artist as string,
    note: r.note as string,
  }));
}

export function setPlaylist(db: DatabaseSync, tracks: Omit<Track, 'position'>[]): Track[] {
  return transaction(db, () => {
    db.exec('DELETE FROM playlist_tracks');
    const insert = db.prepare('INSERT INTO playlist_tracks (position, title, artist, note) VALUES (?, ?, ?, ?)');
    tracks.forEach((t, i) => insert.run(i + 1, t.title, t.artist, t.note));
    return getPlaylist(db);
  });
}

// --- invitation ------------------------------------------------------------

export function getInvitation(db: DatabaseSync): Invitation | null {
  const row = db.prepare('SELECT subject, body FROM invitation WHERE id = 1').get() as Row | undefined;
  return row ? { subject: row.subject as string, body: row.body as string } : null;
}

export function setInvitation(db: DatabaseSync, invitation: Invitation): Invitation {
  db.prepare('INSERT OR REPLACE INTO invitation (id, subject, body) VALUES (1, ?, ?)')
    .run(invitation.subject, invitation.body);
  return invitation;
}

// --- whole plan ------------------------------------------------------------

/** Clears everything the planner generates; keeps the event settings and guests. */
export function clearPlan(db: DatabaseSync): void {
  transaction(db, () => {
    db.exec(`DELETE FROM seat_assignments; UPDATE seating SET seat_count = 0;
      DELETE FROM menu_items; DELETE FROM playlist_tracks; DELETE FROM invitation;`);
  });
}
