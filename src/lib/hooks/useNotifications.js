'use client';

// src/lib/hooks/useNotifications.js
// Real-time notifications. Detects truly NEW docs and delivers them through
// channels the user controls in Налаштування → Сповіщення
// (users/{uid}/settings/notifications): browser push, sound, in-app popup,
// opt-in email. Also exposes list actions for the notification center.
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, query, where, limit, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, writeBatch, serverTimestamp, getDocs, getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sendEmailNotification } from '@/lib/utils/sendEmail';

// Request browser notification permission once
export async function requestNotifPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// Fire a browser native notification
function fireBrowserNotif(title, body, link) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const n = new Notification(title, {
    body,
    icon: '/logo.svg',
    badge: '/logo.svg',
    silent: false
  });
  if (link) n.onclick = () => {
    window.focus();
    window.location.href = link;
    n.close();
  };
  setTimeout(() => n.close(), 8000);
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
    note(880, 0, 0.3);        // A5
    note(1174.66, 0.1, 0.35); // D6
    setTimeout(() => { ctx.close().catch(() => {}); }, 900);
  } catch { /* audio not available — silently skip */ }
}

// Channel defaults — must mirror the notif initial state in settings/page.js
export const CHANNEL_DEFAULTS = { sound: true, popup: true, emailEnabled: false };

export function useNotifications(userId, {
  onNew
} = {}) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const seenIds = useRef(new Set());
  const isFirstLoad = useRef(true);
  const prefsRef = useRef(CHANNEL_DEFAULTS);

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
    const q = query(collection(db, 'notifications'), where('userId', '==', userId), limit(60));
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
            const prefs = prefsRef.current;
            // 1. Browser native notification (gated by browser permission)
            fireBrowserNotif(n.title, n.body, n.link);
            // 2. Sound chime
            if (prefs.sound !== false) playChime();
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

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, {
      read: true
    }));
    await batch.commit();
  }, [userId]);

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
  const clearRead = useCallback(async () => {
    if (!userId) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', true));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }, [userId]);

  return {
    notifications,
    unreadCount,
    loading,
    markAllRead,
    markRead,
    markUnread,
    removeNotification,
    clearRead
  };
}

// ── Send notification(s) to users ───────────────────────────────────

// Maps notification type → toggle key in users/{uid}/settings/notifications.
// Types not listed here (e.g. 'alert' emergency calls, 'test') are always delivered.
const PREF_KEY_BY_TYPE = {
  assigned: 'assigned',
  commented: 'commented',
  status_changed: 'statusChanged',
  mentioned: 'mentioned',
  deadline: 'deadline'
};
// Must mirror the defaults in settings/page.js (notif initial state)
const PREF_DEFAULTS = {
  assigned: true, commented: true, statusChanged: false, deadline: true, mentioned: true
};
// Only the important types go to the opt-in email channel
const EMAIL_TYPES = new Set(['assigned', 'mentioned', 'deadline', 'alert']);

async function getRecipientPrefs(userId) {
  try {
    const snap = await getDoc(doc(db, 'users', userId, 'settings', 'notifications'));
    return snap.exists() ? snap.data() : {};
  } catch {
    return {};
  }
}

export async function sendNotification({
  userIds = [],
  type,
  title,
  body,
  link = '',
  issueId = '',
  projectId = '',
  actor = null, // { id, name, avatar } — хто виконав дію (для аватарки в центрі сповіщень)
}) {
  await Promise.all(userIds.map(async userId => {
    const prefs = await getRecipientPrefs(userId);
    const prefKey = PREF_KEY_BY_TYPE[type];
    if (prefKey && !(prefs[prefKey] ?? PREF_DEFAULTS[prefKey])) return;

    await addDoc(collection(db, 'notifications'), {
      userId,
      type,
      title,
      body,
      link,
      issueId,
      projectId,
      actorId: actor?.id || '',
      actorName: actor?.name || '',
      actorAvatar: actor?.avatar || '',
      read: false,
      createdAt: serverTimestamp()
    }).catch(() => {});

    // Opt-in email channel (Налаштування → Сповіщення → Email)
    if (prefs.emailEnabled && EMAIL_TYPES.has(type)) {
      try {
        const userSnap = await getDoc(doc(db, 'users', userId));
        const email = userSnap.exists() ? userSnap.data()?.email : null;
        if (email) await sendEmailNotification({ email, type, title, body, link });
      } catch { /* email is best-effort */ }
    }
  }));
}
