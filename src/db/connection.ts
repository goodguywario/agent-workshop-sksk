import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { applySchema } from './schema.ts';
import { transaction } from './repo.ts';
import { seed } from './seed.ts';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function dbPath(): string {
  return process.env.PARTY_DB ?? join(repoRoot, 'data', 'party.db');
}

const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Retries `fn` while another process holds the lock that busy_timeout doesn't cover (switching to WAL). */
function retryWhileLocked<T>(fn: () => T): T {
  for (let attempt = 1; ; attempt++) {
    try {
      return fn();
    } catch (err) {
      if (attempt >= 50 || !String((err as Error).message).includes('database is locked')) throw err;
      sleep(20 * attempt);
    }
  }
}

export function openDb(path = dbPath()): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
  retryWhileLocked(() => db.exec('PRAGMA journal_mode = WAL;'));
  retryWhileLocked(() => applySchema(db));
  return db;
}

/** Opens the database and seeds it with the workshop data if it has no guests yet. */
export function ensureDb(path = dbPath()): DatabaseSync {
  const db = openDb(path);
  transaction(db, () => {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM guests').get() as { n: number };
    if (n === 0) seed(db);
  });
  return db;
}
