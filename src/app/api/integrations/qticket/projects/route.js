import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import { readSignedQTicketRequest, resolveQTicketActor } from '@/lib/server/qticketInbound';

const MAX_PROJECTS = 200;

/**
 * The projects this person may put a task into, so qTicket can ask before it
 * transfers rather than guess afterwards.
 *
 * The answer is names and ids, and it is the same list the person would see
 * here: an owner or an admin reaches every project of the organization, and
 * everybody else reaches the ones they are on. A project that is archived,
 * being deleted, or read-only because the plan's ceiling moved is not offered
 * — sending a task there would fail on arrival, and a picker that lists
 * choices the next step refuses is worse than no picker.
 */
export async function POST(request) {
  try {
    const signed = await readSignedQTicketRequest(request);
    if (signed.error) {
      return NextResponse.json({ error: signed.error, code: signed.code }, { status: signed.status });
    }
    const db = getAdminDb();
    const resolved = await resolveQTicketActor(db, signed.body || {});
    if (resolved.error) {
      return NextResponse.json({ error: resolved.error, code: resolved.code }, { status: resolved.status });
    }

    const { organizationId, actor } = resolved;
    const isPrivileged = actor.role === 'owner' || actor.role === 'admin';
    const snapshot = await db.collection('projects')
      .where('organizationId', '==', organizationId)
      .select('name', 'team', 'status', 'deletionPending', 'overPlanLimit')
      .get();
    const projects = snapshot.docs
      // The document id last: a stored `id` field must not overwrite the real one.
      .map(document => ({ ...document.data(), id: document.id }))
      .filter(project => (
        project.status !== 'archived'
        && project.deletionPending !== true
        && project.overPlanLimit !== true
        && (isPrivileged || (Array.isArray(project.team) && project.team.includes(actor.uid)))
      ))
      .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'uk'))
      .slice(0, MAX_PROJECTS)
      .map(project => ({ id: project.id, name: project.name || 'Проєкт' }));

    return NextResponse.json({ version: 1, projects }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return routeErrorResponse(error, {
      context: 'qticket-projects',
      fallbackMessage: 'Не вдалося отримати список проєктів',
    });
  }
}
