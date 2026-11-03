import { DatabaseSync } from 'node:sqlite';
import { describe, expect, test } from 'vitest';
import { openDb } from '../src/db/connection.ts';
import {
  ValidationError, addSpeech, clearPlan, getSpeeches, listPublicGuests, removeGuest, removeSpeech, reorderSpeeches,
  setSpeechText, setSpeechesEnabled, updateGuest, updateSpeech,
} from '../src/db/repo.ts';
import { freshDb, tempDbPath } from './helpers.ts';

function withSpeeches(count = 3) {
  const ctx = freshDb(3);
  setSpeechesEnabled(ctx.db, true);
  const speeches = Array.from({ length: count }, () => addSpeech(ctx.db));
  return { ...ctx, speeches };
}

describe('speech settings', () => {
  test('speeches start switched off with no entries', () => {
    const { db } = freshDb(1);
    expect(getSpeeches(db)).toEqual({ enabled: false, speeches: [] });
  });

  test('switching on persists', () => {
    const { db } = freshDb(1);
    expect(setSpeechesEnabled(db, true).enabled).toBe(true);
    expect(getSpeeches(db).enabled).toBe(true);
  });

  test('enabled must be a boolean', () => {
    const { db } = freshDb(1);
    expect(() => setSpeechesEnabled(db, 'yes' as never)).toThrow(ValidationError);
  });

  test('addSpeech appends with defaults', () => {
    const { db, speeches } = withSpeeches(2);
    const added = addSpeech(db);
    expect(added).toMatchObject({
      position: 3, role: 'colleague', speakerGuestId: null, tone: 'warm', length: 'short', cringe: 2, mention: '',
      body: null, writtenAt: null, outOfDate: false,
    });
    expect(getSpeeches(db).speeches.map((s) => s.id)).toEqual([...speeches.map((s) => s.id), added.id]);
  });

  test('rejects values outside the allowed choices', () => {
    const { db, speeches } = withSpeeches(1);
    const id = speeches[0].id;
    expect(() => updateSpeech(db, id, { cringe: 7 })).toThrow('cringe must be a whole number from 1 to 5');
    expect(() => updateSpeech(db, id, { cringe: 2.5 })).toThrow(ValidationError);
    expect(() => updateSpeech(db, id, { tone: 'angry' as never })).toThrow(/tone must be one of warm, formal/);
    expect(() => updateSpeech(db, id, { role: 'king' as never })).toThrow(ValidationError);
    expect(() => updateSpeech(db, id, { length: 'epic' as never })).toThrow(ValidationError);
    expect(() => updateSpeech(db, id, { speakerGuestId: 999 })).toThrow('guest id 999 does not exist');
    expect(() => updateSpeech(db, id, { colour: 'red' } as never)).toThrow('unknown speech field "colour"');
    expect(() => addSpeech(db, { cringe: 0 })).toThrow(ValidationError);
    expect(getSpeeches(db).speeches).toHaveLength(1);
  });

  test('unknown speech id is rejected', () => {
    const { db } = withSpeeches(1);
    expect(() => updateSpeech(db, 999, { tone: 'formal' })).toThrow('speech id 999 does not exist');
    expect(() => removeSpeech(db, 999)).toThrow('speech id 999 does not exist');
  });
});

describe('running order', () => {
  test('reorder sets positions', () => {
    const { db, speeches: [a, b, c] } = withSpeeches(3);
    const plan = reorderSpeeches(db, [a.id, c.id, b.id]);
    expect(plan.speeches.map((s) => [s.id, s.position])).toEqual([[a.id, 1], [c.id, 2], [b.id, 3]]);
  });

  test('reorder must list every speech exactly once', () => {
    const { db, speeches: [a, b] } = withSpeeches(3);
    expect(() => reorderSpeeches(db, [a.id, b.id])).toThrow(ValidationError);
    expect(() => reorderSpeeches(db, [a.id, a.id, b.id])).toThrow(ValidationError);
    expect(() => reorderSpeeches(db, [a.id, b.id, 999])).toThrow(ValidationError);
    expect(() => reorderSpeeches(db, 'nope' as never)).toThrow(ValidationError);
  });

  test('remove keeps positions gapless', () => {
    const { db, speeches: [a, b, c] } = withSpeeches(3);
    removeSpeech(db, b.id);
    expect(getSpeeches(db).speeches.map((s) => [s.id, s.position])).toEqual([[a.id, 1], [c.id, 2]]);
    expect(addSpeech(db).position).toBe(3);
  });
});

