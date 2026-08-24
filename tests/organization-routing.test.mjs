import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  organizationLoadErrorKind,
  organizationLoadRetryDelay,
  shouldRetryOrganizationLoad,
} from '../src/lib/utils/organizationLoadErrors.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('each browser tab owns its organization selection and keeps it in the URL', async () => {
  const [context, onboarding, guard] = await Promise.all([
    read('../src/lib/context/OrgContext.js'),
    read('../src/app/onboarding/page.js'),
    read('../src/components/WorkspaceOrganizationRouteGuard.jsx'),
  ]);

  assert.match(context, /sessionStorage\.setItem\(TAB_STORAGE_KEY, orgId\)/);
  assert.match(context, /sessionStorage\.getItem\(TAB_STORAGE_KEY\)/);
  assert.doesNotMatch(context, /localStorage\.(?:getItem|setItem)\(TAB_STORAGE_KEY/);
  assert.match(context, /window\.history\.replaceState\(null, '', scoped\)/);
  assert.match(onboarding, /sessionStorage\.setItem\('qt_active_org_id', orgId\)/);
  assert.doesNotMatch(onboarding, /localStorage\.setItem\('qt_active_org_id'/);
  assert.match(guard, /withNotificationOrganization\(current, activeOrgId\)/);
});

test('project and issue routes derive organization scope from the project resource', async () => {
  const [access, projectPage, issuePage, projectClient] = await Promise.all([
    read('../src/lib/server/workspaceProjectAccess.js'),
    read('../src/app/(app)/[projectId]/page.js'),
    read('../src/app/(app)/[projectId]/issue/[issueId]/page.js'),
    read('../src/app/(app)/[projectId]/ProjectBoardClient.jsx'),
  ]);

  assert.match(access, /collection\('projects'\)\.doc\(cleanProjectId\)\.get\(\)/);
  assert.match(access, /if \(!projectSnapshot\.exists\) notFound\(\)/);
  assert.match(access, /doc\(`\$\{organizationId\}_\$\{user\.uid\}`\)/);
  assert.match(access, /if \(!privileged && !onProjectTeam\) notFound\(\)/);
  for (const route of [projectPage, issuePage]) {
    assert.match(route, /readWorkspaceProjectAccess\(projectId\)/);
    assert.match(route, /query\?\.org !== access\.organizationId/);
    assert.match(route, /redirect\(withNotificationOrganization/);
  }
  assert.match(projectClient, /resourceOrganizationId !== activeOrgId/);
  assert.match(projectClient, /switchOrg\(resourceOrganizationId\)/);
  assert.match(projectClient, /if \(!project\)/);
});

test('a denied read is retried before it is called a loss of access', async () => {
  assert.equal(organizationLoadErrorKind({ code: 'permission-denied' }), 'permission-denied');
  assert.equal(organizationLoadErrorKind({ code: 'not-found' }), 'not-found');
  assert.equal(organizationLoadErrorKind({ code: 'unavailable' }), 'retryable');
  // Signing out and back in swaps the credential under listeners that are
  // already attached, and the first snapshot across that swap comes back
  // denied. Believing it on sight put a person who had just logged in on
  // «Немає доступу до організації», so the denial is retried on the same
  // bounded budget as a network failure. An organization that is genuinely
  // gone is still terminal — nothing is going to make it reappear.
  assert.equal(shouldRetryOrganizationLoad({ code: 'permission-denied' }), true);
  assert.equal(shouldRetryOrganizationLoad({ code: 'unavailable' }), true);
  assert.equal(shouldRetryOrganizationLoad({ code: 'not-found' }), false);
  assert.deepEqual([1, 2, 3].map(organizationLoadRetryDelay), [250, 750, 1_500]);

  const [context, layout, issueDetail] = await Promise.all([
    read('../src/lib/context/OrgContext.js'),
    read('../src/app/(app)/layout.js'),
    read('../src/components/workspace/IssueDetail.jsx'),
  ]);
  assert.match(context, /retryAttempt < ORG_LOAD_RETRY_LIMIT/);
  assert.match(context, /window\.setTimeout\(subscribe, organizationLoadRetryDelay\(retryAttempt\)\)/);
  // The retry goes back out with a token that belongs to the account that is
  // signed in now, not the one that was rejected.
  assert.match(context, /auth\.currentUser\?\.getIdToken\(true\)/);
  // And the card that survives all of that still offers a way off itself.
  assert.match(layout, /accessFailure \? \([\s\S]*Увійти іншим акаунтом/);
  assert.match(issueDetail, /!issueAccessFailure && \([\s\S]*Спробувати ще раз/);
});

// A stale membership snapshot must not be able to hide a workspace.
//
// The handler is async: it takes a snapshot of `orgMemberships` and then goes
// back to Firestore for the organization documents. Snapshots arrive in pairs —
// Firestore's persistent cache answers first, the server a moment later — and
// the two need not agree, because a browser whose cache never held one of the
// memberships emits the shorter list first. Both fetches were then in flight at
// once and whichever returned last won, so a cached snapshot that lost the race
// by a millisecond removed a workspace the person owns from the switcher, and
// it stayed removed until a membership changed. Reloading was a coin toss, and
// another account with a cold cache looked perfectly healthy.
//
// Snapshots are numbered in arrival order, and only the newest may publish —
// which makes the server's answer authoritative by construction, since it
// always arrives after the cache's.
test('an organization list published late cannot overwrite a newer one', async () => {
  const context = await read('../src/lib/context/OrgContext.js');

  assert.match(context, /let snapshotSequence = 0;/);
  assert.match(context, /snapshotSequence \+= 1;\s*\n\s*const sequence = snapshotSequence;/);
  assert.match(context, /const current = \(\) => !cancelled && sequence === snapshotSequence;/);
  // The publish is guarded, not merely the unmount.
  assert.match(context, /if \(!current\(\)\) return;\s*\n\s*setOrgError\(null\);\s*\n\s*setAllOrgs\(orgs\);/);

  // The list itself is still built from memberships alone — access is
  // `orgMemberships` and nothing else — so the guard protects the right thing.
  assert.match(context, /collection\(db, 'orgMemberships'\),\s*\n\s*where\('userId', '==', uid\)/);
});
