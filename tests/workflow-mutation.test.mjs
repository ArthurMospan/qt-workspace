import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeWorkflowMutationInput,
  sameStringSet,
} from '../src/lib/utils/workflowMutation.mjs';

function workflow() {
  return {
    statuses: [
      { id: 'todo', label: 'До виконання', color: '#fff', isDone: false },
      { id: 'done', label: 'Готово', color: '#000', isDone: true },
    ],
    types: [{ id: 'task', label: 'Задача' }],
    priorities: [{ id: 'medium', label: 'Середній' }],
    labels: [],
    positions: [{ id: 'dev', label: 'Розробник', hourlyRate: 30 }],
  };
}

test('workflow mutation normalizes all sections and explicit status migrations', () => {
  assert.deepEqual(normalizeWorkflowMutationInput({
    workflow: workflow(),
    statusMigrations: [{
      fromStatusId: ' old ',
      toStatusId: 'todo',
    }],
  }), {
    value: {
      workflow: workflow(),
      statusMigrations: [{
        fromStatusId: 'old',
        toStatusId: 'todo',
      }],
    },
  });
});

test('workflow mutation rejects duplicate ids and malformed migration mappings', () => {
  const duplicate = workflow();
  duplicate.statuses.push({ id: 'todo', label: 'Ще один' });
  assert.equal(
    normalizeWorkflowMutationInput({ workflow: duplicate }).error.code,
    'DUPLICATE_WORKFLOW_ID',
  );
  assert.equal(normalizeWorkflowMutationInput({
    workflow: workflow(),
    statusMigrations: [
      { fromStatusId: 'old', toStatusId: 'todo' },
      { fromStatusId: 'old', toStatusId: 'done' },
    ],
  }).error.code, 'DUPLICATE_STATUS_MIGRATION');
});

test('string-set comparison ignores ordering but not membership', () => {
  assert.equal(sameStringSet(['todo', 'done'], ['done', 'todo']), true);
  assert.equal(sameStringSet(['todo'], ['todo', 'done']), false);
});
