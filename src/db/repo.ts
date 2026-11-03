// This layer rejects broken data only: unknown ids, duplicates, malformed values.
// Rules about what makes a GOOD plan (boss in the middle, allergy-safe menus,
// only seating attending guests, ...) live in .opencode/ — that's the workshop.
// Do not add them here.

import type { DatabaseSync } from 'node:sqlite';
import {
  SPEECH_LENGTHS, SPEECH_ROLES, SPEECH_TONES,
  type Guest, type GuestInput, type Invitation, type MenuItem, type PartyEvent, type PublicGuest, type SeatingPlan,
  type Speech, type SpeechLength, type SpeechPlan, type SpeechRole, type SpeechSettings, type SpeechTone, type Track,
} from './types.ts';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

type Row = Record<string, unknown>;

/** Runs `fn` in a write transaction, or inside the caller's if one is already open. */
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  if (db.isTransaction) return fn();
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

// --- speeches --------------------------------------------------------------
// The organiser owns the speech settings (web app); the speech writer only writes the text.

const SPEECH_COLUMNS: Record<keyof SpeechSettings, string> = {
  role: 'role',
  speakerGuestId: 'speaker_guest_id',
  tone: 'tone',
  length: 'length',
  cringe: 'cringe',
  mention: 'mention',
};

export const DEFAULT_SPEECH: SpeechSettings = {
  role: 'colleague', speakerGuestId: null, tone: 'warm', length: 'short', cringe: 2, mention: '',
};

function toSpeech(row: Row): Speech {
  const body = (row.body as string | null) ?? null;
  return {
    id: Number(row.id),
    position: Number(row.position),
    role: row.role as SpeechRole,
    speakerGuestId: row.speaker_guest_id == null ? null : Number(row.speaker_guest_id),
    tone: row.tone as SpeechTone,
    length: row.length as SpeechLength,
    cringe: Number(row.cringe),
    mention: row.mention as string,
    body,
    writtenAt: (row.written_at as string | null) ?? null,
    outOfDate: body !== null && Number(row.written_version) < Number(row.settings_version),
  };
}

function oneOf<T extends string>(field: string, value: unknown, allowed: readonly T[]): void {
  if (!allowed.includes(value as T)) {
    throw new ValidationError(`${field} must be one of ${allowed.join(', ')} (got ${JSON.stringify(value)})`);
  }
}

function validateSpeechPatch(db: DatabaseSync, patch: Partial<SpeechSettings>): [keyof SpeechSettings, unknown][] {
  const entries = Object.entries(patch ?? {}).filter(([, v]) => v !== undefined) as [keyof SpeechSettings, unknown][];
  for (const [key, value] of entries) {
    if (!(key in SPEECH_COLUMNS)) throw new ValidationError(`unknown speech field "${key}"`);
    if (key === 'role') oneOf('role', value, SPEECH_ROLES);
    if (key === 'tone') oneOf('tone', value, SPEECH_TONES);
    if (key === 'length') oneOf('length', value, SPEECH_LENGTHS);
    if (key === 'cringe' && !(Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 5)) {
      throw new ValidationError(`cringe must be a whole number from 1 to 5 (got ${JSON.stringify(value)})`);
    }
    if (key === 'mention' && typeof value !== 'string') throw new ValidationError('mention must be text');
    if (key === 'speakerGuestId' && value !== null) {
      if (!Number.isInteger(value)) throw new ValidationError('speakerGuestId must be a guest id or null');
      assertGuestExists(db, value as number);
    }
  }
  return entries;
}

function getSpeech(db: DatabaseSync, id: number): Speech {
  const row = db.prepare('SELECT * FROM speeches WHERE id = ?').get(id) as Row | undefined;
  if (!row) throw new ValidationError(`speech id ${id} does not exist`);
  return toSpeech(row);
}

function renumberSpeeches(db: DatabaseSync, ids: number[]): void {
  const update = db.prepare('UPDATE speeches SET position = ? WHERE id = ?');
  ids.forEach((id, i) => update.run(i + 1, id));
}

function speechIds(db: DatabaseSync): number[] {
  return (db.prepare('SELECT id FROM speeches ORDER BY position, id').all() as Row[]).map((r) => Number(r.id));
}

