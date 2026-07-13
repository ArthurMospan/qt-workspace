'use client';

// src/lib/hooks/useTimeLogs.js — Time log CRUD for a single issue
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { reportLoadError } from '@/lib/utils/errors';
export function useTimeLogs(issueId) {
  const {
    activeOrgId
  } = useAppContext();
  const [logs, setLogs] = useState([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!issueId || !activeOrgId) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    // Two equality filters — no composite index required
    const q = query(collection(db, 'timeLogs'), where('organizationId', '==', activeOrgId), where('issueId', '==', issueId));
    const unsub = onSnapshot(q, {
      serverTimestamps: 'estimate'
    }, snap => {
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      // Sort client-side by loggedAt desc
      docs.sort((a, b) => {
        const aTime = a.loggedAt?.toMillis?.() ?? 0;
        const bTime = b.loggedAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      });
      const total = docs.reduce((sum, l) => sum + (l.spentMinutes || 0), 0);
      setLogs(docs);
      setTotalMinutes(total);
      setLoading(false);
    }, err => {
      reportLoadError('[useTimeLogs]', err);
      setLoading(false);
    });
    return () => unsub();
  }, [issueId, activeOrgId]);

  // -------------------------------------------------------------------------
  // addTimeLog
  // -------------------------------------------------------------------------
  const addTimeLog = useCallback(async (issueId, projectId, userId, minutes, description = '') => {
    if (!minutes || minutes <= 0) throw new Error('minutes must be > 0');
    await addDoc(collection(db, 'timeLogs'), {
      issueId,
      projectId,
      userId,
      organizationId: activeOrgId,
      spentMinutes: Math.round(minutes),
      description: description || '',
      loggedAt: serverTimestamp()
    });
  }, [activeOrgId]);

  // -------------------------------------------------------------------------
  // updateTimeLog — Edit existing time log
  // -------------------------------------------------------------------------
  const updateTimeLog = useCallback(async (logId, {
    spentMinutes,
    description
  }) => {
    const updates = {};
    if (spentMinutes !== undefined) {
      if (spentMinutes <= 0) throw new Error('minutes must be > 0');
      updates.spentMinutes = Math.round(spentMinutes);
    }
    if (description !== undefined) updates.description = description;
    if (Object.keys(updates).length === 0) return;
    await updateDoc(doc(db, 'timeLogs', logId), updates);
  }, []);

  // -------------------------------------------------------------------------
  // deleteTimeLog — Delete time log
  // -------------------------------------------------------------------------
  const deleteTimeLog = useCallback(async logId => {
    await deleteDoc(doc(db, 'timeLogs', logId));
  }, []);
  return {
    logs,
    totalMinutes,
    loading,
    addTimeLog,
    updateTimeLog,
    deleteTimeLog
  };
}
