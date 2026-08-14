import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ANALYTICS_QUERY_PAGE_SIZE,
  COLUMN_RENDER_PAGE_SIZE,
  ISSUE_QUERY_PAGE_SIZE,
  SPRINT_QUERY_PAGE_SIZE,
  nextQueryLimit,
} from '../src/lib/utils/queryPagination.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('query pages grow by one bounded page', () => {
  assert.equal(ISSUE_QUERY_PAGE_SIZE, 100);
  assert.equal(ANALYTICS_QUERY_PAGE_SIZE, 100);
  assert.equal(SPRINT_QUERY_PAGE_SIZE, 50);
  assert.equal(COLUMN_RENDER_PAGE_SIZE, 40);
  assert.equal(nextQueryLimit(100, 100), 200);
  assert.equal(nextQueryLimit(0, 50), 100);
});

test('project, personal, sprint and analytics listeners all use Firestore limits', async () => {
  const [issues, mine, sprints, analytics] = await Promise.all([
    read('src/lib/hooks/useIssues.js'),
    read('src/lib/hooks/useAllMyTasks.js'),
    read('src/lib/hooks/useSprints.js'),
    read('src/lib/hooks/useWorkspaceAnalytics.js'),
  ]);

  for (const source of [issues, mine, sprints, analytics]) {
    assert.match(source, /limit\(queryLimit \+ 1\)/);
    assert.match(source, /hasMore/);
    assert.match(source, /loadMore/);
  }
  assert.match(mine, /where\('assigneeIds', 'array-contains', userId\)/);
  assert.match(sprints, /orderBy\('createdAt', 'desc'\)/);
  assert.match(analytics, /includeTimeLogs/);
});

test('large single-swimlane columns use measured virtual DnD lists with absolute indices', async () => {
  const [board, card, sprintPage] = await Promise.all([
    read('src/components/workspace/AgileBoard.jsx'),
    read('src/components/workspace/IssueCard.jsx'),
    read('src/app/(app)/sprints/page.js'),
  ]);

  assert.match(board, /cardPageSize = COLUMN_RENDER_PAGE_SIZE/);
  assert.match(board, /const shouldVirtualize = swimlanes\.length === 1/);
  assert.match(board, /<VirtualDroppableColumn[\s\S]*issues=\{colIssues\}/);
  assert.match(board, /mode="virtual"/);
  assert.match(board, /renderClone=/);
  assert.match(board, /const VIRTUAL_OVERSCAN = [1-9]\d*/);
  assert.match(board, /new ResizeObserver\(report\)/);
  assert.match(board, /const index = visibleRange\.start \+ offset/);
  assert.match(board, /visibleColumnIds = columnCards/);
  assert.match(card, /dragProvided/);
  assert.match(card, /virtualStyle/);

  // Complex multi-swimlane and sprint tables stay on a bounded progressive
  // path; only the large single-swimlane board needs virtual DnD semantics.
  assert.match(board, /const renderedColIssues = colIssues\.slice\(0, visibleLimit\)/);
  assert.match(sprintPage, /const renderedIssues = sorted\.slice\(0, visibleLimit\)/);
  assert.match(sprintPage, /Показати ще/);
});

test('sprint planning skips unused time-log subscriptions', async () => {
  const page = await read('src/app/(app)/sprints/page.js');
  assert.match(page, /useWorkspaceAnalytics\(projectIds, \{ includeTimeLogs: false \}\)/);
});

test('required pagination indexes are declared', async () => {
  const indexes = JSON.parse(await read('firestore.indexes.json'));
  const issueIndex = indexes.indexes.find(index => (
    index.collectionGroup === 'issues'
    && index.fields.some(field => field.fieldPath === 'assigneeIds' && field.arrayConfig === 'CONTAINS')
  ));
  const sprintIndex = indexes.indexes.find(index => (
    index.collectionGroup === 'sprints'
    && index.fields.some(field => field.fieldPath === 'createdAt' && field.order === 'DESCENDING')
  ));
  assert.ok(issueIndex);
  assert.ok(sprintIndex);
});
