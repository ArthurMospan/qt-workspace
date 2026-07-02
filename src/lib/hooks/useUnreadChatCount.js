'use client';

// src/lib/hooks/useUnreadChatCount.js — number of chat channels with unread messages
// (channel.lastMessageAt is newer than the user's readState cursor — same rule as the chat sidebar)
import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';

export function useUnreadChatCount() {
  const { currentUser, activeOrgId } = useAppContext();
  const [channels, setChannels] = useState([]);
  const [readState, setReadState] = useState(null); // { channelId: lastReadAt Timestamp }

  useEffect(() => {
    if (!activeOrgId || !currentUser) return;
    const uid = currentUser.id || currentUser.uid;
    const qReadState = query(collection(db, 'organizations', activeOrgId, 'readState'), where('userId', '==', uid));
    const unsub = onSnapshot(qReadState, snap => {
      const state = {};
      snap.forEach(d => {
        const data = d.data();
        state[data.channelId] = data.lastReadAt;
      });
      setReadState(state);
    }, err => {
      console.error('[useUnreadChatCount.js] onSnapshot error', err);
    });
    return () => unsub();
  }, [activeOrgId, currentUser]);

  useEffect(() => {
    if (!activeOrgId) return;
    const qChannels = query(collection(db, 'organizations', activeOrgId, 'channels'));
    const unsub = onSnapshot(qChannels, snap => {
      setChannels(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => {
      console.error('[useUnreadChatCount.js] onSnapshot error', err);
    });
    return () => unsub();
  }, [activeOrgId]);

  return useMemo(() => {
    if (!readState) return 0;
    return channels.filter(c => {
      // Same exclusions as useWorkspaceChat: DM pseudo-channel, project channels, test channels
      if (c.id === 'DM' || c.id?.startsWith('project_') || /^\d+$/.test(c.id)) return false;
      if (!c.lastMessageAt || !readState[c.id]) return false;
      return (c.lastMessageAt?.toMillis?.() ?? 0) > (readState[c.id]?.toMillis?.() ?? 0);
    }).length;
  }, [channels, readState]);
}
