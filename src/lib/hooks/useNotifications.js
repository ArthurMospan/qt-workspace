'use client';

// src/lib/hooks/useNotifications.js
// Real-time notifications. Detects truly NEW docs and delivers them through
// channels the user controls in Налаштування → Сповіщення
// (users/{uid}/settings/notifications): sound, in-app popup and opt-in email.
// Also exposes list actions for the notification center.
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, query, where, orderBy, limit, onSnapshot, updateDoc, deleteDoc,
  doc, getDocs, writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { CHANNEL_DEFAULTS } from '@/lib/utils/notificationChannels.mjs';

// Live window kept in memory for the notification centre.
const PAGE_SIZE = 50;
// Firestore caps a batched write at 500 operations.
const WRITE_BATCH_LIMIT = 400;

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

// Re-exported for callers that already import it from here. The definition
// lives with the delivery rules in lib/utils/notificationChannels.mjs, which the
// settings page and both server senders read too.
export { CHANNEL_DEFAULTS };

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
    // Scoped to the active organization. A user-only query let notifications
    // from other organizations consume the page limit and inflate the badge
    // for an organization the user is not even looking at.
    const q = activeOrganizationId
      ? query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('organizationId', '==', activeOrganizationId),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
      )
      : query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
      );
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }))
        // `inapp: false` marks a document written purely as the cross-channel
        // dedupe claim for someone who wanted this event by email or Telegram
        // only. Filtered here rather than in the query: adding it as a `where`
        // would need a composite index and would hide every document written
        // before the field existed.
        .filter(n => n.inapp !== false)
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
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
            // 1. Sound chime
            if (prefs.sound !== false && n.type !== 'emergency') playChime();
            // 2. In-app popup callback (goes to store)
            if (prefs.popup !== false && onNew) onNew(n);
          }
        });
      }
      setNotifications(docs);
      setUnreadCount(docs.filter(n => !n.read).length);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [userId, activeOrganizationId]); // eslint-disable-line

  // "Mark all read" / "clear read" used to operate on the loaded page only, so
  // with more unread items than the page size the button appeared to do
  // nothing for the rest. Both now walk every matching document in batches.
  const applyToAllMatching = useCallback(async (organizationId, matches, mutate) => {
    if (!userId) return;
    const constraints = [where('userId', '==', userId)];
    if (organizationId) constraints.push(where('organizationId', '==', organizationId));
    const snapshot = await getDocs(query(collection(db, 'notifications'), ...constraints));
    const targets = snapshot.docs.filter(matches);
    for (let index = 0; index < targets.length; index += WRITE_BATCH_LIMIT) {
      const batch = writeBatch(db);
      targets.slice(index, index + WRITE_BATCH_LIMIT).forEach(item => mutate(batch, item.ref));
      await batch.commit();
    }
  }, [userId]);

  const markAllRead = useCallback(async (organizationId = null) => {
    await applyToAllMatching(
      organizationId,
      item => item.data().read !== true,
      (batch, ref) => batch.update(ref, { read: true }),
    );
  }, [applyToAllMatching]);

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
    await applyToAllMatching(
      organizationId,
      item => item.data().read === true,
      (batch, ref) => batch.delete(ref),
    );
  }, [applyToAllMatching]);

  const markProjectRead = useCallback(async (projectId, organizationId = null) => {
    await applyToAllMatching(
      organizationId,
      item => item.data().read !== true && item.data().projectId === projectId,
      (batch, ref) => batch.update(ref, { read: true }),
    );
  }, [applyToAllMatching]);

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
