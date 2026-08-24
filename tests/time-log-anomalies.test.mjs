import test from 'node:test';
import assert from 'node:assert/strict';
import { findTimeLogAnomalies } from '../src/lib/utils/timeLogAnomalies.mjs';

test('flags an event log that greatly exceeds its scheduled occurrence', () => {
  const occurrenceStartAt = '2026-08-05T09:00:00.000Z';
  const anomalies = findTimeLogAnomalies([
    { id: 'log', eventId: 'event', occurrenceStartAt, spentMinutes: 3001 },
  ], [
    {
      id: `event::${occurrenceStartAt}`,
      sourceEventId: 'event',
      startAt: occurrenceStartAt,
      endAt: '2026-08-05T10:06:00.000Z',
    },
  ]);

  assert.equal(anomalies.length, 1);
  assert.equal(anomalies[0].kind, 'long-event');
  assert.equal(anomalies[0].expectedMinutes, 66);
});

test('does not flag ordinary task or calendar time', () => {
  assert.deepEqual(findTimeLogAnomalies([
    { id: 'task', issueId: 'issue', spentMinutes: 480 },
    { id: 'event', eventId: 'event', spentMinutes: 60 },
  ]), []);
});
