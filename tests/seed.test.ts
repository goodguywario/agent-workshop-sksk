import { describe, expect, test } from 'vitest';
import { ensureDb, openDb } from '../src/db/connection.ts';
import { clearPlan, getEvent, getGuest, getPlaylist, getSpeeches, listGuests, setPlaylist, updateGuest } from '../src/db/repo.ts';
import { seed } from '../src/db/seed.ts';
import type { Guest } from '../src/db/types.ts';
import { tempDbPath } from './helpers.ts';

function seeded(): Guest[] {
  const db = openDb(tempDbPath());
  seed(db);
  return listGuests(db);
}

const fullName = (g: Guest) => `${g.firstName} ${g.lastName}`;

describe('seed', () => {
  const guests = seeded();
  const byId = new Map(guests.map((g) => [g.id, g]));

  test('event is a Christmas party with the agreed dates', () => {
    const db = openDb(tempDbPath());
    seed(db);
    expect(getEvent(db)).toMatchObject({
      theme: 'Christmas', startsAt: '2026-12-11T18:00', endsAt: '2026-12-12T01:00', rsvpDeadline: '2026-11-27',
    });
  });

  test('seed has exactly one boss and they attend with a partner', () => {
    const bosses = guests.filter((g) => g.isBoss);
    expect(bosses).toHaveLength(1);
    expect(bosses[0].rsvpStatus).toBe('attending');
    const partner = byId.get(bosses[0].partnerId!)!;
    expect(partner.rsvpStatus).toBe('attending');
    expect(partner.department).toBeNull();
  });

  test('seed has 24-26 guests with 2 declined and 2 pending', () => {
    expect(guests.length).toBeGreaterThanOrEqual(24);
    expect(guests.length).toBeLessThanOrEqual(26);
    expect(guests.filter((g) => g.rsvpStatus === 'declined')).toHaveLength(2);
    expect(guests.filter((g) => g.rsvpStatus === 'pending')).toHaveLength(2);
  });

  test('partner links in seed are symmetric', () => {
    for (const g of guests.filter((x) => x.partnerId !== null)) {
      expect(byId.get(g.partnerId!)!.partnerId).toBe(g.id);
    }
  });

  test('seed has employee+employee and employee+plus-one couples besides the boss', () => {
    const couples = guests.filter((g) => g.partnerId !== null && g.id < g.partnerId! && !g.isBoss && !byId.get(g.partnerId!)!.isBoss);
    expect(couples.length).toBeGreaterThanOrEqual(2);
    const kinds = couples.map((g) => (g.department && byId.get(g.partnerId!)!.department ? 'emp' : 'plus'));
    expect(kinds).toContain('emp');
    expect(kinds).toContain('plus');
  });

  test('seed contains each allergy trap', () => {
    const attending = guests.filter((g) => g.rsvpStatus === 'attending');
    const has = (list: Guest[], s: string) => list.some((g) => g.allergies.toLowerCase().includes(s));
    for (const s of ['epipen', 'coeliac', 'lactose', 'shellfish']) expect(has(attending, s)).toBe(true);
    expect(has(guests.filter((g) => g.rsvpStatus === 'pending'), 'sesame')).toBe(true);
    expect(attending.some((g) => g.dietaryPreference === 'vegan' && g.allergies.toLowerCase().includes('nut'))).toBe(true);
    expect(attending.some((g) => g.dietaryPreference === 'vegetarian')).toBe(true);
    expect(attending.some((g) => g.allergies === '' && g.notes.toLowerCase().includes('spicy'))).toBe(true);
    expect(guests.some((g) => g.rsvpStatus === 'declined' && g.allergies !== '')).toBe(true);
  });

  test('seed has a wheelchair user in a couple', () => {
    const user = guests.find((g) => g.notes.toLowerCase().includes('wheelchair'))!;
    expect(user.rsvpStatus).toBe('attending');
    expect(user.partnerId).not.toBeNull();
  });

  test('seed has a new hire with an attending buddy', () => {
    const hire = guests.find((g) => g.notes.toLowerCase().includes('onboarding buddy'))!;
    expect(hire.partnerId).toBeNull();
    const buddy = guests.find((g) => g !== hire && hire.notes.includes(fullName(g)))!;
    expect(buddy.rsvpStatus).toBe('attending');
    expect(buddy.partnerId).toBeNull();
  });

  test('seed has a do-not-seat-next-to note naming a real guest', () => {
    const asker = guests.find((g) => g.notes.toLowerCase().includes("don't seat me next to"))!;
    const other = guests.find((g) => g !== asker && asker.notes.includes(fullName(g)))!;
    expect(other.rsvpStatus).toBe('attending');
  });
});

test('seed has speeches switched off with a toastmaster and the boss', () => {
  const db = openDb(tempDbPath());
  seed(db);
  seed(db);
  const { enabled, speeches } = getSpeeches(db);
  expect(enabled).toBe(false);
  expect(speeches.map((s) => s.role)).toEqual(['toastmaster', 'boss']);
  expect(speeches.map((s) => s.position)).toEqual([1, 2]);
  const boss = listGuests(db).find((g) => g.isBoss)!;
  expect(speeches[1].speakerGuestId).toBe(boss.id);
});

test('ensureDb seeds an empty database once', () => {
  const path = tempDbPath();
  const count = listGuests(ensureDb(path)).length;
  expect(count).toBeGreaterThan(0);
  expect(listGuests(ensureDb(path))).toHaveLength(count);
});

test('plan reset keeps edited guests', () => {
  const db = ensureDb(tempDbPath());
  const first = listGuests(db)[0];
  updateGuest(db, first.id, { notes: 'edited' });
  setPlaylist(db, [{ title: 'T', artist: 'A', note: '' }]);
  clearPlan(db);
  expect(getGuest(db, first.id).notes).toBe('edited');
  expect(getPlaylist(db)).toEqual([]);
});
