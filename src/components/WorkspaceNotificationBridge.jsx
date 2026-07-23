'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { useUnreadChatCount } from '@/lib/hooks/useUnreadChatCount';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { auth } from '@/lib/firebase';

export default function WorkspaceNotificationBridge() {
  const { currentUser, activeOrgId } = useAppContext();
  const userId = currentUser?.id || currentUser?.uid;
  const unreadChats = useUnreadChatCount();
  const baseTitleRef = useRef('');
  const playedEmergencyIds = useRef(new Set());
  const emergencyTimers = useRef(new Map());
  const showLiveNotif = useWorkspaceStore(state => state.showLiveNotif);
  const clearLiveNotif = useWorkspaceStore(state => state.clearLiveNotif);
  const setNotificationCenter = useWorkspaceStore(state => state.setNotificationCenter);
  const clearNotificationCenter = useWorkspaceStore(state => state.clearNotificationCenter);
  const handleNew = useCallback(notification => showLiveNotif(notification), [showLiveNotif]);
  const notificationCenter = useNotifications(userId, {
    activeOrganizationId: activeOrgId,
    onNew: handleNew,
  });
  const unreadChatNotifications = notificationCenter.notifications.filter(notification =>
    notification.type === 'chat_message'
    && !notification.read
    && notification.organizationId === activeOrgId).length;
  const displayedUnreadChats = unreadChatNotifications || unreadChats;

  useEffect(() => {
    clearLiveNotif();
  }, [activeOrgId, clearLiveNotif]);

  useEffect(() => {
    if (!activeOrgId || !userId) return undefined;
    let cancelled = false;
    const checkCalendarReminders = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token || cancelled) return;
        await fetch('/api/calendar/reminders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ organizationId: activeOrgId }),
        });
      } catch {
        // Best-effort poll: the next interval safely retries deterministic reminders.
      }
    };
    checkCalendarReminders();
    const timer = window.setInterval(checkCalendarReminders, 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeOrgId, userId]);
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

  useEffect(() => {
    for (const [id, timers] of emergencyTimers.current.entries()) {
      const remainsUnread = notificationCenter.notifications.some(item =>
        item.id === id
        && item.type === 'emergency'
        && !item.read
        && item.organizationId === activeOrgId);
      if (!remainsUnread) {
        timers.forEach(window.clearTimeout);
        emergencyTimers.current.delete(id);
      }
    }

    notificationCenter.notifications.forEach(notification => {
      if (
        notification.type !== 'emergency'
        || notification.read
        || notification.organizationId !== activeOrgId
        || playedEmergencyIds.current.has(notification.id)
      ) return;

      playedEmergencyIds.current.add(notification.id);
      const playAlarm = () => {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 0.2;
        audio.play().catch(() => {});
      };
      playAlarm();
      emergencyTimers.current.set(notification.id, [
        window.setTimeout(playAlarm, 3000),
        window.setTimeout(playAlarm, 6000),
      ]);
    });

  }, [activeOrgId, notificationCenter.notifications]);

  useEffect(() => {
    const timersByNotification = emergencyTimers.current;
    return () => {
      for (const timers of timersByNotification.values()) timers.forEach(window.clearTimeout);
      timersByNotification.clear();
    };
  }, []);

  useEffect(() => () => clearNotificationCenter(), [clearNotificationCenter, userId]);

  useEffect(() => {
    if (!baseTitleRef.current) {
      baseTitleRef.current = document.title.replace(/^\(\d+\)\s*/, '').replace(/^Нове повідомлення ·\s*/, '');
    }
    const baseTitle = baseTitleRef.current || 'QuickTeam';
    if (displayedUnreadChats === 0) {
      document.title = baseTitle;
      return undefined;
    }

    let alternate = false;
    const renderTitle = () => {
      alternate = !alternate;
      document.title = document.hidden && alternate
        ? `Нове повідомлення · ${baseTitle}`
        : `(${displayedUnreadChats}) ${baseTitle}`;
    };
    renderTitle();
    const timer = window.setInterval(renderTitle, 1400);
    document.addEventListener('visibilitychange', renderTitle);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', renderTitle);
      document.title = baseTitle;
    };
  }, [displayedUnreadChats]);

  return null;
}
