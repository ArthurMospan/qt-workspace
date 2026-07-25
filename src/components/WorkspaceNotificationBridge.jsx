'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { useUnreadChatCount } from '@/lib/hooks/useUnreadChatCount';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { auth } from '@/lib/firebase';

// How often a visible tab asks the server whether a reminder is due. The
// server's look-back window (REMINDER_LOOKBACK_MS) must stay comfortably
// larger than this, or a reminder could fall between two polls.
const REMINDER_POLL_MS = 180_000;

// Synthesised locally instead of streamed from assets.mixkit.co. Pulling an
// alarm sound off a third-party CDN meant the emergency alert silently failed
// whenever that host was blocked, offline or slow — exactly the moments the
// alert matters most — and disclosed usage to an unrelated service.
function playEmergencyAlarm() {
  if (typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const play = () => {
      // Two-tone descending siren, twice.
      [0, 0.55].forEach(offset => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, ctx.currentTime + offset);
        osc.frequency.exponentialRampToValueAtTime(560, ctx.currentTime + offset + 0.42);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + offset + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.5);
      });
      window.setTimeout(() => { ctx.close().catch(() => {}); }, 1400);
    };
    if (ctx.state === 'suspended') ctx.resume().then(play).catch(() => ctx.close().catch(() => {}));
    else play();
  } catch { /* audio unavailable — the visual alert still fires */ }
}

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
  const restoreTimer = useWorkspaceStore(state => state.restoreTimer);
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

  // A running timer survives reloads and crashes; re-attach it as soon as the
  // workspace mounts so the user never silently loses tracked time.
  useEffect(() => {
    restoreTimer();
  }, [restoreTimer]);

  // Reminder polling is the single largest source of Firestore reads in the
  // app: it runs in every open tab, for every user, forever. A hidden tab has
  // nobody to show a reminder to, so it does not poll at all — it catches up
  // the moment it becomes visible. Reminders are idempotent (deterministic
  // notification ids) and the server looks back further than this interval, so
  // a slower cadence cannot drop one.
  useEffect(() => {
    if (!activeOrgId || !userId) return undefined;
    let cancelled = false;
    const checkCalendarReminders = async () => {
      if (cancelled || document.hidden) return;
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
    const timer = window.setInterval(checkCalendarReminders, REMINDER_POLL_MS);
    const onVisible = () => { if (!document.hidden) checkCalendarReminders(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
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
      playEmergencyAlarm();
      emergencyTimers.current.set(notification.id, [
        window.setTimeout(playEmergencyAlarm, 3000),
        window.setTimeout(playEmergencyAlarm, 6000),
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

  // Captured on every run, not once: pinning it to the first page meant the tab
  // kept showing the title of whatever page happened to load first for as long
  // as there were unread chats.
  useEffect(() => {
    const decorated = /^(\(\d+\)\s*|Нове повідомлення ·\s*)/;
    if (!decorated.test(document.title)) {
      baseTitleRef.current = document.title;
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
