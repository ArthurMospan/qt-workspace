'use client';
// src/lib/hooks/useWorkflowConfig.js
// Reads workflow config (statuses, types, priorities) from Firestore.
// Falls back to sensible defaults so the app works out of the box before
// an admin customises anything in Settings.
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';

export const DEFAULT_STATUSES = [
  { id: 'backlog',         label: 'Backlog',         color: '#9a9a9a', emoji: '📋' },
  { id: 'todo',            label: 'To Do',           color: '#6366f1', emoji: '📌' },
  { id: 'in-progress',     label: 'In Progress',     color: '#0891b2', emoji: '⚡' },
  { id: 'code-review',     label: 'Code Review',     color: '#d97706', emoji: '🔍' },
  { id: 'qa',              label: 'QA',              color: '#7c3aed', emoji: '🧪' },
  { id: 'client-approval', label: 'Client Approval', color: '#db2777', emoji: '👁' },
  { id: 'done',            label: 'Done',            color: '#10b981', emoji: '✅' },
];

export const DEFAULT_TYPES = [
  { id: 'epic',    label: 'Epic',    color: '#8b5cf6', emoji: '⚡' },
  { id: 'feature', label: 'Feature', color: '#0891b2', emoji: '⭐' },
  { id: 'task',    label: 'Task',    color: '#059669', emoji: '✅' },
  { id: 'bug',     label: 'Bug',     color: '#dc2626', emoji: '🐛' },
];

export const DEFAULT_PRIORITIES = [
  { id: 'blocker', label: 'Blocker', color: '#dc2626', emoji: '🚨' },
  { id: 'high',    label: 'High',    color: '#f97316', emoji: '🔴' },
  { id: 'medium',  label: 'Medium',  color: '#eab308', emoji: '🟡' },
  { id: 'low',     label: 'Low',     color: '#9a9a9a', emoji: '🔵' },
];

export const DEFAULT_LABELS = [
  { id: 'bug',      label: 'Bug',      color: '#ef4444' },
  { id: 'frontend', label: 'Frontend', color: '#3b82f6' },
  { id: 'design',   label: 'Design',   color: '#db2777' },
];

export function useWorkflowConfig() {
  const { activeOrgId } = useAppContext();
  const [statuses,   setStatuses]   = useState(DEFAULT_STATUSES);
  const [types,      setTypes]      = useState(DEFAULT_TYPES);
  const [priorities, setPriorities] = useState(DEFAULT_PRIORITIES);
  const [labels,     setLabels]     = useState(DEFAULT_LABELS);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (!activeOrgId) { setLoading(false); return; }

    const ref = doc(db, 'organizations', activeOrgId, 'settings', 'workflow');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.statuses !== undefined)   setStatuses(d.statuses);
        if (d.types !== undefined)      setTypes(d.types);
        if (d.priorities !== undefined) setPriorities(d.priorities);
        if (d.labels !== undefined)     setLabels(d.labels);
      }
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [activeOrgId]);

  return { statuses, types, priorities, labels, loading };
}
