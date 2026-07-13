'use client';

// src/lib/hooks/useComments.js — Internal comments for an issue (subcollection)
import { useState, useEffect, useCallback } from 'react';
import { collection, doc, getCountFromServer, onSnapshot, increment, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { reportLoadError } from '@/lib/utils/errors';
export function useComments(issueId) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!issueId) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    const colRef = collection(db, 'issues', issueId, 'comments');
    const unsub = onSnapshot(colRef, {
      serverTimestamps: 'estimate'
    }, snap => {
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      // Sort client-side by createdAt asc
      docs.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return aTime - bTime;
      });
      setComments(docs);
      setLoading(false);
    }, err => {
      reportLoadError('[useComments]', err);
      setLoading(false);
    });
    return () => unsub();
  }, [issueId]);

  // -------------------------------------------------------------------------
  // addComment
  // user: { uid, displayName, photoURL }
  // -------------------------------------------------------------------------
  const addComment = useCallback(async (issueId, text, user = {}, attachments = [], replyTo = null) => {
    if (!text?.trim() && attachments.length === 0) throw new Error('Comment cannot be empty');
    const commentRef = doc(collection(db, 'issues', issueId, 'comments'));
    const issueRef = doc(db, 'issues', issueId);
    const existingCount = await getCountFromServer(collection(db, 'issues', issueId, 'comments'));
    await runTransaction(db, async transaction => {
      const issueSnap = await transaction.get(issueRef);
      if (!issueSnap.exists()) throw new Error('Issue not found');
      transaction.set(commentRef, {
        authorId: user.uid || user.id || null,
        authorName: user.name || user.displayName || user.email?.split('@')[0] || 'Невідомо',
        authorAvatar: user.avatar || user.photoURL || null,
        text: text?.trim() || '',
        attachments,
        replyTo: replyTo ? {
          id: replyTo.id,
          authorName: replyTo.authorName || '',
          text: replyTo.text || '',
        } : null,
        createdAt: serverTimestamp()
      });
      transaction.update(issueRef, {
        commentCount: typeof issueSnap.data().commentCount === 'number'
          ? increment(1)
          : existingCount.data().count + 1,
        updatedAt: serverTimestamp(),
      });
    });
  }, []);

  const updateComment = useCallback(async (commentId, text) => {
    if (!issueId || !commentId || !text?.trim()) return;
    await updateDoc(doc(db, 'issues', issueId, 'comments', commentId), {
      text: text.trim(),
      editedAt: serverTimestamp(),
    });
  }, [issueId]);

  const deleteComment = useCallback(async commentId => {
    if (!issueId || !commentId) return;
    const commentRef = doc(db, 'issues', issueId, 'comments', commentId);
    const issueRef = doc(db, 'issues', issueId);
    await runTransaction(db, async transaction => {
      const issueSnap = await transaction.get(issueRef);
      transaction.delete(commentRef);
      if (issueSnap.exists()) {
        transaction.update(issueRef, {
          commentCount: Math.max(0, (issueSnap.data().commentCount || 0) - 1),
          updatedAt: serverTimestamp(),
        });
      }
    });
  }, [issueId]);

  return {
    comments,
    loading,
    addComment,
    updateComment,
    deleteComment,
  };
}
