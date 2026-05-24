'use client';
// src/lib/hooks/useTimeLogs.js — Time log CRUD for a single issue
import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db, ORG_ID } from '@/lib/firebase';

export function useTimeLogs(issueId) {
  const [logs, setLogs] = useState([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!issueId) {
      setLoading(false);
      return;
    }

    // Two equality filters — no composite index required
    const q = query(
      collection(db, 'timeLogs'),
      where('organizationId', '==', ORG_ID),
      where('issueId', '==', issueId),
    );

    const unsub = onSnapshot(q, { serverTimestamps: 'estimate' }, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Sort client-side by loggedAt desc
      docs.sort((a, b) => {
        const aTime = a.loggedAt?.toMillis?.() ?? 0;
        const bTime = b.loggedAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      });

      const total = docs.reduce((sum, l) => sum + (l.spentMinutes || 0), 0);
      setLogs(docs);
      setTotalMinutes(total);
      setLoading(false);
    }, (err) => {
      console.error('[useTimeLogs] onSnapshot error', err);
      setLoading(false);
    });

    return () => unsub();
  }, [issueId]);

  // -------------------------------------------------------------------------
  // addTimeLog
  // -------------------------------------------------------------------------
  const addTimeLog = useCallback(async (issueId, projectId, userId, minutes, description = '') => {
    if (!minutes || minutes <= 0) throw new Error('minutes must be > 0');

    await addDoc(collection(db, 'timeLogs'), {
      issueId,
      projectId,
      userId,
      organizationId: ORG_ID,
      spentMinutes: Math.round(minutes),
      description: description || '',
      loggedAt: serverTimestamp(),
    });
  }, []);

  return { logs, totalMinutes, loading, addTimeLog };
}
