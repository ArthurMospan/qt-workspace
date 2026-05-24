'use client';
// src/lib/hooks/useProjectTimeLogs.js — Aggregated time logs for a whole project
import { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot,
} from 'firebase/firestore';
import { db, ORG_ID } from '@/lib/firebase';

export function useProjectTimeLogs(projectId) {
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [byUser, setByUser] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'timeLogs'),
      where('organizationId', '==', ORG_ID),
      where('projectId', '==', projectId),
    );

    const unsub = onSnapshot(q, { serverTimestamps: 'estimate' }, (snap) => {
      let total = 0;
      const userMap = {};

      snap.docs.forEach(d => {
        const { userId, spentMinutes = 0 } = d.data();
        total += spentMinutes;
        if (userId) {
          userMap[userId] = (userMap[userId] || 0) + spentMinutes;
        }
      });

      setTotalMinutes(total);
      setByUser(userMap);
      setLoading(false);
    }, (err) => {
      console.error('[useProjectTimeLogs] onSnapshot error', err);
      setLoading(false);
    });

    return () => unsub();
  }, [projectId]);

  return { totalMinutes, byUser, loading };
}
