import { describe, expect, test } from 'vitest';
import { openDb } from '../src/db/connection.ts';
import {
  ValidationError, clearPlan, getEvent, getGuest, getMenu, getPlaylist, getSeatingPlan, listGuests,
  removeGuest, setInvitation, setMenu, setPlaylist, setSeatingPlan, updateGuest, getInvitation,
} from '../src/db/repo.ts';
import { freshDb } from './helpers.ts';

describe('seating', () => {
  test('setSeatingPlan rejects unknown ids', () => {
    const { db, guests } = freshDb(2);
    expect(() => setSeatingPlan(db, [guests[0].id, 999])).toThrow(ValidationError);
    expect(() => setSeatingPlan(db, [guests[0].id, 999])).toThrow('guest id 999 does not exist');
  });

  test('setSeatingPlan rejects duplicates', () => {
    const { db, guests } = freshDb(2);
    expect(() => setSeatingPlan(db, [guests[0].id, guests[0].id])).toThrow('appears more than once');
  });

  test('setSeatingPlan accepts declined guests', () => {
    const { db, guests } = freshDb(2);
    updateGuest(db, guests[1].id, { rsvpStatus: 'declined' });
    const plan = setSeatingPlan(db, guests.map((g) => g.id));
    expect(plan.seats[1].rsvpStatus).toBe('declined');
  });

  test('middle seat is ceil(n/2)', () => {
    const { db, guests } = freshDb(5);
    expect(setSeatingPlan(db, guests.map((g) => g.id)).middleSeat).toBe(3);
    expect(setSeatingPlan(db, guests.slice(0, 4).map((g) => g.id)).middleSeat).toBe(2);
    expect(setSeatingPlan(db, []).middleSeat).toBeNull();
  });

  test('removing a seated guest leaves a gap', () => {
    const { db, guests } = freshDb(3);
    setSeatingPlan(db, guests.map((g) => g.id));
    removeGuest(db, guests[1].id);
    const plan = getSeatingPlan(db);
    expect(plan.seatCount).toBe(3);
    expect(plan.seats[1]).toEqual({ seatNumber: 2, guestId: null, guestName: null, rsvpStatus: null });
    expect(plan.seats[2].guestId).toBe(guests[2].id);
  });
});

describe('guests', () => {
  test('partner links are symmetric', () => {
    const { db, guests: [a, b, c] } = freshDb(3);
    updateGuest(db, a.id, { partnerId: b.id });
    expect(getGuest(db, b.id).partnerId).toBe(a.id);
    updateGuest(db, a.id, { partnerId: c.id });
    expect(getGuest(db, b.id).partnerId).toBeNull();
    expect(getGuest(db, c.id).partnerId).toBe(a.id);
    updateGuest(db, c.id, { partnerId: null });
    expect(getGuest(db, a.id).partnerId).toBeNull();
  });

  test('deleting a partner clears the link', () => {
    const { db, guests: [a, b] } = freshDb(2);
    updateGuest(db, a.id, { partnerId: b.id });
    removeGuest(db, b.id);
    expect(getGuest(db, a.id).partnerId).toBeNull();
  });

  test('partner to unknown guest is rejected', () => {
    const { db, guests: [a] } = freshDb(1);
    expect(() => updateGuest(db, a.id, { partnerId: 77 })).toThrow('guest id 77 does not exist');
  });

  test('getGuest on unknown id names the id', () => {
    const { db } = freshDb(1);
    expect(() => getGuest(db, 42)).toThrow('guest id 42 does not exist');
  });
});

describe('outputs', () => {
  test('setMenu replaces and round-trips arrays', () => {
    const { db } = freshDb(0);
    setMenu(db, [{ course: 'main', name: 'A', description: 'a', allergens: ['milk'], dietaryTags: ['vegetarian'], notes: '' }]);
    setMenu(db, [
      { course: 'starter', name: 'B', description: 'b', allergens: [], dietaryTags: ['vegan'], notes: 'n' },
      { course: 'dessert', name: 'C', description: 'c', allergens: ['eggs', 'milk'], dietaryTags: [], notes: '' },
    ]);
    const menu = getMenu(db);
    expect(menu.map((m) => m.name)).toEqual(['B', 'C']);
    expect(menu[1].allergens).toEqual(['eggs', 'milk']);
  });

  test('setPlaylist assigns positions 1..n', () => {
    const { db } = freshDb(0);
    const tracks = setPlaylist(db, [
      { title: 'One', artist: 'X', note: '' },
      { title: 'Two', artist: 'Y', note: 'why' },
    ]);
    expect(tracks.map((t) => t.position)).toEqual([1, 2]);
    expect(getPlaylist(db)[1]).toEqual({ position: 2, title: 'Two', artist: 'Y', note: 'why' });
  });

  test('clearPlan empties outputs but keeps guests and event', () => {
    const { db, guests } = freshDb(2);
    setSeatingPlan(db, guests.map((g) => g.id));
    setMenu(db, [{ course: 'main', name: 'A', description: '', allergens: [], dietaryTags: [], notes: '' }]);
    setPlaylist(db, [{ title: 'T', artist: 'A', note: '' }]);
    setInvitation(db, { subject: 'Hi', body: 'Come' });
    clearPlan(db);
    expect(getSeatingPlan(db).seatCount).toBe(0);
    expect(getMenu(db)).toEqual([]);
    expect(getPlaylist(db)).toEqual([]);
    expect(getInvitation(db)).toBeNull();
    expect(listGuests(db)).toHaveLength(2);
    expect(getEvent(db).name).toBe('Test Party');
  });
});

test('two connections write without locking', () => {
  const { db, path, guests } = freshDb(2);
  const other = openDb(path);
  for (let i = 0; i < 50; i++) {
    updateGuest(db, guests[0].id, { notes: `n${i}` });
    setPlaylist(other, [{ title: `T${i}`, artist: 'A', note: '' }]);
  }
  expect(getPlaylist(db)[0].title).toBe('T49');
  expect(getGuest(other, guests[0].id).notes).toBe('n49');
});
