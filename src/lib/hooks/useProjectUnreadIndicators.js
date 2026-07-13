'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { reportLoadError } from '@/lib/utils/errors';

export function useProjectUnreadIndicators(userId) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!userId) {
      queueMicrotask(() => setNotifications([]));
      return;
    }
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
    );
    return onSnapshot(notificationsQuery, snapshot => {
      setNotifications(snapshot.docs
        .map(item => ({ id: item.id, ...item.data() }))
        .filter(item => !item.read));
    }, error => {
      reportLoadError('[useProjectUnreadIndicators]', error);
      setNotifications([]);
    });
  }, [userId]);

  const unreadProjectIds = useMemo(
    () => new Set(notifications.map(item => item.projectId).filter(Boolean)),
    [notifications],
  );

  const markProjectRead = useCallback(async projectId => {
    const projectNotifications = notifications.filter(item => item.projectId === projectId);
    if (projectNotifications.length === 0) return;
    const batch = writeBatch(db);
    projectNotifications.forEach(item => batch.update(doc(db, 'notifications', item.id), { read: true }));
    await batch.commit();
  }, [notifications]);

  return { unreadProjectIds, markProjectRead };
}
