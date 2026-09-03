// Pure path rules for uploaded assets. Kept free of 'server-only' and
// firebase-admin so they stay unit-testable — the Firestore membership lookup
// that uses them lives in src/lib/server/uploadPaths.js.
//
// Every asset this app uploads lives under `quickteam/`, and everything that
// can later be deleted lives under `quickteam/organizations/{orgId}/…`.
// Keeping the organization in the path is what makes ownership provable on
// delete: without it, any signed-in user could destroy any other tenant's
// files just by naming their public_id.
export const UPLOAD_ROOT = 'quickteam';

const ORGANIZATION_FOLDER = /^quickteam\/organizations\/([A-Za-z0-9_-]{1,128})(?:\/[A-Za-z0-9/_-]{1,160})?$/;
const SAFE_FOLDER = /^quickteam\/[A-Za-z0-9/_-]{1,180}$/;
const SAFE_PUBLIC_ID = /^quickteam\/[A-Za-z0-9/_-]{1,220}$/;

// The organization a folder or public_id belongs to, or '' when the path is
// not organization-scoped (legacy uploads, shared avatars).
export function organizationIdFromPath(path) {
  if (typeof path !== 'string') return '';
  return ORGANIZATION_FOLDER.exec(path)?.[1] || '';
}

export function isSafeUploadFolder(folder) {
  return typeof folder === 'string' && SAFE_FOLDER.test(folder);
}

export function isSafeStoragePath(storagePath) {
  return typeof storagePath === 'string' && SAFE_PUBLIC_ID.test(storagePath);
}

export function isOrganizationChatStoragePath(path, organizationId = '') {
  if (!isSafeStoragePath(path)) return false;
  const pathOrganizationId = organizationIdFromPath(path);
  if (!pathOrganizationId || (organizationId && pathOrganizationId !== organizationId)) return false;
  return path.startsWith(`quickteam/organizations/${pathOrganizationId}/chat/`);
}

// What a plain member may remove. The organization's logo is the one asset
// under the prefix that belongs to the workspace rather than to somebody's
// work: it is set by an owner or admin, and «member of the tenant» was enough
// to destroy it. Everything else — attachments, replies, chat files, call
// recordings, avatars — is where a member's own files go.
const MEMBER_UNTOUCHABLE_FOLDER = /^quickteam\/organizations\/[A-Za-z0-9_-]{1,128}\/logos(\/|$)/;

export function memberMayDeleteStoragePath(storagePath) {
  return isSafeStoragePath(storagePath) && !MEMBER_UNTOUCHABLE_FOLDER.test(storagePath);
}

export function isOrganizationChatUploadFolder(folder, organizationId = '') {
  if (!isSafeUploadFolder(folder)) return false;
  const pathOrganizationId = organizationIdFromPath(folder);
  if (!pathOrganizationId || (organizationId && pathOrganizationId !== organizationId)) return false;
  return folder === `quickteam/organizations/${pathOrganizationId}/chat`;
}
