import { calendarEventOccurrenceKey } from './calendarEventNavigation.mjs';

const LONG_TASK_LOG_MINUTES = 16 * 60;
const LONG_EVENT_LOG_MINUTES = 8 * 60;
const EVENT_DURATION_MULTIPLIER = 4;

function eventDurationMinutes(event) {
  const start = new Date(event?.startAt).getTime();
  const end = new Date(event?.endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.round((end - start) / 60_000);
}

/**
 * A warning heuristic, not a validator: unusual records remain in every total.
 * Its job is to make a likely extra zero visible before it reaches an invoice.
 */
export function findTimeLogAnomalies(logs, events = []) {
  const eventsByOccurrence = new Map(events.map(event => [
    calendarEventOccurrenceKey(event.sourceEventId || event.id, event.startAt),
    event,
  ]));

  return (logs || []).flatMap(log => {
    const minutes = Number(log?.spentMinutes);
    if (!Number.isSafeInteger(minutes) || minutes <= 0) return [];

    if (!log?.eventId) {
      return minutes > LONG_TASK_LOG_MINUTES
        ? [{ log, kind: 'long-task', minutes, expectedMinutes: null }]
        : [];
    }

    const event = eventsByOccurrence.get(
      calendarEventOccurrenceKey(log.eventId, log.occurrenceStartAt),
    );
    const expectedMinutes = eventDurationMinutes(event);
    const threshold = expectedMinutes === null
      ? LONG_TASK_LOG_MINUTES
      : Math.max(LONG_EVENT_LOG_MINUTES, expectedMinutes * EVENT_DURATION_MULTIPLIER);

    return minutes > threshold
      ? [{ log, kind: 'long-event', minutes, expectedMinutes }]
      : [];
  });
}
