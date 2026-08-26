import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existingParentIssueId } from '../src/lib/utils/issueHierarchyModel.mjs';
import { myTaskChildScopes, mergeMyTaskChildren } from '../src/lib/utils/myTaskChildren.mjs';

const scope = { organizationId: 'org', userId: 'me', projectIds: ['project'] };
const task = (id, extra = {}) => ({
  id, organizationId: 'org', projectId: 'project', assigneeIds: ['me'], status: 'planned', ...extra,
});
const parent = task('parent');
const childrenOf = issues => issues.filter(issue => existingParentIssueId(issue) === parent.id);
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

for (const [label, assigneeIds] of [['unassigned', []], ['another person', ['other']], ['me', ['me']]]) {
  test(`My Tasks counts both children when the second is assigned to ${label}`, () => {
    const records = [parent,
      task('child-a', { parentIssueId: parent.id }),
      task('child-b', { parentIssueId: parent.id, assigneeIds, status: 'finished' }),
    ];
    const personalTasks = records.filter(issue => issue.assigneeIds.includes('me'));
    const scopes = myTaskChildScopes(personalTasks, scope);
    // Emulate the exact per-project child queries, without an assignee filter.
    const childResults = scopes.flatMap(query => records.filter(issue => (
      issue.organizationId === query.organizationId && issue.projectId === query.projectId
      && query.parentIds.includes(issue[query.field])
    )));
    const context = mergeMyTaskChildren(personalTasks, childResults, scopes);
    assert.deepEqual(childrenOf(context).map(issue => issue.id).sort(), ['child-a', 'child-b']);
    assert.equal(childrenOf(context).filter(issue => issue.status === 'finished').length, 1);
    // Related children are context, not extra cards in the personal list.
    assert.equal(personalTasks.length, assigneeIds.includes('me') ? 3 : 2);
  });
}

test('canonical and legacy children are merged once and canonical parentage wins', () => {
  const mine = task('mine', { parentIssueId: parent.id, status: 'finished' });
  const scopes = myTaskChildScopes([parent, mine], scope);
  const context = mergeMyTaskChildren([parent, mine], [
    { ...mine, status: 'planned' },
    { ...mine, status: 'planned' },
    task('legacy', { parentEpicId: parent.id, assigneeIds: [] }),
    task('reparented', { parentIssueId: 'another-parent', parentEpicId: parent.id }),
    task('detached', { parentIssueId: null, parentEpicId: parent.id }),
  ], scopes);
  assert.deepEqual(childrenOf(context).map(issue => issue.id).sort(), ['legacy', 'mine']);
  assert.equal(context.find(issue => issue.id === 'mine').status, 'finished');
});

test('child context excludes archived, cancelled, unrelated and out-of-scope records', () => {
  const scopes = myTaskChildScopes([parent], scope);
  const context = mergeMyTaskChildren([parent], [
    task('active', { parentIssueId: parent.id, assigneeIds: [] }),
    task('archived', { parentIssueId: parent.id, archivedAt: 1 }),
    task('cancelled', { parentIssueId: parent.id, cancelledAt: 1 }),
    task('other-org', { parentIssueId: parent.id, organizationId: 'other' }),
    task('other-project', { parentIssueId: parent.id, projectId: 'other' }),
    task('unrelated', { parentIssueId: 'other' }),
  ], scopes);
  assert.deepEqual(context.map(issue => issue.id).sort(), ['active', 'parent']);
  assert.deepEqual(mergeMyTaskChildren([parent], context, []), []);
});

test('child queries stay project-scoped, bounded and stable across reorder/status updates', () => {
  const tasks = Array.from({ length: 23 }, (_, i) => task(`task-${i}`));
  const scopes = myTaskChildScopes(tasks, scope);
  assert.equal(scopes.length, 6); // Three batches, canonical + legacy per batch.
  assert.ok(scopes.every(query => query.parentIds.length <= 10 && query.parentIds.length > 0));
  assert.ok(scopes.every(query => query.organizationId === 'org' && query.projectId === 'project'));
  assert.deepEqual(myTaskChildScopes([...tasks].reverse().map(issue => ({ ...issue, status: 'finished' })), scope), scopes);
  assert.deepEqual(myTaskChildScopes([...tasks, tasks[0]], scope), scopes);
  for (const options of [
    { ...scope, userId: 'other' }, { ...scope, organizationId: 'other' },
    { ...scope, projectIds: [] }, { ...scope, userId: null },
  ]) assert.deepEqual(myTaskChildScopes(tasks, options), []);
  assert.deepEqual(myTaskChildScopes([task('hidden', { archivedAt: 1 }), task('cancelled', { cancelledAt: 1 })], scope), []);
});

test('the personal query stays filtered while the card receives complete child context', async () => {
  const [hook, page, card] = await Promise.all([
    read('src/lib/hooks/useAllMyTasks.js'),
    read('src/app/(app)/my/page.js'),
    read('src/components/workspace/IssueCard.jsx'),
  ]);
  assert.match(hook, /where\('assigneeIds', 'array-contains', userId\)/);
  assert.match(hook, /where\('organizationId', '==', scope.organizationId\)/);
  assert.match(hook, /where\('projectId', '==', scope.projectId\)/);
  assert.match(hook, /where\(scope.field, 'in', scope.parentIds\)/);
  assert.match(hook, /useOptimisticPatch\(contextIssues\)/);
  assert.match(hook, /loading: loading \|\| myTaskOrderLoading \|\| childrenLoading/);
  assert.match(hook, /error: error \|\| childrenError/);
  assert.match(page, /issues=\{filtered\}\s+allIssues=\{allIssues\}/);
  assert.match(card, /const contextIssues = allIssues \|\| issues/);
});

test('team analytics calls its total unique tasks, not a sum of member rows', async () => {
  const [workload, help] = await Promise.all([
    read('src/components/workspace/WorkloadTab.jsx'),
    read('src/lib/content/helpArticles.mjs'),
  ]);
  assert.match(workload, /sub="унікальні задачі"/);
  assert.doesNotMatch(workload, /сума по учасниках/);
  assert.match(help, /спільна задача враховується в кожного/);
  assert.match(help, /незалежно від того, кому вони призначені/);
});
