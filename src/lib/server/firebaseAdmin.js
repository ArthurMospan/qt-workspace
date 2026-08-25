import 'server-only';

import {
  cert,
  getApp,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  FieldPath,
  FieldValue,
  Timestamp,
  getFirestore,
} from 'firebase-admin/firestore';
import { createHash, timingSafeEqual } from 'node:crypto';
import { isRejectedIdTokenError } from '@/lib/utils/firebaseAuthError.mjs';

function getAdminApp() {
  if (getApps().length) return getApp();

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId) throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID is not configured');

  const options = { projectId };
  if (clientEmail && privateKey) {
    options.credential = cert({ projectId, clientEmail, privateKey });
  }

  return initializeApp(options);
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export async function authenticateRequest(request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    console.error('[auth] Missing bearer token', {
      hasAuthorizationHeader: Boolean(authorization),
      scheme: authorization.split(' ', 1)[0] || '',
    });
    return { error: 'Unauthorized', status: 401 };
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    console.error('[auth] Empty bearer token');
    return { error: 'Unauthorized', status: 401 };
  }

  try {
    return { user: await getAdminAuth().verifyIdToken(token, true) };
  } catch (error) {
    const firebaseCode = error?.code || '';
    const tokenWasRejected = isRejectedIdTokenError(error);
    // Never log the bearer token. The Firebase error code is enough to tell an
    // actually expired/revoked session from an Admin SDK credential or project
    // mismatch, which otherwise collapses into the same user-facing 401.
    console.error('[auth] Firebase ID token rejected', {
      code: firebaseCode || 'unknown',
      name: error?.name || error?.constructor?.name || 'Error',
      message: typeof error?.message === 'string'
        ? error.message.slice(0, 240)
        : '',
      causeCode: error?.cause?.code || '',
      expectedProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    });
    if (tokenWasRejected) {
      return {
        error: 'Invalid or expired token',
        status: 401,
        code: firebaseCode,
      };
    }
    return {
      error: 'Authentication service is temporarily unavailable',
      status: 503,
      code: 'AUTH_SERVICE_UNAVAILABLE',
    };
  }
}

export async function authorizeOrgRequest(request, organizationId, allowedRoles = []) {
  const authResult = await authenticateRequest(request);
  if (authResult.error) return authResult;
  if (!organizationId) return { error: 'Organization is required', status: 400 };

  const membershipId = `${organizationId}_${authResult.user.uid}`;
  const membershipSnap = await getAdminDb().collection('orgMemberships').doc(membershipId).get();
  if (!membershipSnap.exists) return { error: 'Forbidden', status: 403 };

  const membership = membershipSnap.data();
  if (
    membership.orgId !== organizationId ||
    membership.userId !== authResult.user.uid ||
    (allowedRoles.length > 0 && !allowedRoles.includes(membership.role))
  ) {
    return { error: 'Forbidden', status: 403 };
  }

  return { user: authResult.user, membership };
}

export async function getOrganizationApiKeys(organizationId, legacyOrgData = null) {
  const privateSnap = await getAdminDb()
    .collection('organizations').doc(organizationId)
    .collection('private').doc('apiKeys').get();
  if (privateSnap.exists) return privateSnap.data().keys || [];
  return legacyOrgData?.apiKeys || [];
}

export function hashApiKey(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function isValidApiKey(keys, token) {
  if (!token || !Array.isArray(keys)) return false;
  const candidate = Buffer.from(hashApiKey(token), 'hex');
  return keys.some(key => {
    if (key.active === false) return false;
    // Temporary compatibility for legacy keys until the private-key migration runs.
    if (key.token) return key.token === token;
    if (!key.tokenHash) return false;
    const expected = Buffer.from(key.tokenHash, 'hex');
    return expected.length === candidate.length && timingSafeEqual(expected, candidate);
  });
}

export async function enforceRateLimit(scope, subject, limit, windowSeconds) {
  const id = `${scope}_${createHash('sha256').update(String(subject)).digest('hex').slice(0, 32)}`;
  const ref = getAdminDb().collection('serverRateLimits').doc(id);
  const now = Date.now();
  return getAdminDb().runTransaction(async transaction => {
    const snap = await transaction.get(ref);
    const data = snap.exists ? snap.data() : null;
    const resetAt = data?.resetAt?.toMillis?.() ?? 0;
    if (!data || resetAt <= now) {
      transaction.set(ref, {
        count: 1,
        resetAt: Timestamp.fromMillis(now + windowSeconds * 1000),
      });
      return true;
    }
    if ((data.count || 0) >= limit) return false;
    transaction.update(ref, { count: FieldValue.increment(1) });
    return true;
  });
}

export { FieldPath, FieldValue, Timestamp };
