import { NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/server/apiErrors';
import { authorizeOrgRequest, enforceRateLimit, getAdminDb } from '@/lib/server/firebaseAdmin';
import { refuseWithoutCapability } from '@/lib/server/planLimits';
import { youTrackRouteErrorResponse } from '@/lib/server/youtrackRouteErrors';
import {
  readYouTrackConnection,
  readYouTrackDiscovery,
  refreshYouTrackDiscovery,
} from '@/lib/server/youtrackIntegration';

export const maxDuration = 60;

function organizationIdFrom(request) {
  return new URL(request.url).searchParams.get('organizationId')?.trim() || '';
}

/**
 * Збережений знімок YouTrack — проєкти, статуси, люди.
 *
 * Це те, що екран читає при відкритті, і воно коштує два читання Firestore та
 * жодного звернення до YouTrack. Доти знімок жив лише в пам'яті вкладки: кожне
 * перезавантаження стирало його, і замість проєктів на екрані знову стояла
 * кнопка «Знайти проєкти».
 */
export async function GET(request) {
  try {
    const organizationId = organizationIdFrom(request);
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner', 'admin']);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    const connectionId = new URL(request.url).searchParams.get('connectionId')?.trim() || '';
    return NextResponse.json(await readYouTrackDiscovery(organizationId, connectionId), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return youTrackRouteErrorResponse(error, {
      context: 'YouTrack discovery snapshot',
      fallbackMessage: 'Не вдалося прочитати збережений список проєктів YouTrack',
    });
  }
}

export async function POST(request) {
  let requestedOrganizationId = '';
  try {
    const { organizationId } = await readJsonBody(request);
    requestedOrganizationId = organizationId;
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner', 'admin']);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    if (!(await enforceRateLimit('youtrack-discover', authorization.user.uid, 10, 60))) {
      return NextResponse.json({ error: 'Забагато запитів до YouTrack' }, { status: 429 });
    }
    // Двері, яких тут не було. Підключення й імпорт питали реєстр про
    // «Перенесення даних», а розвідка — ні, тож організація, яка повернулась на
    // безкоштовний тариф, могла й далі ганяти найдорожчий роут цієї інтеграції:
    // сотні звернень до чужого API з нашого сервера. Поки розвідку запускали
    // кнопкою, це було непомітно; тепер її запускає відкриття екрана.
    const refusal = await refuseWithoutCapability(getAdminDb(), organizationId, 'data-import');
    if (refusal) return refusal;
    return NextResponse.json(await refreshYouTrackDiscovery(organizationId), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    // Токен, який YouTrack більше не приймає, — це стан підключення, а не збій
    // читання, і екран має право сказати про нього окремим реченням із
    // кнопкою «Змінити токен» замість загального «спробуйте ще раз».
    const status = Number(error?.status);
    if (error?.source === 'youtrack' && (status === 401 || status === 403) && requestedOrganizationId) {
      const connection = await readYouTrackConnection(requestedOrganizationId).catch(() => null);
      return NextResponse.json({
        error: 'YouTrack не прийняв збережений токен.',
        code: 'YOUTRACK_TOKEN_REJECTED',
        baseUrl: connection?.baseUrl || '',
      }, { status: 400 });
    }
    return youTrackRouteErrorResponse(error, {
      context: 'YouTrack discover',
      fallbackMessage: 'Не вдалося прочитати проєкти YouTrack',
    });
  }
}
