import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('deactivating a member closes their access and leaves their work alone', async () => {
  const [route, archive, hook] = await Promise.all([
    read('../src/app/api/organizations/[organizationId]/members/[memberId]/route.js'),
    read('../src/lib/server/orgMembership.js'),
    read('../src/lib/hooks/useOrganization.js'),
  ]);

  // Access is closed in the two places that grant it, and nowhere else.
  assert.match(route, /where\('team', 'array-contains', memberId\)/);
  assert.match(route, /team: FieldValue\.arrayRemove\(memberId\)/);
  assert.match(route, /transaction\.delete\(membershipRef\)/);
  assert.match(route, /MEMBERSHIP_ARCHIVE/);
  assert.match(route, /memberDirectoryVersion: FieldValue\.increment\(1\)/);

  // The record of what the person did is not access and is never rewritten.
  // These two writes are what turned "remove from team" into a quiet edit of
  // every task they had ever been assigned or had been watching.
  assert.doesNotMatch(route, /assigneeIds: FieldValue\.arrayRemove/);
  assert.doesNotMatch(route, /watcherIds = FieldValue\.arrayRemove/);

  // Leaving needs no privilege; taking someone else's access away does.
  assert.match(route, /const leavingSelf = memberId === authorization\.user\.uid/);
  assert.match(route, /!leavingSelf && !can\(authorization\.membership\?\.role, 'deactivate:member'\)/);
  assert.match(route, /role === 'owner'/);

  // Coming back restores the seat rather than creating a new one.
  assert.match(archive, /transaction\.delete\(archiveRef\)/);
  assert.match(archive, /arrayUnion\(userId\)/);

  assert.doesNotMatch(hook, /updateDoc\(membershipRef/);
  assert.doesNotMatch(hook, /deleteDoc\(membershipRef/);
  assert.match(hook, /removeOrganizationMember\(activeOrgId, uid\)/);
});

test('an administrator may change a role, and only the owner seat is off limits', async () => {
  const [route, dialog] = await Promise.all([
    read('../src/app/api/organizations/[organizationId]/members/[memberId]/route.js'),
    read('../src/components/TeamMemberSettingsDialog.jsx'),
  ]);
  assert.match(route, /authorizeOrgRequest\(request, organizationId, \['owner', 'admin'\]\)/);
  assert.doesNotMatch(route, /Only the owner can change member roles/);
  assert.match(route, /action === 'role' && membership\.role === 'owner'/);
  assert.match(route, /memberId === authorization\.user\.uid/);
  assert.match(dialog, /canChangeRole = isAdmin && !isMe && member\.role !== 'owner'/);
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