describe('speech text', () => {
  test('setSpeechText stores the text and time', () => {
    const { db, speeches: [a] } = withSpeeches(1);
    const written = setSpeechText(db, a.id, 'Skål!');
    expect(written.body).toBe('Skål!');
    expect(written.writtenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(written.outOfDate).toBe(false);
  });

  test('changing settings after writing marks the speech out of date, and rewriting clears it', () => {
    const { db, speeches: [a] } = withSpeeches(1);
    setSpeechText(db, a.id, 'Hello');
    const changed = updateSpeech(db, a.id, { tone: 'formal' });
    expect(changed.outOfDate).toBe(true);
    expect(changed.body).toBe('Hello');
    expect(setSpeechText(db, a.id, 'Good evening').outOfDate).toBe(false);
  });

  test('an empty patch does not mark the speech out of date', () => {
    const { db, speeches: [a] } = withSpeeches(1);
    setSpeechText(db, a.id, 'Hello');
    expect(updateSpeech(db, a.id, {}).outOfDate).toBe(false);
  });

  test('setSpeechText rejects empty text, unknown ids, and calls while switched off', () => {
    const { db, speeches: [a] } = withSpeeches(1);
    expect(() => setSpeechText(db, a.id, '  ')).toThrow('body must not be empty');
    expect(() => setSpeechText(db, 999, 'x')).toThrow('speech id 999 does not exist');
    setSpeechesEnabled(db, false);
    expect(() => setSpeechText(db, a.id, 'x')).toThrow('speeches are switched off');
  });

  test('clearPlan clears the text but keeps the setup', () => {
    const { db, speeches: [a, b] } = withSpeeches(2);
    updateSpeech(db, a.id, { tone: 'playful', cringe: 5 });
    setSpeechText(db, a.id, 'One');
    setSpeechText(db, b.id, 'Two');
    clearPlan(db);
    const plan = getSpeeches(db);
    expect(plan.enabled).toBe(true);
    expect(plan.speeches).toHaveLength(2);
    expect(plan.speeches[0]).toMatchObject({ tone: 'playful', cringe: 5, body: null, writtenAt: null, outOfDate: false });
  });
});

describe('speaker guest', () => {
  test('deleting the speaker guest keeps the speech with no speaker', () => {
    const { db, guests, speeches: [a] } = withSpeeches(1);
    updateSpeech(db, a.id, { speakerGuestId: guests[0].id });
    removeGuest(db, guests[0].id);
    expect(getSpeeches(db).speeches[0]).toMatchObject({ id: a.id, speakerGuestId: null });
  });
});

describe('listPublicGuests', () => {
  test('returns attending guests with public fields only', () => {
    const { db, guests } = freshDb(3);
    updateGuest(db, guests[0].id, { notes: 'secret', allergies: 'nuts', dietaryPreference: 'vegan' });
    updateGuest(db, guests[1].id, { rsvpStatus: 'declined' });
    updateGuest(db, guests[2].id, { rsvpStatus: 'pending' });
    const result = listPublicGuests(db);
    expect(result.map((g) => g.id)).toEqual([guests[0].id]);
    expect(Object.keys(result[0]).sort()).toEqual(
      ['department', 'firstName', 'id', 'isBoss', 'jobTitle', 'lastName', 'partnerId']);
  });
});

describe('schema upgrade', () => {
  test('a database with the early speeches table is upgraded on open', () => {
    const path = tempDbPath();
    const old = new DatabaseSync(path);
    old.exec(`CREATE TABLE speeches (
      id INTEGER PRIMARY KEY AUTOINCREMENT, position INTEGER NOT NULL, role TEXT NOT NULL, speaker_guest_id INTEGER,
      tone TEXT NOT NULL, length TEXT NOT NULL, cringe INTEGER NOT NULL, mention TEXT NOT NULL DEFAULT '',
      body TEXT, written_at TEXT, settings_updated_at TEXT NOT NULL);
      INSERT INTO speeches (position, role, tone, length, cringe, body, written_at, settings_updated_at)
      VALUES (1, 'boss', 'formal', 'short', 1, 'Skål!', '2026-01-01', '2026-01-01');`);
    old.close();

    const db = openDb(path);
    clearPlan(db);
    setSpeechesEnabled(db, true);
    const added = addSpeech(db);
    expect(getSpeeches(db).speeches.map((s) => s.id)).toEqual([1, added.id]);
    expect(setSpeechText(db, 1, 'Again').outOfDate).toBe(false);
    expect(updateSpeech(db, 1, { tone: 'warm' }).outOfDate).toBe(true);
  });
});
