import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TYPE_IDS,
  STATUS_LABELS,
  localizeBuiltInWorkflowItems,
} from '../src/lib/utils/workflowDefaults.mjs';

test('built-in workflow labels localize by stable id without changing ids', () => {
  assert.deepEqual(
    localizeBuiltInWorkflowItems('statuses', [
      { id: 'backlog', label: 'Backlog' },
      { id: 'todo', label: 'To Do' },
      { id: 'in-progress', label: 'In Progress' },
      { id: 'done', label: 'Done', isDone: true },
    ]),
    [
      { id: 'backlog', label: 'Беклог' },
      { id: 'todo', label: 'До виконання' },
      { id: 'in-progress', label: 'У роботі' },
      { id: 'done', label: 'Готово', isDone: true },
    ],
  );
  assert.equal(STATUS_LABELS.backlog, 'Беклог');
  assert.deepEqual(DEFAULT_TYPE_IDS, ['feature', 'task', 'bug']);
});

test('workflow localization never rewrites a custom id with a familiar label', () => {
  const custom = [
    { id: 'customer-bug', label: 'Bug' },
    { id: 'brand-design', label: 'Design' },
  ];
  assert.deepEqual(localizeBuiltInWorkflowItems('labels', custom), custom);
});

test('legacy built-in positions localize while custom positions remain intact', () => {
  assert.deepEqual(
    localizeBuiltInWorkflowItems('positions', [
      { id: 'dev', label: 'Developer', hourlyRate: 30 },
      { id: 'designer', label: 'Designer', hourlyRate: 35 },
      { id: 'pm', label: 'Project Manager', hourlyRate: 40 },
      { id: 'custom-pm', label: 'Project Manager', hourlyRate: 50 },
    ]),
    [
      { id: 'dev', label: 'Розробник', hourlyRate: 30 },
      { id: 'designer', label: 'Дизайнер', hourlyRate: 35 },
      { id: 'pm', label: 'PM', hourlyRate: 40 },
      { id: 'custom-pm', label: 'Project Manager', hourlyRate: 50 },
    ],
  );
});
