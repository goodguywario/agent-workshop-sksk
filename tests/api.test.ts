import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createApi } from '../src/api/server.ts';
import { ensureDb } from '../src/db/connection.ts';
import { tempDbPath } from './helpers.ts';

const server = createApi(ensureDb(tempDbPath()));
let base = '';

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server.close(); });

const json = (method: string, body: unknown) => ({
  method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

test('GET /api/guests returns seeded guests', async () => {
  const res = await fetch(`${base}/api/guests`);
  expect(res.status).toBe(200);
  expect((await res.json()).length).toBeGreaterThanOrEqual(24);
});

test('PUT /api/guests/:id with partnerId to unknown guest returns 400 with message', async () => {
  const res = await fetch(`${base}/api/guests/1`, json('PUT', { partnerId: 999 }));
  expect(res.status).toBe(400);
  expect((await res.json()).error).toContain('guest id 999 does not exist');
});

test('DELETE /api/guests/:id returns 204', async () => {
  const res = await fetch(`${base}/api/guests/25`, { method: 'DELETE' });
  expect(res.status).toBe(204);
  expect((await fetch(`${base}/api/guests/25`, json('PUT', { notes: 'x' }))).status).toBe(400);
});

test('POST /api/guests creates a guest', async () => {
  const res = await fetch(`${base}/api/guests`, json('POST', {
    firstName: 'New', lastName: 'Person', email: '', jobTitle: null, department: null, isBoss: false,
    partnerId: null, rsvpStatus: 'pending', dietaryPreference: 'none', allergies: '', notes: '',
  }));
  expect(res.status).toBe(201);
  expect((await res.json()).firstName).toBe('New');
});

test('PUT /api/event updates settings', async () => {
  const res = await fetch(`${base}/api/event`, json('PUT', { theme: 'Winter' }));
  expect((await res.json()).theme).toBe('Winter');
});

test('GET /api/invitation returns null when unset; unknown route is 404', async () => {
  expect(await (await fetch(`${base}/api/invitation`)).json()).toBeNull();
  expect((await fetch(`${base}/api/nope`)).status).toBe(404);
});

describe('speeches', () => {
  const plan = async () => (await fetch(`${base}/api/speeches`)).json();

  test('GET /api/speeches returns the seeded setup, switched off', async () => {
    const res = await plan();
    expect(res.enabled).toBe(false);
    expect(res.speeches.map((s: { role: string }) => s.role)).toEqual(['toastmaster', 'boss']);
  });

  test('PUT /api/speeches/settings switches speeches on', async () => {
    const res = await fetch(`${base}/api/speeches/settings`, json('PUT', { enabled: true }));
    expect(res.status).toBe(200);
    expect((await plan()).enabled).toBe(true);
    expect((await fetch(`${base}/api/speeches/settings`, json('PUT', { enabled: 'yes' }))).status).toBe(400);
  });

  test('POST, PUT, reorder and DELETE a speech', async () => {
    const created = await fetch(`${base}/api/speeches`, json('POST', {}));
    expect(created.status).toBe(201);
    const speech = await created.json();
    expect(speech).toMatchObject({ role: 'colleague', tone: 'warm', length: 'short', cringe: 2 });

    const updated = await fetch(`${base}/api/speeches/${speech.id}`, json('PUT', { tone: 'formal', mention: 'Thanks!' }));
    expect(await updated.json()).toMatchObject({ tone: 'formal', mention: 'Thanks!' });

    const ids: number[] = (await plan()).speeches.map((s: { id: number }) => s.id);
    const reversed = [...ids].reverse();
    const reordered = await (await fetch(`${base}/api/speeches/order`, json('PUT', { ids: reversed }))).json();
    expect(reordered.speeches.map((s: { id: number }) => s.id)).toEqual(reversed);
    expect((await fetch(`${base}/api/speeches/order`, json('PUT', { ids: ids.slice(1) }))).status).toBe(400);

    expect((await fetch(`${base}/api/speeches/${speech.id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await plan()).speeches).toHaveLength(ids.length - 1);
  });

  test('bad speech values return 400 with a message', async () => {
    const id = (await plan()).speeches[0].id;
    for (const body of [{ cringe: 7 }, { tone: 'angry' }]) {
      const res = await fetch(`${base}/api/speeches/${id}`, json('PUT', body));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/cringe|tone/);
    }
    expect((await fetch(`${base}/api/speeches/999`, json('PUT', { cringe: 3 }))).status).toBe(400);
  });
});

test('speech writer routes: public guest list and speech text', async () => {
  const guests = await (await fetch(`${base}/api/guests/public`)).json();
  expect(guests.length).toBeGreaterThan(0);
  expect(Object.keys(guests[0]).sort()).toEqual(['department', 'firstName', 'id', 'isBoss', 'jobTitle', 'lastName', 'partnerId']);

  await fetch(`${base}/api/speeches/settings`, json('PUT', { enabled: true }));
  const id = (await (await fetch(`${base}/api/speeches`)).json()).speeches[0].id;
  const res = await fetch(`${base}/api/speeches/${id}/text`, json('PUT', { body: 'Cheers, everyone!' }));
  expect(res.status).toBe(200);
  expect((await res.json()).body).toBe('Cheers, everyone!');
  expect((await fetch(`${base}/api/speeches/${id}/text`, json('PUT', { body: '' }))).status).toBe(400);
});

test('DELETE /api/plan clears the plan and keeps guests', async () => {
  const guestsBefore = (await (await fetch(`${base}/api/guests`)).json()).length;
  const res = await fetch(`${base}/api/plan`, { method: 'DELETE' });
  expect(res.status).toBe(204);
  expect(await (await fetch(`${base}/api/invitation`)).json()).toBeNull();
  expect((await (await fetch(`${base}/api/seating`)).json()).seatCount).toBe(0);
  expect((await (await fetch(`${base}/api/guests`)).json()).length).toBe(guestsBefore);
});

test('write routes validate the body shape', async () => {
  const bad = await fetch(`${base}/api/menu`, json('PUT', { items: [{ course: 'soup', name: 'X' }] }));
  expect(bad.status).toBe(400);
  expect((await bad.json()).error).toMatch(/starter|main|dessert|drinks/);
  const ok = await fetch(`${base}/api/playlist`, json('PUT', { tracks: [{ title: 'Jingle', artist: 'Bells' }] }));
  expect(await ok.json()).toEqual([{ position: 1, title: 'Jingle', artist: 'Bells', note: '' }]);
  expect((await fetch(`${base}/api/seating`, json('PUT', { guestIds: 'nope' }))).status).toBe(400);
});
