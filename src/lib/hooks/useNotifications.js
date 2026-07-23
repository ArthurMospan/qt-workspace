'use client';

// src/lib/hooks/useNotifications.js
// Real-time notifications. Detects truly NEW docs and delivers them through
// channels the user controls in Налаштування → Сповіщення
// (users/{uid}/settings/notifications): browser push, sound, in-app popup,
// opt-in email. Also exposes list actions for the notification center.
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, query, where, orderBy, limit, onSnapshot, updateDoc, deleteDoc,
  doc, writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { notificationDestinationWithOrganization } from '@/lib/utils/notificationNavigation.mjs';

// Request browser notification permission once
export async function requestNotifPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// Fire a browser native notification
function fireBrowserNotif(notification) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const n = new Notification(notification.title, {
    body: notification.body,
    icon: '/logo.svg',
    badge: '/logo.svg',
    silent: notification.type === 'emergency',
    requireInteraction: notification.type === 'emergency',
    tag: notification.type === 'emergency' ? `emergency-${notification.id || 'alert'}` : undefined,
  });
  const link = notificationDestinationWithOrganization(notification);
  if (link) n.onclick = () => {
    window.focus();
    window.location.href = link;
    n.close();
  };
  if (notification.type !== 'emergency') setTimeout(() => n.close(), 8000);
}

// Soft two-tone chime via WebAudio — no external audio asset needed
function playChime() {
  if (typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const note = (freq, at, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + dur + 0.05);
    };
    const schedule = () => {
      note(880, 0, 0.3);        // A5
      note(1174.66, 0.1, 0.35); // D6
      setTimeout(() => { ctx.close().catch(() => {}); }, 900);
    };
    if (ctx.state === 'suspended') {
      ctx.resume().then(schedule).catch(() => ctx.close().catch(() => {}));
    } else {
      schedule();
    }
  } catch { /* audio not available — silently skip */ }
}

// Channel defaults — must mirror the notif initial state in settings/page.js
export const CHANNEL_DEFAULTS = { sound: true, popup: true, emailEnabled: false };

export function useNotifications(userId, {
  activeOrganizationId,
  onNew
} = {}) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const seenIds = useRef(new Set());
  const isFirstLoad = useRef(true);
  const prefsRef = useRef(CHANNEL_DEFAULTS);
  const activeOrganizationIdRef = useRef(activeOrganizationId);

  useEffect(() => {
    activeOrganizationIdRef.current = activeOrganizationId;
  }, [activeOrganizationId]);

  // Live-follow the user's channel preferences so toggles apply instantly
  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, 'users', userId, 'settings', 'notifications'), snap => {
      prefsRef.current = { ...CHANNEL_DEFAULTS, ...(snap.exists() ? snap.data() : {}) };
    }, () => {});
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(60),
    );
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })).sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)).slice(0, 50);
      if (isFirstLoad.current) {
        // On first load: just populate seenIds, don't fire popups
        isFirstLoad.current = false;
        docs.forEach(d => seenIds.current.add(d.id));
      } else {
        // On subsequent updates: detect new docs
        docs.forEach(n => {
          if (!seenIds.current.has(n.id)) {
            seenIds.current.add(n.id);
            if (n.organizationId !== activeOrganizationIdRef.current) return;
            const prefs = prefsRef.current;
            // 1. Browser native notification (gated by browser permission)
            fireBrowserNotif(n);
            // 2. Sound chime
            if (prefs.sound !== false && n.type !== 'emergency') playChime();
            // 3. In-app popup callback (goes to store)
            if (prefs.popup !== false && onNew) onNew(n);
          }
        });
      }
      setNotifications(docs);
      setUnreadCount(docs.filter(n => !n.read).length);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [userId]); // eslint-disable-line

  const markAllRead = useCallback(async (organizationId = null) => {
    if (!userId) return;
    const targets = notifications.filter(item => !item.read && (!organizationId || item.organizationId === organizationId));
    if (targets.length === 0) return;
    const batch = writeBatch(db);
    targets.forEach(item => batch.update(doc(db, 'notifications', item.id), { read: true }));
    await batch.commit();
  }, [notifications, userId]);

  const markRead = useCallback(async id => {
    await updateDoc(doc(db, 'notifications', id), {
      read: true
    });
  }, []);

  const markUnread = useCallback(async id => {
    await updateDoc(doc(db, 'notifications', id), {
      read: false
    });
  }, []);

  const removeNotification = useCallback(async id => {
    await deleteDoc(doc(db, 'notifications', id));
  }, []);

  // Delete everything already read — keeps the center tidy
  const clearRead = useCallback(async (organizationId = null) => {
    if (!userId) return;
    const targets = notifications.filter(item => item.read && (!organizationId || item.organizationId === organizationId));
    if (targets.length === 0) return;
    const batch = writeBatch(db);
    targets.forEach(item => batch.delete(doc(db, 'notifications', item.id)));
    await batch.commit();
  }, [notifications, userId]);

  const markProjectRead = useCallback(async (projectId, organizationId = null) => {
    const targets = notifications.filter(item =>
      !item.read && item.projectId === projectId && (!organizationId || item.organizationId === organizationId));
    if (targets.length === 0) return;
    const batch = writeBatch(db);
    targets.forEach(item => batch.update(doc(db, 'notifications', item.id), { read: true }));
    await batch.commit();
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    loading,
    markAllRead,
    markRead,
    markUnread,
    removeNotification,
    clearRead,
    markProjectRead,
  };
}

// ── Send notification(s) to users ───────────────────────────────────

// Recipient preferences, actor identity, membership and email delivery are
// resolved server-side; callers never need access to another user's profile.
export async function sendNotification({
  userIds = [],
  type,
  title,
  body,
  link = '',
  issueId = '',
  projectId = '',
  organizationId = '',
  dedupeKey = '',
}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Authentication required');
  const response = await fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userIds, type, title, body, link, issueId, projectId, organizationId, dedupeKey }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to send notification');
  return result;
}
