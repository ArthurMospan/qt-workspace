import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterTeamIssues,
  filterTeamTimeLogs,
} from '../src/lib/utils/teamAnalytics.mjs';

const issues = [
  { id: 'a', projectId: 'p1', assigneeIds: ['u1'], priority: 'high' },
  { id: 'b', projectId: 'p1', assigneeIds: ['u2'], priority: 'low' },
  { id: 'c', projectId: 'p2', assigneeIds: ['u1'], priority: 'low' },
];

const logs = [
  { id: 'l1', projectId: 'p1', userId: 'u1' },
  { id: 'l2', projectId: 'p1', userId: 'u2' },
  { id: 'l3', projectId: '', userId: 'u1', sourceType: 'calendar_event' },
];

test('team member selection filters tasks and time independently of task-only filters', () => {
  assert.deepEqual(
    filterTeamIssues(issues, [], 'u1').map(issue => issue.id),
    ['a', 'c'],
  );
  assert.deepEqual(
    filterTeamTimeLogs(logs, [], 'u1').map(log => log.id),
    ['l1', 'l3'],
  );
});

test('project filtering is consistent for team tasks and time', () => {
  assert.deepEqual(
    filterTeamIssues(issues, ['p1'], 'all').map(issue => issue.id),
    ['a', 'b'],
  );
  assert.deepEqual(
    filterTeamTimeLogs(logs, ['p1'], 'all').map(log => log.id),
    ['l1', 'l2'],
  );
});

test('projectless event time remains visible when no project filter is active', () => {
  assert.equal(filterTeamTimeLogs(logs, [], 'all').some(log => log.id === 'l3'), true);
});
