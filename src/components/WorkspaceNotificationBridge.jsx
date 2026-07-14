'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useNotifications } from '@/lib/hooks/useNotifications';
import useWorkspaceStore from '@/store/useWorkspaceStore';

export default function WorkspaceNotificationBridge() {
  const { currentUser } = useAppContext();
  const userId = currentUser?.id || currentUser?.uid;
  const showLiveNotif = useWorkspaceStore(state => state.showLiveNotif);
  const setNotificationCenter = useWorkspaceStore(state => state.setNotificationCenter);
  const clearNotificationCenter = useWorkspaceStore(state => state.clearNotificationCenter);
  const handleNew = useCallback(notification => showLiveNotif(notification), [showLiveNotif]);
  const notificationCenter = useNotifications(userId, { onNew: handleNew });
  const actions = useMemo(() => ({
    markAllRead: notificationCenter.markAllRead,
    markRead: notificationCenter.markRead,
    markUnread: notificationCenter.markUnread,
    removeNotification: notificationCenter.removeNotification,
    clearRead: notificationCenter.clearRead,
    markProjectRead: notificationCenter.markProjectRead,
  }), [
    notificationCenter.markAllRead,
    notificationCenter.markRead,
    notificationCenter.markUnread,
    notificationCenter.removeNotification,
    notificationCenter.clearRead,
    notificationCenter.markProjectRead,
  ]);

  useEffect(() => {
    setNotificationCenter(notificationCenter.notifications, notificationCenter.loading, actions);
  }, [actions, notificationCenter.loading, notificationCenter.notifications, setNotificationCenter]);

  useEffect(() => () => clearNotificationCenter(), [clearNotificationCenter, userId]);

  return null;
}
