'use client';
// src/lib/hooks/useWorkspaceChat.js
import { useState, useEffect } from 'react';
import { collection, doc, query, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';

export function useWorkspaceChat(channelId) {
  const { currentUser, activeOrgId } = useAppContext();
  const [messages, setMessages] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch channels
  useEffect(() => {
    if (!activeOrgId) return;
    const q = query(collection(db, 'organizations', activeOrgId, 'channels'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Basic fallback if empty
      setChannels(data.length ? data : [
        { id: 'general', name: 'general', type: 'public' },
        { id: 'design', name: 'design', type: 'public' },
        { id: 'development', name: 'development', type: 'public' }
      ]);
    });
    return () => unsub();
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

  const sendMessage = async (text) => {
    if (!text.trim() || !currentUser || !channelId) return;

    try {
      // Ensure channel exists (lazy init)
      const channelRef = doc(db, 'organizations', activeOrgId, 'channels', channelId);
      await setDoc(channelRef, { name: channelId, type: 'public' }, { merge: true });

      const messagesRef = collection(channelRef, 'messages');
      await addDoc(messagesRef, {
        text: text.trim(),
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

  return { channels, messages, loading, sendMessage };
}
