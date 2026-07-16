'use client';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getPortalDb } from '@/lib/portal/firebase';

/**
 * One-shot count of the connected user's QuickTeam+ projects — the Phase 2 proof
 * that data actually flows. QT+ rules authorize the read by team membership.
 */
export function usePortalProjects(portalUser) {
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!portalUser) return;
    const db = getPortalDb();
    if (!db) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const snap = await getDocs(
          query(collection(db, 'projects'), where('team', 'array-contains', portalUser.uid)),
        );
        if (!cancelled) { setCount(snap.size); setLoading(false); }
      } catch (err) {
        console.error('[qtplus] portal projects read failed:', err);
        if (!cancelled) { setError('read_failed'); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [portalUser]);

  return { count, loading, error };
}
