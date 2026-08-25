'use client';

// src/lib/hooks/useComments.js — Internal comments for an issue (subcollection)
import { useState, useEffect, useCallback } from 'react';
import { arrayUnion, collection, deleteField, doc, getCountFromServer, limit, onSnapshot, orderBy, query, increment, runTransaction, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { reportLoadError } from '@/lib/utils/errors';
import { deleteFileFromCloudinary } from '@/lib/services/fileUpload';
// How much of a conversation opens with the task. The same reasoning as a chat
// channel: the newest page is what a reader arrives for, and the rest is loaded
// when they ask for it — a task discussed for a year must not cost its whole
// year every time somebody opens it.
export const COMMENT_WINDOW = 60;

/**
 * The task's comments, oldest first — which is how they are read — over a
 * window of the newest ones, which is how they are fetched.
 *
 * @param {string} issueId The task.
 * @param {number} windowSize How many of the newest comments to subscribe to.
 */
export function useComments(issueId, windowSize = COMMENT_WINDOW) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    if (!issueId) {
      queueMicrotask(() => setLoading(false));
      return undefined;
    }
    const conversationQuery = query(
      collection(db, 'issues', issueId, 'comments'),
      orderBy('createdAt', 'desc'),
      limit(windowSize),
    );
    const unsub = onSnapshot(conversationQuery, {
      serverTimestamps: 'estimate'
    }, snap => {
      // Newest first out of the query, oldest first into the conversation.
      setComments(snap.docs.map(d => ({ ...d.data(), id: d.id })).reverse());
      setHasMore(snap.size >= windowSize);
      setLoading(false);
    }, err => {
      reportLoadError('[useComments]', err);
      setLoading(false);
    });
    return () => unsub();
  }, [issueId, windowSize]);

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
        // What the composer already resolved about the tasks this comment
        // names, so drawing them later costs nothing. See `collectIssueMentions`.
        issueMentions: Array.isArray(options.issueMentions) ? options.issueMentions : [],
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
        // One tally per person, so a card can say "you were named three times"
        // instead of only "you were named in the last message" — which is all
        // `lastCommentMentionIds` can ever say, and the next message erases it.
        // Cleared for a reader in `markCommentsRead` below.
        ...Object.fromEntries(
          [...new Set(options.mentionedUserIds || [])]
            .filter(userId => userId && userId !== authorId)
            .map(userId => [`unreadMentions.${userId}`, increment(1)]),
        ),
      });
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('quickteam:issue-activity', {
        detail: {
          issueId,
          updatedAt: new Date(),
          lastActivityAt: new Date(),
          lastActivityType: 'comment',
          lastActivityActorId: authorId,
          lastActivityActorName: user.name || user.displayName || user.email?.split('@')[0] || 'Невідомо',
          lastActivityActorAvatar: user.avatar || user.photoURL || null,
          lastActivityText: text?.trim().slice(0, 240) || 'Вкладення',
          lastCommentAt: new Date(),
          lastCommentAuthorId: authorId,
          lastCommentMentionIds: options.mentionedUserIds || [],
          lastCommentReadBy: authorId ? [authorId] : [],
        },
      }));
    }
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
        // Reading the chat is what answers a mention, so the tally goes rather
        // than resetting to zero — an absent key costs nothing to store and
        // reads the same as a zero everywhere it is counted.
        [`unreadMentions.${userId}`]: deleteField(),
      });
      await batch.commit();
    } catch (error) {
      reportLoadError('[useComments] markRead', error);
    }
  }, [issueId]);

  return {
    comments,
    loading,
    hasMore,
    addComment,
    updateComment,
    deleteComment,
    markCommentsRead,
  };
}
