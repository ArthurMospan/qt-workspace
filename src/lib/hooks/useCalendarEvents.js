'use client';

import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { expandOccurrences } from '@/lib/utils/calendarRecurrence.mjs';

async function calendarRequest(path, options = {}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Потрібно увійти в акаунт');
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Не вдалося оновити календар');
  return result;
}

// How far around today the calendar materialises a repeating series. Anchoring
// the window on *now* rather than on the series start is what stops a
// long-running daily event from vanishing: the old code walked from the first
// occurrence and gave up after a fixed number of steps, so anything older than
// ~13 months produced no occurrences at all.
const HORIZON_BEHIND_MONTHS = 6;
const HORIZON_AHEAD_MONTHS = 24;

function expandRecurringEvents(sourceEvents) {
  const windowStart = new Date();
  windowStart.setMonth(windowStart.getMonth() - HORIZON_BEHIND_MONTHS);
  const windowEnd = new Date();
  windowEnd.setMonth(windowEnd.getMonth() + HORIZON_AHEAD_MONTHS);

  return sourceEvents.flatMap(event => {
    const frequency = event.recurrence?.frequency || 'none';
    if (frequency === 'none') return [event];
    const originalStart = new Date(event.startAt);
    const duration = new Date(event.endAt).getTime() - originalStart.getTime();
    const { occurrences } = expandOccurrences({
      start: originalStart,
      frequency,
      interval: event.recurrence?.interval,
      until: event.recurrence?.until ? `${event.recurrence.until}T23:59:59` : null,
      windowStart,
      windowEnd,
    });
    return occurrences.map((occurrenceStart, index) => {
      const startAt = occurrenceStart.toISOString();
      return {
        ...event,
        id: `${event.id}::${startAt}`,
        sourceEventId: event.id,
        seriesStartAt: event.startAt,
        seriesEndAt: event.endAt,
        recurrenceIndex: index,
        startAt,
        endAt: new Date(occurrenceStart.getTime() + duration).toISOString(),
      };
    });
  });
}

export function useCalendarEvents() {
  const { activeOrgId } = useAppContext();
  const [events, setEvents] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!activeOrgId) {
      setEvents([]);
      setDeadlines([]);
      setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
      setEvents([]);
      setDeadlines([]);
    }
    try {
      const result = await calendarRequest(
        `/api/calendar/events?organizationId=${encodeURIComponent(activeOrgId)}`,
      );
      setEvents(expandRecurringEvents(result.events || []));
      setDeadlines(result.deadlines || []);
      setError(null);
    } catch (requestError) {
      setError(requestError);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [activeOrgId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  const createEvent = useCallback(async data => {
    const result = await calendarRequest('/api/calendar/events', {
      method: 'POST',
      body: JSON.stringify({ ...data, organizationId: activeOrgId }),
    });
    await refresh({ silent: true });
    return result.event;
  }, [activeOrgId, refresh]);

  const updateEvent = useCallback(async (eventId, data) => {
    const result = await calendarRequest(`/api/calendar/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    await refresh({ silent: true });
    return result.event;
  }, [refresh]);

  const removeEvent = useCallback(async eventId => {
    await calendarRequest(`/api/calendar/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    });
    await refresh({ silent: true });
  }, [refresh]);

  const respondToEvent = useCallback(async (eventId, response) => {
    return updateEvent(eventId, { response });
  }, [updateEvent]);

  return {
    events,
    deadlines,
    loading,
    error,
    refresh,
    createEvent,
    updateEvent,
    removeEvent,
    respondToEvent,
  };
}
