import { expect, test } from 'vitest';
import { horseshoeLayout } from '../web/src/horseshoe.ts';

const W = 900, H = 640;

test('horseshoe returns n seats', () => {
  expect(horseshoeLayout(21, W, H)).toHaveLength(21);
  expect(horseshoeLayout(21, W, H).map((s) => s.seatNumber)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
});

test('middle seat is lowest point and horizontally centred', () => {
  for (const n of [25, 24, 21, 3]) {
    const seats = horseshoeLayout(n, W, H);
    const middle = seats[Math.ceil(n / 2) - 1];
    const lowest = Math.max(...seats.map((s) => s.y));
    expect(middle.y).toBeGreaterThanOrEqual(lowest - 1e-6);
    if (n % 2 === 1) expect(Math.abs(middle.x - W / 2)).toBeLessThan(1);
  }
});

test('seat 1 and seat n are the arm tips, mirrored', () => {
  const seats = horseshoeLayout(21, W, H);
  const first = seats[0], last = seats[20];
  expect(first.y).toBeCloseTo(last.y);
  expect(first.x + last.x).toBeCloseTo(W);
  expect(first.y).toBe(Math.min(...seats.map((s) => s.y)));
  expect(first.x).toBeLessThan(W / 2);
});

test('seats are evenly spaced along the table', () => {
  const seats = horseshoeLayout(21, W, H);
  const gaps = seats.slice(1).map((s, i) => Math.hypot(s.x - seats[i].x, s.y - seats[i].y));
  // chords on the curve are slightly shorter than on the straight arms
  expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThan(1.05);
});

test('a single seat sits at the bottom centre; n = 0 returns []', () => {
  expect(horseshoeLayout(0, W, H)).toEqual([]);
  const [only] = horseshoeLayout(1, W, H);
  expect(only.x).toBeCloseTo(W / 2);
});
