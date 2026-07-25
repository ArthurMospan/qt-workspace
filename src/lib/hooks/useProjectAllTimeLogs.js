'use client';

// src/lib/hooks/useProjectAllTimeLogs.js
// Loads ALL time logs for a project with per-issue aggregation
// Returns: logs[], byIssue{ issueId -> { totalMinutes, byUser{ uid -> minutes } } }
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
export function useProjectAllTimeLogs(projectId) {
  const {
    activeOrgId
  } = useAppContext();
  const [logs, setLogs] = useState([]);
  const [byIssue, setByIssue] = useState({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!projectId || !activeOrgId) {
      queueMicrotask(() => {
        setLogs([]);
        setByIssue({});
        setLoading(false);
      });
      return;
    }
    queueMicrotask(() => {
      setLogs([]);
      setByIssue({});
      setLoading(true);
    });
    const q = query(collection(db, 'timeLogs'), where('organizationId', '==', activeOrgId), where('projectId', '==', projectId));
    const unsub = onSnapshot(q, {
      serverTimestamps: 'estimate'
    }, snap => {
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      // Build per-issue map
      const map = {};
      docs.forEach(l => {
        const {
          issueId,
          userId,
          spentMinutes = 0
        } = l;
        if (!issueId) return;
        if (!map[issueId]) map[issueId] = {
          totalMinutes: 0,
          byUser: {}
        };
        map[issueId].totalMinutes += spentMinutes;
        if (userId) {
          map[issueId].byUser[userId] = (map[issueId].byUser[userId] || 0) + spentMinutes;
        }
      });
      setLogs(docs);
      setByIssue(map);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [projectId, activeOrgId]);

  return {
    logs,
    byIssue,
    loading
  };
}
