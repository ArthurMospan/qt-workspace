import { NextResponse } from 'next/server';
import { admin, authorizeOrgRequest, getAdminDb } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import {
  canManageCalendarEvent,
  createCalendarNotifications,
  normalizedCalendarEventInput,
  serializeCalendarEvent,
  validateCalendarReferences,
} from '@/lib/server/calendarEvents';

async function loadEvent(eventId) {
  const ref = getAdminDb().collection('calendarEvents').doc(eventId);
  const snapshot = await ref.get();
  return { ref, snapshot, event: snapshot.exists ? snapshot.data() : null };
}

export async function PATCH(request, context) {
  try {
    const { eventId } = await context.params;
    const body = await request.json();
    const loaded = await loadEvent(eventId);
    if (!loaded.event) return NextResponse.json({ error: 'Подію не знайдено' }, { status: 404 });

    const authorization = await authorizeOrgRequest(request, loaded.event.organizationId);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }

    if (body.response) {
      if (!loaded.event.participantIds?.includes(authorization.user.uid)) {
        return NextResponse.json({ error: 'Вас не запрошено до цієї події' }, { status: 403 });
      }
      if (!['accepted', 'tentative', 'declined'].includes(body.response)) {
        return NextResponse.json({ error: 'Невідома відповідь' }, { status: 400 });
      }
      await loaded.ref.update({
        [`participantResponses.${authorization.user.uid}`]: body.response,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await createCalendarNotifications({
        organizationId: loaded.event.organizationId,
        eventId,
        recipientIds: [loaded.event.organizerId],
        actorId: authorization.user.uid,
        type: 'calendar_changed',
        title: body.response === 'accepted'
          ? 'Учасник підтвердив подію'
          : body.response === 'tentative'
            ? 'Учасник відповів «Можливо»'
            : 'Учасник відмовився від події',
        body: loaded.event.title,
      });
      const updated = await loaded.ref.get();
      return NextResponse.json({ event: serializeCalendarEvent(updated) });
    }

    if (!canManageCalendarEvent(loaded.event, authorization)) {
      return NextResponse.json({ error: 'Редагувати подію може організатор або адміністратор' }, { status: 403 });
    }

    const normalized = normalizedCalendarEventInput(body, loaded.event);
    if (normalized.error) return NextResponse.json({ error: normalized.error }, { status: 400 });
    const eventData = normalized.value;
    if (eventData.visibility === 'private') {
      eventData.participantIds = [loaded.event.organizerId];
    } else if (!eventData.participantIds.includes(loaded.event.organizerId)) {
      eventData.participantIds.unshift(loaded.event.organizerId);
    }
    const referenceError = await validateCalendarReferences({
      organizationId: loaded.event.organizationId,
      ...eventData,
      authorization,
    });
    if (referenceError) return NextResponse.json({ error: referenceError }, { status: 400 });

    const previousParticipants = new Set(loaded.event.participantIds || []);
    const nextParticipants = new Set(eventData.participantIds);
    const addedParticipants = eventData.participantIds.filter(uid => !previousParticipants.has(uid));
    const retainedParticipants = eventData.participantIds.filter(uid => previousParticipants.has(uid));
    const participantResponses = Object.fromEntries(
      Object.entries(loaded.event.participantResponses || {}).filter(([uid]) => nextParticipants.has(uid)),
    );
    participantResponses[loaded.event.organizerId] = 'accepted';
    addedParticipants.forEach(uid => { participantResponses[uid] = 'pending'; });

    await loaded.ref.update({
      ...eventData,
      participantResponses,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await Promise.all([
      createCalendarNotifications({
        organizationId: loaded.event.organizationId,
        eventId,
        recipientIds: addedParticipants,
        actorId: authorization.user.uid,
        type: 'calendar_invite',
        title: `Запрошення: ${eventData.title}`,
        body: 'Вас додали до командної події',
      }),
      createCalendarNotifications({
        organizationId: loaded.event.organizationId,
        eventId,
        recipientIds: retainedParticipants,
        actorId: authorization.user.uid,
        type: 'calendar_changed',
        title: `Подію оновлено: ${eventData.title}`,
        body: 'Організатор змінив деталі події',
      }),
    ]);

    const updated = await loaded.ref.get();
    return NextResponse.json({ event: serializeCalendarEvent(updated) });
  } catch (error) {
    return routeErrorResponse(error, {
      context: 'calendar-event PATCH',
      fallbackMessage: 'Не вдалося оновити подію',
    });
  }
}

export async function DELETE(request, context) {
  try {
    const { eventId } = await context.params;
    const loaded = await loadEvent(eventId);
    if (!loaded.event) return NextResponse.json({ error: 'Подію не знайдено' }, { status: 404 });

    const authorization = await authorizeOrgRequest(request, loaded.event.organizationId);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }
    if (!canManageCalendarEvent(loaded.event, authorization)) {
      return NextResponse.json({ error: 'Видалити подію може організатор або адміністратор' }, { status: 403 });
    }

    await createCalendarNotifications({
      organizationId: loaded.event.organizationId,
      eventId,
      recipientIds: loaded.event.participantIds || [],
      actorId: authorization.user.uid,
      type: 'calendar_changed',
      title: `Подію скасовано: ${loaded.event.title}`,
      body: 'Організатор скасував командну подію',
      link: '/calendar',
    });
    await loaded.ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, {
      context: 'calendar-event DELETE',
      fallbackMessage: 'Не вдалося видалити подію',
    });
  }
}
