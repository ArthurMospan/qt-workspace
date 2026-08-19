// Cancelling a task: the third action, and the only one that takes work out of
// the record as well as out of the way. What is covered here is the difference
// between it and the archive, because that difference is the only reason both
// exist — and it is a difference that lives in whether a number counts a task,
// which nothing on screen would show until a report is read.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CANCEL_FIELDS,
  cancelledIssuesOf,
  isCancelledIssue,
  withoutCancelledIssues,
} from '../src/lib/utils/issueCancel.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('a cancelled task is the one carrying cancelledAt', () => {
  assert.equal(isCancelledIssue({ cancelledAt: new Date() }), true);
  assert.equal(isCancelledIssue({ cancelledAt: null }), false);
  assert.equal(isCancelledIssue({}), false);
  assert.equal(isCancelledIssue(null), false);

  const issues = [{ id: 'a' }, { id: 'b', cancelledAt: new Date() }];
  assert.deepEqual(withoutCancelledIssues(issues).map(i => i.id), ['a']);
  assert.deepEqual(cancelledIssuesOf(issues).map(i => i.id), ['b']);
  assert.deepEqual([...CANCEL_FIELDS], ['cancelledAt', 'cancelledBy']);
});

test('cancelling is its own action, beside archiving and deleting', async () => {
  const [registry, bar, detail, route] = await Promise.all([
    read('../src/lib/bulk/issueBulkActions.mjs'),
    read('../src/components/ui/TaskManagement/BulkActionBar.jsx'),
    read('../src/components/workspace/IssueDetail.jsx'),
    read('../src/app/api/issues/bulk/route.js'),
  ]);
  assert.match(registry, /id: 'cancel'[^}]*permission: 'edit:issue'/);
  // Routed to its own endpoint — not into the archive's, which would leave the
  // task in every report it was supposed to leave.
  assert.match(route, /actionId === 'cancel'[\s\S]{0,400}\/cancel/);
  // Offered on the task itself next to the other two, and taken back from
  // there too.
  assert.match(detail, /label: 'Скасувати', icon: Ban/);
  assert.match(detail, /label: 'Повернути завдання', icon: Undo2/);
  assert.match(bar, /label: `Скасувати \(\$\{count\}\)`/);
});

test('the difference between the two is stated where the choice is made', async () => {
  const [bar, detail, settings] = await Promise.all([
    read('../src/components/ui/TaskManagement/BulkActionBar.jsx'),
    read('../src/components/workspace/IssueDetail.jsx'),
    read('../src/app/(app)/settings/page.js'),
  ]);
  // Archiving keeps the work in the record — the sentence people actually need,
  // because "it disappears" is what stops them using the archive at all.
  assert.match(detail, /Записаний час нікуди не дінеться/);
  assert.match(bar, /У звітах, таймшиті та рахунках вони лишаються/);
  // Cancelling does not, and says so in the same breath as the way back.
  assert.match(detail, /з усього обліку/);
  assert.match(detail, /Якщо робота відбулася і просто завершена — архівуйте/);
  assert.match(bar, /Якщо робота відбулася — архівуйте/);
  // And the archive screen says which list means which.
  assert.match(settings, /Архівоване лишається у звітах і рахунках, скасоване не рахується ніде/);
});

test('the cancelled state is written by the server, never by the browser', async () => {
  const [rules, route] = await Promise.all([
    read('../firestore.rules'),
    read('../src/app/api/issues/[issueId]/cancel/route.js'),
  ]);
  assert.match(rules, /'cancelledAt',\s*\n\s*'cancelledBy'/);
  assert.match(route, /rolesFor\('edit:issue'\)/);
  assert.match(route, /projectWriteError\(/);
  assert.match(route, /action: cancelled \? 'cancelled' : 'uncancelled'/);
  // Asking for the state a task is already in is a retry, not an error.
  assert.match(route, /if \(Boolean\(current\.cancelledAt\) === cancelled\)/);
});

test('work already fixed into an invoice cannot be cancelled out of the record', async () => {
  const route = await read('../src/app/api/issues/[issueId]/cancel/route.js');
  // The same two guards deletion has. Cancelling billed work would leave the
  // invoice standing and quietly stop counting the hours behind it, so the two
  // would disagree with nothing on screen having changed.
  assert.match(route, /ISSUE_HAS_INVOICE_ESTIMATE/);
  assert.match(route, /ISSUE_HAS_BILLED_TIME/);
  assert.match(route, /isBilledTimeLog\(data\)/);
  // Both name the way out, which is the other action.
  assert.match(route, /Його можна архівувати, але не скасувати/);
  // Un-cancelling is never blocked by them: taking a task back into the record
  // cannot make an invoice wrong.
  assert.match(route, /if \(cancelled\) \{\s*\n\s*if \(estimateReservationSnap\.exists\)/);
});

test('a cancelled task leaves every set the numbers are built from', async () => {
  const [issues, analytics, myTasks, home, candidates, search] = await Promise.all([
    read('../src/lib/hooks/useIssues.js'),
    read('../src/lib/hooks/useWorkspaceAnalytics.js'),
    read('../src/lib/hooks/useAllMyTasks.js'),
    read('../src/app/(app)/page.js'),
    read('../src/lib/utils/reminderCandidates.mjs'),
    read('../src/app/api/search/route.js'),
  ]);
  // Filtered at every source, so that no reader downstream — a board, a chart,
  // an invoice — has to know that cancelling exists.
  assert.match(issues, /withoutCancelledIssues\(withoutArchivedIssues\(docs\)\)/);
  assert.match(myTasks, /withoutCancelledIssues\(/);
  assert.match(home, /withoutCancelledIssues\(/);
  assert.match(candidates, /isCancelledIssue\(issue\)/);
  assert.match(search, /!isCancelledIssue\(item\.data\(\)\)/);
  // Including the record: `allIssues` is what the timesheet and the invoice
  // read, and cancelled work is not part of what happened either.
  assert.match(analytics, /const record = useMemo\(\(\) => withoutCancelledIssues\(allIssues\)/);
  assert.match(analytics, /const issues = useMemo\(\(\) => withoutArchivedIssues\(record\)/);
});

test('«Архів» lists the cancelled ones and hands them back', async () => {
  const settings = await read('../src/app/(app)/settings/page.js');
  assert.match(settings, /\{ id: 'cancelled', label: 'Скасовані', count: cancelledIssueList\.length \}/);
  assert.match(settings, /setIssueCancelled\(issue\.id, false\)/);
  // The stream starts only when one of the task tabs is open — the archive
  // shares the workspace's read budget with everything else.
  assert.match(settings, /archiveTab === 'issues' \|\| archiveTab === 'cancelled'/);
  // Both task lists are the same row, so they cannot drift apart.
  assert.match(settings, /function ArchiveIssueRows\(/);
});
