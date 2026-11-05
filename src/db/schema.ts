import { DatabaseSync } from 'node:sqlite';
import { transaction } from './repo.ts';

// The whole schema. On startup, missing tables are created and missing columns are added
// to existing tables (see addMissingColumns), so editing this file and restarting is enough.
// A NOT NULL column added to an existing table needs a DEFAULT, or SQLite can't fill the rows already there.
// Renamed, removed or changed columns are NOT migrated: delete the data/ folder to rebuild the database.

const DDL = `
CREATE TABLE IF NOT EXISTS event (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT '',
  host_company TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT '',
  dress_code TEXT NOT NULL DEFAULT '',
  venue_name TEXT NOT NULL DEFAULT '',
  venue_address TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL DEFAULT '',
  ends_at TEXT,
  rsvp_deadline TEXT NOT NULL DEFAULT ''
);
INSERT OR IGNORE INTO event (id) VALUES (1);

CREATE TABLE IF NOT EXISTS guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  job_title TEXT,
  department TEXT,
  is_boss INTEGER NOT NULL DEFAULT 0,
  partner_id INTEGER REFERENCES guests(id) ON DELETE SET NULL,
  rsvp_status TEXT NOT NULL DEFAULT 'pending' CHECK (rsvp_status IN ('attending','declined','pending')),
  dietary_preference TEXT NOT NULL DEFAULT 'none' CHECK (dietary_preference IN ('none','vegetarian','vegan','pescatarian')),
  allergies TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS seating (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  seat_count INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO seating (id) VALUES (1);

CREATE TABLE IF NOT EXISTS seat_assignments (
  seat_number INTEGER PRIMARY KEY,
  guest_id INTEGER NOT NULL UNIQUE REFERENCES guests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_items (
  sort_order INTEGER PRIMARY KEY,
  course TEXT NOT NULL CHECK (course IN ('starter','main','dessert','drinks')),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  allergens TEXT NOT NULL DEFAULT '[]',
  dietary_tags TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  position INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS invitation (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  subject TEXT NOT NULL,
  body TEXT NOT NULL
);
`;

export function applySchema(db: DatabaseSync): void {
  db.exec(DDL);
  addMissingColumns(db, DDL);
}

/** Splits `text` at commas that are not inside parentheses. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth--;
    else if (text[i] === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

const TABLE_CONSTRAINT = /^(CONSTRAINT|PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY)\b/i;

/** Column name -> its definition as written in `ddl`, for every table `ddl` creates. */
function declaredColumns(ddl: string): Map<string, Map<string, string>> {
  const scratch = new DatabaseSync(':memory:');
  scratch.exec(ddl);
  const tables = scratch.prepare(
    "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  ).all() as { name: string; sql: string }[];
  scratch.close();
  return new Map(tables.map(({ name, sql }) => {
    const body = sql.slice(sql.indexOf('(') + 1, sql.lastIndexOf(')'));
    const columns = splitTopLevel(body)
      .filter((def) => !TABLE_CONSTRAINT.test(def))
      .map((def) => [def.split(/\s+/)[0].replace(/^["`[]|["`\]]$/g, ''), def] as [string, string]);
    return [name, new Map(columns)];
  }));
}

/** Adds columns that `ddl` declares but an existing table lacks. */
export function addMissingColumns(db: DatabaseSync, ddl: string): void {
  transaction(db, () => {
    for (const [table, columns] of declaredColumns(ddl)) {
      const existing = new Set((db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map((c) => c.name));
      for (const [column, def] of columns) {
        if (existing.has(column)) continue;
        try {
          db.exec(`ALTER TABLE "${table}" ADD COLUMN ${def}`);
        } catch (err) {
          throw new Error(`Can't add column ${table}.${column} to the existing database (${(err as Error).message}). `
            + 'Give the column a DEFAULT in src/db/schema.ts, or delete the data/ folder to rebuild the database.');
        }
      }
    }
  });
}
