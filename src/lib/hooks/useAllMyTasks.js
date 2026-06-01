'use client';

// src/lib/hooks/useAllMyTasks.js — Fetch all tasks assigned to current user across all projects
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
export function useAllMyTasks(userId) {
  const {
    activeOrgId
  } = useAppContext();
  const [tasks, setTasks] = useState([]);
  const [issueLinks, setIssueLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!activeOrgId) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    const q = query(collection(db, 'issues'), where('organizationId', '==', activeOrgId));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      docs.sort((a, b) => {
        const aTime = a.dueDate?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.dueDate?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
        return aTime - bTime;
      });
      setTasks(docs);
      setLoading(false);
    }, err => {
      console.error('[useAllMyTasks]', err);
      setLoading(false);
    });

    const lq = query(collection(db, 'issueLinks'), where('organizationId', '==', activeOrgId));
    const unsubLinks = onSnapshot(lq, snap => {
      setIssueLinks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsub(); unsubLinks(); };
  }, [userId, activeOrgId]);
  const updateTask = useCallback(async (taskId, data) => {
    await updateDoc(doc(db, 'issues', taskId), {
      ...data,
      updatedAt: serverTimestamp()
    });
  }, []);
  return {
    tasks,
    issueLinks,
    loading,
    updateTask
  };
}