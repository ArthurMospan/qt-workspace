'use client';
// src/lib/hooks/useTasks.js — CRUD for tasks with organizationId multi-tenancy
import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db, ORG_ID } from '@/lib/firebase';

export function useTasks(projectId) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }

    const q = query(
      collection(db, 'tasks'),
      where('organizationId', '==', ORG_ID),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
      organizationId: ORG_ID,
      projectId,
      assignees,
      createdBy,
      dueDate: dueDate || null,
      order: statusCount,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, [projectId, tasks]);

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
