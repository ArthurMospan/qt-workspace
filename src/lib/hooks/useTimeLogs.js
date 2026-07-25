'use client';

// src/lib/hooks/useTimeLogs.js — Time log CRUD for a single issue
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
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

  // ---------------------------------------------------------------------------
  // `issues/{id}.spentMinutes` is a denormalised mirror of these logs, read by
  // the board and the backlog table. It used to be maintained by the caller as
  // `read local value → add → write`, which loses one of two concurrent logs and
  // leaves the mirror permanently wrong if the second write fails. Every change
  // below therefore ships the log and the mirror in ONE batch, and moves the
  // mirror with increment() so the server resolves concurrent updates.
  // ---------------------------------------------------------------------------
  const commitLogChange = useCallback(async (targetIssueId, mutate, minutesDelta) => {
    if (!targetIssueId) throw new Error('Issue is required');
    const batch = writeBatch(db);
    mutate(batch);
    if (minutesDelta !== 0) {
      batch.update(doc(db, 'issues', targetIssueId), {
        spentMinutes: increment(minutesDelta),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }, []);

  const addTimeLog = useCallback(async (targetIssueId, projectId, userId, minutes, description = '') => {
    if (!minutes || minutes <= 0) throw new Error('minutes must be > 0');
    const rounded = Math.round(minutes);
    await commitLogChange(targetIssueId, batch => {
      batch.set(doc(collection(db, 'timeLogs')), {
        issueId: targetIssueId,
        projectId,
        userId,
        organizationId: activeOrgId,
        spentMinutes: rounded,
        description: description || '',
        loggedAt: serverTimestamp(),
      });
    }, rounded);
  }, [activeOrgId, commitLogChange]);

  const updateTimeLog = useCallback(async (logId, { spentMinutes, description }) => {
    const current = logs.find(item => item.id === logId);
    const updates = {};
    let delta = 0;
    if (spentMinutes !== undefined) {
      if (spentMinutes <= 0) throw new Error('minutes must be > 0');
      updates.spentMinutes = Math.round(spentMinutes);
      delta = updates.spentMinutes - (Number(current?.spentMinutes) || 0);
    }
    if (description !== undefined) updates.description = description;
    if (Object.keys(updates).length === 0) return;
    await commitLogChange(current?.issueId || issueId, batch => {
      batch.update(doc(db, 'timeLogs', logId), updates);
    }, delta);
  }, [commitLogChange, issueId, logs]);

  const deleteTimeLog = useCallback(async logId => {
    const current = logs.find(item => item.id === logId);
    await commitLogChange(current?.issueId || issueId, batch => {
      batch.delete(doc(db, 'timeLogs', logId));
    }, -(Number(current?.spentMinutes) || 0));
  }, [commitLogChange, issueId, logs]);
  return {
    logs,
    totalMinutes,
    loading,
    addTimeLog,
    updateTimeLog,
    deleteTimeLog
  };
}
