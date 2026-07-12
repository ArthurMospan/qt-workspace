'use client';

// src/lib/hooks/useWorkspaceChat.js
import { useState, useEffect } from 'react';
import { collection, doc, query, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc, where, deleteDoc, updateDoc, getDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
export function useWorkspaceChat(channelId, channelType = 'channel') {
  const {
    currentUser,
    activeOrgId
  } = useAppContext();
  const [messages, setMessages] = useState([]);
  const [channels, setChannels] = useState([]);
  const [activeChannelData, setActiveChannelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [readState, setReadState] = useState({}); // { channelId: Timestamp }
  const [activeDMs, setActiveDMs] = useState([]); // [uid, ...]

  // Thread state
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);

  // Fetch read state for all channels (per-user cursor tracking)
  useEffect(() => {
    if (!activeOrgId || !currentUser) return;
    const uid = currentUser.id || currentUser.uid;
    const qReadState = query(collection(db, 'organizations', activeOrgId, 'readState'), where('userId', '==', uid));
    const unsub = onSnapshot(qReadState, snap => {
      const state = {};
      snap.forEach(doc => {
        const data = doc.data();
        state[data.channelId] = data.lastReadAt;
      });
      setReadState(state);
    }, err => {
      console.error("[useWorkspaceChat.js] onSnapshot error", err);
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
      console.error("[useWorkspaceChat.js] onSnapshot error", err);
    });
    return () => unsub();
  }, [activeOrgId, currentUser]);

  // Fetch manual channels only (no auto-generated project channels)
  useEffect(() => {
    if (!activeOrgId) return;
    const qChannels = query(collection(db, 'organizations', activeOrgId, 'channels'));
    const unsubChannels = onSnapshot(qChannels, snap => {
      // Filter out invalid/test channels
      let channels = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })).filter(c => {
        // Skip DM as channel, project channels, and obviously invalid names
        if (c.id === 'DM' || c.id?.startsWith('project_')) return false;
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
      console.error("[useWorkspaceChat.js] onSnapshot error", err);
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
      console.error("[useWorkspaceChat.js] onSnapshot error", err);
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
      console.error("[useWorkspaceChat.js] onSnapshot error", err);
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
      console.error("[useWorkspaceChat.js] onSnapshot error", err);
    });
    return () => unsub();
  }, [channelId, activeOrgId]);
  const sendMessage = async (text, attachments = []) => {
    if (!text.trim() && attachments.length === 0 || !currentUser || !channelId) return;
    try {
      const uid = currentUser.id || currentUser.uid;
      const channelRef = doc(db, 'organizations', activeOrgId, 'channels', channelId);

      // Ensure channel exists and update metadata
      await setDoc(channelRef, {
        name: channelType === 'channel' ? channelId : 'DM',
        type: channelType === 'channel' ? 'public' : 'dm',
        lastMessageAt: serverTimestamp(),
        lastMessageText: text.trim().slice(0, 80),
        lastMessageSender: currentUser.name || 'Користувач'
      }, {
        merge: true
      });
      const messagesRef = collection(channelRef, 'messages');
      await addDoc(messagesRef, {
        text: text.trim(),
        attachments: attachments,
        senderId: uid,
        user: currentUser.name || 'Користувач',
        avatar: currentUser.avatar || null,
        createdAt: serverTimestamp(),
        readBy: [uid]
      });

      // Mark this channel as read by the sender
      await setDoc(doc(db, 'organizations', activeOrgId, 'readState', `${uid}_${channelId}`), {
        lastReadAt: serverTimestamp(),
        channelId,
        userId: uid
      }, {
        merge: true
      });

      // If DM, update activeDMs for both participants
      if (channelType === 'dm') {
        const parts = channelId.split('_');
        for (const partnerId of parts) {
          const others = parts.filter(p => p !== partnerId);
          await setDoc(doc(db, 'organizations', activeOrgId, 'activeDMs', partnerId), {
            partners: arrayUnion(...others)
          }, {
            merge: true
          });
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };
  const deleteMessage = async msgId => {
    if (!channelId || !activeOrgId) return;
    try {
      const msgRef = doc(db, 'organizations', activeOrgId, 'channels', channelId, 'messages', msgId);
      await deleteDoc(msgRef);
    } catch (e) {
      console.error('Error deleting message:', e);
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
    }
  };
  const toggleReaction = async (msgId, emoji) => {
    if (!channelId || !activeOrgId || !currentUser) return;
    const uid = currentUser.id || currentUser.uid;
    try {
      const msgRef = doc(db, 'organizations', activeOrgId, 'channels', channelId, 'messages', msgId);

      // First check if user already reacted
      const snap = await getDoc(msgRef);
      if (!snap.exists()) return;
      const reactions = snap.data().reactions || {};
      const hasReacted = (reactions[emoji] || []).includes(uid);

      // Use atomic arrayUnion/arrayRemove to avoid race conditions
      const update = {};
      update[`reactions.${emoji}`] = hasReacted ? arrayRemove(uid) : arrayUnion(uid);
      await updateDoc(msgRef, update);
    } catch (e) {
      console.error('Error toggling reaction:', e);
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
    const uid = currentUser.id || currentUser.uid;
    try {
      const channelRef = doc(db, 'organizations', activeOrgId, 'channels', channelId);
      await setDoc(channelRef, {
        typing: isTyping ? arrayUnion(uid) : arrayRemove(uid)
      }, {
        merge: true
      });
    } catch (e) {}
  };
  const sendThreadMessage = async (text, attachments = []) => {
    if (!text.trim() && attachments.length === 0 || !currentUser || !channelId || !activeThreadId) return;
    try {
      const repliesRef = collection(db, 'organizations', activeOrgId, 'channels', channelId, 'messages', activeThreadId, 'replies');
      await addDoc(repliesRef, {
        text: text.trim(),
        attachments: attachments,
        senderId: currentUser.id || currentUser.uid,
        user: currentUser.name || 'Користувач',
        avatar: currentUser.avatar || null,
        createdAt: serverTimestamp()
      });
      const parentRef = doc(db, 'organizations', activeOrgId, 'channels', channelId, 'messages', activeThreadId);
      await updateDoc(parentRef, {
        replyCount: increment(1)
      });
    } catch (e) {
      console.error(e);
    }
  };
  const markAsRead = async cId => {
    if (!currentUser || !activeOrgId || !cId) return;
    const uid = currentUser.id || currentUser.uid;
    try {
      await setDoc(doc(db, 'organizations', activeOrgId, 'readState', `${uid}_${cId}`), {
        lastReadAt: serverTimestamp(),
        channelId: cId,
        userId: uid
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
      await deleteDoc(replyRef);

      // Decrement reply count on parent message
      const parentRef = doc(db, 'organizations', activeOrgId, 'channels', channelId, 'messages', parentMsgId);
      await updateDoc(parentRef, {
        replyCount: increment(-1)
      });
    } catch (e) {
      console.error('Error deleting reply:', e);
    }
  };
  const openThread = msgId => setActiveThreadId(msgId);
  const closeThread = () => setActiveThreadId(null);

  // Compute unread count for a channel
  const getUnreadCount = cId => {
    if (!readState[cId]) return messages.length;
    const lastReadAt = readState[cId]?.toMillis?.() ?? 0;
    return messages.filter(m => (m.createdAt?.toMillis?.() ?? 0) > lastReadAt).length;
  };
  return {
    channels,
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
