import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { applySchema } from './schema.ts';
import { seed } from './seed.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function dbPath(): string {
  return process.env.PARTY_DB ?? join(repoRoot, 'data', 'party.db');
}

export function openDb(path = dbPath()): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  applySchema(db);
  return db;
}

/** Opens the database and seeds it with the workshop data if it has no guests yet. */
export function ensureDb(path = dbPath()): DatabaseSync {
  const db = openDb(path);
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM guests').get() as { n: number };
  if (n === 0) seed(db);
  return db;
}
