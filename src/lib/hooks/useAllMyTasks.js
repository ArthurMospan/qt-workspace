'use client';

// src/lib/hooks/useAllMyTasks.js — Fetch all tasks assigned to current user across all projects
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { useOptimisticPatch } from '@/lib/hooks/useOptimisticPatch';
import { reportLoadError } from '@/lib/utils/errors';
import { pickPatchableFields } from '@/lib/utils/optimistic.mjs';
export function useAllMyTasks(userId) {
  const {
    activeOrgId
  } = useAppContext();
  const { doneStatusIds } = useWorkflowConfig();
  const [snapshotTasks, setSnapshotTasks] = useState([]);
  const [issueLinks, setIssueLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  // Keeps the "My tasks" kanban from springing a dropped card back to its old
  // column while the write is in flight. Sorted by due date here, not by
  // `order`, so the merged list needs no re-sort.
  const [tasks, applyPatch, revertPatch] = useOptimisticPatch(snapshotTasks);
  useEffect(() => {
    if (!activeOrgId || !userId) {
      queueMicrotask(() => {
        setSnapshotTasks([]);
        setIssueLinks([]);
        setLoading(false);
      });
      return;
    }
    queueMicrotask(() => {
      setSnapshotTasks([]);
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
      setSnapshotTasks(docs);
      setLoading(false);
    }, err => {
      reportLoadError('[useAllMyTasks]', err);
      setLoading(false);
    });

    const lq = query(collection(db, 'issueLinks'), where('organizationId', '==', activeOrgId));
    const unsubLinks = onSnapshot(lq, snap => {
      setIssueLinks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => {
      reportLoadError('[useAllMyTasks] links', err);
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
    // Paint the new column before the round-trip, otherwise the drop animation
    // lands the card back where it started and the echo teleports it.
    const optimistic = pickPatchableFields(data);
    if (optimistic) applyPatch({ [taskId]: optimistic });

    try {
      await updateDoc(doc(db, 'issues', taskId), {
        ...updates,
      });
    } catch (err) {
      if (optimistic) revertPatch([taskId]);
      throw err;
    }
  }, [tasks, doneStatusIds, applyPatch, revertPatch]);
  return {
    tasks,
    issueLinks,
    loading,
    updateTask
  };
}
