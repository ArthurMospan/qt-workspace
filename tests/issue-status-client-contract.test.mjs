import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('all interactive status moves use the authenticated status API', async () => {
  const [service, projectIssues, myTasks] = await Promise.all([
    read('../src/lib/services/issues.js'),
    read('../src/lib/hooks/useIssues.js'),
    read('../src/lib/hooks/useAllMyTasks.js'),
  ]);

  assert.match(service, /export async function transitionIssueStatusViaApi/);
  assert.match(service, /\/api\/issues\/\$\{encodeURIComponent\(issueId\)\}\/status/);
  assert.match(projectIssues, /await transitionIssueStatusViaApi\(\{/);
  assert.match(myTasks, /await transitionIssueStatusViaApi\(\{/);
  assert.doesNotMatch(projectIssues, /\bwriteBatch\b|\bdeleteField\b/);
  assert.doesNotMatch(myTasks, /\bdeleteField\b/);
});

test('browser Firestore writes cannot bypass execution fields', async () => {
  const rules = await read('../firestore.rules');
  const issueBlock = rules.slice(
    rules.indexOf('match /issues/{issueId}'),
    rules.indexOf('match /issueLinks/{id}'),
  );

  for (const field of ['status', 'columnId', 'completedAt', 'order']) {
    assert.match(issueBlock, new RegExp(`'${field}'`));
  }
});
