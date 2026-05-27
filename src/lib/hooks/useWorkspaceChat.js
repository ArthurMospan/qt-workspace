'use client';
// src/lib/hooks/useWorkspaceChat.js
import { useState, useEffect } from 'react';
import { collection, doc, query, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc, where, deleteDoc, updateDoc, getDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';

export function useWorkspaceChat(channelId, channelType = 'channel') {
  const { currentUser, activeOrgId } = useAppContext();
  const [messages, setMessages] = useState([]);
  const [channels, setChannels] = useState([]);
  const [activeChannelData, setActiveChannelData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Thread state
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);

  // Fetch channels and projects to combine them
  useEffect(() => {
    if (!activeOrgId) return;
    
    let manualChannels = [];
    let projectChannels = [];

    const updateCombined = () => {
      // Avoid duplicate IDs just in case
      const seen = new Set();
      const combined = [...manualChannels, ...projectChannels].filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
      
      if (combined.length === 0) {
        setChannels([
          { id: 'general', name: 'general', type: 'public' },
          { id: 'design', name: 'design', type: 'public' },
          { id: 'development', name: 'development', type: 'public' }
        ]);
      } else {
        setChannels(combined.sort((a, b) => a.name.localeCompare(b.name)));
      }
    };

    const qChannels = query(collection(db, 'organizations', activeOrgId, 'channels'), orderBy('name', 'asc'));
    const unsubChannels = onSnapshot(qChannels, (snap) => {
      manualChannels = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateCombined();
    });

    const qProjects = query(collection(db, 'projects'), where('organizationId', '==', activeOrgId));
    const unsubProjects = onSnapshot(qProjects, (snap) => {
      projectChannels = snap.docs.map(d => ({ 
        id: `project_${d.id}`, 
        name: d.data().name || 'Project', 
        type: 'project', 
        originalId: d.id 
      }));
      updateCombined();
    });

    return () => {
      unsubChannels();
      unsubProjects();
    };
  }, [activeOrgId]);

  // Fetch messages for active channel
  useEffect(() => {
    if (!channelId || !activeOrgId) {
      setMessages([]);
      return;
    }
    
    setLoading(true);
    const messagesRef = collection(db, 'organizations', activeOrgId, 'channels', channelId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));
    
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => {
        const item = d.data();
        let timeString = '';
        if (item.createdAt && typeof item.createdAt.toDate === 'function') {
           timeString = item.createdAt.toDate().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
        } else {
           timeString = new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
        }

        return {
          id: d.id,
          ...item,
          time: timeString
        };
      });
      setMessages(data);
      setLoading(false);
    });

    return () => unsub();
  }, [channelId, activeOrgId]);

  // Fetch thread messages
  useEffect(() => {
    if (!activeThreadId || !channelId || !activeOrgId) {
      setThreadMessages([]);
      return;
    }

    const q = query(collection(db, 'organizations', activeOrgId, 'channels', channelId, 'messages', activeThreadId, 'replies'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => {
        const item = d.data();
        let timeString = '';
        if (item.createdAt && typeof item.createdAt.toDate === 'function') {
           timeString = item.createdAt.toDate().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
        } else {
           timeString = new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
        }
        return { id: d.id, ...item, time: timeString };
      });
      setThreadMessages(data);
    });
    return () => unsub();
  }, [activeThreadId, channelId, activeOrgId]);

  // Fetch active channel data (for typing indicators)
  useEffect(() => {
    if (!channelId || !activeOrgId) {
      setActiveChannelData(null);
      return;
    }

    const channelRef = doc(db, 'organizations', activeOrgId, 'channels', channelId);
    const unsub = onSnapshot(channelRef, (snap) => {
       if (snap.exists()) {
         setActiveChannelData(snap.data());
       } else {
         setActiveChannelData(null);
       }
    });
    return () => unsub();
  }, [channelId, activeOrgId]);

  const sendMessage = async (text, attachments = []) => {
    if ((!text.trim() && attachments.length === 0) || !currentUser || !channelId) return;

    try {
      // Ensure channel exists (lazy init)
      const channelRef = doc(db, 'organizations', activeOrgId, 'channels', channelId);
      await setDoc(channelRef, { 
        name: channelType === 'channel' ? channelId : 'DM', 
        type: channelType 
      }, { merge: true });

      const messagesRef = collection(channelRef, 'messages');
      await addDoc(messagesRef, {
        text: text.trim(),
        attachments: attachments,
        senderId: currentUser.id || currentUser.uid,
        user: currentUser.name || 'Користувач',
        avatar: currentUser.avatar || null,
        createdAt: serverTimestamp(),
        readBy: [currentUser.id || currentUser.uid]
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const deleteMessage = async (msgId) => {
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
      const snap = await getDoc(msgRef);
      if (!snap.exists()) return;
      
      const reactions = snap.data().reactions || {};
      const currentReactors = reactions[emoji] || [];
      
      if (currentReactors.includes(uid)) {
        reactions[emoji] = currentReactors.filter(id => id !== uid);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji] = [...currentReactors, uid];
      }
      
      await updateDoc(msgRef, { reactions });
    } catch (e) {
      console.error('Error toggling reaction:', e);
    }
  };

  const createChannel = async (name) => {
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

  const setTyping = async (isTyping) => {
    if (!channelId || !activeOrgId || !currentUser) return;
    const uid = currentUser.id || currentUser.uid;

    try {
      const channelRef = doc(db, 'organizations', activeOrgId, 'channels', channelId);
      await setDoc(channelRef, {
        typing: isTyping ? arrayUnion(uid) : arrayRemove(uid)
      }, { merge: true });
    } catch(e) {}
  };

  const sendThreadMessage = async (text, attachments = []) => {
    if ((!text.trim() && attachments.length === 0) || !currentUser || !channelId || !activeThreadId) return;
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
      await updateDoc(parentRef, { replyCount: increment(1) });
    } catch (e) {
      console.error(e);
    }
  };

  const openThread = (msgId) => setActiveThreadId(msgId);
  const closeThread = () => setActiveThreadId(null);

  return { channels, messages, loading, activeChannelData, activeThreadId, threadMessages, sendMessage, deleteMessage, editMessage, toggleReaction, createChannel, setTyping, openThread, closeThread, sendThreadMessage };
}
