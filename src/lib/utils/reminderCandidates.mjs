import { expandOccurrences } from './calendarRecurrence.mjs';

// The floor for one sweep's look-back. The sweep is *supposed* to run every few
// minutes; when it does, this is the whole window.
export const REMINDER_LOOKBACK_MS = 10 * 60 * 1000;
// The ceiling. The scheduler that drives the sweep is not reliable (GitHub
// Actions throttles `*/5 * * * *` down to roughly hourly, and to three hours
// overnight), and a fixed ten-minute window silently threw away every reminder
// whose trigger fell in a gap. The sweep now carries its own watermark and asks
// for `now - lastRun`, clamped here so a scheduler that was down for a week does
// not deliver a week of stale reminders in one burst.
export const MAX_REMINDER_LOOKBACK_MS = 12 * 60 * 60 * 1000;
export const DEADLINE_HORIZON_MS = 24 * 60 * 60 * 1000;
// Overdue tasks used to renotify every single day, forever, which is the bulk of
// what reads as "the same notification over and over". They now nag on the day
// the deadline slips, the day after, and weekly from then on.
export const OVERDUE_NAG_DAYS = new Set([0, 1]);
export const OVERDUE_NAG_INTERVAL_DAYS = 7;
// A deadline older than this stops producing candidates altogether. It also
// bounds the Firestore query that feeds the sweep: without a floor it read every
// issue that had ever been overdue, on every pass, forever.
export const DEADLINE_FLOOR_MS = 120 * 24 * 60 * 60 * 1000;

export function clampReminderLookback(elapsedMs) {
  if (!Number.isFinite(elapsedMs)) return REMINDER_LOOKBACK_MS;
  return Math.min(Math.max(elapsedMs, REMINDER_LOOKBACK_MS), MAX_REMINDER_LOOKBACK_MS);
}

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

export function dayOffsetBetweenKeys(fromKey, toKey) {
  if (!fromKey || !toKey) return null;
  const from = Date.parse(`${fromKey}T00:00:00.000Z`);
  const to = Date.parse(`${toKey}T00:00:00.000Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

// The label describes the distance to the event *at delivery*, not the reminder
// that was configured. A sweep that runs an hour late used to send "До початку
// 15 хв" about a meeting that had already finished, which is worse than sending
// nothing: it teaches the reader that QuickTeam's reminders are fiction.
export function reminderLabel(msUntilStart) {
  const minutes = Math.round(msUntilStart / 60_000);
  if (minutes <= 0) {
    const late = Math.abs(minutes);
    if (late === 0) return 'Подія починається зараз';
    if (late < 60) return `Подія почалася ${late} хв тому`;
    const hours = Math.floor(late / 60);
    const rest = late % 60;
    return rest
      ? `Подія почалася ${hours} год ${rest} хв тому`
      : `Подія почалася ${hours} год тому`;
  }
  if (minutes < 60) return `До початку ${minutes} хв`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `До початку ${hours} год ${rest} хв` : `До початку ${hours} год`;
  }
  const days = Math.round(minutes / 1440);
  return `До початку ${days} дн`;
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
            body: reminderLabel(occurrence.getTime() - nowMs),
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

export function overdueNagDue(overdueDays) {
  if (!Number.isFinite(overdueDays) || overdueDays < 0) return false;
  if (OVERDUE_NAG_DAYS.has(overdueDays)) return true;
  return overdueDays % OVERDUE_NAG_INTERVAL_DAYS === 0;
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
  const floor = nowMs - DEADLINE_FLOOR_MS;

  for (const issue of issues || []) {
    const dueDate = asDate(issue.dueDate);
    const assigneeIds = [...new Set(
      (Array.isArray(issue.assigneeIds) ? issue.assigneeIds : [])
        .filter(value => typeof value === 'string' && value.length > 0),
    )];
    if (!issue.id || !issue.organizationId || !issue.projectId || !dueDate || !assigneeIds.length) continue;
    if (dueDate.getTime() > horizon || dueDate.getTime() < floor) continue;

    const doneStatusIds = doneStatusIdsByOrganization.get(issue.organizationId) || new Set(['done']);
    if (doneStatusIds.has(issue.columnId || issue.status)) continue;

    const timeZone = timeZonesByOrganization.get(issue.organizationId) || 'Europe/Kyiv';
    const overdue = dueDate.getTime() < nowMs;
    const dayKey = overdue
      ? dayKeyInTimeZone(nowMs, timeZone)
      : dayKeyInTimeZone(dueDate, timeZone);
    // How long it has been overdue, counted in the organization's calendar days
    // rather than in raw milliseconds: "прострочено вчора" has to mean yesterday
    // in Kyiv, not 24 hours ago.
    const overdueDays = overdue
      ? dayOffsetBetweenKeys(dayKeyInTimeZone(dueDate, timeZone), dayKey)
      : 0;
    if (overdue && !overdueNagDue(overdueDays)) continue;
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
          ? `${issue.issueKey || 'Завдання'}: дедлайн прострочено${overdueDays > 0 ? ` на ${overdueDays} дн` : ''}`
          : `${issue.issueKey || 'Завдання'}: дедлайн ${dueLabel}`,
        body: issue.title || '',
      });
    }
  }

  return candidates;
}
