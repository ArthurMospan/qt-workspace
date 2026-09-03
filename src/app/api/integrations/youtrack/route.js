import { NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/server/apiErrors';
import { authorizeOrgRequest, enforceRateLimit, getAdminDb } from '@/lib/server/firebaseAdmin';
import { youTrackRouteErrorResponse } from '@/lib/server/youtrackRouteErrors';
import { refuseWithoutCapability } from '@/lib/server/planLimits';
import {
  connectYouTrack,
  disconnectYouTrack,
  readYouTrackConnection,
} from '@/lib/server/youtrackIntegration';
import { cancelOpenYouTrackImports } from '@/lib/server/youtrackImporter';

function organizationIdFrom(request) {
  return new URL(request.url).searchParams.get('organizationId')?.trim() || '';
}

export async function GET(request) {
  try {
    const organizationId = organizationIdFrom(request);
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner', 'admin']);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    return NextResponse.json(await readYouTrackConnection(organizationId), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return youTrackRouteErrorResponse(error, {
      context: 'YouTrack status',
      fallbackMessage: 'Не вдалося перевірити підключення YouTrack',
    });
  }
}

export async function POST(request) {
  try {
    const { organizationId, baseUrl, token } = await readJsonBody(request);
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner', 'admin']);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    if (!(await enforceRateLimit('youtrack-connect', authorization.user.uid, 10, 60))) {
      return NextResponse.json({ error: 'Забагато спроб підключення' }, { status: 429 });
    }
    // Connecting a tracker is «Перенесення даних». Disconnecting (DELETE) is
    // not: a stored credential must always be removable.
    const refusal = await refuseWithoutCapability(getAdminDb(), organizationId, 'data-import');
    if (refusal) return refusal;
    const previous = await readYouTrackConnection(organizationId);
    const connection = await connectYouTrack({
      organizationId,
      baseUrl,
      token,
      userId: authorization.user.uid,
    });
    // Той самий роут робить дві різні речі: замінює токен (адреса та сама) і
    // під'єднує інший YouTrack (адреса інша). Перше нічого не ламає — усі ключі
    // ідемпотентності висять на `connectionId`, тобто на хеші адреси, тож
    // незавершене перенесення просто йде далі. Друге лишало б чергу від
    // попереднього сервера живою й невидимою: екран її вже не показує, а
    // `assertNoForeignActiveImport` усе ще на неї зважає.
    if (previous.connected && previous.connectionId !== connection.connectionId) {
      await cancelOpenYouTrackImports({
        organizationId,
        userId: authorization.user.uid,
      }).catch(error => {
        console.warn('[youtrack] open imports not cancelled on reconnect:', error.message);
      });
    }
    return NextResponse.json(connection);
  } catch (error) {
    return youTrackRouteErrorResponse(error, {
      context: 'YouTrack connect',
      fallbackMessage: 'Не вдалося підключити YouTrack',
    });
  }
}

export async function DELETE(request) {
  try {
    const organizationId = organizationIdFrom(request);
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner', 'admin']);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    // Спершу спиняємо те, що ще пише, і лише потім забираємо токен. Замок стояв
    // у браузері — кнопка «Відключити» була `disabled`, поки job живий, — і саме
    // тому відкликаний токен ставав глухим кутом: продовжити не можна, бо
    // YouTrack не пускає, відключити не можна, бо йде імпорт.
    //
    // Невдача цього кроку не спиняє відключення. Збережена чужа облікова
    // здатність мусить бути видаленною завжди; job без токена все одно нікуди
    // не піде, а лишити токен у базі через те, що не оновився статус черги, —
    // гірше з двох.
    const stopped = await cancelOpenYouTrackImports({
      organizationId,
      userId: authorization.user.uid,
    }).catch(error => {
      console.warn('[youtrack] open imports not cancelled on disconnect:', error.message);
      return 0;
    });
    await disconnectYouTrack(organizationId);
    return NextResponse.json({ success: true, stoppedImports: stopped });
  } catch (error) {
    return youTrackRouteErrorResponse(error, {
      context: 'YouTrack disconnect',
      fallbackMessage: 'Не вдалося відключити YouTrack',
    });
  }
}
