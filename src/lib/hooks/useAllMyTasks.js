'use client';
// src/lib/hooks/useAllMyTasks.js — Fetch all tasks assigned to current user across all projects
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, ORG_ID } from '@/lib/firebase';

export function useAllMyTasks(userId) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    const q = query(
      collection(db, 'tasks'),
      where('organizationId', '==', ORG_ID),
      where('assignees', 'array-contains', userId),
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        const aTime = a.dueDate?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.dueDate?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
        return aTime - bTime;
      });
      setTasks(docs);
      setLoading(false);
    }, (err) => {
      console.error('[useAllMyTasks]', err);
      setLoading(false);
    });

    return () => unsub();
  }, [userId]);

  const updateTask = useCallback(async (taskId, data) => {
    await updateDoc(doc(db, 'tasks', taskId), { ...data, updatedAt: serverTimestamp() });
  }, []);

  return { tasks, loading, updateTask };
}
