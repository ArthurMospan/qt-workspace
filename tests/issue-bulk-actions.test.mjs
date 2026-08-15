import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ISSUE_BULK_ACTION_IDS,
  MAX_BULK_ISSUES,
  normalizeBulkIssueIds,
  validateBulkActionValue,
} from '../src/lib/bulk/issueBulkActions.mjs';
import { optimisticBulkPatch } from '../src/lib/bulk/issueBulkOptimistic.mjs';
import { toggleIssueId, toggleIssueScope, visibleSelectedIds } from '../src/lib/utils/issueSelection.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('bulk action registry is complete and the API remains bounded', () => {
  assert.equal(MAX_BULK_ISSUES, 50);
  assert.deepEqual(ISSUE_BULK_ACTION_IDS, [
    'status',
    'assignees-add', 'assignees-remove', 'assignees-replace', 'assignees-clear',
    'priority', 'priority-clear',
    'labels-add', 'labels-remove', 'labels-clear',
    'type', 'deadline', 'deadline-clear', 'estimate', 'estimate-clear',
    'sprint', 'backlog', 'duplicate', 'archive',
  ]);
});

test('bulk values reject malformed or unbounded inputs', () => {
  assert.equal(validateBulkActionValue('status', { mode: 'category', id: 'done' }), null);
  assert.equal(validateBulkActionValue('status', { mode: 'guess', id: 'done' }), 'Потрібен коректний статус або категорія');
  assert.equal(validateBulkActionValue('assignees-add', ['a']), null);
  assert.ok(validateBulkActionValue('assignees-add', []));
  assert.ok(validateBulkActionValue('labels-add', Array.from({ length: 21 }, (_, index) => String(index))));
  assert.equal(validateBulkActionValue('estimate', 0), null);
  assert.equal(validateBulkActionValue('estimate', 525600), null);
  assert.ok(validateBulkActionValue('estimate', -1));
  assert.equal(validateBulkActionValue('deadline', '2026-08-15'), null);
  assert.ok(validateBulkActionValue('deadline', 'not-a-date'));
  assert.ok(validateBulkActionValue('deadline', '2026-02-31'));
  assert.ok(validateBulkActionValue('missing', null));
});

test('issue ids are trimmed and de-duplicated without silently truncating', () => {
  const ids = normalizeBulkIssueIds([' a ', 'a', '', null, 'b']);
  assert.deepEqual(ids, ['a', 'b']);
  assert.equal(normalizeBulkIssueIds(Array.from({ length: 51 }, (_, index) => `i-${index}`)).length, 51);
});

test('optimistic patches preserve unrelated assignees and labels', () => {
  const issue = { assigneeIds: ['a', 'b'], labelIds: ['x', 'y'] };
  assert.deepEqual(optimisticBulkPatch(issue, 'assignees-add', ['b', 'c']), { assigneeIds: ['a', 'b', 'c'] });
  assert.deepEqual(optimisticBulkPatch(issue, 'assignees-remove', ['b']), { assigneeIds: ['a'] });
  assert.deepEqual(optimisticBulkPatch(issue, 'labels-add', ['y', 'z']), { labelIds: ['x', 'y', 'z'] });
  assert.deepEqual(optimisticBulkPatch(issue, 'labels-remove', ['x']), { labelIds: ['y'] });
  assert.deepEqual(optimisticBulkPatch(issue, 'priority-clear'), { priority: 'none' });
  assert.deepEqual(optimisticBulkPatch(issue, 'archive'), { _bulkArchived: true });
});

test('selection starts by scope, supports Shift ranges and drops invisible ids', () => {
  const order = ['a', 'b', 'c', 'd'];
  const scoped = toggleIssueScope(new Set(), ['a', 'b', 'c']);
  assert.deepEqual([...scoped], ['a', 'b', 'c']);
  const removed = toggleIssueId(scoped, 'b', order, 'a', false);
  assert.deepEqual([...removed], ['a', 'c']);
  const range = toggleIssueId(new Set(['a']), 'd', order, 'a', true);
  assert.deepEqual([...range], order);
  assert.deepEqual([...visibleSelectedIds(range, [{ id: 'a' }, { id: 'c' }])], ['a', 'c']);
});

test('bulk route enforces auth, project scope, canonical routes and partial results', async () => {
  const route = await read('src/app/api/issues/bulk/route.js');
  assert.match(route, /authorizeOrgRequest\(request, organizationId/);
  assert.match(route, /enforceRateLimit\('issue-bulk'/);
  assert.match(route, /rawIssueIds\.length > MAX_BULK_ISSUES/);
  assert.match(route, /projectAccessError\(project, organizationId, authorization\)/);
  assert.match(route, /createIssue\(internal\)/);
  assert.match(route, /deleteIssue\(internal/);
  assert.match(route, /transitionIssueStatus\(internal/);
  assert.match(route, /db\.runTransaction/);
  assert.match(route, /collection\('audit'\)/);
  assert.match(route, /const failed = results\.filter/);
  assert.match(route, /NextResponse\.json\(\{[\s\S]*requested:[\s\S]*updated,[\s\S]*failed,/);
});

test('client batches a large select-all and rolls back only failed ids', async () => {
  const hook = await read('src/lib/hooks/useBulkIssueActions.js');
  assert.match(hook, /batches\(issueIds, MAX_BULK_ISSUES\)/);
  assert.match(hook, /result\.updated\.push/);
  assert.match(hook, /result\.failed\.push/);
  assert.match(hook, /revertPatch\(failedIds\)/);
  assert.doesNotMatch(hook, /throw error/);
});

test('bulk action previews run under the same confirm contract as the workspace', async () => {
  const uiKit = await read('src/app/ui-kit/page.js');
  assert.match(uiKit, /<ConfirmProvider>[\s\S]*<KitContext\.Provider/);
});
