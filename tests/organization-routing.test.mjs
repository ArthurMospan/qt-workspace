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

test('access failures are terminal while network failures retry with backoff', async () => {
  assert.equal(organizationLoadErrorKind({ code: 'permission-denied' }), 'permission-denied');
  assert.equal(organizationLoadErrorKind({ code: 'not-found' }), 'not-found');
  assert.equal(organizationLoadErrorKind({ code: 'unavailable' }), 'retryable');
  assert.equal(shouldRetryOrganizationLoad({ code: 'permission-denied' }), false);
  assert.equal(shouldRetryOrganizationLoad({ code: 'unavailable' }), true);
  assert.deepEqual([1, 2, 3].map(organizationLoadRetryDelay), [250, 750, 1_500]);

  const [context, layout, issueDetail] = await Promise.all([
    read('../src/lib/context/OrgContext.js'),
    read('../src/app/(app)/layout.js'),
    read('../src/components/workspace/IssueDetail.jsx'),
  ]);
  assert.match(context, /retryAttempt < ORG_LOAD_RETRY_LIMIT/);
  assert.match(context, /window\.setTimeout\(subscribe, organizationLoadRetryDelay\(retryAttempt\)\)/);
  assert.match(layout, /!accessFailure && \([\s\S]*Спробувати ще раз/);
  assert.match(issueDetail, /!issueAccessFailure && \([\s\S]*Спробувати ще раз/);
});
