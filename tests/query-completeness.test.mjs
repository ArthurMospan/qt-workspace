import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { COLUMN_VIRTUALIZATION_THRESHOLD } from '../src/lib/utils/boardRendering.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('workspace task listeners expose their complete authorized scope', async () => {
  const [issues, mine, sprints, analytics] = await Promise.all([
    read('src/lib/hooks/useIssues.js'),
    read('src/lib/hooks/useAllMyTasks.js'),
    read('src/lib/hooks/useSprints.js'),
    read('src/lib/hooks/useWorkspaceAnalytics.js'),
  ]);

  for (const source of [issues, mine, sprints, analytics]) {
    assert.doesNotMatch(source, /limit\(/);
    assert.doesNotMatch(source, /hasMore/);
    assert.doesNotMatch(source, /loadMore/);
  }
  assert.match(mine, /where\('assigneeIds', 'array-contains', userId\)/);
  assert.match(sprints, /orderBy\('createdAt', 'desc'\)/);
  assert.match(analytics, /includeTimeLogs/);
});

test('large single-swimlane columns virtualize without hiding tasks behind a button', async () => {
  const [board, column, card, sprintPage, projectPage, myPage, profile] = await Promise.all([
    read('src/components/workspace/AgileBoard.jsx'),
    read('src/components/workspace/VirtualDroppableColumn.jsx'),
    read('src/components/workspace/IssueCard.jsx'),
    read('src/app/(app)/sprints/page.js'),
    read('src/app/(app)/[projectId]/ProjectBoardClient.jsx'),
    read('src/app/(app)/my/page.js'),
    read('src/components/profile/ProfileView.jsx'),
  ]);

  assert.equal(COLUMN_VIRTUALIZATION_THRESHOLD, 40);
  // The windowing itself is one module, so the board and the sprint backlog —
  // the other list long enough to need it — cannot drift into two answers.
  assert.match(column, /mode="virtual"/);
  assert.match(column, /renderClone=/);
  assert.match(column, /const VIRTUAL_OVERSCAN = [1-9]\d*/);
  assert.match(column, /new ResizeObserver\(report\)/);
  assert.match(column, /const index = visibleRange\.start \+ offset/);
  assert.match(board, /const shouldVirtualize = swimlanes\.length === 1/);
  assert.match(board, /<VirtualDroppableColumn[\s\S]*issues=\{colIssues\}/);
  assert.match(board, /visibleColumnIds = columnCards/);
  assert.match(
    sprintPage,
    /sorted\.length > COLUMN_VIRTUALIZATION_THRESHOLD[\s\S]{0,200}<VirtualDroppableColumn/,
  );
  assert.match(card, /dragProvided/);
  assert.match(card, /virtualStyle/);

  for (const source of [board, column, sprintPage, projectPage, myPage, profile]) {
    assert.doesNotMatch(source, /Завантажити ще|Показати ще|Довантажити дані/);
  }
  assert.doesNotMatch(board, /renderedColIssues|remainingIssueCount|visibleCardLimits/);
  assert.doesNotMatch(sprintPage, /renderedIssues|remainingIssueCount|visibleIssueLimits/);
});

test('sprint planning skips unused time-log subscriptions', async () => {
  const page = await read('src/app/(app)/sprints/page.js');
  assert.match(page, /useWorkspaceAnalytics\(projectIds, \{ includeTimeLogs: false \}\)/);
});

test('analytics does not fetch everything and then hide arbitrary rows', async () => {
  const [taskList, overview, projectAnalytics, workload, velocity] = await Promise.all([
    read('src/components/ui/TaskManagement/TaskListCard.jsx'),
    read('src/app/(app)/analytics/page.js'),
    read('src/components/workspace/AnalyticsTab.jsx'),
    read('src/components/workspace/WorkloadTab.jsx'),
    read('src/components/workspace/VelocityTab.jsx'),
  ]);

  assert.doesNotMatch(taskList, /issues\.slice\(/);
  assert.doesNotMatch(taskList, /props\.limit|\blimit\s*=/);
  for (const source of [overview, projectAnalytics, workload, velocity]) {
    assert.doesNotMatch(source, /<TaskListCard[\s\S]{0,500}\blimit=/);
  }
  assert.doesNotMatch(workload, /rows\.slice\(0,|logs\.slice\(0,/);
  assert.doesNotMatch(velocity, /byProject\.slice\(0,/);
});
