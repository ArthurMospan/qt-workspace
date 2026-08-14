import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { authorizeOrgRequest, getAdminDb } from '@/lib/server/firebaseAdmin';
import { readJsonBody, routeErrorResponse } from '@/lib/server/apiErrors';
import {
  canManageCalendarEvent,
  createCalendarNotifications,
  normalizedCalendarEventInput,
  serializeCalendarEvent,
} from '@/lib/server/calendarEvents';
import {
  calendarEventSourceIdentityChanged,
} from '@/lib/utils/calendarTimeLog.mjs';

function eventMutationError(code, status, message, details = {}) {
  const error = new Error(code);
  error.calendarEventMutation = { code, status, message, ...details };
  return error;
}

function eventMutationErrorResponse(error) {
  const { message, status, ...payload } = error.calendarEventMutation;
  return NextResponse.json({ error: message, ...payload }, { status });
}

async function deliverNotificationsSafely(notificationWork, context) {
  try {
    await notificationWork;
  } catch (error) {
    console.warn(`[calendar] ${context} notification failed after commit:`, error);
  }
}

async function loadEvent(eventId) {
  const ref = getAdminDb().collection('calendarEvents').doc(eventId);
  const snapshot = await ref.get();
  return { ref, snapshot, event: snapshot.exists ? snapshot.data() : null };
}

function validEventId(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 256
    && !value.includes('/')
    && !value.includes('\0');
}

function ensureEventScope(snapshot, organizationId) {
  if (
    !snapshot.exists
    || snapshot.data().organizationId !== organizationId
  ) {
    throw eventMutationError(
      'CALENDAR_EVENT_NOT_FOUND',
      404,
      'Подію не знайдено',
    );
  }
  return snapshot.data();
}

async function validateReferencesInTransaction({
  transaction,
  db,
  organizationId,
  eventData,
  authorization,
}) {
  const membershipRefs = eventData.participantIds.map(
    uid => db.collection('orgMemberships').doc(`${organizationId}_${uid}`),
  );
  const membershipSnapshots = membershipRefs.length
    ? await transaction.getAll(...membershipRefs)
    : [];
  const invalidParticipant = membershipSnapshots.some((snapshot, index) => (
    !snapshot.exists
    || snapshot.data().orgId !== organizationId
    || snapshot.data().userId !== eventData.participantIds[index]
  ));
  if (invalidParticipant) {
    throw eventMutationError(
      'CALENDAR_PARTICIPANT_INVALID',
      409,
      'Один або кілька учасників уже не належать до команди',
    );
  }

  let projectRef = null;
  let project = null;
  if (eventData.projectId) {
    projectRef = db.collection('projects').doc(eventData.projectId);
    const projectSnapshot = await transaction.get(projectRef);
    project = projectSnapshot.exists ? projectSnapshot.data() : null;
    if (!project || project.organizationId !== organizationId) {
      throw eventMutationError(
        'CALENDAR_PROJECT_SCOPE_MISMATCH',
        409,
        'Обраний проєкт не належить цій організації',
      );
    }
    if (project.deletionPending === true) {
      throw eventMutationError(
        'CALENDAR_PROJECT_DELETION_IN_PROGRESS',
        409,
        'Обраний проєкт уже видаляють',
      );
    }
    if (project.status === 'archived') {
      throw eventMutationError(
        'CALENDAR_PROJECT_ARCHIVED',
        409,
        'Не можна прив’язати подію до архівованого проєкту',
      );
    }
    const isPrivileged = ['owner', 'admin'].includes(
      authorization.membership?.role,
    );
    if (
      !isPrivileged
      && !(
        Array.isArray(project.team)
        && project.team.includes(authorization.user.uid)
      )
    ) {
      throw eventMutationError(
        'CALENDAR_PROJECT_FORBIDDEN',
        403,
        'Ви не належите до команди обраного проєкту',
      );
    }
  }
  return { project, projectRef };
}

function incrementProjectLocks(transaction, projectRefs) {
  const uniqueRefs = new Map(
    projectRefs.filter(Boolean).map(ref => [ref.path, ref]),
  );
  uniqueRefs.forEach(ref => {
    transaction.update(ref, {
      invoiceMutationVersion: FieldValue.increment(1),
    });
  });
}

