import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { admin, getAdminAuth, getAdminDb } from '@/lib/server/firebaseAdmin';
import {
  getOauthTokenCookieOptions,
  OAUTH_CUSTOM_TOKEN_COOKIE,
} from '@/lib/server/oauthTokenCookie';
import { getSafeAuthRedirect } from '@/lib/utils/authRedirect';
import { normalizeEmail } from '@/lib/server/emailOtp';

const ONEB_API_URI = (process.env.ONEB_API_URI || 'https://account.oneb.app/s/').replace(/\/?$/, '/');
const ONEB_SYNTHETIC_EMAIL_DOMAIN = 'oneb.quickteam.app';

function redirectWithError(origin, error) {
  const loginUrl = new URL('/login', origin);
  loginUrl.searchParams.set('error', error);
  return NextResponse.redirect(loginUrl);
}

function parseRedirect(stateRaw) {
  if (!stateRaw) return '/workspace';
  const candidates = [stateRaw];
  try {
    const decoded = decodeURIComponent(stateRaw);
    if (decoded !== stateRaw) candidates.push(decoded);
  } catch {}

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return getSafeAuthRedirect(parsed?.r, '/workspace');
    } catch {}
  }
  return '/workspace';
}

function onebHash(accountId) {
  return createHash('sha256').update(String(accountId)).digest('hex');
}

function onebUid(accountId) {
  return `oneb_${onebHash(accountId).slice(0, 48)}`;
}

function syntheticOneBEmail(accountId) {
  return `oneb_${onebHash(accountId).slice(0, 32)}@${ONEB_SYNTHETIC_EMAIL_DOMAIN}`;
}

function isSyntheticOneBEmail(email) {
  return typeof email === 'string' && email.endsWith(`@${ONEB_SYNTHETIC_EMAIL_DOMAIN}`);
}

async function getOrCreateOneBUser(profile, resolvedEmail) {
  const auth = getAdminAuth();
  const db = getAdminDb();
  const displayName = profile.name || profile.alias || 'OneB User';
  const photoURL = normalizeUrl(profile.photoUrl);

  const onebProfileSnap = await db.collection('users')
    .where('onebId', '==', profile.accountId)
    .limit(1)
    .get();
  if (!onebProfileSnap.empty) {
    const uid = onebProfileSnap.docs[0].id;
    let userRecord;
    try {
      userRecord = await auth.getUser(uid);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
      userRecord = await auth.createUser({
        uid,
        email: resolvedEmail,
        emailVerified: true,
        displayName,
        ...(photoURL ? { photoURL } : {}),
      });
    }
    return updateOneBUser(userRecord, profile, resolvedEmail, displayName, photoURL);
  }

  const normalizedRealEmail = normalizeEmail(profile.email);
  if (normalizedRealEmail) {
    try {
      const userRecord = await auth.getUserByEmail(normalizedRealEmail);
      if (userRecord.disabled) throw new Error('Firebase user is disabled');
      return updateOneBUser(userRecord, profile, normalizedRealEmail, displayName, photoURL);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
    }
  }

  const uid = onebUid(profile.accountId);
  try {
    const userRecord = await auth.getUser(uid);
    if (userRecord.disabled) throw new Error('Firebase user is disabled');
    return updateOneBUser(userRecord, profile, resolvedEmail, displayName, photoURL);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
  }

  const created = await auth.createUser({
    uid,
    email: resolvedEmail,
    emailVerified: true,
    displayName,
    ...(photoURL ? { photoURL } : {}),
  });
  return updateOneBUser(created, profile, resolvedEmail, displayName, photoURL);
}

async function updateOneBUser(userRecord, profile, resolvedEmail, displayName, photoURL) {
  const auth = getAdminAuth();
  const update = {
    emailVerified: true,
    displayName,
  };
  if (photoURL) update.photoURL = photoURL;
  if (
    resolvedEmail &&
    userRecord.email !== resolvedEmail &&
    (!userRecord.email || !isSyntheticOneBEmail(resolvedEmail))
  ) {
    update.email = resolvedEmail;
  }

  let nextUserRecord = userRecord;
  try {
    nextUserRecord = await auth.updateUser(userRecord.uid, update);
  } catch (error) {
    if (error.code !== 'auth/email-already-exists') throw error;
    delete update.email;
    nextUserRecord = await auth.updateUser(userRecord.uid, update);
  }

  await auth.setCustomUserClaims(nextUserRecord.uid, {
    ...(nextUserRecord.customClaims || {}),
    oneb_id: profile.accountId,
    oneb_connected: true,
  });

  const userRef = getAdminDb().collection('users').doc(nextUserRecord.uid);
  const userSnap = await userRef.get();
  const nowIso = new Date().toISOString();
  const profileData = {
    id: nextUserRecord.uid,
    name: displayName,
    email: nextUserRecord.email || resolvedEmail,
    avatar: photoURL || nextUserRecord.photoURL || `https://i.pravatar.cc/150?u=${nextUserRecord.uid}`,
    photoURL: photoURL || nextUserRecord.photoURL || null,
    onebId: profile.accountId,
    onebConnected: true,
    onebAlias: profile.alias ?? null,
    onebWorkspace: profile.workspace ?? null,
    onebWorkspaceId: profile.tenantId ?? null,
    authProvider: 'oneb',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (!userSnap.exists) {
    profileData.role = 'user';
    profileData.createdAt = nowIso;
    profileData.lastActive = nowIso;
  }
  await userRef.set(profileData, { merge: true });

  return nextUserRecord;
}

function normalizeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function GET(request) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const redirectTo = parseRedirect(searchParams.get('state') || '');

  if (!code) return redirectWithError(origin, 'oneb_no_code');

  const clientId = process.env.NEXT_PUBLIC_ONEB_CLIENT_ID;
  const clientSecret = process.env.ONEB_CLIENT_SECRET;
  const redirectUri = `${origin}/oauth2/result`;

  if (!clientId || clientId === 'dummy_client_id') {
    console.error('[OneB] NEXT_PUBLIC_ONEB_CLIENT_ID is not configured');
    return redirectWithError(origin, 'oneb_no_client_id');
  }
  if (!clientSecret) {
    console.error('[OneB] ONEB_CLIENT_SECRET is not configured');
    return redirectWithError(origin, 'oneb_no_client_secret');
  }

  try {
    const tokenRes = await fetch(`${ONEB_API_URI}token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      console.error('[OneB] Token exchange failed:', await tokenRes.text());
      return redirectWithError(origin, 'oneb_token');
    }

    const tokenData = await tokenRes.json();
    const profileRes = await fetch(`${ONEB_API_URI}auth/v1/user-details`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
      console.error('[OneB] Profile fetch failed:', await profileRes.text());
      return redirectWithError(origin, 'oneb_profile');
    }

    const profile = await profileRes.json();
    if (!profile.accountId) {
      return redirectWithError(origin, 'oneb_no_account');
    }

    const resolvedEmail = normalizeEmail(profile.email) || syntheticOneBEmail(profile.accountId);
    const userRecord = await getOrCreateOneBUser(profile, resolvedEmail);
    const customToken = await getAdminAuth().createCustomToken(userRecord.uid, {
      auth_provider: 'oneb',
    });

    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('oneb', 'success');
    loginUrl.searchParams.set('next', redirectTo);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(
      OAUTH_CUSTOM_TOKEN_COOKIE,
      customToken,
      getOauthTokenCookieOptions()
    );
    return response;
  } catch (error) {
    console.error('[OneB] Unexpected error:', error);
    return redirectWithError(origin, 'oneb_unexpected');
  }
}
