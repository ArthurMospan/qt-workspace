'use client';

// src/lib/hooks/useWorkspaceChat.js
import { useState, useEffect, useRef } from 'react';
import { collection, doc, query, orderBy, onSnapshot, serverTimestamp, setDoc, where, deleteDoc, updateDoc, getDoc, arrayUnion, arrayRemove, increment, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { reportLoadError } from '@/lib/utils/errors';
import { sendNotification } from '@/lib/hooks/useNotifications';
import { channelUnreadCount } from '@/lib/utils/workspaceChat.mjs';

export function useWorkspaceChat(channelId, channelType = 'channel', dmPartnerId = null) {
  const {
    currentUser,
    activeOrgId
  } = useAppContext();
  const [messages, setMessages] = useState([]);
  const [channels, setChannels] = useState([]);
  const [dmChannels, setDmChannels] = useState([]);
  const [activeChannelData, setActiveChannelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [readState, setReadState] = useState({}); // { channelId: Timestamp }
  const [activeDMs, setActiveDMs] = useState([]); // [uid, ...]
  const typingStateRef = useRef(false);

  // Thread state
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);

  useEffect(() => {
    typingStateRef.current = false;
    if (!channelId || !activeOrgId || !currentUser) return undefined;
    const uid = currentUser.id || currentUser.uid;
    const channelRef = doc(db, 'organizations', activeOrgId, 'channels', channelId);
    return () => {
      if (!typingStateRef.current) return;
      typingStateRef.current = false;
      void updateDoc(channelRef, { typing: arrayRemove(uid) }).catch(() => {});
    };
  }, [activeOrgId, channelId, currentUser]);

  // Fetch read state for all channels (per-user cursor tracking)
  useEffect(() => {
    if (!activeOrgId || !currentUser) return;
    const uid = currentUser.id || currentUser.uid;
    const qReadState = query(collection(db, 'organizations', activeOrgId, 'readState'), where('userId', '==', uid));
    const unsub = onSnapshot(qReadState, snap => {
      const state = {};
      snap.forEach(doc => {
        const data = doc.data();
        state[data.channelId] = {
          lastReadAt: data.lastReadAt,
          messageCount: Number(data.messageCount || 0),
        };
      });
      setReadState(state);
    }, err => {
      reportLoadError('[useWorkspaceChat] messages', err);
    });
    return () => unsub();
  }, [activeOrgId, currentUser]);

  // Fetch active DMs list for current user
  useEffect(() => {
    if (!activeOrgId || !currentUser) return;
    const uid = currentUser.id || currentUser.uid;
    const dmDocRef = doc(db, 'organizations', activeOrgId, 'activeDMs', uid);
    const unsub = onSnapshot(dmDocRef, snap => {
      if (snap.exists()) {
        setActiveDMs(snap.data().partners || []);
      } else {
        setActiveDMs([]);
      }
    }, err => {
      reportLoadError('[useWorkspaceChat] channel', err);
    });
    return () => unsub();
  }, [activeOrgId, currentUser]);

  // Fetch manual channels only (no auto-generated project channels)
  useEffect(() => {
    if (!activeOrgId) return;
    const qChannels = query(collection(db, 'organizations', activeOrgId, 'channels'));
    const unsubChannels = onSnapshot(qChannels, snap => {
      const allChannels = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setDmChannels(allChannels.filter(channel => channel.type === 'dm'));

      // Filter out DMs, invalid/test channels and auto-generated project rooms.
      let channels = allChannels.filter(c => {
        // Skip DM as channel, project channels, and obviously invalid names
        if (c.type === 'dm' || c.id === 'DM' || c.id?.startsWith('project_')) return false;
        if (!c.name || c.name.length === 0) return false;
        // Skip test channels (single digit IDs like "1", "11")
        if (/^\d+$/.test(c.id)) return false;
        return true;
      });

      // Always include general channel
      const hasGeneral = channels.some(c => c.id === 'general');
      const finalChannels = hasGeneral ? channels : [{
        id: 'general',
        name: 'general',
        type: 'public'
      }, ...channels];
      if (finalChannels.length > 0) {
        // Sort by lastMessageAt desc (most recent first), then alphabetically
        finalChannels.sort((a, b) => {
          const aTime = a.lastMessageAt?.toMillis?.() ?? 0;
          const bTime = b.lastMessageAt?.toMillis?.() ?? 0;
          if (bTime !== aTime) return bTime - aTime;
          return a.name.localeCompare(b.name);
        });
        setChannels(finalChannels);
      } else {
        setChannels([{
          id: 'general',
          name: 'general',
          type: 'public'
        }, {
          id: 'design',
          name: 'design',
          type: 'public'
        }, {
          id: 'development',
          name: 'development',
          type: 'public'
        }]);
      }
    }, err => {
      reportLoadError('[useWorkspaceChat] channels', err);
    });
    return () => unsubChannels();
  }, [activeOrgId]);

  // Fetch messages for active channel
  useEffect(() => {
    if (!channelId || !activeOrgId) {
      queueMicrotask(() => setMessages([]));
      return;
    }
    queueMicrotask(() => setLoading(true));
    const messagesRef = collection(db, 'organizations', activeOrgId, 'channels', channelId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => {
        const item = d.data();
        let timeString = '';
        if (item.createdAt && typeof item.createdAt.toDate === 'function') {
          timeString = item.createdAt.toDate().toLocaleTimeString('uk-UA', {
            hour: '2-digit',
            minute: '2-digit'
          });
        } else {
          timeString = new Date().toLocaleTimeString('uk-UA', {
            hour: '2-digit',
            minute: '2-digit'
          });
        }
        return {
          id: d.id,
          ...item,
          time: timeString
        };
      });
      setMessages(data);
      setLoading(false);
    }, err => {
      reportLoadError('[useWorkspaceChat] read state', err);
    });
    return () => unsub();
  }, [channelId, activeOrgId]);

  // Fetch thread messages
  useEffect(() => {
    if (!activeThreadId || !channelId || !activeOrgId) {
      queueMicrotask(() => setThreadMessages([]));
      return;
    }
    const q = query(collection(db, 'organizations', activeOrgId, 'channels', channelId, 'messages', activeThreadId, 'replies'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => {
        const item = d.data();
        let timeString = '';
        if (item.createdAt && typeof item.createdAt.toDate === 'function') {
          timeString = item.createdAt.toDate().toLocaleTimeString('uk-UA', {
            hour: '2-digit',
            minute: '2-digit'
          });
        } else {
          timeString = new Date().toLocaleTimeString('uk-UA', {
            hour: '2-digit',
            minute: '2-digit'
          });
        }
        return {
          id: d.id,
          ...item,
          time: timeString
        };
      });
      setThreadMessages(data);
    }, err => {
      reportLoadError('[useWorkspaceChat] direct messages', err);
    });
    return () => unsub();
  }, [activeThreadId, channelId, activeOrgId]);

  // Fetch active channel data (for typing indicators)
  useEffect(() => {
    if (!channelId || !activeOrgId) {
      queueMicrotask(() => setActiveChannelData(null));
      return;
    }
    const channelRef = doc(db, 'organizations', activeOrgId, 'channels', channelId);
    const unsub = onSnapshot(channelRef, snap => {
      if (snap.exists()) {
        setActiveChannelData(snap.data());
      } else {
        setActiveChannelData(null);
      }
    }, err => {
      reportLoadError('[useWorkspaceChat] replies', err);
    });
    return () => unsub();
  }, [channelId, activeOrgId]);
  const sendMessage = async (text, attachments = []) => {
    if (!text.trim() && attachments.length === 0 || !currentUser || !channelId) return;
    try {
      const uid = currentUser.id || currentUser.uid;
      const channelRef = doc(db, 'organizations', activeOrgId, 'channels', channelId);
      const messagesRef = collection(channelRef, 'messages');
      const messageRef = doc(messagesRef);
      const batch = writeBatch(db);
      const channelMetadata = {
        lastMessageAt: serverTimestamp(),
        lastMessageText: text.trim().slice(0, 80),
        lastMessageSender: currentUser.name || 'Користувач',
        lastMessageSenderId: uid,
        messageCount: increment(1),
      };
      if (channelType === 'dm') {
        channelMetadata.name = 'DM';
        channelMetadata.type = 'dm';
      } else if (channelId === 'general') {
        channelMetadata.name = 'general';
        channelMetadata.type = 'public';
      }
      batch.set(channelRef, channelMetadata, { merge: true });
      batch.set(messageRef, {
        text: text.trim(),
        attachments: attachments,
        senderId: uid,
        user: currentUser.name || 'Користувач',
        avatar: currentUser.avatar || null,
        createdAt: serverTimestamp(),
        readBy: [uid]
      });
      batch.set(doc(db, 'organizations', activeOrgId, 'readState', `${uid}_${channelId}`), {
        lastReadAt: serverTimestamp(),
        channelId,
        userId: uid,
      }, { merge: true });
      await batch.commit();

      // The current Firestore rules allow the sender to add themselves only to
      // the recipient's active-DM document. Keep this best-effort so a sidebar
      // bookkeeping failure can never cancel an already-sent message.
      if (channelType === 'dm') {
        if (dmPartnerId) {
          void (async () => {
            try {
            const recipientDMRef = doc(db, 'organizations', activeOrgId, 'activeDMs', dmPartnerId);
            await setDoc(recipientDMRef, {
              partners: arrayUnion(uid)
            }, {
              merge: true
            });
          } catch (activeDMError) {
            console.error('[workspace-chat] Failed to update recipient DM list:', activeDMError);
          }

          // Notification delivery is intentionally independent from Firestore
          // sidebar state, otherwise one denied write suppresses the alert.
          try {
            await sendNotification({
              userIds: [dmPartnerId],
              type: 'chat_message',
              title: currentUser.name || 'Нове приватне повідомлення',
              body: text.trim() || 'Надіслано вкладення',
              link: `/chat?dm=${encodeURIComponent(uid)}`,
              organizationId: activeOrgId,
              dedupeKey: `chat_${messageRef.id}`,
            });
          } catch (notificationError) {
            console.error('[workspace-chat] DM notification failed:', notificationError);
          }
          })();
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };
  const deleteMessage = async msgId => {
    if (!channelId || !activeOrgId) return;
    try {
      const msgRef = doc(db, 'organizations', activeOrgId, 'channels', channelId, 'messages', msgId);
      await deleteDoc(msgRef);
    } catch (e) {
      console.error('Error deleting message:', e);
      throw e;
    }
  };
  const editMessage = async (msgId, newText) => {
    if (!channelId || !activeOrgId || !newText.trim()) return;
    try {
      const msgRef = doc(db, 'organizations', activeOrgId, 'channels', channelId, 'messages', msgId);
      await updateDoc(msgRef, {
        text: newText.trim(),
        isEdited: true,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error('Error editing message:', e);
      throw e;
    }
  };
  const toggleReaction = async (msgId, emoji, hasReacted = false) => {
    if (!channelId || !activeOrgId || !currentUser) return;
    const uid = currentUser.id || currentUser.uid;
    try {
      const msgRef = doc(db, 'organizations', activeOrgId, 'channels', channelId, 'messages', msgId);

      // Use atomic arrayUnion/arrayRemove to avoid race conditions
      const update = {};
      update[`reactions.${emoji}`] = hasReacted ? arrayRemove(uid) : arrayUnion(uid);
      await updateDoc(msgRef, update);
    } catch (e) {
      console.error('Error toggling reaction:', e);
      throw e;
    }
  };
  const createChannel = async name => {
    if (!name.trim() || !activeOrgId) return null;
    const safeId = name.trim().toLowerCase().replace(/\s+/g, '-');
    try {
      await setDoc(doc(db, 'organizations', activeOrgId, 'channels', safeId), {
        name: name.trim().toLowerCase(),
        type: 'public'
      });
      return safeId;
    } catch (error) {
      console.error('Error creating channel:', error);
      return null;
    }
  };
  const setTyping = async isTyping => {
    if (!channelId || !activeOrgId || !currentUser) return;
    if (typingStateRef.current === isTyping) return;
    typingStateRef.current = isTyping;
    const uid = currentUser.id || currentUser.uid;
    try {
      const channelRef = doc(db, 'organizations', activeOrgId, 'channels', channelId);
      await setDoc(channelRef, {
        typing: isTyping ? arrayUnion(uid) : arrayRemove(uid)
      }, {
        merge: true
      });
    } catch (e) {
      typingStateRef.current = !isTyping;
    }
  };
  const sendThreadMessage = async (text, attachments = []) => {
    if (!text.trim() && attachments.length === 0 || !currentUser || !channelId || !activeThreadId) return;
    try {
      const parentRef = doc(db, 'organizations', activeOrgId, 'channels', channelId, 'messages', activeThreadId);
      const replyRef = doc(collection(parentRef, 'replies'));
      const batch = writeBatch(db);
      batch.set(replyRef, {
        text: text.trim(),
        attachments: attachments,
        senderId: currentUser.id || currentUser.uid,
        user: currentUser.name || 'Користувач',
        avatar: currentUser.avatar || null,
        createdAt: serverTimestamp()
      });
      batch.update(parentRef, {
        replyCount: increment(1)
      });
      await batch.commit();
    } catch (e) {
      console.error(e);
      throw e;
    }
  };
  const markAsRead = async cId => {
    if (!currentUser || !activeOrgId || !cId) return;
    const uid = currentUser.id || currentUser.uid;
    try {
      const channelSnapshot = await getDoc(doc(db, 'organizations', activeOrgId, 'channels', cId));
      await setDoc(doc(db, 'organizations', activeOrgId, 'readState', `${uid}_${cId}`), {
        lastReadAt: serverTimestamp(),
        channelId: cId,
        userId: uid,
        messageCount: Number(channelSnapshot.data()?.messageCount || 0),
      }, {
        merge: true
      });
    } catch (e) {
      console.error('Error marking as read:', e);
    }
  };
  const deleteReply = async (parentMsgId, replyId) => {
    if (!channelId || !activeOrgId || !parentMsgId || !replyId) return;
    try {
      const replyRef = doc(db, 'organizations', activeOrgId, 'channels', channelId, 'messages', parentMsgId, 'replies', replyId);
      const parentRef = doc(db, 'organizations', activeOrgId, 'channels', channelId, 'messages', parentMsgId);
      const batch = writeBatch(db);
      batch.delete(replyRef);
      batch.update(parentRef, {
        replyCount: increment(-1)
      });
      await batch.commit();
    } catch (e) {
      console.error('Error deleting reply:', e);
      throw e;
    }
  };
  const openThread = msgId => setActiveThreadId(msgId);
  const closeThread = () => setActiveThreadId(null);

  // Compute unread count for a channel
  const getUnreadCount = cId => {
    const channel = [...channels, ...dmChannels].find(item => item.id === cId);
    return channelUnreadCount(channel, readState[cId], currentUser?.id || currentUser?.uid);
  };
  return {
    channels,
    dmChannels,
    messages,
    loading,
    activeChannelData,
    activeThreadId,
    threadMessages,
    readState,
    activeDMs,
    sendMessage,
    deleteMessage,
    editMessage,
    toggleReaction,
    createChannel,
    setTyping,
    openThread,
    closeThread,
    sendThreadMessage,
    markAsRead,
    deleteReply,
    getUnreadCount
  };
}
