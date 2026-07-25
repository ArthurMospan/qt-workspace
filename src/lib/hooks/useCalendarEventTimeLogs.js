'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { reportLoadError } from '@/lib/utils/errors';

export function useCalendarEventTimeLogs(eventId, occurrenceStartAt) {
  const { activeOrgId } = useAppContext();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(Boolean(eventId));

  useEffect(() => {
    if (!eventId || !occurrenceStartAt || !activeOrgId) {
      queueMicrotask(() => {
        setLogs([]);
        setLoading(false);
      });
      return undefined;
    }

    const logsQuery = query(
      collection(db, 'timeLogs'),
      where('organizationId', '==', activeOrgId),
      where('eventId', '==', eventId),
      where('occurrenceStartAt', '==', occurrenceStartAt),
    );
    return onSnapshot(logsQuery, { serverTimestamps: 'estimate' }, snapshot => {
      const nextLogs = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      nextLogs.sort((a, b) => (b.loggedAt?.toMillis?.() ?? 0) - (a.loggedAt?.toMillis?.() ?? 0));
      setLogs(nextLogs);
      setLoading(false);
    }, error => {
      reportLoadError('[useCalendarEventTimeLogs]', error);
      setLoading(false);
    });
  }, [activeOrgId, eventId, occurrenceStartAt]);

  const addTimeLog = useCallback(async ({
    userId,
    projectId = '',
    spentMinutes,
    description = '',
  }) => {
    const minutes = Math.round(Number(spentMinutes));
    if (!eventId || !occurrenceStartAt || !userId || !Number.isFinite(minutes) || minutes <= 0) {
      throw new Error('Вкажіть коректний час');
    }
    const occurrenceDate = new Date(occurrenceStartAt);
    if (!Number.isFinite(occurrenceDate.getTime())) {
      throw new Error('Не вдалося визначити дату події');
    }
    await addDoc(collection(db, 'timeLogs'), {
      organizationId: activeOrgId,
      sourceType: 'calendar_event',
      eventId,
      occurrenceStartAt,
      issueId: '',
      projectId,
      userId,
      spentMinutes: minutes,
      description: String(description || '').trim().slice(0, 2000),
      // Calendar work belongs to the occurrence date, even when entered later.
      loggedAt: Timestamp.fromDate(occurrenceDate),
      createdAt: serverTimestamp(),
    });
  }, [activeOrgId, eventId, occurrenceStartAt]);

  const deleteTimeLog = useCallback(async logId => {
    await deleteDoc(doc(db, 'timeLogs', logId));
  }, []);

  return {
    logs,
    loading,
    totalMinutes: logs.reduce((sum, log) => sum + (Number(log.spentMinutes) || 0), 0),
    addTimeLog,
    deleteTimeLog,
  };
}
