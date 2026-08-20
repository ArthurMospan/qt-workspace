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

test('analytics counts every task, a parent with subtasks included', async () => {
  const [analytics, velocity, workload, team] = await Promise.all([
    read('../src/app/(app)/analytics/page.js'),
    read('../src/components/workspace/VelocityTab.jsx'),
    read('../src/components/workspace/WorkloadTab.jsx'),
    read('../src/lib/utils/teamAnalytics.mjs'),
  ]);

  assert.match(analytics, /label="Задачі"/);
  // The column header is «Задач»; the table it heads is `DataTable`, whose
  // columns are objects rather than a hand-written <thead>.
  assert.match(analytics, /header: 'Задач'/);
  // A task used to leave every count the moment it gained a subtask, which
  // rewrote finished weeks in the velocity chart. Nothing may filter by
  // hierarchy here again.
  for (const source of [analytics, velocity, workload, team]) {
    assert.doesNotMatch(source, /selectActionableIssues|summaryIssueIds/);
  }
});

test('billing never turns an estimate into money', async () => {
  const [accounting, billing, payload] = await Promise.all([
    read('../src/lib/utils/issueAccounting.mjs'),
    read('../src/components/workspace/BillingTab.jsx'),
    read('../src/lib/server/invoicePayload.mjs'),
  ]);

  assert.doesNotMatch(accounting, /estimateMinutes/);
  assert.doesNotMatch(billing, /estimateMinutes/);
  // 'estimate' survives as a historical kind on invoices already issued, but
  // a new position may never be created with it.
  assert.match(payload, /const SOURCE_KINDS = new Set\(\['actual', 'manual', 'none'\]\);/);
});
