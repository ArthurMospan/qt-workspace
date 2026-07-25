import { calendarEventOccurrenceKey } from './calendarEventNavigation.mjs';
import { isCalendarEventTimeLog } from './timeLogDates.mjs';

export function buildCalendarBillingItems({
  logs = [],
  events = [],
  projectId = '',
  byIssue = {},
} = {}) {
  const eventMap = new Map();
  events.forEach(event => {
    eventMap.set(
      calendarEventOccurrenceKey(event.sourceEventId || event.id, event.startAt),
      event,
    );
  });

  const itemMap = {};
  const timeLogsByItem = { ...byIssue };
  logs.filter(isCalendarEventTimeLog).forEach(log => {
    const occurrenceKey = calendarEventOccurrenceKey(log.eventId, log.occurrenceStartAt);
    const itemId = `billing:${occurrenceKey}`;
    if (!timeLogsByItem[itemId]) {
      timeLogsByItem[itemId] = { totalMinutes: 0, byUser: {} };
    }
    timeLogsByItem[itemId].totalMinutes += Number(log.spentMinutes) || 0;
    if (log.userId) {
      timeLogsByItem[itemId].byUser[log.userId] = (
        timeLogsByItem[itemId].byUser[log.userId] || 0
      ) + (Number(log.spentMinutes) || 0);
    }

    const event = eventMap.get(occurrenceKey);
    const eventDateValue = log.occurrenceStartAt
      ? new Date(log.occurrenceStartAt)
      : null;
    const eventDate = Number.isFinite(eventDateValue?.getTime())
      ? eventDateValue.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
      : '';
    itemMap[itemId] = {
      id: itemId,
      issueKey: eventDate ? `ПОДІЯ · ${eventDate}` : 'ПОДІЯ',
      title: event?.title || log.description || 'Подія календаря',
      type: 'calendar_event',
      columnId: 'calendar_event',
      projectId,
      assigneeIds: [...new Set([
        ...(itemMap[itemId]?.assigneeIds || []),
        ...(log.userId ? [log.userId] : []),
      ])],
    };
  });

  return {
    billableEvents: Object.values(itemMap),
    timeLogsByItem,
  };
}
