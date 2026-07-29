import 'server-only';

import { admin, getAdminDb } from '@/lib/server/firebaseAdmin';
import { withNotificationOrganization } from '@/lib/utils/notificationNavigation.mjs';
import { deliverTelegramNotification } from '@/lib/server/telegram';
import { normalizeCalendarRecurrenceInterval } from '@/lib/utils/calendarTimeLog.mjs';

export const CALENDAR_EVENT_TYPES = new Set([
  'meeting',
  'event',
  'focus',
  'absence',
  'release',
  'note',
  'reminder',
  'milestone',
]);

export const CALENDAR_VISIBILITIES = new Set(['team', 'participants', 'private']);
export const CALENDAR_RECURRENCES = new Set(['none', 'daily', 'weekly', 'monthly']);
export const CALENDAR_REMINDERS = new Set([0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080]);

const cleanText = (value, maxLength) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

export function timestampFromInput(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return undefined;
  return admin.firestore.Timestamp.fromDate(date);
}

export function serializeTimestamp(value) {
  if (!value) return null;
  const date = value.toDate ? value.toDate() : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function serializeCalendarEvent(document) {
  const data = document.data();
  return {
    id: document.id,
    ...data,
    startAt: serializeTimestamp(data.startAt),
    endAt: serializeTimestamp(data.endAt),
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt),
  };
}

export function normalizedCalendarEventInput(input, current = null) {
  const title = cleanText(input.title ?? current?.title, 200);
  const description = cleanText(input.description ?? current?.description, 10_000);
  const location = cleanText(input.location ?? current?.location, 500);
  const meetingUrl = cleanText(input.meetingUrl ?? current?.meetingUrl, 1_000);
  const projectId = cleanText(input.projectId ?? current?.projectId, 128);
  const type = cleanText(input.type ?? current?.type, 32) || 'meeting';
  const visibility = cleanText(input.visibility ?? current?.visibility, 32) || 'team';
  const startAt = timestampFromInput(input.startAt ?? current?.startAt);
  const endAt = timestampFromInput(input.endAt ?? current?.endAt);
  const allDay = input.allDay === undefined ? current?.allDay === true : input.allDay === true;
  const participantIds = [...new Set(
    (Array.isArray(input.participantIds) ? input.participantIds : current?.participantIds || [])
      .filter(item => typeof item === 'string' && item.length > 0),
  )].slice(0, 50);
  const rawRecurrence = input.recurrence ?? current?.recurrence ?? {};
  const recurrenceFrequency = cleanText(rawRecurrence.frequency, 16) || 'none';
  const recurrenceInterval = normalizeCalendarRecurrenceInterval(rawRecurrence.interval);
  const recurrenceUntil = cleanText(rawRecurrence.until, 32);
  const recurrence = {
    frequency: recurrenceFrequency,
    interval: recurrenceInterval,
    until: recurrenceUntil,
  };
  const reminderMinutes = [...new Set(
    (Array.isArray(input.reminderMinutes) ? input.reminderMinutes : current?.reminderMinutes || [15])
      .map(value => Number(value))
      .filter(value => CALENDAR_REMINDERS.has(value)),
  )].sort((a, b) => a - b).slice(0, 5);

  if (!title) return { error: 'Вкажіть назву події' };
  if (!CALENDAR_EVENT_TYPES.has(type)) return { error: 'Невідомий тип події' };
  if (!CALENDAR_VISIBILITIES.has(visibility)) return { error: 'Невідома видимість події' };
  if (!CALENDAR_RECURRENCES.has(recurrence.frequency)) return { error: 'Невідомий тип повторення' };
  if (!startAt || !endAt || startAt === undefined || endAt === undefined) {
    return { error: 'Вкажіть коректні дату й час' };
  }
  if (recurrence.until) {
    const untilDate = new Date(`${recurrence.until}T23:59:59`);
    if (!Number.isFinite(untilDate.getTime()) || untilDate.getTime() < startAt.toMillis()) {
      return { error: 'Дата завершення повторення має бути після початку події' };
    }
  }
  if (endAt.toMillis() <= startAt.toMillis()) {
    return { error: 'Завершення має бути пізніше за початок' };
  }
  if (endAt.toMillis() - startAt.toMillis() > 366 * 24 * 60 * 60 * 1000) {
    return { error: 'Подія не може тривати понад рік' };
  }

  return {
    value: {
      title,
      description,
      location,
      meetingUrl,
      projectId,
      type,
      visibility,
      startAt,
      endAt,
      allDay,
      participantIds,
      recurrence,
      reminderMinutes,
    },
  };
}

