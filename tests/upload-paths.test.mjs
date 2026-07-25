import test from 'node:test';
import assert from 'node:assert/strict';

// These are the checks standing between one tenant and another tenant's files:
// /api/upload/delete derives the owning organization from the path alone, so a
// caller can never widen their own scope by naming a different organizationId.
import {
  isSafeStoragePath,
  isSafeUploadFolder,
  organizationIdFromPath,
} from '../src/lib/utils/uploadPaths.mjs';

test('the organization is read out of the storage path, never from the caller', () => {
  assert.equal(
    organizationIdFromPath('quickteam/organizations/org-a/attachments/1699_file'),
    'org-a',
  );
  assert.equal(organizationIdFromPath('quickteam/organizations/org-a'), 'org-a');
  assert.equal(organizationIdFromPath('quickteam/organizations/org-a/chat/x'), 'org-a');
});

test('paths that prove no ownership yield no organization', () => {
  // Legacy, non-scoped uploads: the delete route refuses these outright rather
  // than letting anyone claim them.
  for (const path of [
    'quickteam/avatars/1699_face',
    'quickteam/chat/attachments/1699_file',
    'organizations/org-a/attachments/x',
    '',
    null,
    undefined,
  ]) {
    assert.equal(organizationIdFromPath(path), '', String(path));
  }
});

test('a traversal or injected segment cannot smuggle in another tenant', () => {
  // The id segment is a single path component; anything with a separator or an
  // unexpected character fails the whole match instead of matching a prefix.
  assert.equal(organizationIdFromPath('quickteam/organizations/../../etc/passwd'), '');
  assert.equal(organizationIdFromPath('quickteam/organizations/org-a$evil/attachments/x'), '');
  assert.equal(organizationIdFromPath('evil/quickteam/organizations/org-a/x'), '');
  // A different tenant's id is reported as that tenant, so the membership check
  // is the thing that rejects it — not a silent match on the caller's own org.
  assert.equal(organizationIdFromPath('quickteam/organizations/org-b/attachments/x'), 'org-b');
});

test('upload folders must live under the app namespace', () => {
  assert.equal(isSafeUploadFolder('quickteam/organizations/org-a/attachments'), true);
  assert.equal(isSafeUploadFolder('quickteam/avatars'), true);
  assert.equal(isSafeUploadFolder('other-app/organizations/org-a'), false);
  assert.equal(isSafeUploadFolder('quickteam/../other'), false);
  assert.equal(isSafeUploadFolder(''), false);
  assert.equal(isSafeUploadFolder(null), false);
});

test('storage paths are validated before reaching the delete API', () => {
  assert.equal(isSafeStoragePath('quickteam/organizations/org-a/attachments/1699_f'), true);
  assert.equal(isSafeStoragePath('quickteam/' + 'a'.repeat(400)), false);
  assert.equal(isSafeStoragePath('../../secrets'), false);
  assert.equal(isSafeStoragePath('quickteam/a b'), false);
  assert.equal(isSafeStoragePath(42), false);
});
