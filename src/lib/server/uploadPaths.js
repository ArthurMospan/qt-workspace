import 'server-only';

import { getAdminDb } from '@/lib/server/firebaseAdmin';

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

// Membership check that does not require the caller to name the organization:
// it is read out of the path they are acting on, so they can never widen their
// own scope by passing a different organizationId.
export async function callerBelongsToPathOrganization(uid, organizationId) {
  if (!uid || !organizationId) return false;
  const snapshot = await getAdminDb()
    .collection('orgMemberships').doc(`${organizationId}_${uid}`).get();
  if (!snapshot.exists) return false;
  const membership = snapshot.data();
  return membership.orgId === organizationId && membership.userId === uid;
}
