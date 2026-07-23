import { NextResponse } from 'next/server';
import { admin, authorizeOrgRequest, enforceRateLimit, getAdminDb } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import {
  createCalendarNotifications,
  normalizedCalendarEventInput,
  serializeCalendarEvent,
  serializeTimestamp,
  validateCalendarReferences,
} from '@/lib/server/calendarEvents';

export async function GET(request) {
  try {
    const organizationId = new URL(request.url).searchParams.get('organizationId')?.trim() || '';
    const authorization = await authorizeOrgRequest(request, organizationId);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }

    const db = getAdminDb();
    const [eventsSnapshot, issuesSnapshot, projectsSnapshot] = await Promise.all([
      db.collection('calendarEvents').where('organizationId', '==', organizationId).get(),
      db.collection('issues').where('organizationId', '==', organizationId).get(),
      db.collection('projects').where('organizationId', '==', organizationId).get(),
    ]);

    const events = eventsSnapshot.docs
      .map(serializeCalendarEvent)
      .filter(event =>
        event.visibility !== 'participants' ||
        event.organizerId === authorization.user.uid ||
        event.participantIds?.includes(authorization.user.uid) ||
        ['owner', 'admin'].includes(authorization.membership?.role),
      );
    const isPrivileged = ['owner', 'admin'].includes(authorization.membership?.role);
    const visibleProjectIds = new Set(projectsSnapshot.docs.flatMap(document => {
      const project = document.data();
      return isPrivileged || project.team?.includes(authorization.user.uid) ? [document.id] : [];
    }));
    const deadlines = issuesSnapshot.docs.flatMap(document => {
      const issue = document.data();
      if (!visibleProjectIds.has(issue.projectId)) return [];
      const dueDate = serializeTimestamp(issue.dueDate);
      if (!dueDate) return [];
      return [{
        id: document.id,
        title: issue.title || '',
        issueKey: issue.issueKey || '',
        projectId: issue.projectId || '',
        dueDate,
        assigneeIds: issue.assigneeIds || [],
        completed: Boolean(issue.completedAt),
      }];
    });

    return NextResponse.json(
      { events, deadlines },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return routeErrorResponse(error, {
      context: 'calendar-events GET',
      fallbackMessage: 'Не вдалося завантажити календар',
    });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner', 'admin', 'member']);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    if (!(await enforceRateLimit('calendar-event-create', authorization.user.uid, 30, 60))) {
      return NextResponse.json({ error: 'Забагато подій за короткий час' }, { status: 429 });
    }

    const normalized = normalizedCalendarEventInput(body);
    if (normalized.error) return NextResponse.json({ error: normalized.error }, { status: 400 });
    const eventData = normalized.value;
    if (!eventData.participantIds.includes(authorization.user.uid)) {
      eventData.participantIds.unshift(authorization.user.uid);
    }
    const referenceError = await validateCalendarReferences({
      organizationId,
      ...eventData,
      authorization,
    });
    if (referenceError) return NextResponse.json({ error: referenceError }, { status: 400 });

    const db = getAdminDb();
    const ref = db.collection('calendarEvents').doc();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const participantResponses = Object.fromEntries(
      eventData.participantIds.map(uid => [
        uid,
        uid === authorization.user.uid ? 'accepted' : 'pending',
      ]),
    );
    await ref.set({
      ...eventData,
      organizationId,
      organizerId: authorization.user.uid,
      participantResponses,
      createdAt: now,
      updatedAt: now,
    });

    await createCalendarNotifications({
      organizationId,
      eventId: ref.id,
      recipientIds: eventData.participantIds,
      actorId: authorization.user.uid,
      type: 'calendar_invite',
      title: `Запрошення: ${eventData.title}`,
      body: eventData.allDay
        ? 'Вас додали до події на весь день'
        : `Початок: ${eventData.startAt.toDate().toLocaleString('uk-UA')}`,
    });

    const created = await ref.get();
    return NextResponse.json({ event: serializeCalendarEvent(created) }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, {
      context: 'calendar-events POST',
      fallbackMessage: 'Не вдалося створити подію',
    });
  }
}
