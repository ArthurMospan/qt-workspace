'use client';
// src/lib/hooks/useTaskChat.js — Real-time team-only comments per task
import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useTaskChat(taskId) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskId) { setLoading(false); return; }

    const q = query(
      collection(db, 'tasks', taskId, 'taskComments'),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [taskId]);

  const sendComment = useCallback(async (text, currentUser) => {
    if (!taskId || !text.trim()) return;
    await addDoc(collection(db, 'tasks', taskId, 'taskComments'), {
      text: text.trim(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar || '',
      createdAt: serverTimestamp(),
    });
  }, [taskId]);

  const deleteComment = useCallback(async (commentId) => {
    if (!taskId || !commentId) return;
    await deleteDoc(doc(db, 'tasks', taskId, 'taskComments', commentId));
  }, [taskId]);

  return { comments, loading, sendComment, deleteComment };
}
