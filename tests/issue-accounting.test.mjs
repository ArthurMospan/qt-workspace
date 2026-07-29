import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateIssueTimeLogs,
  buildIssueAccountingIndex,
  buildParentIssueProgress,
  calculateBillingAutoPrice,
  collectSourceTimeLogIds,
  collectReservedInvoiceItemIds,
  collectReservedInvoiceTimeLogIds,
  findInvoiceTimeLogOverlap,
  selectActionableIssues,
  selectBillableIssues,
  selectIncrementalBillableIssues,
  sumRawTimeLogMinutes,
} from '../src/lib/utils/issueAccounting.mjs';

test('standalone tasks and leaves are actionable while their parent is a summary', () => {
  const issues = [
    { id: 'standalone', projectId: 'p1' },
    { id: 'parent', projectId: 'p1' },
    { id: 'child-a', projectId: 'p1', parentIssueId: 'parent' },
    { id: 'child-b', projectId: 'p1', parentIssueId: 'parent' },
  ];

  assert.deepEqual(
    selectActionableIssues(issues).map(issue => issue.id),
    ['standalone', 'child-a', 'child-b'],
  );
});

test('legacy parentEpicId remains accounting-compatible before migration', () => {
  const issues = [
    { id: 'legacy-parent', projectId: 'p1' },
    { id: 'legacy-child', projectId: 'p1', parentEpicId: 'legacy-parent' },
  ];

  assert.deepEqual(
    selectActionableIssues(issues).map(issue => issue.id),
    ['legacy-child'],
  );
});

test('a parent stays a summary when its children are outside the visible filter', () => {
  const hierarchyIssues = [
    { id: 'parent', projectId: 'p1', priority: 'high' },
    { id: 'child', projectId: 'p1', parentIssueId: 'parent', priority: 'low' },
  ];

  assert.deepEqual(
    selectActionableIssues([hierarchyIssues[0]], hierarchyIssues),
    [],
  );
});

test('orphan and cross-project parent pointers remain visible as actionable work', () => {
  const issues = [
    { id: 'orphan', projectId: 'p1', parentIssueId: 'missing' },
    { id: 'foreign-parent', projectId: 'p2' },
    { id: 'cross-project-child', projectId: 'p1', parentIssueId: 'foreign-parent' },
  ];
  const index = buildIssueAccountingIndex(issues);

  assert.deepEqual(
    selectActionableIssues(issues).map(issue => issue.id),
    ['orphan', 'foreign-parent', 'cross-project-child'],
  );
  assert.deepEqual([...index.orphanIssueIds].sort(), ['cross-project-child', 'orphan']);
});

test('nested legacy hierarchy counts only the deepest leaves and derives parent progress separately', () => {
  const issues = [
    { id: 'root', projectId: 'p1', columnId: 'in-progress' },
    { id: 'middle', projectId: 'p1', parentIssueId: 'root', columnId: 'done' },
    { id: 'done-leaf', projectId: 'p1', parentIssueId: 'middle', columnId: 'done' },
    { id: 'open-leaf', projectId: 'p1', parentIssueId: 'middle', columnId: 'to-do' },
  ];

  assert.deepEqual(
    selectActionableIssues(issues).map(issue => issue.id),
    ['done-leaf', 'open-leaf'],
  );
  const progress = buildParentIssueProgress(issues, ['done']);
  assert.deepEqual(
    progress.map(item => ({
      issueId: item.issueId,
      childIds: item.childIds.sort(),
      done: item.done,
      total: item.total,
      percent: item.percent,
    })),
    [
      {
        issueId: 'root',
        childIds: ['done-leaf', 'open-leaf'],
        done: 1,
        total: 2,
        percent: 50,
      },
      {
        issueId: 'middle',
        childIds: ['done-leaf', 'open-leaf'],
        done: 1,
        total: 2,
        percent: 50,
      },
    ],
  );
});

test('cyclic legacy pointers are ignored so tasks do not vanish from accounting', () => {
  const issues = [
    { id: 'a', projectId: 'p1', parentIssueId: 'b' },
    { id: 'b', projectId: 'p1', parentIssueId: 'a' },
  ];
  const index = buildIssueAccountingIndex(issues);

  assert.deepEqual(selectActionableIssues(issues).map(issue => issue.id), ['a', 'b']);
  assert.deepEqual([...index.cycleIssueIds].sort(), ['a', 'b']);
});

test('raw time is counted once and task aggregates retain unique source log IDs', () => {
  const logs = [
    { id: 'log-1', issueId: 'task', userId: 'u1', spentMinutes: 30 },
    { id: 'log-1', issueId: 'task', userId: 'u1', spentMinutes: 30 },
    { id: 'log-2', issueId: 'task', userId: 'u2', spentMinutes: 45 },
    {
      id: 'event-log',
      sourceType: 'calendar_event',
      eventId: 'event',
      issueId: 'task',
      spentMinutes: 20,
    },
    { id: 'negative-log', issueId: 'task', userId: 'u1', spentMinutes: -500 },
    { id: 'fractional-log', issueId: 'task', userId: 'u1', spentMinutes: 1.5 },
    { id: 'huge-log', issueId: 'task', userId: 'u1', spentMinutes: 525_601 },
  ];

  assert.equal(sumRawTimeLogMinutes(logs), 95);
  assert.deepEqual(aggregateIssueTimeLogs(logs), {
    task: {
      totalMinutes: 75,
      byUser: { u1: 30, u2: 45 },
      logIds: ['log-1', 'log-2'],
    },
  });
});

