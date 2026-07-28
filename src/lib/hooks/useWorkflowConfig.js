'use client';

// src/lib/hooks/useWorkflowConfig.js
// Reads workflow config (statuses, types, priorities) from Firestore.
// Falls back to sensible defaults so the app works out of the box before
// an admin customises anything in Settings.
import { useMemo, useSyncExternalStore } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { reportLoadError } from '@/lib/utils/errors';
import { AlertOctagon, ArrowUp, Minus, ArrowDown, Zap, Star, CheckSquare, Bug } from 'lucide-react';

// Single source of truth for priority/type icons — every place that renders
// a priority or type (sprints, SearchModal, IssueDetail, analytics…) reads
// from here instead of keeping its own copy, so the icon set can't drift.
export const PRIORITY_ICONS = { blocker: AlertOctagon, high: ArrowUp, medium: Minus, low: ArrowDown };
export const TYPE_ICONS = { epic: Zap, feature: Star, task: CheckSquare, bug: Bug };
// Canonical default workflow for an org that has never saved
// settings/workflow. Must stay in sync with the id lists in
// src/app/api/issues/route.js (server can't import this client module) and
// must keep 'backlog' (new issues default there) and 'done' (terminal
// fallback in getDoneStatusIds). Settings imports these too — the board,
// the settings page and the API must always describe the same workflow.
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

const WORKFLOW_SERVER_SNAPSHOT = Object.freeze({
  statuses: DEFAULT_STATUSES,
  types: DEFAULT_TYPES,
  priorities: DEFAULT_PRIORITIES,
  labels: DEFAULT_LABELS,
  positions: DEFAULT_POSITIONS,
  loading: true,
  error: null,
});

const EMPTY_WORKFLOW_SNAPSHOT = Object.freeze({
  ...WORKFLOW_SERVER_SNAPSHOT,
  loading: false,
});

const workflowStores = new Map();

function createWorkflowStore(organizationId) {
  let snapshot = WORKFLOW_SERVER_SNAPSHOT;
  let unsubscribe = null;
  let stopTimer = null;
  const listeners = new Set();

  const emit = next => {
    snapshot = next;
    listeners.forEach(listener => listener());
  };

  const start = () => {
    if (unsubscribe) return;
    const ref = doc(db, 'organizations', organizationId, 'settings', 'workflow');
    unsubscribe = onSnapshot(ref, workflowSnap => {
      const data = workflowSnap.exists() ? workflowSnap.data() : {};
      emit({
        statuses: Array.isArray(data.statuses) ? data.statuses : DEFAULT_STATUSES,
        types: Array.isArray(data.types) ? data.types : DEFAULT_TYPES,
        priorities: Array.isArray(data.priorities) ? data.priorities : DEFAULT_PRIORITIES,
        labels: Array.isArray(data.labels) ? data.labels : DEFAULT_LABELS,
        positions: Array.isArray(data.positions) ? data.positions : DEFAULT_POSITIONS,
        loading: false,
        error: null,
      });
    }, error => {
      reportLoadError('[useWorkflowConfig]', error);
      emit({ ...EMPTY_WORKFLOW_SNAPSHOT, error });
    });
  };

  const subscribe = listener => {
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
    }
    listeners.add(listener);
    start();
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        stopTimer = setTimeout(() => {
          unsubscribe?.();
          unsubscribe = null;
          stopTimer = null;
        }, 1000);
      }
    };
  };

  return {
    subscribe,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => WORKFLOW_SERVER_SNAPSHOT,
  };
}

const emptyWorkflowStore = {
  subscribe: () => () => {},
  getSnapshot: () => EMPTY_WORKFLOW_SNAPSHOT,
  getServerSnapshot: () => EMPTY_WORKFLOW_SNAPSHOT,
};

function getWorkflowStore(organizationId) {
  if (!organizationId) return emptyWorkflowStore;
  if (!workflowStores.has(organizationId)) {
    workflowStores.set(organizationId, createWorkflowStore(organizationId));
  }
  return workflowStores.get(organizationId);
}

export function useWorkflowConfig() {
  const { activeOrgId } = useAppContext();
  const store = useMemo(() => getWorkflowStore(activeOrgId), [activeOrgId]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  // Terminal status ids derived from the live config — components use this
  // instead of hardcoding `'done'`.
  const doneStatusIds = useMemo(() => getDoneStatusIds(snapshot.statuses), [snapshot.statuses]);
  return {
    ...snapshot,
    doneStatusIds,
  };
}
