'use client';

import { useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import useWorkspaceStore from '@/store/useWorkspaceStore';

export function useUserTimerState(userId) {
  const applyUserTimerState = useWorkspaceStore(state => state.applyUserTimerState);
  const clearUserTimerState = useWorkspaceStore(state => state.clearUserTimerState);
  const flushQueuedTimerStop = useWorkspaceStore(state => state.flushQueuedTimerStop);

  useEffect(() => {
    if (!userId) {
      clearUserTimerState();
      return undefined;
    }
    let cancelled = false;
    const unsubscribe = onSnapshot(doc(db, 'timerStates', userId), snapshot => {
      if (cancelled) return;
      applyUserTimerState(snapshot.exists() ? snapshot.data() : null, userId);
      flushQueuedTimerStop(userId);
    }, () => {
      // Keep the last server-confirmed timer visible during a transient loss of
      // connectivity. The listener will reconcile it on reconnect.
    });
    const flushOnline = () => {
      if (!cancelled) flushQueuedTimerStop(userId);
    };
    window.addEventListener('online', flushOnline);
    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('online', flushOnline);
      clearUserTimerState();
    };
  }, [applyUserTimerState, clearUserTimerState, flushQueuedTimerStop, userId]);
}
