'use client';
// src/lib/hooks/useStagesForProject.js — Real-time stages for a project
import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useStagesForProject(projectId) {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }

    const q = query(
      collection(db, 'stages'),
      where('projectId', '==', projectId),
      orderBy('order', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setStages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [projectId]);

  return { stages, loading };
}
