'use client';
// src/lib/hooks/useSprints.js — CRUD for sprints
import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  writeBatch, arrayUnion, arrayRemove
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';

export function useSprints(projectId) {
  const { activeOrgId } = useAppContext();
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || !activeOrgId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'sprints'),
      where('organizationId', '==', activeOrgId),
      where('projectId', '==', projectId)
    );

    const unsub = onSnapshot(q, { serverTimestamps: 'estimate' }, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by createdAt ascending (oldest first)
      docs.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return aTime - bTime;
      });
      setSprints(docs);
      setLoading(false);
    }, (err) => {
      console.error('[useSprints] onSnapshot error', err);
      setLoading(false);
    });

    return () => unsub();
  }, [projectId, activeOrgId]);

  const createSprint = useCallback(async (data) => {
    if (!projectId || !activeOrgId) return;
    
    // Auto-generate name if not provided
    const sprintCount = sprints.length + 1;
    const name = data.name || `Спринт ${sprintCount}`;

    await addDoc(collection(db, 'sprints'), {
      projectId,
      organizationId: activeOrgId,
      name,
      goal: data.goal || '',
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      status: 'planned', // planned, active, completed
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, [projectId, activeOrgId, sprints]);

  const updateSprint = useCallback(async (sprintId, data) => {
    await updateDoc(doc(db, 'sprints', sprintId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }, []);

  const deleteSprint = useCallback(async (sprintId) => {
    await deleteDoc(doc(db, 'sprints', sprintId));
  }, []);

  const startSprint = useCallback(async (sprintId) => {
    if (!projectId) return;
    const batch = writeBatch(db);
    batch.update(doc(db, 'sprints', sprintId), {
      status: 'active',
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'projects', projectId), {
      activeSprints: arrayUnion(sprintId)
    });
    await batch.commit();
  }, [projectId]);

  const completeSprint = useCallback(async (sprintId) => {
    if (!projectId) return;
    const batch = writeBatch(db);
    batch.update(doc(db, 'sprints', sprintId), {
      status: 'completed',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'projects', projectId), {
      activeSprints: arrayRemove(sprintId)
    });
    await batch.commit();
  }, [projectId]);

  return { sprints, loading, createSprint, updateSprint, deleteSprint, startSprint, completeSprint };
}
