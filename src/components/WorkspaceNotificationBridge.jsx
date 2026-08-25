'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { useUnreadChatCount } from '@/lib/hooks/useUnreadChatCount';
import { useOrganizationUnreadCounts } from '@/lib/hooks/useOrganizationUnreadCounts';
import { useUserTimerState } from '@/lib/hooks/useUserTimerState';
import { isConversationOnScreen } from '@/lib/utils/notificationPresence.mjs';
import useWorkspaceStore from '@/store/useWorkspaceStore';

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
  const playedEmergencyIds = useRef(new Set());
  const emergencyTimers = useRef(new Map());
  const setUnreadChatCount = useWorkspaceStore(state => state.setUnreadChatCount);
  const showLiveNotif = useWorkspaceStore(state => state.showLiveNotif);
  const clearLiveNotif = useWorkspaceStore(state => state.clearLiveNotif);
  const setNotificationCenter = useWorkspaceStore(state => state.setNotificationCenter);
  const clearNotificationCenter = useWorkspaceStore(state => state.clearNotificationCenter);
  // Read off the store rather than subscribed to: which conversation is open
  // matters only at the instant a notification arrives, and re-subscribing this
  // callback to it would rebuild the whole notification stream every time the
  // reader switched panes.
  const handleNew = useCallback(notification => {
    if (isConversationOnScreen(notification, useWorkspaceStore.getState().visibleConversation)) return;
    showLiveNotif(notification);
  }, [showLiveNotif]);
  const notificationCenter = useNotifications(userId, {
    activeOrganizationId: activeOrgId,
    onNew: handleNew,
  });
  useOrganizationUnreadCounts();
  useUserTimerState(userId);
  const unreadChatNotifications = notificationCenter.notifications.filter(notification =>
    notification.type === 'chat_message'
    && !notification.read
    && notification.organizationId === activeOrgId).length;
  const displayedUnreadChats = unreadChatNotifications || unreadChats;

  useEffect(() => {
    clearLiveNotif();
  }, [activeOrgId, clearLiveNotif]);

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

  // Published rather than rendered. This component owns the only subscription
  // to the chat channels and read cursors; the bottom bar and the tab title
  // read the number back out of the store instead of opening their own pair of
  // Firestore listeners each. document.title itself belongs to
  // WorkspaceDocumentTitle, which is the only writer.
  useEffect(() => {
    setUnreadChatCount(displayedUnreadChats);
  }, [displayedUnreadChats, setUnreadChatCount]);

  useEffect(() => () => setUnreadChatCount(0), [setUnreadChatCount]);

  return null;
}
