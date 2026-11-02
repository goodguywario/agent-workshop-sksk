import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { applySchema } from './schema.ts';

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