export function getSpeeches(db: DatabaseSync): SpeechPlan {
  const { enabled } = db.prepare('SELECT enabled FROM speech_settings WHERE id = 1').get() as { enabled: number };
  const rows = db.prepare('SELECT * FROM speeches ORDER BY position, id').all() as Row[];
  return { enabled: Boolean(enabled), speeches: rows.map(toSpeech) };
}

export function setSpeechesEnabled(db: DatabaseSync, enabled: boolean): SpeechPlan {
  if (typeof enabled !== 'boolean') throw new ValidationError('enabled must be true or false');
  db.prepare('UPDATE speech_settings SET enabled = ? WHERE id = 1').run(Number(enabled));
  return getSpeeches(db);
}

/** Adds a speech at the end of the running order. Missing settings get the defaults. */
export function addSpeech(db: DatabaseSync, input: Partial<SpeechSettings> = {}): Speech {
  return transaction(db, () => {
    validateSpeechPatch(db, input);
    const s = { ...DEFAULT_SPEECH, ...Object.fromEntries(Object.entries(input ?? {}).filter(([, v]) => v !== undefined)) };
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM speeches').get() as { n: number };
    const result = db.prepare(`INSERT INTO speeches (position, role, speaker_guest_id, tone, length, cringe, mention)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(n + 1, s.role, s.speakerGuestId, s.tone, s.length, s.cringe, s.mention);
    return getSpeech(db, Number(result.lastInsertRowid));
  });
}

export function updateSpeech(db: DatabaseSync, id: number, patch: Partial<SpeechSettings>): Speech {
  return transaction(db, () => {
    getSpeech(db, id);
    const entries = validateSpeechPatch(db, patch);
    if (entries.length > 0) {
      const sets = entries.map(([key]) => `${SPEECH_COLUMNS[key]} = ?`).join(', ');
      db.prepare(`UPDATE speeches SET ${sets}, settings_version = settings_version + 1 WHERE id = ?`)
        .run(...entries.map(([, v]) => v as string | number | null), id);
    }
    return getSpeech(db, id);
  });
}

export function removeSpeech(db: DatabaseSync, id: number): void {
  transaction(db, () => {
    getSpeech(db, id);
    db.prepare('DELETE FROM speeches WHERE id = ?').run(id);
    renumberSpeeches(db, speechIds(db));
  });
}

/** Sets the running order. `ids` must contain every speech exactly once. */
export function reorderSpeeches(db: DatabaseSync, ids: number[]): SpeechPlan {
  return transaction(db, () => {
    const current = speechIds(db);
    if (!Array.isArray(ids)) throw new ValidationError('ids must be a list of speech ids');
    const given = ids.map(Number);
    const same = given.length === current.length && new Set(given).size === given.length
      && given.every((id) => current.includes(id));
    if (!same) throw new ValidationError(`ids must list every speech exactly once: ${current.join(', ') || 'none'}`);
    renumberSpeeches(db, given);
    return getSpeeches(db);
  });
}

export function setSpeechText(db: DatabaseSync, id: number, body: string): Speech {
  return transaction(db, () => {
    if (!getSpeeches(db).enabled) throw new ValidationError('speeches are switched off');
    getSpeech(db, id);
    if (typeof body !== 'string' || body.trim() === '') throw new ValidationError('body must not be empty');
    db.prepare(`UPDATE speeches SET body = ?, written_at = ?, written_version = settings_version WHERE id = ?`)
      .run(body, new Date().toISOString(), id);
    return getSpeech(db, id);
  });
}

/** Attending guests with public fields only. This is a privacy boundary for the speech writer, not a planning rule. */
export function listPublicGuests(db: DatabaseSync): PublicGuest[] {
  return listGuests(db).filter((g) => g.rsvpStatus === 'attending').map((g) => ({
    id: g.id, firstName: g.firstName, lastName: g.lastName, jobTitle: g.jobTitle,
    department: g.department, isBoss: g.isBoss, partnerId: g.partnerId,
  }));
}

// --- whole plan ------------------------------------------------------------

/** Clears everything the planner generates; keeps the event settings, guests and speech setup. */
export function clearPlan(db: DatabaseSync): void {
  transaction(db, () => {
    db.exec(`DELETE FROM seat_assignments; UPDATE seating SET seat_count = 0;
      DELETE FROM menu_items; DELETE FROM playlist_tracks; DELETE FROM invitation;
      UPDATE speeches SET body = NULL, written_at = NULL, written_version = NULL;`);
  });
}
