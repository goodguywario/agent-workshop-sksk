import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterAll, describe, expect, test } from 'vitest';
import { createApi } from '../src/api/server.ts';
import { ensureDb } from '../src/db/connection.ts';
import { createApiClient } from '../src/mcp/api-client.ts';
import { registerTools } from '../src/mcp/tools.ts';
import { tempDbPath } from './helpers.ts';

const apis: Server[] = [];
afterAll(() => { apis.forEach((api) => api.close()); });

/** Starts the party API on a fresh database and returns its base URL. */
async function startApi(): Promise<string> {
  const api = createApi(ensureDb(tempDbPath()));
  apis.push(api);
  await new Promise<void>((resolve) => api.listen(0, resolve));
  return `http://localhost:${(api.address() as AddressInfo).port}`;
}

async function connect(baseUrl?: string): Promise<Client> {
  const server = new McpServer({ name: 'party', version: '1.0.0' });
  registerTools(server, createApiClient(baseUrl ?? await startApi()));
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(clientSide);
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as { type: string; text: string }[])[0].text;
  return { isError: Boolean(result.isError), text, json: () => JSON.parse(text) };
}

describe('party MCP tools', () => {
  test('lists exactly the expected tool names', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'add_guest', 'clear_seating_plan', 'get_event', 'get_guest', 'get_invitation', 'get_menu',
      'get_playlist', 'get_seating_plan', 'get_speeches', 'list_guests', 'list_public_guests', 'remove_guest',
      'set_invitation', 'set_menu', 'set_playlist', 'set_seating_plan', 'set_speech_text', 'update_event', 'update_guest',
    ]);
  });

  test('list_public_guests hides private fields and guests who are not coming', async () => {
    const client = await connect();
    const all = (await call(client, 'list_guests')).json();
    const pub = (await call(client, 'list_public_guests')).json();
    expect(pub).toHaveLength(all.filter((g: { rsvpStatus: string }) => g.rsvpStatus === 'attending').length);
    const text = JSON.stringify(pub);
    for (const secret of ['EpiPen', 'wheelchair', 'long story', 'Maggie', 'notes', 'allergies', 'email']) {
      expect(text).not.toContain(secret);
    }
  });

  test('set_speech_text writes a speech only while speeches are switched on', async () => {
    const client = await connect();
    const { enabled, speeches } = (await call(client, 'get_speeches')).json();
    expect(enabled).toBe(false);
    const off = await call(client, 'set_speech_text', { id: speeches[0].id, body: 'Skål!' });
    expect(off.isError).toBe(true);
    expect(off.text).toContain('speeches are switched off');
  });

  test('set_seating_plan with unknown id returns isError with the id in the message', async () => {
    const client = await connect();
    const res = await call(client, 'set_seating_plan', { guestIds: [1, 4242] });
    expect(res.isError).toBe(true);
    expect(res.text).toContain('guest id 4242 does not exist');
  });

  test('tolerates sloppy-but-meaningful arguments', async () => {
    const client = await connect();
    expect((await call(client, 'get_guest', { id: '3' })).json().id).toBe(3);
    const playlist = await call(client, 'set_playlist', { tracks: [{ title: 'Jingle', artist: 'Bells' }] });
    expect(playlist.json()).toEqual([{ position: 1, title: 'Jingle', artist: 'Bells', note: '' }]);
    const seating = await call(client, 'set_seating_plan', { guestIds: ['1', '2'] });
    expect(seating.json().seatCount).toBe(2);
    expect((await call(client, 'set_seating_plan', { guestIds: [] })).json().seatCount).toBe(0);
    const menu = await call(client, 'set_menu', { items: [{ course: 'main', name: 'Roast', description: 'Turkey' }] });
    expect(menu.json()[0]).toMatchObject({ allergens: [], dietaryTags: [], notes: '' });
  });

  test('invalid enum value explains what is allowed', async () => {
    const client = await connect();
    const res = await call(client, 'set_menu', { items: [{ course: 'soup', name: 'X', description: '' }] });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/starter|main|dessert|drinks/);
  });

  test('get_invitation returns null before one is written', async () => {
    const client = await connect();
    expect((await call(client, 'get_invitation')).json()).toBeNull();
    await call(client, 'set_invitation', { subject: 'Hi', body: 'Come' });
    expect((await call(client, 'get_invitation')).json()).toEqual({ subject: 'Hi', body: 'Come' });
  });
});

test('tools explain when the API is not running', async () => {
  const client = await connect('http://localhost:1');
  const res = await call(client, 'list_guests');
  expect(res.isError).toBe(true);
  expect(res.text).toContain('npm run dev');
});

test('stdio server reaches the API at PARTY_API_URL', async () => {
  const transport = new StdioClientTransport({
    command: 'npx', args: ['tsx', 'src/mcp/server.ts'],
    env: { ...process.env, PARTY_API_URL: await startApi() } as Record<string, string>,
  });
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  const res = await call(client, 'list_guests');
  expect(res.json().length).toBeGreaterThanOrEqual(24);
  await client.close();
}, 30_000);
