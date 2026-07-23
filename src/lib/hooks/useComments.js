'use client';

// src/lib/hooks/useComments.js — Internal comments for an issue (subcollection)
import { useState, useEffect, useCallback } from 'react';
import { arrayUnion, collection, doc, getCountFromServer, onSnapshot, increment, runTransaction, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { reportLoadError } from '@/lib/utils/errors';
import { deleteFileFromCloudinary } from '@/lib/services/fileUpload';
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
  const addComment = useCallback(async (issueId, text, user = {}, attachments = [], replyTo = null, options = {}) => {
    if (!text?.trim() && attachments.length === 0) throw new Error('Comment cannot be empty');
    const commentRef = doc(collection(db, 'issues', issueId, 'comments'));
    const issueRef = doc(db, 'issues', issueId);
    const authorId = user.uid || user.id || null;
    const existingCount = await getCountFromServer(collection(db, 'issues', issueId, 'comments'));
    await runTransaction(db, async transaction => {
      const issueSnap = await transaction.get(issueRef);
      if (!issueSnap.exists()) throw new Error('Issue not found');
      transaction.set(commentRef, {
        authorId,
        authorName: user.name || user.displayName || user.email?.split('@')[0] || 'Невідомо',
        authorAvatar: user.avatar || user.photoURL || null,
        text: text?.trim() || '',
        attachments,
        // The sender has read their own message — read receipts compare readBy
        // against everyone except the sender.
        readBy: authorId ? [authorId] : [],
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
        lastActivityType: 'comment',
        lastActivityAt: serverTimestamp(),
        lastActivityActorId: authorId,
        lastActivityActorName: user.name || user.displayName || user.email?.split('@')[0] || 'Невідомо',
        lastActivityActorAvatar: user.avatar || user.photoURL || null,
        lastActivityText: text?.trim().slice(0, 240) || 'Вкладення',
        lastCommentAt: serverTimestamp(),
        lastCommentAuthorId: authorId,
        lastCommentMentionIds: options.mentionedUserIds || [],
        lastCommentReadBy: authorId ? [authorId] : [],
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

  const deleteComment = useCallback(async (commentId, attachments = []) => {
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
    // Purge the message's files from Cloudinary so storage doesn't accumulate
    // orphans. Best-effort and after the doc is gone — a storage hiccup must
    // not resurrect a deleted message.
    await Promise.allSettled(
      (attachments || [])
        .filter(attachment => attachment?.storagePath)
        .map(attachment => deleteFileFromCloudinary(attachment.storagePath, attachment.resourceType))
    );
  }, [issueId]);

  // Read receipts: mark the given comments as read by `userId` (arrayUnion, so
  // it's idempotent). Best-effort — callers pass only comments not yet read by
  // this user, and a rules/permission hiccup must never break the chat.
  const markCommentsRead = useCallback(async (commentIds, userId) => {
    if (!issueId || !userId || !commentIds?.length) return;
    try {
      const batch = writeBatch(db);
      commentIds.slice(0, 400).forEach(commentId => {
        batch.update(doc(db, 'issues', issueId, 'comments', commentId), {
          readBy: arrayUnion(userId),
        });
      });
      batch.update(doc(db, 'issues', issueId), {
        lastCommentReadBy: arrayUnion(userId),
      });
      await batch.commit();
    } catch (error) {
      reportLoadError('[useComments] markRead', error);
    }
  }, [issueId]);

  return {
    comments,
    loading,
    addComment,
    updateComment,
    deleteComment,
    markCommentsRead,
  };
}
