// The devices this account is signed in on.
//
// The browser cannot see where a request came from and it cannot end another
// device's session, so both belong here. Recording a session is a server write
// because the place comes from the hosting platform's headers; ending one is a
// server action because only the Admin SDK can revoke a refresh token.
//
// Reading is deliberately *not* here: `users/{uid}/settings/sessions` is already
// readable by its own owner and by nobody else, so the panel reads the document
// directly and this route stays two verbs long.

import { NextResponse } from 'next/server';
import {
  authenticateRequest,
  enforceRateLimit,
  FieldValue,
  getAdminAuth,
  getAdminDb,
} from '@/lib/server/firebaseAdmin';
import { readJsonBody, routeErrorResponse } from '@/lib/server/apiErrors';
import {
  describeDevice,
  describePlace,
  expiredSessionIds,
  isSessionId,
} from '@/lib/utils/accountSessions.mjs';

function sessionsRef(db, uid) {
  return db.collection('users').doc(uid).collection('settings').doc('sessions');
}

export async function POST(request) {
  try {
    const authorization = await authenticateRequest(request);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    const uid = authorization.user.uid;
    const body = await readJsonBody(request);
    if (!isSessionId(body.sessionId)) {
      return NextResponse.json({ error: 'Невідомий сеанс' }, { status: 400 });
    }

    const db = getAdminDb();
    const reference = sessionsRef(db, uid);
    const userAgent = request.headers.get('user-agent') || '';
    const place = describePlace({
      city: request.headers.get('x-vercel-ip-city'),
      region: request.headers.get('x-vercel-ip-country-region'),
      country: request.headers.get('x-vercel-ip-country'),
    });
    const existing = (await reference.get()).data() || {};
    const known = existing[body.sessionId];

    await reference.set({
      [body.sessionId]: {
        device: describeDevice(userAgent),
        userAgent: userAgent.slice(0, 400),
        place: place || known?.place || null,
        // The first sighting is what makes a row worth reading: «this browser
        // has been signed in since March» is the sentence that tells somebody
        // whether they recognise it.
        firstSeenAt: known?.firstSeenAt || FieldValue.serverTimestamp(),
        lastSeenAt: FieldValue.serverTimestamp(),
      },
    }, { merge: true });

    // Trim in the same breath as the write, so the document cannot grow without
    // bound on an account that signs in from a new browser every week.
    const stale = expiredSessionIds(
      { ...existing, [body.sessionId]: known || {} },
      { keepId: body.sessionId },
    );
    if (stale.length > 0) {
      await reference.update(Object.fromEntries(
        stale.map(id => [id, FieldValue.delete()]),
      ));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, {
      context: 'account-sessions-record',
      fallbackMessage: 'Не вдалося зберегти сеанс',
    });
  }
}

export async function DELETE(request) {
  try {
    const authorization = await authenticateRequest(request);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    const uid = authorization.user.uid;
    const sessionId = new URL(request.url).searchParams.get('sessionId') || '';
    if (!isSessionId(sessionId)) {
      return NextResponse.json({ error: 'Невідомий сеанс' }, { status: 400 });
    }

    const allowed = await enforceRateLimit('account-sessions-end', uid, 20, 3600);
    if (!allowed) {
      return NextResponse.json({
        error: 'Забагато спроб. Спробуйте за годину',
        code: 'RATE_LIMITED',
      }, { status: 429 });
    }

    const db = getAdminDb();
    await sessionsRef(db, uid).set({ [sessionId]: FieldValue.delete() }, { merge: true });
    // Firebase can revoke an account's refresh tokens; it cannot revoke one
    // device's. So ending a session ends every one of them — which is the safe
    // direction, and the only honest one. The confirmation says so.
    await getAdminAuth().revokeRefreshTokens(uid);

    return NextResponse.json({ success: true, signedOutEverywhere: true });
  } catch (error) {
    return routeErrorResponse(error, {
      context: 'account-sessions-end',
      fallbackMessage: 'Не вдалося завершити сеанс',
    });
  }
}
