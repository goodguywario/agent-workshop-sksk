import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { openDb } from '../src/db/connection.ts';
import { listGuests } from '../src/db/repo.ts';
import { tempDbPath } from './helpers.ts';

test('node floor is 22.13, where node:sqlite needs no flag', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  expect(pkg.engines.node).toBe('>=22.13');
  expect(readFileSync('README.md', 'utf8')).not.toMatch(/22\.5/);
});

test('processes opening a fresh database at the same moment all succeed', async () => {
  const path = tempDbPath();
  const startAt = Date.now() + 4000;
  const script = `import { ensureDb } from './src/db/connection.ts';
    while (Date.now() < ${startAt}) {}
    ensureDb(${JSON.stringify(path)});`;
  const runs = Array.from({ length: 6 }, () => new Promise<{ code: number | null; stderr: string }>((resolve) => {
    const child = spawn('node', ['--import', 'tsx', '--input-type=module', '-e', script]);
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => resolve({ code, stderr }));
  }));
  const results = await Promise.all(runs);
  expect(results.map((r) => r.stderr.match(/database is locked/)?.[0] ?? r.code)).toEqual(Array(6).fill(0));
  expect(listGuests(openDb(path))).toHaveLength(25);
}, 60_000);
