import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { memberMayDeleteStoragePath } from '../src/lib/utils/uploadPaths.mjs';

// The Cloudinary delete route asked only «member of this tenant?», so a plain
// member could destroy the workspace's logo by naming the public id every page
// carries. The logo is the one asset under the prefix that belongs to the
// workspace rather than to somebody's work; everything else is where a
// member's own files go, avatars included, and stays theirs to remove.
test('a plain member deletes their work’s files and never the workspace logo', async () => {
  const route = await readFile(new URL('../src/app/api/upload/delete/route.js', import.meta.url), 'utf8');
  assert.match(route, /!isPrivilegedRole\(membership\.role\) && !memberMayDeleteStoragePath\(storagePath\)/);
  // A Cloudinary public id carries no extension, and the safe-path rule admits
  // no dot — the same alphabet the upload signer accepts.
  assert.ok(memberMayDeleteStoragePath('quickteam/organizations/org_1/attachments/1725000000000_scan'));
  assert.ok(memberMayDeleteStoragePath('quickteam/organizations/org_1/chat/1725000000000_photo'));
  assert.ok(memberMayDeleteStoragePath('quickteam/organizations/org_1/ai-calls/1725000000000_call'));
  assert.ok(memberMayDeleteStoragePath('quickteam/organizations/org_1/avatars/1725000000000_me'));
  assert.ok(!memberMayDeleteStoragePath('quickteam/organizations/org_1/logos/1725000000000_logo'));
  assert.ok(!memberMayDeleteStoragePath('quickteam/organizations/org_1/logos'));
  assert.ok(!memberMayDeleteStoragePath('../quickteam/organizations/org_1/attachments/x'));
});
