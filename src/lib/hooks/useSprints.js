'use client';

// src/lib/hooks/useSprints.js — CRUD for sprints
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch, arrayUnion, arrayRemove, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
export function useSprints() {
  const {
    activeOrgId
  } = useAppContext();
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!activeOrgId) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    const q = query(collection(db, 'sprints'), where('organizationId', '==', activeOrgId));
    const unsub = onSnapshot(q, {
      serverTimestamps: 'estimate'
    }, snap => {
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      // Sort by createdAt ascending (oldest first)
      docs.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return aTime - bTime;
      });
      setSprints(docs);
      setLoading(false);
    }, err => {
      console.error('[useSprints] onSnapshot error', err);
      setLoading(false);
    });
    return () => unsub();
  }, [activeOrgId]);
  const createSprint = useCallback(async data => {
    if (!activeOrgId) return;

    // Auto-generate name if not provided
    const sprintCount = sprints.length + 1;
    const name = data.name || `Спринт ${sprintCount}`;
    await addDoc(collection(db, 'sprints'), {
      organizationId: activeOrgId,
      name,
      goal: data.goal || '',
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      status: 'planned',
      // planned, active, completed
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }, [activeOrgId, sprints]);
  const updateSprint = useCallback(async (sprintId, data) => {
    await updateDoc(doc(db, 'sprints', sprintId), {
      ...data,
      updatedAt: serverTimestamp()
    });
  }, []);
  const deleteSprint = useCallback(async sprintId => {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'sprints', sprintId));
    
    // Remove sprintId from tasks
    const q = query(collection(db, 'issues'), where('sprintId', '==', sprintId));
    const snap = await getDocs(q);
    snap.forEach(d => {
      batch.update(d.ref, { sprintId: null, updatedAt: serverTimestamp() });
    });
    
    await batch.commit();
  }, []);
  const startSprint = useCallback(async sprintId => {
    const batch = writeBatch(db);
    // Find active sprints and mark them as planned (or leave them, but the requirement says "може бути лише один")
    sprints.filter(s => s.status === 'active').forEach(s => {
      batch.update(doc(db, 'sprints', s.id), { status: 'completed' });
    });
    batch.update(doc(db, 'sprints', sprintId), {
      status: 'active',
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await batch.commit();
  }, [sprints]);
  const completeSprint = useCallback(async (sprintId, moveToSprintId = null, incompleteIssueIds = []) => {
    const batch = writeBatch(db);
    batch.update(doc(db, 'sprints', sprintId), {
      status: 'completed',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    // Move incomplete issues
    incompleteIssueIds.forEach(issueId => {
      batch.update(doc(db, 'issues', issueId), {
        sprintId: moveToSprintId,
        updatedAt: serverTimestamp()
      });
    });
    await batch.commit();
  }, []);
  return {
    sprints,
    loading,
    createSprint,
    updateSprint,
    deleteSprint,
    startSprint,
    completeSprint
  };
}