export async function validateCalendarReferences({
  organizationId,
  participantIds,
  projectId,
  authorization,
}) {
  const db = getAdminDb();
  if (participantIds.length) {
    const memberships = await db.getAll(
      ...participantIds.map(uid => db.collection('orgMemberships').doc(`${organizationId}_${uid}`)),
    );
    const invalid = memberships.some((snapshot, index) =>
      !snapshot.exists ||
      snapshot.data().orgId !== organizationId ||
      snapshot.data().userId !== participantIds[index],
    );
    if (invalid) return 'Один або кілька учасників уже не належать до команди';
  }

  if (projectId) {
    const projectSnapshot = await db.collection('projects').doc(projectId).get();
    if (!projectSnapshot.exists || projectSnapshot.data().organizationId !== organizationId) {
      return 'Обраний проєкт не належить цій команді';
    }
    if (projectSnapshot.data().deletionPending === true) {
      return 'Обраний проєкт уже видаляють';
    }
    if (projectSnapshot.data().status === 'archived') {
      return 'Не можна додавати події до архівованого проєкту';
    }
    const isPrivileged = ['owner', 'admin'].includes(authorization?.membership?.role);
    const projectTeam = projectSnapshot.data().team;
    if (
      authorization &&
      !isPrivileged &&
      !(Array.isArray(projectTeam) && projectTeam.includes(authorization.user.uid))
    ) {
      return 'Ви не належите до обраного проєкту';
    }
  }

  return null;
}

export function canManageCalendarEvent(event, authorization) {
  if (event.visibility === 'private') return event.organizerId === authorization.user.uid;
  return event.organizerId === authorization.user.uid ||
    ['owner', 'admin'].includes(authorization.membership?.role);
}

export function canViewCalendarEvent(event, authorization) {
  if (!event || !authorization?.user?.uid) return false;
  if (event.visibility === 'private') {
    return event.organizerId === authorization.user.uid;
  }
  if (event.visibility === 'participants') {
    return event.organizerId === authorization.user.uid
      || event.participantIds?.includes(authorization.user.uid)
      || ['owner', 'admin'].includes(authorization.membership?.role);
  }
  return true;
}

export function canAccessCalendarEventProject(event, project, authorization) {
  if (!event?.projectId) return true;
  if (
    !project
    || project.organizationId !== event.organizationId
    || project.deletionPending === true
    || project.status === 'archived'
  ) {
    return false;
  }
  return ['owner', 'admin'].includes(authorization?.membership?.role)
    || (
      Array.isArray(project.team)
      && project.team.includes(authorization?.user?.uid)
    );
}

export async function createCalendarNotifications({
  organizationId,
  eventId,
  recipientIds,
  actorId,
  type,
  title,
  body,
  link = `/calendar/event/${encodeURIComponent(eventId)}`,
}) {
  const recipients = [...new Set(recipientIds)].filter(uid => uid && uid !== actorId);
  if (!recipients.length) return;

  const db = getAdminDb();
  const actorSnapshot = await db.collection('users').doc(actorId).get();
  const actor = actorSnapshot.exists ? actorSnapshot.data() : {};
  const scopedLink = withNotificationOrganization(link, organizationId);
  const batch = db.batch();
  recipients.forEach(userId => {
    batch.set(db.collection('notifications').doc(), {
      userId,
      type,
      title,
      body,
      link: scopedLink,
      organizationId,
      calendarEventId: eventId,
      actorId,
      actorName: actor.name || actor.displayName || '',
      actorAvatar: actor.avatar || actor.photoURL || '',
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
  await deliverTelegramNotification({
    userIds: recipients,
    title,
    body,
    link: scopedLink,
  }).catch(error => console.warn('[calendar] Telegram delivery failed:', error.message));
}
