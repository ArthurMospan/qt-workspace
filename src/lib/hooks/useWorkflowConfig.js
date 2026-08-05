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
import { AlertOctagon, ArrowUp, Minus, ArrowDown, Zap, Star, Bug } from 'lucide-react';
import { TaskIcon } from '@/lib/design/icons';
import {
  localizeBuiltInWorkflowItems,
  resolveDoneStatusIds,
} from '@/lib/utils/workflowDefaults.mjs';
import {
  statusCategoryColumns,
  statusCategoryMap,
} from '@/lib/utils/statusCategories.mjs';

// Single source of truth for priority/type icons — every place that renders
// a priority or type (sprints, SearchModal, IssueDetail, analytics…) reads
// from here instead of keeping its own copy, so the icon set can't drift.
export const PRIORITY_ICONS = { blocker: AlertOctagon, high: ArrowUp, medium: Minus, low: ArrowDown };
export const TYPE_ICONS = { epic: Zap, feature: Star, task: TaskIcon, bug: Bug };
// Canonical default workflow for an org that has never saved
// settings/workflow. Must stay in sync with the id lists in
// src/app/api/issues/route.js (server can't import this client module) and
// must keep a `backlog` category (new issues land there) and a `done` one
// (something has to close a task). Settings imports these too — the board,
// the settings page and the API must always describe the same workflow.
//
// `category` is the shared layer of a status: the label is this organization's
// business, the category is what «Мої завдання», analytics and billing read.
// See src/lib/utils/statusCategories.mjs.
export const DEFAULT_STATUSES = [{
  id: 'backlog',
  label: 'Беклог',
  color: '#9a9a9a',
  category: 'backlog',
}, {
  id: 'todo',
  label: 'До виконання',
  color: '#6366f1',
  category: 'todo',
}, {
  id: 'in-progress',
  label: 'У роботі',
  color: '#f59e0b',
  category: 'in-progress',
}, {
  id: 'done',
  label: 'Готово',
  color: '#10b981',
  category: 'done',
  isDone: true,
}];
// ── Terminal ("done") status helpers ───────────────────────────────────────────
// A status closes a task when its category does — `done` or `cancelled`. The
// whole app must ask these helpers instead of comparing against a hardcoded id
// `'done'`, so renaming/adding a final status stays correct everywhere
// (analytics, billing, backlog, sprints, overdue, dependencies…).
//
// The rule itself lives in the shared, server-importable module: this used to be
// a second copy of it, free to drift from the one the API enforces.
export function getDoneStatusIds(statuses) {
  const list = Array.isArray(statuses) && statuses.length ? statuses : DEFAULT_STATUSES;
  return resolveDoneStatusIds(list);
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

// QUI-130. «Задача» leads because it is the default: most issues are tasks, and
// the list should open on the one you reach for. («Завдання» is the entity —
// what the whole product calls an issue; «Задача» is one of its three types.)
export const DEFAULT_TYPES = [{
  id: 'task',
  label: 'Задача',
  color: '#059669'
}, {
  id: 'feature',
  label: 'Фіча',
  color: '#f59e0b'
}, {
  id: 'bug',
  label: 'Баг',
  color: '#dc2626'
}];
export const DEFAULT_PRIORITIES = [{
  id: 'blocker',
  label: 'Критичний',
  color: '#ef4444'
}, {
  id: 'high',
  label: 'Високий',
  color: '#f97316'
}, {
  id: 'medium',
  label: 'Середній',
  color: '#eab308'
}, {
  id: 'low',
  label: 'Низький',
  color: '#9a9a9a'
}];
export const DEFAULT_LABELS = [{
  id: 'bug',
  label: 'Баг',
  color: '#ef4444'
}, {
  id: 'frontend',
  label: 'Фронтенд',
  color: '#3b82f6'
}, {
  id: 'design',
  label: 'Дизайн',
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
        statuses: Array.isArray(data.statuses)
          ? localizeBuiltInWorkflowItems('statuses', data.statuses)
          : DEFAULT_STATUSES,
        types: Array.isArray(data.types)
          ? localizeBuiltInWorkflowItems('types', data.types)
          : DEFAULT_TYPES,
        priorities: Array.isArray(data.priorities)
          ? localizeBuiltInWorkflowItems('priorities', data.priorities)
          : DEFAULT_PRIORITIES,
        labels: Array.isArray(data.labels)
          ? localizeBuiltInWorkflowItems('labels', data.labels)
          : DEFAULT_LABELS,
        positions: Array.isArray(data.positions)
          ? localizeBuiltInWorkflowItems('positions', data.positions)
          : DEFAULT_POSITIONS,
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
  // The shared layer of the workflow, resolved once per snapshot: which category
  // each status belongs to, and the columns a cross-project view is built from.
  const statusCategoryById = useMemo(
    () => statusCategoryMap(snapshot.statuses),
    [snapshot.statuses],
  );
  const categoryColumns = useMemo(
    () => statusCategoryColumns(snapshot.statuses),
    [snapshot.statuses],
  );
  return {
    ...snapshot,
    doneStatusIds,
    statusCategoryById,
    categoryColumns,
  };
}