export async function PATCH(request, context) {
  try {
    const { eventId } = await context.params;
    if (!validEventId(eventId)) {
      return NextResponse.json({
        error: 'Некоректна подія',
        code: 'CALENDAR_EVENT_ID_INVALID',
      }, { status: 400 });
    }
    let body;
    try {
      body = await readJsonBody(request);
    } catch {
      return NextResponse.json({
        error: 'Некоректний JSON',
        code: 'CALENDAR_EVENT_JSON_INVALID',
      }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({
        error: 'Тіло запиту має бути об’єктом',
        code: 'CALENDAR_EVENT_JSON_INVALID',
      }, { status: 400 });
    }
    const loaded = await loadEvent(eventId);
    if (!loaded.event) {
      return NextResponse.json({ error: 'Подію не знайдено' }, { status: 404 });
    }

    const authorization = await authorizeOrgRequest(
      request,
      loaded.event.organizationId,
    );
    if (authorization.error) {
      return NextResponse.json(
        { error: authorization.error },
        { status: authorization.status },
      );
    }

    const db = getAdminDb();
    if (Object.hasOwn(body, 'response')) {
      const responseResult = await db.runTransaction(async transaction => {
        const currentSnapshot = await transaction.get(loaded.ref);
        const current = ensureEventScope(
          currentSnapshot,
          loaded.event.organizationId,
        );
        if (!current.participantIds?.includes(authorization.user.uid)) {
          throw eventMutationError(
            'CALENDAR_RESPONSE_FORBIDDEN',
            403,
            'Вас не запрошено до цієї події',
          );
        }
        if (!['accepted', 'tentative', 'declined'].includes(body.response)) {
          throw eventMutationError(
            'CALENDAR_RESPONSE_INVALID',
            400,
            'Невідома відповідь',
          );
        }
        transaction.update(loaded.ref, {
          [`participantResponses.${authorization.user.uid}`]: body.response,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return {
          organizationId: current.organizationId,
          organizerId: current.organizerId,
          title: current.title,
        };
      });

      await deliverNotificationsSafely(createCalendarNotifications({
        organizationId: responseResult.organizationId,
        eventId,
        recipientIds: [responseResult.organizerId],
        actorId: authorization.user.uid,
        type: 'calendar_changed',
        title: body.response === 'accepted'
          ? 'Учасник підтвердив подію'
          : body.response === 'tentative'
            ? 'Учасник відповів «Можливо»'
            : 'Учасник відмовився від події',
        body: responseResult.title,
      }), 'response');
      const updated = await loaded.ref.get();
      return NextResponse.json({ event: serializeCalendarEvent(updated) });
    }

    const mutationResult = await db.runTransaction(async transaction => {
      const currentSnapshot = await transaction.get(loaded.ref);
      const current = ensureEventScope(
        currentSnapshot,
        loaded.event.organizationId,
      );
      if (!canManageCalendarEvent(current, authorization)) {
        throw eventMutationError(
          'CALENDAR_EVENT_FORBIDDEN',
          403,
          'Редагувати подію може організатор або адміністратор',
        );
      }

      const normalized = normalizedCalendarEventInput(body, current, {
        ownerId: current.organizerId,
      });
      if (normalized.error) {
        throw eventMutationError(
          'CALENDAR_EVENT_INVALID',
          400,
          normalized.error,
        );
      }
      const eventData = normalized.value;
      if (eventData.visibility === 'private') {
        eventData.participantIds = [current.organizerId];
      } else if (!eventData.participantIds.includes(current.organizerId)) {
        eventData.participantIds.unshift(current.organizerId);
      }

      const { projectRef: nextProjectRef } = await validateReferencesInTransaction({
        transaction,
        db,
        organizationId: current.organizationId,
        eventData,
        authorization,
      });
      let previousProjectRef = null;
      if (current.projectId && current.projectId !== eventData.projectId) {
        previousProjectRef = db.collection('projects').doc(current.projectId);
        const previousProjectSnapshot = await transaction.get(previousProjectRef);
        if (
          !previousProjectSnapshot.exists
          || previousProjectSnapshot.data().organizationId !== current.organizationId
        ) {
          // A legacy dangling event must remain cleanable. With no valid
          // project there is no lock to update; the time-log guard below still
          // blocks every accounting-sensitive identity change.
          previousProjectRef = null;
        }
      }

      const logsSnapshot = await transaction.get(
        db.collection('timeLogs')
          .where('organizationId', '==', current.organizationId)
          .where('sourceType', '==', 'calendar_event')
          .where('eventId', '==', eventId)
          .limit(1),
      );
      const logs = logsSnapshot.docs.map(document => ({
        id: document.id,
        ...document.data(),
      }));
      if (
        logs.length > 0
        && calendarEventSourceIdentityChanged(current, eventData)
      ) {
        throw eventMutationError(
          'CALENDAR_EVENT_HAS_TIME_LOGS',
          409,
          'Спочатку видаліть усі записи часу: проєкт, дата, повторення та приватність події вже зафіксовані в обліку',
          { hasTimeLogs: true },
        );
      }

      const previousParticipants = new Set(current.participantIds || []);
      const nextParticipants = new Set(eventData.participantIds);
      const addedParticipants = eventData.participantIds.filter(
        uid => !previousParticipants.has(uid),
      );
      const retainedParticipants = eventData.participantIds.filter(
        uid => previousParticipants.has(uid),
      );
      const participantResponses = Object.fromEntries(
        Object.entries(current.participantResponses || {})
          .filter(([uid]) => nextParticipants.has(uid)),
      );
      participantResponses[current.organizerId] = 'accepted';
      addedParticipants.forEach(uid => {
        participantResponses[uid] = 'pending';
      });

      transaction.update(loaded.ref, {
        ...eventData,
        participantResponses,
        updatedAt: FieldValue.serverTimestamp(),
      });
      incrementProjectLocks(transaction, [previousProjectRef, nextProjectRef]);
      return {
        organizationId: current.organizationId,
        addedParticipants,
        retainedParticipants,
        title: eventData.title,
      };
    });

    await deliverNotificationsSafely(Promise.all([
      createCalendarNotifications({
        organizationId: mutationResult.organizationId,
        eventId,
        recipientIds: mutationResult.addedParticipants,
        actorId: authorization.user.uid,
        type: 'calendar_invite',
        title: `Запрошення: ${mutationResult.title}`,
        body: 'Вас додали до командної події',
      }),
      createCalendarNotifications({
        organizationId: mutationResult.organizationId,
        eventId,
        recipientIds: mutationResult.retainedParticipants,
        actorId: authorization.user.uid,
        type: 'calendar_changed',
        title: `Подію оновлено: ${mutationResult.title}`,
        body: 'Організатор змінив деталі події',
      }),
    ]), 'update');

    const updated = await loaded.ref.get();
    return NextResponse.json({ event: serializeCalendarEvent(updated) });
  } catch (error) {
    if (error?.calendarEventMutation) {
      return eventMutationErrorResponse(error);
    }
    return routeErrorResponse(error, {
      context: 'calendar-event PATCH',
      fallbackMessage: 'Не вдалося оновити подію',
    });
  }
}

export async function DELETE(request, context) {
  try {
    const { eventId } = await context.params;
    if (!validEventId(eventId)) {
      return NextResponse.json({
        error: 'Некоректна подія',
        code: 'CALENDAR_EVENT_ID_INVALID',
      }, { status: 400 });
    }
    const loaded = await loadEvent(eventId);
    if (!loaded.event) {
      return NextResponse.json({ error: 'Подію не знайдено' }, { status: 404 });
    }

    const authorization = await authorizeOrgRequest(
      request,
      loaded.event.organizationId,
    );
    if (authorization.error) {
      return NextResponse.json(
        { error: authorization.error },
        { status: authorization.status },
      );
    }

    const db = getAdminDb();
    const deletedEvent = await db.runTransaction(async transaction => {
      const currentSnapshot = await transaction.get(loaded.ref);
      const current = ensureEventScope(
        currentSnapshot,
        loaded.event.organizationId,
      );
      if (!canManageCalendarEvent(current, authorization)) {
        throw eventMutationError(
          'CALENDAR_EVENT_FORBIDDEN',
          403,
          'Видалити подію може організатор або адміністратор',
        );
      }

      let projectRef = null;
      if (current.projectId) {
        projectRef = db.collection('projects').doc(current.projectId);
        const projectSnapshot = await transaction.get(projectRef);
        if (
          !projectSnapshot.exists
          || projectSnapshot.data().organizationId !== current.organizationId
        ) {
          // Permit cleanup of a legacy dangling event. A live project is only
          // needed for mutation locking, not as a prerequisite to delete an
          // event that has no accounting evidence.
          projectRef = null;
        }
      }
      const logsSnapshot = await transaction.get(
        db.collection('timeLogs')
          .where('organizationId', '==', current.organizationId)
          .where('sourceType', '==', 'calendar_event')
          .where('eventId', '==', eventId)
          .limit(1),
      );
      if (!logsSnapshot.empty) {
        throw eventMutationError(
          'CALENDAR_EVENT_HAS_TIME_LOGS',
          409,
          'Спочатку видаліть усі записи часу цієї події',
          { hasTimeLogs: true },
        );
      }

      transaction.delete(loaded.ref);
      incrementProjectLocks(transaction, [projectRef]);
      return current;
    });

    await deliverNotificationsSafely(createCalendarNotifications({
      organizationId: deletedEvent.organizationId,
      eventId,
      recipientIds: deletedEvent.participantIds || [],
      actorId: authorization.user.uid,
      type: 'calendar_changed',
      title: `Подію скасовано: ${deletedEvent.title}`,
      body: 'Організатор скасував командну подію',
      link: '/calendar',
    }), 'delete');
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error?.calendarEventMutation) {
      return eventMutationErrorResponse(error);
    }
    return routeErrorResponse(error, {
      context: 'calendar-event DELETE',
      fallbackMessage: 'Не вдалося видалити подію',
    });
  }
}
