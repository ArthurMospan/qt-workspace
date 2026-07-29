import { expandOccurrences } from './calendarRecurrence.mjs';

export const REMINDER_LOOKBACK_MS = 10 * 60 * 1000;
export const DEADLINE_HORIZON_MS = 24 * 60 * 60 * 1000;

function asDate(value) {
  if (!value) return null;
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function dayKeyInTimeZone(value, timeZone = 'Europe/Kyiv') {
  const date = asDate(value);
  if (!date) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(
      parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]),
    );
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function reminderLabel(minutes) {
  if (minutes === 0) return 'Подія починається зараз';
  if (minutes < 60) return `До початку ${minutes} хв`;
  if (minutes < 1440) return `До початку ${minutes / 60} год`;
  return `До початку ${minutes / 1440} дн`;
}

export function calendarReminderCandidates(
  events,
  { nowMs = Date.now(), lookBackMs = REMINDER_LOOKBACK_MS, recipientId = '' } = {},
) {
  const candidates = [];

  for (const event of events || []) {
    const start = asDate(event.startAt);
    const participantIds = [...new Set(
      (Array.isArray(event.participantIds) ? event.participantIds : [])
        .filter(value => typeof value === 'string' && value.length > 0),
    )];
    const recipients = recipientId
      ? participantIds.filter(userId => userId === recipientId)
      : participantIds;
    const reminders = [...new Set(
      (Array.isArray(event.reminderMinutes) ? event.reminderMinutes : [15])
        .map(Number)
        .filter(Number.isFinite)
        .filter(minutes => minutes >= 0),
    )];
    if (!event.id || !event.organizationId || !start || !recipients.length || !reminders.length) continue;

    const maxReminderMs = Math.max(...reminders) * 60 * 1000;
    const { occurrences } = expandOccurrences({
      start,
      frequency: event.recurrence?.frequency || 'none',
      interval: event.recurrence?.interval,
      until: event.recurrence?.until ? `${event.recurrence.until}T23:59:59.999Z` : null,
      windowStart: new Date(nowMs - lookBackMs),
      windowEnd: new Date(nowMs + maxReminderMs + 5 * 60 * 1000),
      maxOccurrences: 64,
    });

    for (const occurrence of occurrences) {
      for (const minutes of reminders) {
        const triggerAt = occurrence.getTime() - minutes * 60 * 1000;
        if (triggerAt > nowMs || triggerAt < nowMs - lookBackMs) continue;
        for (const userId of recipients) {
          if (event.participantResponses?.[userId] === 'declined') continue;
          candidates.push({
            id: `calendar_reminder_${event.id}_${userId}_${occurrence.getTime()}_${minutes}`,
            userId,
            organizationId: event.organizationId,
            type: 'calendar_reminder',
            title: event.title || 'Подія',
            body: reminderLabel(minutes),
            calendarEventId: event.id,
            occurrenceStart: occurrence.getTime(),
            actorId: event.organizerId || '',
          });
        }
      }
    }
  }

  return candidates;
}

export function deadlineReminderCandidates(
  issues,
  {
    nowMs = Date.now(),
    doneStatusIdsByOrganization = new Map(),
    timeZonesByOrganization = new Map(),
  } = {},
) {
  const candidates = [];
  const horizon = nowMs + DEADLINE_HORIZON_MS;

  for (const issue of issues || []) {
    const dueDate = asDate(issue.dueDate);
    const assigneeIds = [...new Set(
      (Array.isArray(issue.assigneeIds) ? issue.assigneeIds : [])
        .filter(value => typeof value === 'string' && value.length > 0),
    )];
    if (!issue.id || !issue.organizationId || !issue.projectId || !dueDate || !assigneeIds.length) continue;
    if (dueDate.getTime() > horizon) continue;

    const doneStatusIds = doneStatusIdsByOrganization.get(issue.organizationId) || new Set(['done']);
    if (doneStatusIds.has(issue.columnId || issue.status)) continue;

    const timeZone = timeZonesByOrganization.get(issue.organizationId) || 'Europe/Kyiv';
    const overdue = dueDate.getTime() < nowMs;
    const dayKey = overdue
      ? dayKeyInTimeZone(nowMs, timeZone)
      : dayKeyInTimeZone(dueDate, timeZone);
    let dueLabel = '';
    try {
      dueLabel = dueDate.toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'long',
        timeZone,
      });
    } catch {
      dueLabel = dueDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
    }

    for (const userId of assigneeIds) {
      candidates.push({
        id: overdue
          ? `overdue_${issue.id}_${userId}_${dayKey}`
          : `deadline_${issue.id}_${userId}_${dayKey}`,
        userId,
        organizationId: issue.organizationId,
        projectId: issue.projectId,
        issueId: issue.id,
        type: 'deadline',
        title: overdue
          ? `${issue.issueKey || 'Завдання'}: дедлайн прострочено`
          : `${issue.issueKey || 'Завдання'}: дедлайн ${dueLabel}`,
        body: issue.title || '',
      });
    }
  }

  return candidates;
}
