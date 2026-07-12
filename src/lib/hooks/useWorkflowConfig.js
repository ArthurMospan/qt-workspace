'use client';

// src/lib/hooks/useWorkflowConfig.js
// Reads workflow config (statuses, types, priorities) from Firestore.
// Falls back to sensible defaults so the app works out of the box before
// an admin customises anything in Settings.
import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { AlertOctagon, ArrowUp, Minus, ArrowDown, Zap, Star, CheckSquare, Bug } from 'lucide-react';

// Single source of truth for priority/type icons — every place that renders
// a priority or type (BacklogTab, sprints, SearchModal, IssueDetail…) reads
// from here instead of keeping its own copy, so the icon set can't drift.
export const PRIORITY_ICONS = { blocker: AlertOctagon, high: ArrowUp, medium: Minus, low: ArrowDown };
export const TYPE_ICONS = { epic: Zap, feature: Star, task: CheckSquare, bug: Bug };
export const DEFAULT_STATUSES = [{
  id: 'backlog',
  label: 'Backlog',
  color: '#9a9a9a'
}, {
  id: 'todo',
  label: 'To Do',
  color: '#6366f1'
}, {
  id: 'in-progress',
  label: 'In Progress',
  color: '#0891b2'
}, {
  id: 'code-review',
  label: 'Code Review',
  color: '#d97706'
}, {
  id: 'qa',
  label: 'QA',
  color: '#7c3aed'
}, {
  id: 'client-approval',
  label: 'Client Approval',
  color: '#db2777'
}, {
  id: 'done',
  label: 'Done',
  color: '#10b981'
}];
// ── Terminal ("done") status helpers ───────────────────────────────────────────
// A status counts as terminal (work complete) when it carries `isDone: true`.
// The whole app must ask these helpers instead of comparing against a hardcoded
// id `'done'`, so renaming/adding a final status stays correct everywhere
// (analytics, billing, backlog, sprints, overdue, dependencies…).
// Back-compat: configs saved before the flag existed have no `isDone`, so we
// fall back to a status whose id is 'done', and finally to the last column.
export function getDoneStatusIds(statuses) {
  const list = Array.isArray(statuses) && statuses.length ? statuses : DEFAULT_STATUSES;
  const flagged = list.filter(s => s?.isDone === true).map(s => s.id);
  if (flagged.length) return flagged;
  const named = list.find(s => s?.id === 'done');
  if (named) return [named.id];
  return [list[list.length - 1].id];
}

// True when `statusId` is one of the terminal statuses for the given config.
export function isDoneStatus(statusId, statuses) {
  return getDoneStatusIds(statuses).includes(statusId);
}

// Historical issues may not have completedAt yet. The updatedAt fallback keeps
// old analytics usable while every new terminal transition records completedAt.
export function getCompletedAtMillis(issue) {
  const value = issue?.completedAt || issue?.updatedAt;
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export const DEFAULT_TYPES = [{
  id: 'epic',
  label: 'Epic',
  color: '#8b5cf6'
}, {
  id: 'feature',
  label: 'Feature',
  color: '#0891b2'
}, {
  id: 'task',
  label: 'Task',
  color: '#059669'
}, {
  id: 'bug',
  label: 'Bug',
  color: '#dc2626'
}];
export const DEFAULT_PRIORITIES = [{
  id: 'blocker',
  label: 'Blocker',
  color: '#ef4444'
}, {
  id: 'high',
  label: 'High',
  color: '#f97316'
}, {
  id: 'medium',
  label: 'Medium',
  color: '#eab308'
}, {
  id: 'low',
  label: 'Low',
  color: '#9a9a9a'
}];
export const DEFAULT_LABELS = [{
  id: 'bug',
  label: 'Bug',
  color: '#ef4444'
}, {
  id: 'frontend',
  label: 'Frontend',
  color: '#3b82f6'
}, {
  id: 'design',
  label: 'Design',
  color: '#db2777'
}];
export const DEFAULT_POSITIONS = [{
  id: 'dev',
  label: 'Розробник',
  hourlyRate: 30
}, {
  id: 'designer',
  label: 'Дизайнер',
  hourlyRate: 35
}, {
  id: 'pm',
  label: 'PM',
  hourlyRate: 40
}, {
  id: 'qa',
  label: 'QA',
  hourlyRate: 25
}];
export function useWorkflowConfig() {
  const {
    activeOrgId
  } = useAppContext();
  const [statuses, setStatuses] = useState(DEFAULT_STATUSES);
  const [types, setTypes] = useState(DEFAULT_TYPES);
  const [priorities, setPriorities] = useState(DEFAULT_PRIORITIES);
  const [labels, setLabels] = useState(DEFAULT_LABELS);
  const [positions, setPositions] = useState(DEFAULT_POSITIONS);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!activeOrgId) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    const ref = doc(db, 'organizations', activeOrgId, 'settings', 'workflow');
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.statuses !== undefined) setStatuses(d.statuses);
        if (d.types !== undefined) setTypes(d.types);
        if (d.priorities !== undefined) setPriorities(d.priorities);
        if (d.labels !== undefined) setLabels(d.labels);
        if (d.positions !== undefined) setPositions(d.positions);
      }
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [activeOrgId]);
  // Terminal status ids derived from the live config — components use this
  // instead of hardcoding `'done'`.
  const doneStatusIds = useMemo(() => getDoneStatusIds(statuses), [statuses]);
  return {
    statuses,
    types,
    priorities,
    labels,
    positions,
    doneStatusIds,
    loading
  };
}
