import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { openDb } from '../src/db/connection.ts';
import { addMissingColumns } from '../src/db/schema.ts';
import { tempDbPath } from './helpers.ts';

test('opening an older database adds the columns it is missing', () => {
  const path = tempDbPath();
  const old = openDb(path);
  old.exec('DROP TABLE playlist_tracks; CREATE TABLE playlist_tracks (position INTEGER PRIMARY KEY, title TEXT NOT NULL, artist TEXT NOT NULL);');
  old.exec("INSERT INTO playlist_tracks (position, title, artist) VALUES (1, 'Jingle', 'Bells')");
  old.close();

  const db = openDb(path);
  expect(db.prepare('SELECT * FROM playlist_tracks').all()).toEqual([{ position: 1, title: 'Jingle', artist: 'Bells', note: '' }]);
});

test('keeps CHECK constraints on added columns', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)');
  addMissingColumns(db, "CREATE TABLE t (id INTEGER PRIMARY KEY, kind TEXT NOT NULL DEFAULT 'a' CHECK (kind IN ('a','b')), label TEXT)");
  expect(() => db.exec("INSERT INTO t (kind) VALUES ('c')")).toThrow(/CHECK/);
  db.exec("INSERT INTO t (label) VALUES ('x')");
  expect(db.prepare('SELECT kind, label FROM t').get()).toEqual({ kind: 'a', label: 'x' });
});

test('explains what to do when a column cannot be added', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY); INSERT INTO t (id) VALUES (1);');
  expect(() => addMissingColumns(db, 'CREATE TABLE t (id INTEGER PRIMARY KEY, speech TEXT NOT NULL)'))
    .toThrow(/t\.speech.*DEFAULT.*data\/ folder/);
});
