import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('workspace analytics excludes archived projects before subscribing to their data', async () => {
  const [workspaceAnalytics, memberAnalytics] = await Promise.all([
    read('../src/app/(app)/analytics/page.js'),
    read('../src/app/(app)/analytics/team/[memberId]/page.js'),
  ]);

  for (const source of [workspaceAnalytics, memberAnalytics]) {
    assert.match(source, /const activeProjects = useMemo\([\s\S]{0,160}project\.status !== 'archived'/);
    assert.match(source, /useWorkspaceAnalytics\(activeProjects\.map\(project => project\.id\)\)/);
  }

  assert.doesNotMatch(workspaceAnalytics, /useWorkspaceAnalytics\(projects\.map/);
  assert.doesNotMatch(memberAnalytics, /useWorkspaceAnalytics\(projects\.map/);
});

test('analytics describes the leaf-task accounting rule without changing it', async () => {
  const [analytics, accounting] = await Promise.all([
    read('../src/app/(app)/analytics/page.js'),
    read('../src/lib/utils/issueAccounting.mjs'),
  ]);

  assert.match(analytics, /label="Робочі задачі"/);
  assert.match(analytics, /Робочих задач/);
  assert.match(analytics, /Батьківські задачі не рахуються окремо: їхня робота представлена підзавданнями\./);
  assert.match(accounting, /return issues\.filter\(issue => \{[\s\S]{0,160}!summaryIssueIds\.has\(id\)/);
});
