import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { openDb } from '../src/db/connection.ts';
import { addGuest, updateEvent } from '../src/db/repo.ts';
import type { Guest, GuestInput } from '../src/db/types.ts';

export function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), 'party-test-')), 'party.db');
}

export function guestInput(overrides: Partial<GuestInput> = {}): GuestInput {
  return {
    firstName: 'Test', lastName: 'Guest', email: 'test@example.com',
    jobTitle: 'Engineer', department: 'Engineering', isBoss: false, partnerId: null,
    rsvpStatus: 'attending', dietaryPreference: 'none', allergies: '', notes: '',
    ...overrides,
  };
}

/** A fresh database with an event and `count` attending guests (not the workshop seed). */
export function freshDb(count = 5): { db: DatabaseSync; path: string; guests: Guest[] } {
  const path = tempDbPath();
  const db = openDb(path);
  updateEvent(db, {
    name: 'Test Party', hostCompany: 'Test Co', theme: 'Christmas', dressCode: 'Smart',
    venueName: 'Hall', venueAddress: '1 Street', startsAt: '2026-12-11T18:00', endsAt: null,
    rsvpDeadline: '2026-11-27',
  });
  const guests = Array.from({ length: count }, (_, i) =>
    addGuest(db, guestInput({ firstName: `Guest${i + 1}`, email: `g${i + 1}@example.com` })));
  return { db, path, guests };
}
