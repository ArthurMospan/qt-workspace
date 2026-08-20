// The inbox behind /errors — every report from every workspace, in one list.
//
// Reading these is not a workspace feature and never was one. A report carries
// somebody's screen, path and failure, and the only person it is addressed to
// is whoever can fix it. That used to be spelled «власник організації», which
// is the wrong person the moment a workspace belongs to a customer: their owner
// would read their team's failures, and the developer would have to walk every
// organization to find their own bug list.
//
// So the reader is not a role here. It is a password, and it is the line right
// below — change it there and nowhere else. Deliberately not an environment
// variable: this is one person's door to a page nobody else has a reason to
// open, and making it a deploy-time setting bought nothing but a setup step.
import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { enforceRateLimit, getAdminDb } from '@/lib/server/firebaseAdmin';
import { readJsonBody, routeErrorResponse } from '@/lib/server/apiErrors';

// The password. This is the whole of the configuration.
const PASSWORD = 'AIW';

const REPORT_LIMIT = 100;

// Compared as fixed-length digests, so the comparison cannot be timed to learn
// the password one character at a time — and so a long paste costs the same as
// an empty field.
const digestOf = value => createHash('sha256').update(String(value ?? '')).digest();

function passwordAccepted(candidate) {
  return timingSafeEqual(digestOf(candidate), digestOf(PASSWORD));
}

// Whoever is knocking. Behind a proxy the socket address is the proxy's, so the
// forwarded chain is the only thing that identifies a caller — its first entry
// is the client, the rest were added on the way here.
function callerAddress(request) {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  return forwarded.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request) {
  try {
    // Ten tries in five minutes per address. A password is only as private as
    // the number of guesses it survives, and this page has no session to fall
    // back on.
    if (!(await enforceRateLimit('errorReportsInbox', callerAddress(request), 10, 300))) {
      return NextResponse.json({ error: 'Забагато спроб. Спробуйте за кілька хвилин' }, { status: 429 });
    }

    const body = await readJsonBody(request, { message: 'Некоректний запит' });
    if (!passwordAccepted(body?.password)) {
      return NextResponse.json({ error: 'Невірний пароль' }, { status: 401 });
    }

    const snapshot = await getAdminDb().collection('errorReports')
      .orderBy('createdAt', 'desc')
      .limit(REPORT_LIMIT)
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
          organizationName: data.organizationName || '',
          reportedByName: data.reportedByName || '',
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
        };
      }),
    });
  } catch (error) {
    return routeErrorResponse(error, {
      context: 'error reports inbox',
      fallbackMessage: 'Не вдалося прочитати звіти',
    });
  }
}
