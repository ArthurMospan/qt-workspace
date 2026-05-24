'use client';
// src/lib/hooks/useAuditLog.js — Audit history for an issue (subcollection)
import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const LIMIT = 50;

export function useAuditLog(issueId) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!issueId) {
      setLoading(false);
      return;
    }

    const colRef = collection(db, 'issues', issueId, 'audit');

    const unsub = onSnapshot(colRef, { serverTimestamps: 'estimate' }, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Sort client-side by createdAt desc
      docs.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      });

      // Cap at 50
      setEntries(docs.slice(0, LIMIT));
      setLoading(false);
    }, (err) => {
      console.error('[useAuditLog] onSnapshot error', err);
      setLoading(false);
    });

    return () => unsub();
  }, [issueId]);

  return { entries, loading };
}
