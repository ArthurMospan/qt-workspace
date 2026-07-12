'use client';

// src/lib/hooks/useAllMyTasks.js — Fetch all tasks assigned to current user across all projects
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
export function useAllMyTasks(userId) {
  const {
    activeOrgId
  } = useAppContext();
  const { doneStatusIds } = useWorkflowConfig();
  const [tasks, setTasks] = useState([]);
  const [issueLinks, setIssueLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!activeOrgId || !userId) {
      queueMicrotask(() => {
        setTasks([]);
        setIssueLinks([]);
        setLoading(false);
      });
      return;
    }
    queueMicrotask(() => {
      setTasks([]);
      setIssueLinks([]);
      setLoading(true);
    });
    const q = query(collection(db, 'issues'), where('organizationId', '==', activeOrgId));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(issue => issue.assigneeIds?.includes(userId));
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
    }, err => {
      console.error('[useAllMyTasks] links error:', err);
    });

    return () => { unsub(); unsubLinks(); };
  }, [userId, activeOrgId]);
  const updateTask = useCallback(async (taskId, data) => {
    const current = tasks.find(task => task.id === taskId);
    const nextStatus = data.columnId || data.status;
    const updates = { ...data, updatedAt: serverTimestamp() };
    if (current && nextStatus) {
      const wasDone = doneStatusIds.includes(current.columnId || current.status);
      const willBeDone = doneStatusIds.includes(nextStatus);
      if (willBeDone && !wasDone) updates.completedAt = serverTimestamp();
      if (!willBeDone && wasDone) updates.completedAt = deleteField();
    }
    await updateDoc(doc(db, 'issues', taskId), {
      ...updates,
    });
  }, [tasks, doneStatusIds]);
  return {
    tasks,
    issueLinks,
    loading,
    updateTask
  };
}
