'use client';

import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';

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

function addRecurrence(date, frequency, interval) {
  const next = new Date(date);
  if (frequency === 'daily') next.setDate(next.getDate() + interval);
  if (frequency === 'weekly') next.setDate(next.getDate() + 7 * interval);
  if (frequency === 'monthly') next.setMonth(next.getMonth() + interval);
  return next;
}

function expandRecurringEvents(sourceEvents) {
  const horizonEnd = new Date();
  horizonEnd.setFullYear(horizonEnd.getFullYear() + 2);
  return sourceEvents.flatMap(event => {
    const frequency = event.recurrence?.frequency || 'none';
    if (frequency === 'none') return [event];
    const interval = Math.max(1, Number(event.recurrence?.interval) || 1);
    const originalStart = new Date(event.startAt);
    const duration = new Date(event.endAt).getTime() - originalStart.getTime();
    const configuredUntil = event.recurrence?.until
      ? new Date(`${event.recurrence.until}T23:59:59`)
      : horizonEnd;
    const until = configuredUntil < horizonEnd ? configuredUntil : horizonEnd;
    const occurrences = [];
    let occurrenceStart = originalStart;
    let index = 0;
    while (occurrenceStart <= until && index < 400) {
      const startAt = occurrenceStart.toISOString();
      occurrences.push({
        ...event,
        id: `${event.id}::${startAt}`,
        sourceEventId: event.id,
        seriesStartAt: event.startAt,
        seriesEndAt: event.endAt,
        recurrenceIndex: index,
        startAt,
        endAt: new Date(occurrenceStart.getTime() + duration).toISOString(),
      });
      occurrenceStart = addRecurrence(occurrenceStart, frequency, interval);
      index += 1;
    }
    return occurrences;
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
