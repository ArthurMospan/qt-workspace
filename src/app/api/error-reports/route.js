// What broke, in the words of the person it broke for.
//
// A failure toast used to be the end of the story: it said «Не вдалося
// зберегти», waited three and a half seconds, and left. Whatever the browser
// actually knew — the code, the route, the message underneath — was in a console
// nobody had open, and the only channel back to us was the user retyping it into
// a chat.
//
// A report is written through this route rather than straight from the browser
// on purpose: the client cannot be trusted with who it says it is, the rate
// limit lives here, and the collection stays closed to client reads entirely.
import { NextResponse } from 'next/server';
import { authorizeOrgRequest, enforceRateLimit, getAdminDb } from '@/lib/server/firebaseAdmin';
import { readJsonBody, routeErrorResponse } from '@/lib/server/apiErrors';
import { Timestamp } from 'firebase-admin/firestore';

// Enough to debug with, bounded so a report cannot become a payload.
const MAX_TEXT = 2000;
const MAX_NOTE = 1000;

function trimmed(value, limit) {
  return String(value ?? '').trim().slice(0, limit);
}

export async function POST(request) {
  try {
    const body = await readJsonBody(request, { message: 'Некоректний JSON для звіту про помилку' });

    const organizationId = trimmed(body?.organizationId, 200);
    const authorization = await authorizeOrgRequest(request, organizationId);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    // Ten a minute is more than any human reports and far less than a loop.
    if (!(await enforceRateLimit('errorReport', authorization.user.uid, 10, 60))) {
      return NextResponse.json({ error: 'Забагато звітів поспіль' }, { status: 429 });
    }

    const message = trimmed(body?.message, MAX_TEXT);
    if (!message) {
      return NextResponse.json({ error: 'Порожній звіт' }, { status: 400 });
    }

    const db = getAdminDb();
    const report = {
      message,
      note: trimmed(body?.note, MAX_NOTE),
      detail: trimmed(body?.detail, MAX_TEXT),
      context: trimmed(body?.context, 200),
      path: trimmed(body?.path, 500),
      userAgent: trimmed(request.headers.get('user-agent'), 400),
      reportedBy: authorization.user.uid,
      reportedByName: authorization.user.name || authorization.user.email || '',
      status: 'new',
      createdAt: Timestamp.now(),
    };
    // Under the organization, not a root collection: the path already scopes
    // it, so reading the newest hundred needs `orderBy` alone and no composite
    // index to be deployed before this works. Firestore denies what no rule
    // matches, so the collection is unreadable from a browser either way.
    const written = await db.collection('organizations').doc(organizationId)
      .collection('errorReports').add(report);
    return NextResponse.json({ ok: true, id: written.id });
  } catch (error) {
    return routeErrorResponse(error, {
      context: 'error report',
      fallbackMessage: 'Не вдалося надіслати звіт',
    });
  }
}

// Reading them is not a workspace feature: an error report carries one member's
// screen, path and failure, and the only people it is for are the ones who can
// act on it. Owners only, and never from a client listener — this route is the
// only way the collection is read, so it can stay closed in the rules.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId') || '';
    const authorization = await authorizeOrgRequest(request, organizationId);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    if (authorization.membership?.role !== 'owner') {
      return NextResponse.json({ error: 'Доступ лише для власника' }, { status: 403 });
    }

    const db = getAdminDb();
    const snapshot = await db.collection('organizations').doc(organizationId)
      .collection('errorReports')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    return NextResponse.json({
      reports: snapshot.docs.map(document => {
        const data = document.data();
        return {
          id: document.id,
          message: data.message || '',
          note: data.note || '',
          detail: data.detail || '',
          context: data.context || '',
          path: data.path || '',
          userAgent: data.userAgent || '',
          reportedByName: data.reportedByName || '',
          status: data.status || 'new',
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
        };
      }),
    });
  } catch (error) {
    return routeErrorResponse(error, {
      context: 'error reports',
      fallbackMessage: 'Не вдалося прочитати звіти',
    });
  }
}
