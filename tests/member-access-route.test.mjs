import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('member mutations use the authenticated server route and cascade stale access', async () => {
  const [route, hook] = await Promise.all([
    read('../src/app/api/organizations/[organizationId]/members/[memberId]/route.js'),
    read('../src/lib/hooks/useOrganization.js'),
  ]);

  assert.match(route, /authorizeOrgRequest\(request, organizationId, \['owner', 'admin'\]\)/);
  assert.match(route, /where\('team', 'array-contains', memberId\)/);
  assert.match(route, /where\('assigneeIds', 'array-contains', memberId\)/);
  assert.match(route, /where\('watcherIds', 'array-contains', memberId\)/);
  assert.match(route, /team: FieldValue\.arrayRemove\(memberId\)/);
  assert.match(route, /assigneeIds: FieldValue\.arrayRemove\(memberId\)/);
  assert.match(route, /watcherIds = FieldValue\.arrayRemove\(memberId\)/);
  assert.match(route, /removalPending: true/);
  assert.match(route, /transaction\.delete\(membershipRef\)/);
  assert.match(route, /memberDirectoryVersion: FieldValue\.increment\(1\)/);
  assert.doesNotMatch(hook, /updateDoc\(membershipRef/);
  assert.doesNotMatch(hook, /deleteDoc\(membershipRef/);
  assert.match(hook, /removeOrganizationMember\(activeOrgId, uid\)/);
});

test('removal confirmation reports the current project impact before deleting', async () => {
  const settings = await read('../src/app/(app)/settings/page.js');
  assert.match(settings, /await getMemberRemovalImpact\(uid\)/);
  assert.match(settings, /Кількість проєктів[^`]*\$\{impact\.projectCount\}/);
  assert.match(settings, /await removeMember\(uid\)/);
});

test('rates are served from protected paths and never persisted in public browser cache', async () => {
  const [membersRoute, memberService, workflowRoute, workflowService, positions] = await Promise.all([
    read('../src/app/api/organizations/[organizationId]/members/route.js'),
    read('../src/lib/services/members.js'),
    read('../src/app/api/organizations/[organizationId]/workflow/route.js'),
    read('../src/lib/services/workflow.js'),
    import('../src/lib/utils/workflowPositions.mjs'),
  ]);

  assert.match(membersRoute, /collection\('memberRates'\)/);
  assert.match(membersRoute, /canViewBilling/);
  assert.match(memberService, /members\.map\(\(\{ hourlyRate, \.\.\.member \}\) => member\)/);
  assert.match(workflowRoute, /collection\('private'\)[\s\S]{0,120}doc\('workflowRates'\)/);
  assert.match(workflowRoute, /canViewBilling[\s\S]{0,180}publicWorkflow\(workflow\)/);
  assert.match(workflowService, /fetchWorkflowViaApi/);
  assert.ok(positions.DEFAULT_WORKFLOW_POSITIONS.every(position => !('hourlyRate' in position)));
});

test('ownership transfer changes both memberships and the organization atomically', async () => {
  const [route, dialog] = await Promise.all([
    read('../src/app/api/organizations/[organizationId]/route.js'),
    read('../src/components/TeamMemberSettingsDialog.jsx'),
  ]);
  assert.match(route, /authorizeOrgRequest\(request, organizationId, \['owner'\]\)/);
  assert.match(route, /await db\.runTransaction/);
  assert.match(route, /transaction\.update\(currentRef, \{ role: 'admin'/);
  assert.match(route, /transaction\.update\(targetRef, \{ role: 'owner'/);
  assert.match(route, /ownerId: targetUserId/);
  assert.match(route, /targetSnap\.data\(\)\.removalPending === true/);
  assert.match(dialog, /member\.role !== 'owner'/);
});

test('the one-time migration is explicit, dry-run by default and idempotent', async () => {
  const migration = await read('../scripts/migrate-member-access.mjs');
  assert.match(migration, /const APPLY = process\.argv\.includes\('--apply'\)/);
  assert.match(migration, /--confirm-project/);
  assert.match(migration, /--confirm-organization/);
  assert.match(migration, /--confirm-writes-frozen/);
  assert.match(migration, /FieldValue\.arrayRemove/);
  assert.match(migration, /hourlyRate: FieldValue\.delete\(\)/);
});
