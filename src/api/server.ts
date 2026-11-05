// JSON API: the only way to the data. The frontend and the MCP server (and so the agents) both go through it.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { ensureDb } from '../db/connection.ts';
import * as repo from '../db/repo.ts';
import {
  eventFields, guestFields, invitationFields, menuFields, newGuestFields, parse, partial, playlistFields, seatingFields,
} from './schemas.ts';

type Handler = (db: DatabaseSync, params: { id: number }, body: any) => unknown;

const routes: Record<string, Handler> = {
  'GET /api/event': (db) => repo.getEvent(db),
  'PUT /api/event': (db, _p, body) => repo.updateEvent(db, parse(partial(eventFields), body) as never),
  'GET /api/guests': (db) => repo.listGuests(db),
  'POST /api/guests': (db, _p, body) => repo.addGuest(db, parse(newGuestFields, body) as never),
  'GET /api/guests/:id': (db, { id }) => repo.getGuest(db, id),
  'PUT /api/guests/:id': (db, { id }, body) => repo.updateGuest(db, id, parse(partial(guestFields), body) as never),
  'DELETE /api/guests/:id': (db, { id }) => repo.removeGuest(db, id),
  'GET /api/seating': (db) => repo.getSeatingPlan(db),
  'PUT /api/seating': (db, _p, body) => repo.setSeatingPlan(db, parse(seatingFields, body).guestIds),
  'DELETE /api/seating': (db) => repo.clearSeatingPlan(db),
  'GET /api/menu': (db) => repo.getMenu(db),
  'PUT /api/menu': (db, _p, body) => repo.setMenu(db, parse(menuFields, body).items as never),
  'GET /api/playlist': (db) => repo.getPlaylist(db),
  'PUT /api/playlist': (db, _p, body) => repo.setPlaylist(db, parse(playlistFields, body).tracks),
  'GET /api/invitation': (db) => repo.getInvitation(db),
  'PUT /api/invitation': (db, _p, body) => repo.setInvitation(db, parse(invitationFields, body)),
  'DELETE /api/plan': (db) => repo.clearPlan(db),
};

async function readBody(req: IncomingMessage): Promise<unknown> {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : undefined;
}

function send(res: ServerResponse, status: number, body?: unknown): void {
  if (body === undefined) {
    res.writeHead(status).end();
    return;
  }
  res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
}

export function createApi(db: DatabaseSync): Server {
  return createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const idMatch = path.match(/^(\/api\/guests)\/(\d+)$/);
    const key = `${req.method} ${idMatch ? `${idMatch[1]}/:id` : path}`;
    const handler = routes[key];
    if (!handler) return send(res, 404, { error: `no route ${req.method} ${path}` });
    try {
      const result = handler(db, { id: idMatch ? Number(idMatch[2]) : 0 }, await readBody(req));
      if (result === undefined) return send(res, 204);
      send(res, req.method === 'POST' ? 201 : 200, result);
    } catch (err) {
      if (err instanceof repo.ValidationError || err instanceof SyntaxError) {
        return send(res, 400, { error: err.message });
      }
      console.error(err);
      send(res, 500, { error: 'internal error' });
    }
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3001);
  createApi(ensureDb()).listen(port, () => console.log(`API listening on http://localhost:${port}`));
}
