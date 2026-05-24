'use client';
// src/lib/hooks/useProjects.js — Real-time projects for authenticated user
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useProjects(userId) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    const q = query(
      collection(db, 'projects'),
      where('team', 'array-contains', userId),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, { serverTimestamps: 'estimate' }, (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error('[useProjects]', err);
      setLoading(false);
    });

    return () => unsub();
  }, [userId]);

  return { projects, loading };
}
