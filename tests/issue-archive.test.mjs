import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  archivedIssuesOf,
  isArchivedIssue,
  withoutArchivedIssues,
} from '../src/lib/utils/issueArchive.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('an archived task is the one carrying archivedAt', () => {
  assert.equal(isArchivedIssue({ archivedAt: new Date() }), true);
  assert.equal(isArchivedIssue({ archivedAt: null }), false);
  assert.equal(isArchivedIssue({}), false);
  assert.equal(isArchivedIssue(null), false);

  const issues = [{ id: 'a' }, { id: 'b', archivedAt: new Date() }];
  assert.deepEqual(withoutArchivedIssues(issues).map(i => i.id), ['a']);
  assert.deepEqual(archivedIssuesOf(issues).map(i => i.id), ['b']);
});

test('archiving and deleting are two actions, not one wearing two names', async () => {
  const [registry, bar, route] = await Promise.all([
    read('../src/lib/bulk/issueBulkActions.mjs'),
    read('../src/components/ui/TaskManagement/BulkActionBar.jsx'),
    read('../src/app/api/issues/bulk/route.js'),
  ]);
  // The archive action must not be routed into the deletion endpoint again.
  assert.match(route, /actionId === 'archive'[\s\S]{0,400}\/archive/);
  assert.match(route, /actionId === 'delete'[\s\S]{0,400}'DELETE'/);
  assert.match(registry, /id: 'archive'[^}]*permission: 'edit:issue'/);
  assert.match(registry, /id: 'delete'[^}]*permission: 'delete:issue'/);
  // The confirmations have to say which of the two is about to happen.
  assert.match(bar, /лишаться в «Архіві» — без строку/);
  assert.match(bar, /«Нещодавно видалене»/);
});

test('the archive state is written by the server, never by the browser', async () => {
  const [rules, route] = await Promise.all([
    read('../firestore.rules'),
    read('../src/app/api/issues/[issueId]/archive/route.js'),
  ]);
  assert.match(rules, /'archivedAt',\s*\n\s*'archivedBy'/);
  // Whoever may edit in the project may archive there; scope is re-checked
  // against the project document the transaction itself read.
  assert.match(route, /\['owner', 'admin', 'member'\]/);
  assert.match(route, /projectWriteError\(/);
  assert.match(route, /action: archived \? 'archived' : 'unarchived'/);
});

test('archived tasks leave the working lists but keep their own link', async () => {
  const [issues, analytics, myTasks, detail, home] = await Promise.all([
    read('../src/lib/hooks/useIssues.js'),
    read('../src/lib/hooks/useWorkspaceAnalytics.js'),
    read('../src/lib/hooks/useAllMyTasks.js'),
    read('../src/components/workspace/IssueDetail.jsx'),
    read('../src/app/(app)/page.js'),
  ]);
  assert.match(issues, /includeArchived \? docs : withoutArchivedIssues\(docs\)/);
  assert.match(myTasks, /withoutArchivedIssues\(flattenDocumentBuckets\(issueBuckets\)\)/);
  // The home screen rolls its own subscription, so it needs the rule by hand or
  // a project's progress bar counts work nobody is doing.
  assert.match(home, /setAllIssues\(withoutArchivedIssues\(flattenDocumentBuckets\(buckets\)\)\)/);
  // The detail is the one reader that asks for them, so «Архів» can open a
  // task and put it back instead of showing "not found".
  assert.match(detail, /useIssues\(projectId, \{ includeLinks: false, includeArchived: true \}\)/);
  // …but its own pickers must not offer one as a parent or a link target.
  assert.match(detail, /const parentCandidates = withoutArchivedIssues\(issues\)/);
  assert.match(detail, /const availableLinkIssues = withoutArchivedIssues\(issues\)/);

  // One subscription, two readings: the working set for what is open, the whole
  // record for what was done.
  assert.match(analytics, /const issues = useMemo\(\(\) => withoutArchivedIssues\(allIssues\)/);
  assert.match(analytics, /return \{ issues, allIssues, timeLogs, issueLinks, loading \};/);
});

test('an archived task keeps its hours in the timesheet and on the invoice', async () => {
  const [page, timesheet, workload] = await Promise.all([
    read('../src/app/(app)/analytics/page.js'),
    read('../src/components/workspace/TimesheetTab.jsx'),
    read('../src/components/workspace/WorkloadTab.jsx'),
  ]);
  // Money first: an hour recorded against a task somebody later archived is
  // still an hour that was worked, and dropping it would bill less than was done.
  assert.match(page, /const billingIssues = allIssues\.filter/);
  // The timesheet has to be able to name the task an old entry belongs to.
  assert.match(page, /<TimesheetTab\s+issues=\{filteredIssuesWithArchived\}/);
  assert.match(page, /logIssues=\{filteredIssuesWithArchived\}/);
  // …while new time is still booked only against tasks that are in use.
  assert.match(timesheet, /const projectIssues = useMemo\(\s*[\s\S]{0,80}withoutArchivedIssues\(issues\)/);
  // Hierarchy maths stays on the working set: an archived child must not turn
  // its parent into a summary row and hide the parent's own work.
  assert.match(workload, /logIssues = hierarchyIssues,/);
  assert.match(workload, /referenceIssues: logIssues,/);
});

test('nothing chases people about a task that was put aside', async () => {
  const [candidates, jobs, search] = await Promise.all([
    read('../src/lib/utils/reminderCandidates.mjs'),
    read('../src/lib/server/reminderJobs.js'),
    read('../src/app/api/search/route.js'),
  ]);
  assert.match(candidates, /if \(isArchivedIssue\(issue\)\) continue;/);
  // The projection has to carry the field, or every archived task reads as active.
  assert.match(jobs, /'archivedAt',/);
  assert.match(search, /\.filter\(item => !isArchivedIssue\(item\.data\(\)\)\)/);
  assert.match(search, /'dueDate', 'archivedAt'/);
});

test('the trash list never hands a tombstone snapshot to the browser', async () => {
  const route = await read('../src/app/api/issues/trash/route.js');
  assert.match(route, /canRestoreIssueTombstone\(tombstone\)/);
  assert.match(route, /hasProjectAccess\(projectById\.get\(tombstone\.projectId\), role, uid\)/);
  // The response is built field by field; the stored `issue` record itself,
  // which holds the whole task, must not be spread into it.
  assert.doesNotMatch(route, /\.\.\.tombstone\.issue/);
  assert.doesNotMatch(route, /issue: tombstone\.issue/);
});

test('«Кошик» is gone from what a person reads', async () => {
  const [help, settings, restore] = await Promise.all([
    read('../src/lib/content/helpArticles.mjs'),
    read('../src/app/(app)/settings/page.js'),
    read('../src/app/api/issues/[issueId]/restore/route.js'),
  ]);
  for (const [name, source] of [['help', help], ['settings', settings], ['restore', restore]]) {
    assert.doesNotMatch(source, /кошик/i, `${name} still says "кошик"`);
  }
  assert.match(settings, /Нещодавно видалене/);
});