test('legacy invoice keys block ambiguous historical work from being billed twice', () => {
  const overlap = findInvoiceTimeLogOverlap(
    [
      { id: 'task-1', issueKey: 'QUI-1' },
      { id: 'task-2', issueKey: 'QUI-2' },
    ],
    {
      'task-1': { totalMinutes: 30, logIds: ['new-log-1'] },
      'task-2': { totalMinutes: 30, logIds: ['new-log-2'] },
    },
    [{
      status: 'draft',
      items: [{ key: 'QUI-1', title: 'Historical task' }],
    }],
  );

  assert.deepEqual(overlap, {
    byItemId: { 'task-1': [] },
    itemIds: ['task-1'],
    logIds: [],
    sourceItemIds: ['task-1'],
  });
});

test('a zero-rate actual log never falls through to an estimate charge', () => {
  const price = calculateBillingAutoPrice({
    issue: { estimateMinutes: 240, assigneeIds: ['u1'] },
    logSummary: { totalMinutes: 60, byUser: { u1: 60 } },
    rates: { u1: 0 },
  });

  assert.equal(price, 0);
});

test('an actionable task falls back to estimate only when it has no actual time', () => {
  const price = calculateBillingAutoPrice({
    issue: { estimateMinutes: 120, assigneeIds: ['u1'] },
    logSummary: { totalMinutes: 0, byUser: {} },
    rates: { u1: 50 },
  });

  assert.equal(price, 100);
});

test('a parent estimate is never billable, while its own actual log is', () => {
  const issues = [
    { id: 'parent', projectId: 'p1', estimateMinutes: 600, assigneeIds: ['u1'] },
    { id: 'child', projectId: 'p1', parentIssueId: 'parent', estimateMinutes: 60 },
  ];
  const withoutParentLogs = {
    child: { totalMinutes: 0, byUser: {}, logIds: [] },
  };
  assert.deepEqual(
    selectBillableIssues(issues, withoutParentLogs).map(issue => issue.id),
    ['child'],
  );
  assert.equal(calculateBillingAutoPrice({
    issue: issues[0],
    logSummary: { totalMinutes: 0, byUser: {} },
    rates: { u1: 100 },
    isSummaryParent: true,
  }), 0);

  const withParentLogs = {
    ...withoutParentLogs,
    parent: { totalMinutes: 30, byUser: { u1: 30 }, logIds: ['parent-log'] },
  };
  assert.deepEqual(
    selectBillableIssues(issues, withParentLogs).map(issue => issue.id),
    ['parent', 'child'],
  );
  assert.equal(calculateBillingAutoPrice({
    issue: issues[0],
    logSummary: withParentLogs.parent,
    rates: { u1: 100 },
    isSummaryParent: true,
  }), 50);
  assert.deepEqual(
    collectSourceTimeLogIds(issues, withParentLogs),
    ['parent-log'],
  );
});

test('a task reappears after billing only when it receives new unbilled actual time', () => {
  const issues = [
    { id: 'actual-task', projectId: 'p1', estimateMinutes: 120 },
    { id: 'estimate-only', projectId: 'p1', estimateMinutes: 60 },
  ];
  const allLogs = {
    'actual-task': {
      totalMinutes: 90,
      byUser: { u1: 90 },
      logIds: ['billed-log', 'new-log'],
    },
  };

  assert.deepEqual(
    selectIncrementalBillableIssues(issues, {}, allLogs).map(issue => issue.id),
    ['estimate-only'],
  );
  assert.deepEqual(
    selectIncrementalBillableIssues(issues, {
      'actual-task': {
        totalMinutes: 30,
        byUser: { u1: 30 },
        logIds: ['new-log'],
      },
    }, allLogs).map(issue => issue.id),
    ['actual-task', 'estimate-only'],
  );
});

test('saved invoices reserve raw logs and source-less estimate positions', () => {
  const items = [
    { id: 'actual-task' },
    { id: 'estimated-task', estimateMinutes: 60 },
  ];
  const timeLogsByItem = {
    'actual-task': {
      totalMinutes: 30,
      byUser: { u1: 30 },
      logIds: ['log-1', 'log-2'],
    },
    'estimated-task': {
      totalMinutes: 0,
      byUser: {},
      logIds: [],
    },
  };
  const invoices = [{
    status: 'draft',
    items: [
      { itemId: 'actual-task', sourceTimeLogIds: ['log-1'] },
      { itemId: 'estimated-task', sourceTimeLogIds: [] },
    ],
  }];

  assert.deepEqual(
    [...collectReservedInvoiceTimeLogIds(invoices)],
    ['log-1'],
  );
  assert.deepEqual(
    [...collectReservedInvoiceItemIds(invoices)],
    ['estimated-task'],
  );
  assert.deepEqual(
    findInvoiceTimeLogOverlap(items, timeLogsByItem, invoices),
    {
      byItemId: { 'actual-task': ['log-1'], 'estimated-task': [] },
      itemIds: ['actual-task', 'estimated-task'],
      logIds: ['log-1'],
      sourceItemIds: ['estimated-task'],
    },
  );
});

test('cancelled invoices release their source logs for billing again', () => {
  const overlap = findInvoiceTimeLogOverlap(
    [{ id: 'task' }],
    { task: { totalMinutes: 30, byUser: { u1: 30 }, logIds: ['log-1'] } },
    [{ status: 'cancelled', sourceTimeLogIds: ['log-1'] }],
  );

  assert.deepEqual(overlap, {
    byItemId: {},
    itemIds: [],
    logIds: [],
    sourceItemIds: [],
  });
});
