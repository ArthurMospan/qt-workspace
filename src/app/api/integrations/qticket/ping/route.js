import { NextResponse } from 'next/server';
import { authorizeOrgRequest, getAdminDb } from '@/lib/server/firebaseAdmin';
import { readJsonBody, routeErrorResponse } from '@/lib/server/apiErrors';
import { qTicketIntegrationConfig } from '@/lib/integrations/qticketContract.mjs';
import { pingQTicket } from '@/lib/server/qticket';

/**
 * Ask qTicket what it actually holds for this organization.
 *
 * The card answered «а воно взагалі працює?» with a revision number out of this
 * database — a record of what QuickTeam believes it sent. A provisioning that
 * failed halfway leaves that number looking exactly like a successful one, so
 * the screen was confident in proportion to nothing.
 *
 * A reply here proves the origin, the shared secret and the two clocks agree as
 * a side effect of arriving. `inSync` compares the revision qTicket stored with
 * the one this side recorded, which is the difference between «я синхронізував»
 * and «я думаю, що синхронізував».
 *
 * A probe is not a sync: it writes nothing, and any member may run it — the
 * question «чи працює доповнення, яким я користуюсь» is not an owner's
 * question. Nothing in the answer names a person or a client.
 */
export async function POST(request) {
  try {
    const body = await readJsonBody(request);
    const organizationId = String(body?.organizationId || '').trim();
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner', 'admin', 'member']);
    if (authorization.error) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    const config = qTicketIntegrationConfig();
    if (!config.configured) {
      return NextResponse.json({ error: 'qTicket не налаштовано на сервері', code: 'not_configured' }, { status: 503 });
    }

    const snapshot = await getAdminDb().doc(`organizations/${organizationId}/private/qticket`).get();
    const localRevision = Number(snapshot.data()?.revision) || 0;

    // An unreachable qTicket is the answer, not an error page. The point of the
    // button is to find out, and «не вдалося» with the reason is a finding.
    let answer;
    try {
      answer = await pingQTicket({ sourceOrganizationId: organizationId });
    } catch (error) {
      return NextResponse.json({
        reachable: false,
        localRevision,
        error: error.message || 'qTicket не відповів',
        code: error.code || 'QTICKET_UPSTREAM',
      }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    return NextResponse.json({
      reachable: true,
      localRevision,
      remoteRevision: Number(answer.revision) || 0,
      inSync: (Number(answer.revision) || 0) === localRevision && localRevision > 0,
      known: answer.known === true,
      entitlement: answer.entitlement || 'inactive',
      portalUrl: String(answer.portalUrl || ''),
      portalBrand: answer.portalBrand || null,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return routeErrorResponse(error, { context: 'qticket-ping', fallbackMessage: 'Не вдалося перевірити qTicket' });
  }
}
