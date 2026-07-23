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

export function useCalendarEvents() {
  const { activeOrgId } = useAppContext();
  const [events, setEvents] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!activeOrgId) {
      setEvents([]);
      setDeadlines([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setEvents([]);
    setDeadlines([]);
    try {
      const result = await calendarRequest(
        `/api/calendar/events?organizationId=${encodeURIComponent(activeOrgId)}`,
      );
      setEvents(result.events || []);
      setDeadlines(result.deadlines || []);
      setError(null);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
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
    setEvents(previous => [...previous, result.event]);
    return result.event;
  }, [activeOrgId]);

  const updateEvent = useCallback(async (eventId, data) => {
    const result = await calendarRequest(`/api/calendar/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    setEvents(previous => previous.map(event => event.id === eventId ? result.event : event));
    return result.event;
  }, []);

  const removeEvent = useCallback(async eventId => {
    await calendarRequest(`/api/calendar/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    });
    setEvents(previous => previous.filter(event => event.id !== eventId));
  }, []);

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
