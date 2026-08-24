import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

// "Nothing was asked" is not "nothing was found".
//
// Every data hook here had the same shape: when the organization, the uid or
// the project list had not arrived yet it cleared its state and reported
// `loading: false`. On a page refresh those arrive a beat after the first
// render, so for that beat the screens read the empty result as an answer —
// «Задачу не знайдено» on the task page, «Подію не знайдено» on the calendar,
// «Немає доступу до організації» on a notification link. Frightening, and
// false. While the context is still resolving, the honest answer is a spinner.
test('a hook that has not subscribed yet reports loading, not emptiness', async () => {
  const cases = [
    ['../src/lib/hooks/useIssues.js', /const stillResolving = authLoading \|\| orgLoading \|\| !currentUserId \|\| !activeOrgId;/],
    ['../src/lib/hooks/useCalendarEvents.js', /setLoading\(Boolean\(authLoading \|\| orgLoading\)\);/],
    // Two subscriptions, two flags: the task set and the windowed time logs
    // move on different clocks, and `loading` is their union.
    ['../src/lib/hooks/useWorkspaceAnalytics.js', /setIssuesLoading\(Boolean\(authLoading \|\| orgLoading\)\);/],
    ['../src/lib/hooks/useAllMyTasks.js', /setLoading\(Boolean\(authLoading \|\| orgLoading \|\| projectsLoading\)\);/],
  ];
  for (const [file, pattern] of cases) {
    const source = await read(file);
    assert.match(source, pattern, file);
    // And the flags are read from the context rather than assumed.
    assert.match(source, /authLoading/, file);
    assert.match(source, /orgLoading/, file);
  }
});

test('useIssues only finishes empty when there is genuinely no project', async () => {
  const source = await read('../src/lib/hooks/useIssues.js');
  assert.match(source, /setLoading\(Boolean\(projectId\) && stillResolving\);/);
  // The resolution flags have to be in the dependency list, or the hook never
  // re-runs when they flip.
  assert.match(
    source,
    /\}, \[projectId, activeOrgId, includeLinks, includeSetAside, currentUserId, authLoading, orgLoading\]\);/,
  );
});

test('an unloaded membership list is not treated as a denied organization', async () => {
  const guard = await read('../src/components/WorkspaceOrganizationRouteGuard.jsx');
  assert.match(guard, /if \(orgLoading \|\| allOrgs\.length === 0\) return <LoadingScreen \/>;/);
  // The denial still exists — it just cannot be reached before the answer is in.
  const denial = '<h1 className="ui-type-section-title text-ink mb-2">Немає доступу до організації</h1>';
  assert.ok(guard.includes(denial));
  assert.ok(
    guard.indexOf('if (orgLoading || allOrgs.length === 0)') < guard.indexOf(denial),
    'the loading guard must come before the denial',
  );
});

test('the member page waits for the member list before saying "not found"', async () => {
  const page = await read('../src/app/(app)/analytics/team/[memberId]/page.js');
  assert.match(page, /loading: membersLoading/);
  assert.match(page, /if \(!urlReady \|\| loading \|\| calendarLoading \|\| membersLoading\)/);
});
