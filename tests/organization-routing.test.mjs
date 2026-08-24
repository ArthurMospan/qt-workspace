import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  organizationLoadErrorKind,
  organizationLoadRetryDelay,
  shouldRetryOrganizationLoad,
} from '../src/lib/utils/organizationLoadErrors.mjs';
import {
  buildOrganizationList,
  createMembershipSnapshotGate,
  organizationMembershipSignature,
  parseOrganizationDirectory,
} from '../src/lib/utils/organizationList.mjs';

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
// Snapshots are numbered inside their source class, and a server snapshot has
// priority over every cached one. Arrival order alone cannot establish that:
// a delayed cache callback is still cache even when it happens to arrive last.
test('an organization list published late cannot overwrite a newer one', async () => {
  const context = await read('../src/lib/context/OrgContext.js');

  const gate = createMembershipSnapshotGate();
  const cachedFirst = gate.begin(false);
  const serverSecond = gate.begin(true);
  assert.equal(cachedFirst.isCurrent(), false);
  assert.equal(serverSecond.isCurrent(), true);

  // Arrival after a server read started cannot make a cache result authoritative.
  assert.equal(gate.begin(false), null);

  // Two real server refreshes can race too; the newest one wins among equals.
  const newerServer = gate.begin(true);
  assert.equal(serverSecond.isCurrent(), false);
  assert.equal(newerServer.isCurrent(), true);

  assert.match(context, /const membershipSnapshotGate = createMembershipSnapshotGate\(\);/);
  assert.match(context, /const snapshotTicket = membershipSnapshotGate\.begin\(authoritative\);/);
  assert.match(context, /const current = \(\) => !cancelled && snapshotTicket\.isCurrent\(\);/);
  // The publish is guarded, not merely the unmount.
  assert.match(
    context,
    /if \(!current\(\)\) return;\s*\n\s*if \(authoritative\) hasVerifiedDirectory = true;\s*\n\s*publishedOrgs = organizations;\s*\n\s*setOrgError\(null\);\s*\n\s*setAllOrgs\(organizations\);/,
  );

  // The list itself is still built from memberships alone — access is
  // `orgMemberships` and nothing else — so the guard protects the right thing.
  assert.match(context, /collection\(db, 'orgMemberships'\),\s*\n\s*where\('userId', '==', uid\)/);
});

// Ordering was only half of it. The list was assembled out of the organization
// documents, so however the reads were sequenced, a read that came back short
// deleted a workspace — and `getDocs` comes back short without failing whenever
// the SDK believes it is offline and answers from a cache that never held the
// document. Nothing re-runs until a membership changes, so the workspace stayed
// gone. A membership is the proof a workspace exists; the document only names
// it.
test('a workspace survives an organization document that did not come back', () => {
  const memberships = [
    { orgId: 'org-one', userId: 'u', role: 'owner' },
    { orgId: 'org-two', userId: 'u', role: 'member' },
  ];

  const { organizations, roles } = buildOrganizationList(
    memberships,
    [{ id: 'org-two', name: 'Друга' }],
  );

  assert.deepEqual(organizations.map(organization => organization.id), ['org-one', 'org-two']);
  assert.equal(organizations[0].pending, true);
  assert.equal(organizations[1].name, 'Друга');
  // The role is the membership's own, so it is known even for the entry whose
  // document is missing — that is what the switcher prints under the name.
  assert.deepEqual(roles, { 'org-one': 'owner', 'org-two': 'member' });
});

test('an entry whose document is missing keeps the name it already had', () => {
  const memberships = [{ orgId: 'org-one', role: 'owner' }];
  const known = [{ id: 'org-one', name: 'OneB', logo: 'https://example.test/logo.png' }];

  const { organizations } = buildOrganizationList(memberships, [], known);

  assert.equal(organizations[0].name, 'OneB');
  assert.equal(organizations[0].logo, 'https://example.test/logo.png');
  assert.notEqual(organizations[0].pending, true);

  // A document that did come back is the fresher of the two.
  const refreshed = buildOrganizationList(memberships, [{ id: 'org-one', name: 'OneB Ltd' }], known);
  assert.equal(refreshed.organizations[0].name, 'OneB Ltd');
});

