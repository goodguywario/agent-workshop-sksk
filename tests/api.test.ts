import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, test } from 'vitest';
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
