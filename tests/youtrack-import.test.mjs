import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fieldMinutes,
  mapYouTrackPriority,
  mapYouTrackStatus,
  mapYouTrackType,
  normalizeYouTrackBaseUrl,
  relationTypeFromYouTrack,
  suggestUserMappings,
  youTrackField,
} from '../src/lib/utils/youtrackImport.mjs';

const workflow = {
  statuses: [
    { id: 'backlog', label: 'Беклог' },
    { id: 'todo', label: 'До роботи' },
    { id: 'in-progress', label: 'У роботі' },
    { id: 'done', label: 'Готово' },
  ],
  priorities: [
    { id: 'blocker', label: 'Блокер' },
    { id: 'high', label: 'Високий' },
    { id: 'medium', label: 'Середній' },
    { id: 'low', label: 'Низький' },
  ],
  types: [
    { id: 'task', label: 'Задача' },
    { id: 'bug', label: 'Баг' },
    { id: 'feature', label: 'Фіча' },
  ],
};

test('normalizes a public YouTrack URL and rejects private hosts', () => {
  assert.equal(normalizeYouTrackBaseUrl('https://acme.youtrack.cloud/'), 'https://acme.youtrack.cloud');
  assert.equal(normalizeYouTrackBaseUrl('https://example.com/youtrack/api'), 'https://example.com/youtrack');
  assert.throws(() => normalizeYouTrackBaseUrl('http://acme.youtrack.cloud'));
  assert.throws(() => normalizeYouTrackBaseUrl('https://127.0.0.1/youtrack'));
  assert.throws(() => normalizeYouTrackBaseUrl('https://192.168.1.20'));
});

test('suggests only exact email mappings', () => {
  assert.deepEqual(
    suggestUserMappings(
      [
        { id: 'u1', name: 'Same Name', email: 'member@example.com' },
        { id: 'u2', name: 'Same Name', email: 'other@example.com' },
      ],
      [{ id: 'qt1', name: 'Same Name', email: 'MEMBER@example.com' }],
    ),
    { u1: 'qt1', u2: 'external' },
  );
});

test('maps common YouTrack workflow values', () => {
  assert.equal(mapYouTrackStatus('In Progress', workflow.statuses), 'in-progress');
  assert.equal(mapYouTrackStatus('Fixed', workflow.statuses), 'done');
  assert.equal(mapYouTrackPriority('Show-stopper', workflow.priorities), 'blocker');
  assert.equal(mapYouTrackPriority('Minor', workflow.priorities), 'low');
  assert.equal(mapYouTrackType('Bug', workflow.types), 'bug');
  assert.equal(mapYouTrackType('User Story', workflow.types), 'feature');
});

test('reads custom fields and YouTrack durations', () => {
  const issue = {
    customFields: [
      { name: 'State', value: { name: 'Open' } },
      { name: 'Estimation', value: { minutes: 95 } },
    ],
  };
  assert.deepEqual(youTrackField(issue, 'state'), { name: 'Open' });
  assert.equal(fieldMinutes(youTrackField(issue, 'Estimation')), 95);
});

test('normalizes link types', () => {
  assert.equal(relationTypeFromYouTrack({ sourceToTarget: 'blocks' }, 'OUTWARD'), 'blocks');
  assert.equal(relationTypeFromYouTrack({ sourceToTarget: 'is required for' }, 'OUTWARD'), 'blocks');
  assert.equal(relationTypeFromYouTrack({ sourceToTarget: 'depends on' }, 'OUTWARD'), 'is-blocked-by');
  assert.equal(relationTypeFromYouTrack({ sourceToTarget: 'duplicates' }, 'OUTWARD'), 'duplicates');
  assert.equal(relationTypeFromYouTrack({ sourceToTarget: 'relates to' }, 'OUTWARD'), 'relates-to');
});
