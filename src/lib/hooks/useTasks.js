'use client';
// src/lib/hooks/useTasks.js — CRUD for tasks with organizationId multi-tenancy
import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';

export function useTasks(projectId) {
  const { activeOrgId } = useAppContext();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || !activeOrgId) { setLoading(false); return; }

    // No orderBy to avoid composite index requirement — sorted client-side
    const q = query(
      collection(db, 'tasks'),
      where('organizationId', '==', activeOrgId),
      where('projectId', '==', projectId),
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort client-side: by order within status, then by createdAt desc
      docs.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      });
      setTasks(docs);
      setLoading(false);
    }, (err) => {
      console.error('[useTasks]', err);
      setLoading(false);
    });

    return () => unsub();
  }, [projectId]);

  const createTask = useCallback(async (data) => {
    const { createdBy, dueDate, assignees = [], ...rest } = data;

    // Count tasks in target status to set order
    const statusCount = tasks.filter(t => t.status === (rest.status || 'todo')).length;

    await addDoc(collection(db, 'tasks'), {
      ...rest,
      organizationId: activeOrgId,
      projectId,
      assignees,
      createdBy,
      dueDate: dueDate || null,
      order: statusCount,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, [projectId, tasks, activeOrgId]);

  const updateTask = useCallback(async (taskId, data) => {
    await updateDoc(doc(db, 'tasks', taskId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }, []);

  const deleteTask = useCallback(async (taskId) => {
    await deleteDoc(doc(db, 'tasks', taskId));
  }, []);

  const moveTask = useCallback(async (taskId, newStatus, newOrder) => {
    // Re-order tasks in destination column
    const batch = writeBatch(db);
    const destTasks = tasks
      .filter(t => t.id !== taskId && t.status === newStatus)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    destTasks.splice(newOrder, 0, { id: taskId });
    destTasks.forEach((t, i) => {
      batch.update(doc(db, 'tasks', t.id), { order: i, updatedAt: serverTimestamp() });
    });

    batch.update(doc(db, 'tasks', taskId), {
      status: newStatus,
      order: newOrder,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  }, [tasks]);

  return { tasks, loading, createTask, updateTask, deleteTask, moveTask };
}
