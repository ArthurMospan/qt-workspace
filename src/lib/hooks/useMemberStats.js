'use client';
// src/lib/hooks/useMemberStats.js
// Computes real per-member stats from Firestore issues.
// Queries are scoped to projects where this org is the owner — avoids
// cross-tenant reads. Results are memoised to avoid re-querying on every render.
import { useState, useEffect } from 'react';
import {
  collection, query, where, getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * useMemberStats(uid, projectIds)
 *  - tasksDone  : issues where assigneeIds contains uid AND columnId === 'done'
 *  - tasksOpen  : issues assigned to uid NOT in 'done'
 *  - totalTime  : sum of spentMinutes on issues assigned to uid
 */
export function useMemberStats(uid, projectIds = []) {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || projectIds.length === 0) {
      setStats({ tasksDone: 0, tasksOpen: 0, totalMinutes: 0 });
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        // Firestore "array-contains" lets us find issues assigned to this uid
        // We query per-project to stay within org boundaries
        let done = 0, open = 0, minutes = 0;

        // Process in chunks of 10 (Firestore "in" limit)
        for (let i = 0; i < projectIds.length; i += 10) {
          const chunk = projectIds.slice(i, i + 10);
          const q = query(
            collection(db, 'issues'),
            where('projectId', 'in', chunk),
            where('assigneeIds', 'array-contains', uid),
          );
          const snap = await getDocs(q);
          for (const d of snap.docs) {
            const data = d.data();
            if (data.columnId === 'done') done++;
            else open++;
            minutes += data.spentMinutes || 0;
          }
        }

        if (!cancelled) {
          setStats({ tasksDone: done, tasksOpen: open, totalMinutes: minutes });
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setStats({ tasksDone: 0, tasksOpen: 0, totalMinutes: 0 });
          setLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [uid, projectIds.join(',')]); // eslint-disable-line

  return { stats, loading };
}