test('a membership names its workspace once, whatever the snapshot holds', () => {
  const { organizations, roles } = buildOrganizationList(
    [
      { orgId: 'org-one', role: 'owner' },
      { orgId: 'org-one', role: 'owner' },
      { role: 'member' },
      null,
    ],
    [{ id: 'org-one', name: 'OneB' }, { id: 'org-ghost', name: 'Не наша' }],
  );

  // Deduplicated, and an organization no membership names is not a workspace of
  // this person's however it got into the read.
  assert.deepEqual(organizations.map(organization => organization.id), ['org-one']);
  assert.deepEqual(roles, { 'org-one': 'owner' });
});

test('membership signatures ignore snapshot order but notice access changes', () => {
  const memberships = [
    { orgId: 'org-two', role: 'member' },
    { orgId: 'org-one', role: 'owner' },
  ];

  assert.equal(
    organizationMembershipSignature(memberships),
    organizationMembershipSignature([...memberships].reverse()),
  );
  assert.notEqual(
    organizationMembershipSignature(memberships),
    organizationMembershipSignature([
      { orgId: 'org-two', role: 'admin' },
      { orgId: 'org-one', role: 'owner' },
    ]),
  );
});

test('only a valid server directory may replace the visible organization list', () => {
  assert.deepEqual(
    parseOrganizationDirectory({
      memberships: [{ orgId: 'org-one', role: 'owner' }],
      organizations: [{ id: 'org-one', name: 'OneB' }],
    }),
    {
      memberships: [{ orgId: 'org-one', role: 'owner' }],
      organizations: [{ id: 'org-one', name: 'OneB' }],
    },
  );
  assert.throws(
    () => parseOrganizationDirectory({ memberships: [], organizations: null }),
    error => error?.code === 'invalid-organization-directory',
  );
  assert.throws(
    () => parseOrganizationDirectory({ memberships: [{ role: 'owner' }], organizations: [] }),
    error => error?.code === 'invalid-organization-directory',
  );
});

test('no memberships is the only thing that means no workspace', () => {
  const { organizations, roles } = buildOrganizationList([], []);
  assert.deepEqual(organizations, []);
  assert.deepEqual(roles, {});
});

