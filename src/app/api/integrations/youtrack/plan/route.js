import { NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/server/apiErrors';
import { authorizeOrgRequest, enforceRateLimit } from '@/lib/server/firebaseAdmin';
import { youTrackRouteErrorResponse } from '@/lib/server/youtrackRouteErrors';
import { readYouTrackPlan, writeYouTrackPlan } from '@/lib/server/youtrackIntegration';

/**
 * Збережений вибір перенесення: що переносимо, куди й кого до кого прив'язано.
 *
 * Він живе на сервері з однієї причини — щоб перезавантаження сторінки нічого
 * не стирало. Доти вибір був станом React: людина розкладала два десятки
 * статусів по колонках, оновлювала вкладку — і починала з кнопки «Знайти
 * проєкти». Саме на це й була скарга.
 *
 * Це не рішення й не дозвіл: `prepareYouTrackImport` однаково перевіряє кожен
 * ідентифікатор наново, бо документ, який пише браузер, — це введені дані, а не
 * висновок.
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get('organizationId')?.trim() || '';
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner', 'admin']);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    const connectionId = url.searchParams.get('connectionId')?.trim() || '';
    return NextResponse.json({ plan: await readYouTrackPlan(organizationId, connectionId) }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return youTrackRouteErrorResponse(error, {
      context: 'YouTrack import plan',
      fallbackMessage: 'Не вдалося прочитати збережений вибір перенесення',
    });
  }
}

export async function PUT(request) {
  try {
    const body = await readJsonBody(request);
    const organizationId = String(body.organizationId || '').trim();
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner', 'admin']);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    if (!(await enforceRateLimit('youtrack-plan', authorization.user.uid, 60, 60))) {
      return NextResponse.json({ error: 'Забагато змін вибору, повторіть за хвилину' }, { status: 429 });
    }
    const connectionId = String(body.connectionId || '').trim();
    if (!connectionId) {
      return NextResponse.json({ error: 'Вкажіть підключення YouTrack' }, { status: 400 });
    }
    const plan = await writeYouTrackPlan({
      organizationId,
      connectionId,
      plan: body.plan,
      userId: authorization.user.uid,
    });
    return NextResponse.json({ plan });
  } catch (error) {
    return youTrackRouteErrorResponse(error, {
      context: 'YouTrack import plan',
      fallbackMessage: 'Не вдалося зберегти вибір перенесення',
    });
  }
}
