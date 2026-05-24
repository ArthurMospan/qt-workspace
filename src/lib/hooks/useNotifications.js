'use client';
// src/lib/hooks/useNotifications.js
import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, orderBy, limit,
  onSnapshot, addDoc, updateDoc, doc, writeBatch,
  serverTimestamp, getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(30),
    );

    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(docs);
      setUnreadCount(docs.filter(n => !n.read).length);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [userId]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
  }, [userId]);

  const markRead = useCallback(async (id) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  }, []);

  return { notifications, unreadCount, loading, markAllRead, markRead };
}

// ── Send a notification to one or more users ──────────────────────
export async function sendNotification({ userIds = [], type, title, body, link = '', issueId = '', projectId = '' }) {
  await Promise.all(
    userIds.map(userId =>
      addDoc(collection(db, 'notifications'), {
        userId, type, title, body, link, issueId, projectId,
        read: false,
        createdAt: serverTimestamp(),
      }).catch(() => {})
    )
  );
}
