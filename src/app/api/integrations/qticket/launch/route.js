import { NextResponse } from 'next/server';
import { authorizeOrgRequest, getAdminDb } from '@/lib/server/firebaseAdmin';
import { readJsonBody, routeErrorResponse } from '@/lib/server/apiErrors';
import { refuseWithoutCapability } from '@/lib/server/planLimits';
import { createQTicketLaunch } from '@/lib/server/qticket';

export async function POST(request) {
  try {
    const body = await readJsonBody(request);
    const organizationId = String(body?.organizationId || '').trim();
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner', 'admin', 'member']);
    if (authorization.error) return NextResponse.json({ error: authorization.error }, { status: authorization.status });

    // Виданий доступ не відкликається зниженням тарифу — але й не відчиняє.
    // Знімок, люди й усе, що вони написали, лишаються на місці й запрацюють
    // тієї ж хвилини, коли тариф повернеться.
    const refusal = await refuseWithoutCapability(getAdminDb(), organizationId, 'qticket');
    if (refusal) return refusal;

    const integration = await getAdminDb().collection('organizations').doc(organizationId)
      .collection('private').doc('qticket').get();
    const data = integration.exists ? integration.data() : {};
    if (data.active !== true || !data.selectedUserIds?.includes(authorization.user.uid)) {
      return NextResponse.json({ error: 'qTicket не активовано для вашого акаунта', code: 'not_enabled' }, { status: 403 });
    }
    const launch = await createQTicketLaunch({
      sourceOrganizationId: organizationId,
      sourceUserId: authorization.user.uid,
      returnTo: typeof body?.returnTo === 'string' ? body.returnTo : '/overview',
    });
    return NextResponse.json(launch, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return routeErrorResponse(error, { context: 'qticket-launch', fallbackMessage: 'Не вдалося відкрити qTicket' });
  }
}
