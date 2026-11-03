import type { DatabaseSync } from 'node:sqlite';

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

CREATE TABLE IF NOT EXISTS speech_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO speech_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS speeches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  position INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('toastmaster','boss','hr','host','colleague')),
  speaker_guest_id INTEGER REFERENCES guests(id) ON DELETE SET NULL,
  tone TEXT NOT NULL CHECK (tone IN ('warm','formal','playful','heartfelt')),
  length TEXT NOT NULL CHECK (length IN ('short','medium','long')),
  cringe INTEGER NOT NULL CHECK (cringe BETWEEN 1 AND 5),
  mention TEXT NOT NULL DEFAULT '',
  body TEXT,
  written_at TEXT,
  -- Bumped on every settings change; copied to written_version when text is written.
  settings_version INTEGER NOT NULL DEFAULT 1,
  written_version INTEGER
);
`;

export function applySchema(db: DatabaseSync): void {
  db.exec(DDL);
  upgradeSpeeches(db);
}

/** Databases created by an early build of the speeches table track staleness with a timestamp; move them to versions. */
function upgradeSpeeches(db: DatabaseSync): void {
  const columns = (db.prepare('PRAGMA table_info(speeches)').all() as { name: string }[]).map((c) => c.name);
  if (!columns.includes('settings_version')) {
    db.exec(`ALTER TABLE speeches ADD COLUMN settings_version INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE speeches ADD COLUMN written_version INTEGER;
      UPDATE speeches SET written_version = 1 WHERE body IS NOT NULL;`);
  }
  if (columns.includes('settings_updated_at')) db.exec('ALTER TABLE speeches DROP COLUMN settings_updated_at');
}
