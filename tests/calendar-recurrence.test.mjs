import test from 'node:test';
import assert from 'node:assert/strict';
import { addRecurrence, expandOccurrences } from '../src/lib/utils/calendarRecurrence.mjs';

// Local calendar date. toISOString() would shift the day in any non-UTC zone,
// and recurrence is defined in the user's local calendar, not in UTC.
const iso = date => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

test('monthly recurrence anchors the day instead of drifting', () => {
  // 31 Jan + 1 month with plain setMonth() lands on 3 March and every later
  // occurrence inherits the shift.
  let cursor = new Date(2026, 0, 31);
  const days = [];
  for (let index = 0; index < 4; index += 1) {
    cursor = addRecurrence(cursor, 'monthly', 1, 31);
    days.push(iso(cursor));
  }
  assert.deepEqual(days, ['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
});

test('monthly recurrence handles a leap February', () => {
  assert.equal(iso(addRecurrence(new Date(2028, 0, 31), 'monthly', 1, 31)), '2028-02-29');
});

test('a long-running daily series still produces current occurrences', () => {
  // The old fixed iteration cap gave up ~400 steps after the series start, so
  // a daily event from three years ago produced nothing at all for today.
  const start = new Date(2023, 0, 1, 9, 0, 0);
  const windowStart = new Date(2026, 6, 25, 0, 0, 0);
  const windowEnd = new Date(2026, 6, 28, 0, 0, 0);
  const { occurrences, truncated } = expandOccurrences({
    start, frequency: 'daily', interval: 1, windowStart, windowEnd,
  });
  assert.equal(truncated, false);
  assert.deepEqual(occurrences.map(iso), ['2026-07-25', '2026-07-26', '2026-07-27']);
});

test('weekly series keep their weekday across a long gap', () => {
  const start = new Date(2024, 0, 3, 10, 0, 0); // a Wednesday
  const { occurrences } = expandOccurrences({
    start,
    frequency: 'weekly',
    interval: 1,
    windowStart: new Date(2026, 6, 20),
    windowEnd: new Date(2026, 7, 3),
  });
  assert.ok(occurrences.length > 0);
  for (const occurrence of occurrences) assert.equal(occurrence.getDay(), 3);
});

test('the until date ends the series', () => {
  const { occurrences } = expandOccurrences({
    start: new Date(2026, 6, 1, 9, 0, 0),
    frequency: 'daily',
    interval: 1,
    until: '2026-07-03T23:59:59',
    windowStart: new Date(2026, 5, 1),
    windowEnd: new Date(2027, 0, 1),
  });
  assert.deepEqual(occurrences.map(iso), ['2026-07-01', '2026-07-02', '2026-07-03']);
});

test('non-repeating events yield their single start only inside the window', () => {
  const start = new Date(2026, 6, 25, 9, 0, 0);
  assert.equal(expandOccurrences({
    start, windowStart: new Date(2026, 6, 24), windowEnd: new Date(2026, 6, 26),
  }).occurrences.length, 1);
  assert.equal(expandOccurrences({
    start, windowStart: new Date(2026, 6, 26), windowEnd: new Date(2026, 6, 27),
  }).occurrences.length, 0);
});

test('the occurrence cap is reported rather than silently swallowed', () => {
  const { occurrences, truncated } = expandOccurrences({
    start: new Date(2026, 0, 1),
    frequency: 'daily',
    interval: 1,
    windowStart: new Date(2026, 0, 1),
    windowEnd: new Date(2027, 0, 1),
    maxOccurrences: 10,
  });
  assert.equal(occurrences.length, 10);
  assert.equal(truncated, true);
});
