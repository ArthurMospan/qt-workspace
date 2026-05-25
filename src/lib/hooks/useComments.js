'use client';
// src/lib/hooks/useComments.js — Internal comments for an issue (subcollection)
import { useState, useEffect, useCallback } from 'react';
import {
  collection, onSnapshot, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useComments(issueId) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!issueId) {
      setLoading(false);
      return;
    }

    const colRef = collection(db, 'issues', issueId, 'comments');

    const unsub = onSnapshot(colRef, { serverTimestamps: 'estimate' }, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort client-side by createdAt asc
      docs.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return aTime - bTime;
      });
      setComments(docs);
      setLoading(false);
    }, (err) => {
      console.error('[useComments] onSnapshot error', err);
      setLoading(false);
    });

    return () => unsub();
  }, [issueId]);

  // -------------------------------------------------------------------------
  // addComment
  // user: { uid, displayName, photoURL }
  // -------------------------------------------------------------------------
  const addComment = useCallback(async (issueId, text, user = {}) => {
    if (!text?.trim()) throw new Error('Comment text cannot be empty');

    await addDoc(collection(db, 'issues', issueId, 'comments'), {
      authorId:     user.uid    || user.id    || null,
      authorName:   user.name   || user.displayName || user.email?.split('@')[0] || 'Невідомо',
      authorAvatar: user.avatar || user.photoURL    || null,
      text: text.trim(),
      createdAt: serverTimestamp(),
    });
  }, []);

  return { comments, loading, addComment };
}