test('a short organizations read is asked again, of the server', async () => {
  const [context, layout] = await Promise.all([
    read('../src/lib/context/OrgContext.js'),
    read('../src/app/(app)/layout.js'),
  ]);

  // The list is the memberships', and the documents only decorate it.
  assert.match(context, /buildOrganizationList\(memberships, documents, publishedOrgs\)/);
  // Whatever the cache failed to supply is requested from the server, and the
  // request being unreachable does not shorten the list either.
  assert.match(context, /const missing = orgIds\.filter\(orgId => !found\.has\(orgId\)\);/);
  assert.match(context, /documents\.concat\(await readOrganizationsById\(missing, true\)\)/);
  assert.match(context, /fromServer \? getDocsFromServer\(request\) : getDocs\(request\)/);
  // «Створіть організацію» follows only from a server-confirmed empty
  // membership list, never from an empty cache.
  assert.match(context, /if \(organizations\.length === 0\) \{[\s\S]*if \(!authoritative\) \{[\s\S]*setNoOrg\(true\);/);
  // And an entry still waiting for its document does not read as un-onboarded.
  assert.match(layout, /if \(activeOrg\.pending\) return;/);
});

test('every browser membership list is verified through the independent server directory', async () => {
  const [context, route] = await Promise.all([
    read('../src/lib/context/OrgContext.js'),
    read('../src/app/api/organizations/route.js'),
  ]);

  // A browser-SDK query can complete successfully while its persistent target
  // is short. The Admin SDK directory is therefore unconditional and primary,
  // rather than a fallback that only runs after getDocsFromServer throws.
  assert.match(context, /refreshOrganizationDirectory\(\);/);
  assert.match(context, /authenticatedRequest\(\s*'\/api\/organizations',\s*\{ cache: 'no-store', signal: controller\.signal \}/);
  assert.doesNotMatch(context, /getDocsFromServer\(membershipsQuery\)/);
  assert.match(context, /window\.addEventListener\('focus', refreshOnFocus\)/);
  assert.match(context, /window\.addEventListener\('online', refreshOnFocus\)/);
  assert.match(context, /directoryAbortController\?\.abort\(\)/);
  assert.doesNotMatch(context, /ORG_DIRECTORY_REFRESH_MS|membershipServerRefreshInterval/);
  assert.match(context, /const verified = parseOrganizationDirectory\(directory\);/);

  // A stuck Firestore client has an independent recovery channel through the
  // authenticated app server. The token supplies the uid; a caller cannot ask
  // this route for somebody else's directory.
  assert.match(route, /const authorization = await authenticateRequest\(request\);/);
  assert.match(route, /\.where\('userId', '==', uid\)/);
  assert.doesNotMatch(route, /searchParams|request\.json\(/);
  assert.match(route, /'Cache-Control': 'private, no-store, max-age=0'/);

  // Cache results remain useful for a fast first paint, but only a server result
  // can prove that zero memberships really means zero workspaces.
  assert.match(context, /return applyMembershipDocuments\(memberships, false\);/);
  assert.doesNotMatch(context, /authoritative = !memSnap\.metadata\?\.fromCache/);
  assert.match(context, /const snapshotTicket = membershipSnapshotGate\.begin\(authoritative\);\s*if \(!snapshotTicket\) return;/);
  assert.match(context, /if \(!authoritative\) \{\s*setNoOrg\(false\);\s*setOrgLoading\(true\);\s*return;/);
  assert.match(context, /\{ includeMetadataChanges: true \}/);
});

test('switching to a server-recovered organization does not erase its verified role from a short cache', async () => {
  const context = await read('../src/lib/context/OrgContext.js');

  assert.match(context, /applyOrg\(target, orgRoles\[orgId\]\)/);
  assert.doesNotMatch(context, /const memSnap = await getDoc/);
  assert.match(context, /if \(snap\.exists\(\)\) setOrgRole\(snap\.data\(\)\.role\);\s*else if \(!snap\.metadata\.fromCache\) setOrgRole\(null\);/);
});

test('the obsolete client-side organization bootstrap is gone', async () => {
  const hook = await read('../src/lib/hooks/useOrganization.js');

  assert.doesNotMatch(hook, /initOrg/);
  assert.doesNotMatch(hook, /getDoc\(membershipRef\)/);
  assert.doesNotMatch(hook, /setDoc\(membershipRef/);
});

// The owner seat is written when the organization is created. Rewriting it on
// every onboarding was meant to be harmless, but roles and removals are
// server-owned: the rules refuse every client write to a membership that
// already exists, and a merge write onto an existing document is one of those.
// Onboarding an organization that already had its seat failed on that no-op,
// after the organization itself had already been saved.
//
// Asking whether the document is there first would swap that failure for a
// worse one: the read rule tests `resource.data.userId`, so on a membership
// that does not exist yet the answer is a denial rather than an empty snapshot,
// and the failure would move to the new-organization path everybody takes.
// Which case we are in is already known — a new organization is the one whose
// id was minted a few lines above.
test('onboarding writes the owner membership only for an organization it just made', async () => {
  const onboarding = await read('../src/app/onboarding/page.js');

  assert.match(onboarding, /const isFreshOrganization = isNewOrg \|\| !activeOrgId;/);
  assert.match(onboarding, /const orgId = isFreshOrganization \? `org_\$\{uid\?\.slice\(0, 8\)\}_\$\{Date\.now\(\)\}` : activeOrgId;/);
  assert.match(onboarding, /if \(isFreshOrganization\) \{\s*\n\s*await setDoc\(doc\(db, 'orgMemberships'/);
  // Created outright, never merged onto whatever is there, and never read first.
  assert.doesNotMatch(onboarding, /'orgMemberships'[\s\S]{0,400}\{ merge: true \}/);
  assert.doesNotMatch(onboarding, /getDoc\(/);
});
