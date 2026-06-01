'use client';

// src/lib/hooks/useNotifications.js
// Real-time notifications: detects truly NEW docs, fires browser Notification + in-app popup
import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, where, limit, onSnapshot, addDoc, updateDoc, doc, writeBatch, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
export function useNotifications(userId, {
  onNew
} = {}) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const seenIds = useRef(new Set());
  const isFirstLoad = useRef(true);
  useEffect(() => {
    if (!userId) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    const q = query(collection(db, 'notifications'), where('userId', '==', userId), limit(40));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })).sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)).slice(0, 30);
      if (isFirstLoad.current) {
        // On first load: just populate seenIds, don't fire popups
        isFirstLoad.current = false;
        docs.forEach(d => seenIds.current.add(d.id));
      } else {
        // On subsequent updates: detect new docs
        docs.forEach(n => {
          if (!seenIds.current.has(n.id)) {
            seenIds.current.add(n.id);
            // 1. Browser native notification
            fireBrowserNotif(n.title, n.body, n.link);

            if (typeof Audio !== 'undefined') {
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
              audio.volume = 0.2;
              audio.play().catch(() => {});
            }

            // 2. In-app popup callback (goes to store)
            if (onNew) onNew(n);
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
  return {
    notifications,
    unreadCount,
    loading,
    markAllRead,
    markRead
  };
}

// ── Send notification(s) to users ───────────────────────────────────

export async function sendNotification({
  userIds = [],
  type,
  title,
  body,
  link = '',
  issueId = '',
  projectId = ''
}) {
  await Promise.all(userIds.map(userId => addDoc(collection(db, 'notifications'), {
    userId,
    type,
    title,
    body,
    link,
    issueId,
    projectId,
    read: false,
    createdAt: serverTimestamp()
  }).catch(() => {})));
}