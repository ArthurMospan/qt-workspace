'use client';

// ─── UI Kit: Task Table View ─────────────────────────────────────────────────
// The third reading of a board's tasks: a grid you can edit in place.
//
// This is deliberately not `DataTable`. That one is the analytics table — a
// presentational grid of figures whose rows are links and which folds into a
// stack of cards below the breakpoint, because six columns of numbers cannot be
// read on a phone. A table of tasks wants the opposite of almost all of that: a
// header that stays put, an identity column that stays put, horizontal scroll
// rather than folding, a control inside every cell, row selection, sort per
// column and bands between groups. The two share the `<table>` tag and nothing
// else, and merging them would give one component two modes with no common
// middle. See docs/UI_KIT_CONTRACT.md.
//
// One editor exists at a time. A `Select` or a `DatePicker` left mounted in
// every cell would register one document listener per cell — six hundred of
// them on a busy backlog — so a cell draws its value as plain markup until it is
// clicked, and only then mounts the real control.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Lock,
  MoreVertical,
} from 'lucide-react';
import { CalendarIcon, TaskIcon } from '@/lib/design/icons';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Forms/Checkbox';
import ContextMenu from '@/components/ui/ContextMenu';
import Counter from '@/components/ui/DataDisplay/Counter';
import EmptyState from '@/components/ui/Feedback/EmptyState';
import { Input } from '@/components/ui/Input';
import Pill from '@/components/ui/DataDisplay/Pill';
import PriorityIcon from '@/components/ui/DataDisplay/PriorityIcon';
import Surface from '@/components/ui/Surface';
import Tag from '@/components/ui/DataDisplay/Tag';
import TypeBadge from '@/components/ui/DataDisplay/TypeBadge';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import { DatePicker } from '@/components/ui/Forms/DatePicker';
import { MultiSelect, Select } from '@/components/ui/Select';
import BulkActionBar from './BulkActionBar';
import { useAppContext } from '@/lib/context/AppContext';
import { useIssueSelection } from '@/lib/hooks/useIssueSelection';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { taskTypeIcon, taskTypeSelectOption } from '@/lib/design/taskTypeIcons';
import { isDueDateOverdue, parseDueDate } from '@/lib/utils/date';
import { issuePath } from '@/lib/utils/issueKeys.mjs';
import { openBlockerIssues } from '@/lib/utils/issueExecution.mjs';
import { isIssueUnread, unreadActivityLabel } from '@/lib/utils/issueReadState.mjs';
import { columnOf } from '@/lib/utils/optimistic.mjs';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { organizationTimeZone } from '@/lib/utils/timeZone.mjs';
import {
  ensureSystemPriorities,
  NO_PRIORITY_ID,
  priorityPresentation,
  prioritySelectOptions,
} from '@/lib/utils/priorities.mjs';
import {
  checklistProgress,
  commentCountOf,
  memberId,
  memberName,
  nextTaskTableSort,
  taskTableContext,
  taskTableSections,
  UNGROUPED_SECTION_ID,
  visibleTaskTableColumns,
} from '@/lib/utils/taskTable.mjs';

// The checkbox gutter. Pinned columns are laid out from its right edge, so the
// number lives here rather than being written into three class strings.
const SELECT_COLUMN_WIDTH = 40;
const ALIGNMENT = { left: 'text-left', right: 'text-right', center: 'text-center' };

function formatDay(value, timeZone) {
  const date = parseDueDate(value, { timeZone });
  if (!date) return '';
  return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', timeZone });
}

function formatStamp(value, timeZone) {
  if (!value) return '';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', timeZone });
}

function formatMinutes(minutes) {
  const total = Number(minutes) || 0;
  if (!total) return '';
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${rest}хв`;
  return rest ? `${hours}г ${rest}хв` : `${hours}г`;
}

// The cell that is being edited mounts the real control, and the click that
// opened the cell has already been spent. Forwarding it into the freshly
// mounted control is what makes «click a cell to change it» one click instead
// of two; a text field takes focus and a selection instead, because there is
// no overlay to open.
function useOpenOnMount(hostRef) {
  useEffect(() => {
    const field = hostRef.current?.querySelector('input, button');
    if (!field) return;
    if (field.tagName === 'INPUT' && !field.readOnly) {
      field.focus();
      field.select?.();
      return;
    }
    field.click();
  }, [hostRef]);
}

function TextCellEditor({ value, type = 'text', suffix, ariaLabel, onCommit, onCancel }) {
  const hostRef = useRef(null);
  const [draft, setDraft] = useState(value ?? '');
  useOpenOnMount(hostRef);

  // Enter and Escape both take the field off the screen, and losing focus is
  // itself a save. Without this latch, Escape saved the very draft it was asked
  // to discard, and Enter wrote twice.
  const settledRef = useRef(false);
  const settle = handler => (...args) => {
    if (settledRef.current) return;
    settledRef.current = true;
    handler(...args);
  };
  const commit = settle(() => onCommit(draft));
  const cancel = settle(() => onCancel());

  return (
    <div ref={hostRef} className="w-full">
      <Input
        size="sm"
        type={type}
        suffix={suffix}
        value={draft}
        aria-label={ariaLabel}
        min={type === 'number' ? 0 : undefined}
        onChange={event => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            cancel();
          }
        }}
      />
    </div>
  );
}

function ChoiceCellEditor({ value, options, placeholder, ariaLabel, onCommit }) {
  const hostRef = useRef(null);
  useOpenOnMount(hostRef);
  return (
    <div ref={hostRef} className="w-full">
      <Select
        size="sm"
        value={value ?? ''}
        options={options}
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        onChange={onCommit}
      />
    </div>
  );
}

function MultiCellEditor({ value, options, placeholder, searchPlaceholder, ariaLabel, onCommit }) {
  const hostRef = useRef(null);
  useOpenOnMount(hostRef);
  return (
    <div ref={hostRef} className="w-full">
      <MultiSelect
        size="sm"
        value={value}
        options={options}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        ariaLabel={ariaLabel}
        showSelectedAvatars
        onChange={onCommit}
      />
    </div>
  );
}

function DateCellEditor({ value, ariaLabel, onCommit }) {
  const hostRef = useRef(null);
  useOpenOnMount(hostRef);
  return (
    <div ref={hostRef} className="w-full">
      <DatePicker
        size="sm"
        compact
        value={value || ''}
        aria-label={ariaLabel}
        onChange={onCommit}
      />
    </div>
  );
}

/**
 * A board's tasks as an editable grid: chosen columns, sorted by any of them,
 * grouped into bands, with every value changeable in its own cell. The
 * arrangement is not held here — it arrives as props and lives in the address,
 * so a configured table is a link somebody can send.
 *
 * @param {object[]} props.issues The tasks to show, already filtered.
 * @param {object[]} props.allIssues Every task in scope, for resolving blockers.
 * @param {object[]} props.issueLinks Relations between tasks, for the blocked column.
 * @param {object[]} props.members People who can be assigned.
 * @param {object[]} props.labels Label definitions, for the labels column.
 * @param {object[]} props.sprints Sprint definitions, for the sprint column.
 * @param {string} props.projectId The project these tasks belong to.
 * @param {string[]} props.columns Which columns are on; empty means the default set.
 * @param {string} props.sort Column the rows are ordered by, or `manual` for the board's own order.
 * @param {'asc'|'desc'} props.dir Direction of that sort.
 * @param {string} props.group What a band is: a status, an assignee, a priority, a type, a sprint — or nothing.
 * @param {(next: {sort: string, dir: string}) => void} props.onSortChange Fires when a column header is clicked.
 * @param {string[]} props.hiddenGroupIds Statuses the project folds into «Приховані».
 * @param {string} props.activeTimerIssueId The task whose timer is running, if any.
 * @param {(issueId: string, patch: object) => Promise<unknown>} props.onUpdateIssue Saves one cell. Omit to make the table read-only.
 * @param {(action: string, value: unknown, issues: object[]) => Promise<unknown>} props.onBulkUpdate Applies one bulk action to the selected rows.
 * @param {{done: number, total: number}} props.bulkProgress How far the running bulk action has got.
 * @param {boolean} props.canArchive Whether the current role may archive selected tasks.
 * @param {string} props.selectionScopeKey Clears selection when a route or filter scope changes.
 * @param {string} props.emptyTitle Headline of the empty state.
 * @param {string} props.emptyDescription Sentence under it.
 */
export default function TaskTableView({
  issues = [],
  allIssues = issues,
  issueLinks = [],
  members = [],
  labels = [],
  sprints = [],
  projectId,
  columns = [],
  sort = 'manual',
  dir = 'asc',
  group = 'status',
  onSortChange,
  hiddenGroupIds = [],
  activeTimerIssueId,
  onUpdateIssue,
  onBulkUpdate,
  bulkProgress = null,
  canArchive = false,
  selectionScopeKey = '',
  emptyTitle = 'Завдань не знайдено',
  emptyDescription = 'Змініть фільтри або створіть нове завдання.',
}) {
  const { currentUser, projects = [], activeOrg } = useAppContext();
  const timeZone = organizationTimeZone(activeOrg);
  const project = projects.find(candidate => candidate.id === projectId);
  const { statuses, priorities, types, closedStatusIds } = useWorkflowConfig();
  const currentUserId = currentUser?.uid || currentUser?.id || null;
  // Subscribed once for the whole table rather than per row: the map is one
  // object in the store, and six hundred selectors over the same object is six
  // hundred subscriptions for one fact.
  const issueReadState = useWorkspaceStore(state => state.issueReadState);
  const [collapsedSections, setCollapsedSections] = useState([]);
  const [editing, setEditing] = useState(null);
  const editable = Boolean(onUpdateIssue);

  const visibleColumns = useMemo(() => visibleTaskTableColumns(columns), [columns]);
  const showsBlocked = visibleColumns.some(column => column.id === 'blocked') || sort === 'blocked';

  // Blockers cost a pass over every relation for every task, so they are only
  // resolved when a column or a sort actually asks about them.
  const blockedIssueIds = useMemo(() => {
    if (!showsBlocked) return new Set();
    const blocked = new Set();
    for (const issue of issues) {
      if (openBlockerIssues(issue.id, allIssues, issueLinks, closedStatusIds).length > 0) {
        blocked.add(issue.id);
      }
    }
    return blocked;
  }, [showsBlocked, issues, allIssues, issueLinks, closedStatusIds]);

  const orderedPriorities = useMemo(() => ensureSystemPriorities(priorities), [priorities]);
  const context = useMemo(() => taskTableContext({
    statuses,
    priorities: orderedPriorities,
    types,
    sprints,
    members,
    labels,
    hiddenStatusIds: hiddenGroupIds,
    blockedIssueIds,
  }), [statuses, orderedPriorities, types, sprints, members, labels, hiddenGroupIds, blockedIssueIds]);

  const sections = useMemo(
    () => taskTableSections(issues, { group, sort, dir, context }),
    [issues, group, sort, dir, context],
  );

  const selectionOrder = useMemo(
    () => sections.flatMap(section => section.issues.map(issue => issue.id)),
    [sections],
  );
  const {
    active: selectionActive,
    activeSelectedIds,
    selectedIssues,
    toggle: toggleIssueSelection,
    toggleScope: toggleIssueScope,
    clear: clearSelection,
  } = useIssueSelection({
    issues,
    order: selectionOrder,
    scopeKey: selectionScopeKey || `${projectId || 'table'}:${group}:${sort}:${dir}`,
  });

  // Leaving the cell: anywhere outside it, except inside a portal the cell's own
  // control opened — a dropdown is part of the editor, not somewhere else.
  const editingRef = useRef(null);
  useEffect(() => {
    if (!editing) return undefined;
    const stopOnOutside = event => {
      if (editingRef.current?.contains(event.target)) return;
      if (event.target.closest?.('[data-qt-floating-overlay]')) return;
      setEditing(null);
    };
    const stopOnEscape = event => {
      if (event.key === 'Escape') setEditing(null);
    };
    document.addEventListener('mousedown', stopOnOutside);
    document.addEventListener('keydown', stopOnEscape);
    return () => {
      document.removeEventListener('mousedown', stopOnOutside);
      document.removeEventListener('keydown', stopOnEscape);
    };
  }, [editing]);

  const commit = useCallback(async (issue, patch, { keepOpen = false } = {}) => {
    if (!keepOpen) setEditing(null);
    if (!patch || Object.keys(patch).length === 0) return;
    // The hook owns the optimistic overlay, the rollback and the toast; a
    // rejected promise here would only reach the browser console.
    try {
      await onUpdateIssue?.(issue.id, patch);
    } catch {
      // Reported by the caller.
    }
  }, [onUpdateIssue]);

  const toggleSection = sectionId => setCollapsedSections(current => (
    current.includes(sectionId)
      ? current.filter(id => id !== sectionId)
      : [...current, sectionId]
  ));

  // A checkbox reports a boolean, not the event that produced it, so the modifier
  // is caught on the way down. Without a selection running, `toggle` refuses a
  // plain click — that guard protects a list where clicking a row opens a task,
  // and a table's checkbox has no such ambiguity to protect against.
  const shiftHeldRef = useRef(false);
  const selectRow = issue => {
    const shiftKey = shiftHeldRef.current;
    if (!selectionActive && !shiftKey) {
      toggleIssueScope([issue.id]);
      return;
    }
    toggleIssueSelection(issue.id, { shiftKey });
  };

  const statusOptions = useMemo(() => statuses.map(status => ({
    value: status.id,
    label: status.label,
    dotColor: status.color,
  })), [statuses]);
  const priorityOptions = useMemo(() => prioritySelectOptions(priorities), [priorities]);
  const typeOptions = useMemo(
    () => types.filter(type => type.id !== 'epic').map(taskTypeSelectOption),
    [types],
  );
  const sprintOptions = useMemo(() => [
    { value: '', label: 'Без спринта' },
    ...sprints.filter(sprint => sprint.status !== 'completed').map(sprint => ({
      value: sprint.id,
      label: sprint.name,
    })),
  ], [sprints]);
  const memberOptions = useMemo(() => members.map(member => ({
    value: memberId(member),
    label: memberName(member),
    user: member,
  })), [members]);
  const labelOptions = useMemo(() => labels.map(label => ({
    value: label.id,
    label: label.label,
    dotColor: label.color,
  })), [labels]);

  // Where each pinned column starts. They are the leading run of the visible
  // set, so one sweep from the checkbox gutter places all of them.
  const pinnedOffsets = useMemo(() => {
    const offsets = {};
    let left = SELECT_COLUMN_WIDTH;
    for (const column of visibleColumns) {
      if (!column.pinned) break;
      offsets[column.id] = left;
      left += column.width;
    }
    return offsets;
  }, [visibleColumns]);
  const tableWidth = SELECT_COLUMN_WIDTH
    + visibleColumns.reduce((total, column) => total + column.width, 0);

  if (issues.length === 0) {
    return (
      <Surface preset="panel" padding="md" className="w-full">
        <EmptyState
          icon={TaskIcon}
          title={emptyTitle}
          description={emptyDescription}
          context="page"
          surface="card"
        />
      </Surface>
    );
  }

  // ── One cell's value, as it reads when nobody is editing it ───────────────
  function renderValue(column, issue) {
    switch (column.id) {
      case 'key': {
        const path = issuePath(issue, project || projectId);
        return (
          <span className="flex items-center gap-[5px]">
            {path ? (
              <Link
                href={path}
                onClick={event => event.stopPropagation()}
                className="truncate font-mono text-[11px] font-bold text-muted hover:text-ink hover:underline"
              >
                {issue.issueKey || '—'}
              </Link>
            ) : (
              <span className="truncate font-mono text-[11px] font-bold text-muted">
                {issue.issueKey || '—'}
              </span>
            )}
            {activeTimerIssueId === issue.id && (
              <span
                title="Таймер запущено"
                className="h-[5px] w-[5px] shrink-0 animate-pulse rounded-full bg-ink"
              />
            )}
            {/* «Є нове» beside the key, where the timer dot already lives. The
                third reading of a board had no unread mark at all, so a table
                showed a task as settled while the same task carried a dot two
                clicks away on the kanban. */}
            {isIssueUnread(issue, issueReadState[issue.id] || 0, currentUserId) && (
              <span role="status" aria-label={unreadActivityLabel(issue)} title={unreadActivityLabel(issue)}>
                <Counter variant="dot" size="sm" status="info" />
              </span>
            )}
          </span>
        );
      }
      case 'title':
        return (
          <span className="block truncate text-[13px] font-semibold text-ink" title={issue.title}>
            {issue.title || <span className="text-faint">Без назви</span>}
          </span>
        );
      case 'status': {
        const status = context.statusById.get(columnOf(issue));
        if (!status) return <span className="text-faint">—</span>;
        return (
          <Pill color={status.color || '#9a9a9a'} size="sm" shape="badge" weight="medium">
            {status.label}
          </Pill>
        );
      }
      case 'assignees': {
        const people = (issue.assigneeIds || issue.assignees || [])
          .map(id => context.memberById.get(id))
          .filter(Boolean);
        if (people.length === 0) return <span className="text-[11px] italic text-faint">Н/В</span>;
        return (
          <span className="flex items-center -space-x-[6px]">
            {people.slice(0, 3).map(person => (
              <span key={memberId(person)} title={memberName(person)} className="rounded-full ring-2 ring-white">
                <UserAvatar user={person} size="xs" />
              </span>
            ))}
            {people.length > 3 && (
              <Pill tone="neutral" size="md" preset="avatar-counter">+{people.length - 3}</Pill>
            )}
          </span>
        );
      }
      case 'priority': {
        const presentation = priorityPresentation(issue.priority, priorities);
        if (presentation.isNoPriority) return <span className="text-faint">—</span>;
        return (
          <span className="flex items-center gap-[6px]">
            <PriorityIcon priority={presentation} size="md" />
            <span className="truncate text-[12px] font-medium text-ink">{presentation.label}</span>
          </span>
        );
      }
      case 'due': {
        const text = formatDay(issue.dueDate, timeZone);
        if (!text) return <span className="text-faint">—</span>;
        const overdue = isDueDateOverdue(issue.dueDate, { timeZone })
          && !closedStatusIds.includes(columnOf(issue));
        return (
          <span className={`flex items-center gap-[4px] text-[12px] font-semibold ${overdue ? 'text-[#ef4444]' : 'text-ink'}`}>
            <CalendarIcon size={11} strokeWidth={2} className="shrink-0" />
            {text}
          </span>
        );
      }
      case 'type': {
        const type = context.typeById.get(issue.type);
        if (!type) return <span className="text-faint">—</span>;
        return <TypeBadge label={type.label} color={type.color || '#9a9a9a'} icon={taskTypeIcon(type)} />;
      }
      case 'sprint': {
        const sprint = context.sprintById.get(issue.sprintId);
        if (!sprint) return <span className="text-faint">—</span>;
        return (
          <Pill tone="neutral" size="sm" shape="badge" weight="medium">{sprint.name}</Pill>
        );
      }
      case 'labels': {
        const chips = (issue.labelIds || [])
          .map(id => context.labelById.get(id))
          .filter(Boolean);
        if (chips.length === 0) return <span className="text-faint">—</span>;
        return (
          <span className="flex items-center gap-[4px] overflow-hidden">
            {chips.map(label => (
              <Tag key={label.id} label={label.label} color={label.color} size="small" className="shrink-0" />
            ))}
          </span>
        );
      }
      case 'estimate': {
        const text = formatMinutes(issue.estimateMinutes);
        return text
          ? <span className="text-[12px] font-medium tabular-nums text-ink">{text}</span>
          : <span className="text-faint">—</span>;
      }
      case 'checklist': {
        const { done, total } = checklistProgress(issue);
        return total
          ? <span className="text-[12px] font-medium tabular-nums text-ink">{done}/{total}</span>
          : <span className="text-faint">—</span>;
      }
      case 'comments': {
        const count = commentCountOf(issue);
        return count
          ? <span className="text-[12px] font-medium tabular-nums text-ink">{count}</span>
          : <span className="text-faint">—</span>;
      }
      case 'blocked':
        return blockedIssueIds.has(issue.id) ? (
          <span className="inline-flex items-center gap-[4px] rounded-[4px] bg-[#fef2f2] px-[6px] py-[1.5px] text-[10px] font-medium text-[#ef4444]">
            <Lock size={10} />
            Заблоковано
          </span>
        ) : <span className="text-faint">—</span>;
      case 'created':
        return <span className="text-[12px] text-muted">{formatStamp(issue.createdAt, timeZone) || '—'}</span>;
      case 'updated':
        return <span className="text-[12px] text-muted">{formatStamp(issue.updatedAt, timeZone) || '—'}</span>;
      default:
        return null;
    }
  }

  // ── The same cell, while it is being changed ──────────────────────────────
  function renderEditor(column, issue) {
    const label = `${column.label}: ${issue.issueKey || issue.title || 'завдання'}`;
    switch (column.editor) {
      case 'text':
        return (
          <TextCellEditor
            value={issue.title || ''}
            ariaLabel={label}
            onCancel={() => setEditing(null)}
            onCommit={value => {
              const title = String(value).trim();
              commit(issue, title && title !== issue.title ? { title } : null);
            }}
          />
        );
      case 'estimate':
        return (
          <TextCellEditor
            type="number"
            suffix="хв"
            value={issue.estimateMinutes || ''}
            ariaLabel={label}
            onCancel={() => setEditing(null)}
            onCommit={value => {
              const minutes = Math.max(0, Math.round(Number(value) || 0));
              commit(issue, minutes === (issue.estimateMinutes || 0)
                ? null
                : { estimateMinutes: minutes });
            }}
          />
        );
      case 'status':
        return (
          <ChoiceCellEditor
            value={columnOf(issue) || ''}
            options={statusOptions}
            placeholder="Статус"
            ariaLabel={label}
            onCommit={value => commit(issue, value === columnOf(issue) ? null : { columnId: value })}
          />
        );
      case 'priority':
        return (
          <ChoiceCellEditor
            value={issue.priority || NO_PRIORITY_ID}
            options={priorityOptions}
            placeholder="Пріоритет"
            ariaLabel={label}
            // «Без пріоритету» is a stored value, not an absent one — the same
            // `none` the bulk bar writes when it clears a priority.
            onCommit={value => commit(issue, value === (issue.priority || NO_PRIORITY_ID)
              ? null
              : { priority: value })}
          />
        );
      case 'type':
        return (
          <ChoiceCellEditor
            value={issue.type || ''}
            options={typeOptions}
            placeholder="Тип"
            ariaLabel={label}
            onCommit={value => commit(issue, value === issue.type ? null : { type: value })}
          />
        );
      case 'sprint':
        return (
          <ChoiceCellEditor
            value={issue.sprintId || ''}
            options={sprintOptions}
            placeholder="Спринт"
            ariaLabel={label}
            onCommit={value => commit(issue, { sprintId: value || null })}
          />
        );
      case 'assignees':
        return (
          <MultiCellEditor
            value={issue.assigneeIds || []}
            options={memberOptions}
            placeholder="Виконавці"
            searchPlaceholder="Пошук людини..."
            ariaLabel={label}
            onCommit={value => commit(issue, { assigneeIds: value }, { keepOpen: true })}
          />
        );
      case 'labels':
        return (
          <MultiCellEditor
            value={issue.labelIds || []}
            options={labelOptions}
            placeholder="Мітки"
            searchPlaceholder="Пошук мітки..."
            ariaLabel={label}
            onCommit={value => commit(issue, { labelIds: value }, { keepOpen: true })}
          />
        );
      case 'due':
        return (
          <DateCellEditor
            value={issue.dueDate || ''}
            ariaLabel={label}
            onCommit={value => commit(issue, { dueDate: value || null })}
          />
        );
      default:
        return renderValue(column, issue);
    }
  }

  const headerCell = column => {
    const active = sort === column.id;
    const Arrow = dir === 'desc' ? ArrowDown : ArrowUp;
    const pinned = column.pinned;
    return (
      <th
        key={column.id}
        scope="col"
        aria-sort={active ? (dir === 'desc' ? 'descending' : 'ascending') : 'none'}
        style={pinned ? { left: pinnedOffsets[column.id] } : undefined}
        className={`sticky top-0 border-b border-line bg-white px-[10px] py-[7px] ${ALIGNMENT[column.align]} ${
          pinned
            ? `z-[3] ${column.id === 'title' ? 'md:sticky' : 'sticky'} ${column.id === 'title' ? 'md:border-r md:border-line' : ''}`
            : 'z-[2]'
        }`}
      >
        {column.sortable && onSortChange ? (
          <button
            type="button"
            onClick={() => onSortChange(nextTaskTableSort(column.id, { sort, dir }))}
            title={active ? 'Змінити напрям сортування' : `Сортувати за: ${column.label}`}
            className={`ui-type-eyebrow inline-flex max-w-full items-center gap-[4px] uppercase tracking-wide transition-colors hover:text-ink ${
              active ? 'text-ink' : 'text-muted'
            } ${column.align === 'right' ? 'flex-row-reverse' : ''}`}
          >
            <span className="truncate">{column.label}</span>
            {active && <Arrow size={11} strokeWidth={3} className="shrink-0" />}
          </button>
        ) : (
          <span className="ui-type-eyebrow uppercase tracking-wide text-muted">{column.label}</span>
        )}
      </th>
    );
  };

  return (
    <div className="flex h-full min-h-[320px] w-full min-w-0 flex-col">
      {/* The table owns its own scrolling in both directions. A sticky header
          and a pinned identity column stick to the nearest scroll container, so
          letting the page scroll instead would leave both of them behind. */}
      <Surface
        preset="bordered-card"
        padding="none"
        className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
      >
        <div className="min-h-0 w-full flex-1 overflow-auto custom-scrollbar">
          <table
            className="w-full table-fixed border-collapse"
            style={{ minWidth: tableWidth }}
          >
            <colgroup>
              <col style={{ width: SELECT_COLUMN_WIDTH }} />
              {visibleColumns.map(column => (
                <col key={column.id} style={{ width: column.width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 top-0 z-[4] border-b border-line bg-white px-[10px] py-[7px]"
                >
                  <span className="sr-only">Вибір</span>
                </th>
                {visibleColumns.map(headerCell)}
              </tr>
            </thead>

            {sections.map(section => {
              const banded = section.id !== UNGROUPED_SECTION_ID;
              const collapsed = collapsedSections.includes(section.id);
              const allSelected = section.issues.every(issue => activeSelectedIds.has(issue.id));
              return (
                <tbody key={section.id}>
                  {banded && (
                    <tr className="bg-canvas">
                      <td colSpan={visibleColumns.length + 1} className="border-b border-line p-0">
                        {/* The band spans the full scroll width, so its label is
                            pinned to the left edge instead of scrolling away
                            from the rows it names. */}
                        <div className="sticky left-0 flex w-[max-content] max-w-[100vw] items-center gap-2 px-[10px] py-[6px]">
                          <button
                            type="button"
                            onClick={() => toggleSection(section.id)}
                            aria-expanded={!collapsed}
                            className="flex min-w-0 items-center gap-2 text-left"
                          >
                            {collapsed
                              ? <ChevronRight size={13} className="shrink-0 text-muted" />
                              : <ChevronDown size={13} className="shrink-0 text-muted" />}
                            {section.color && (
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ background: section.color }}
                              />
                            )}
                            <span className="ui-type-eyebrow truncate uppercase tracking-wide text-ink">
                              {section.label}
                            </span>
                          </button>
                          <Counter value={section.issues.length} size="sm" appearance="subtle" />
                          {onBulkUpdate && (
                            <ContextMenu
                              trigger={(
                                <Button
                                  style="ghost"
                                  size="icon-xs"
                                  icon={MoreVertical}
                                  composition="section-kebab"
                                  aria-label={`Дії з групою ${section.label}`}
                                  title="Дії з групою"
                                />
                              )}
                              items={[{
                                label: allSelected ? 'Зняти вибір у групі' : 'Вибрати всі у групі',
                                icon: CheckSquare,
                                onClick: () => toggleIssueScope(section.issues.map(issue => issue.id)),
                              }]}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {!collapsed && section.issues.map(issue => {
                    const selected = activeSelectedIds.has(issue.id);
                    const rowTone = selected ? 'bg-[#f1f1f1]' : 'bg-white group-hover:bg-[#fafafa]';
                    return (
                      <tr
                        key={issue.id}
                        className={`group border-b border-[#f4f4f5] transition-colors ${
                          selected ? 'bg-[#f1f1f1]' : 'hover:bg-[#fafafa]'
                        }`}
                      >
                        <td
                          className={`sticky left-0 z-[1] h-9 px-[10px] align-middle ${rowTone}`}
                          onMouseDown={event => { shiftHeldRef.current = event.shiftKey; }}
                        >
                          <Checkbox
                            checked={selected}
                            onChange={() => selectRow(issue)}
                            size="sm"
                            ariaLabel={`Вибрати завдання ${issue.issueKey || issue.title}`}
                          />
                        </td>
                        {visibleColumns.map(column => {
                          const isEditing = editable
                            && editing?.issueId === issue.id
                            && editing?.columnId === column.id;
                          const canEdit = editable && Boolean(column.editor);
                          return (
                            <td
                              key={column.id}
                              ref={isEditing ? editingRef : undefined}
                              style={column.pinned ? { left: pinnedOffsets[column.id] } : undefined}
                              className={`h-9 align-middle ${ALIGNMENT[column.align]} ${
                                column.pinned
                                  ? `z-[1] ${column.id === 'title' ? 'md:sticky md:border-r md:border-line' : 'sticky'} ${rowTone}`
                                  : ''
                              } ${isEditing ? 'p-[3px]' : 'px-[10px] py-0'}`}
                            >
                              {isEditing ? renderEditor(column, issue) : (
                                canEdit ? (
                                  // A cell you can change is a control, and says
                                  // so; the key inside the title cell keeps its
                                  // own link because opening a task and renaming
                                  // one are different intentions.
                                  <button
                                    type="button"
                                    onClick={() => setEditing({ issueId: issue.id, columnId: column.id })}
                                    title={`Змінити: ${column.label}`}
                                    className={`-mx-[6px] flex h-[26px] w-[calc(100%+12px)] min-w-0 items-center rounded-[6px] px-[6px] text-left transition-colors hover:bg-black/[0.05] ${
                                      column.align === 'right' ? 'justify-end' : ''
                                    }`}
                                  >
                                    {renderValue(column, issue)}
                                  </button>
                                ) : (
                                  <span className={`flex min-w-0 items-center ${column.align === 'right' ? 'justify-end' : ''}`}>
                                    {renderValue(column, issue)}
                                  </span>
                                )
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </div>
      </Surface>

      <BulkActionBar
        count={onBulkUpdate ? activeSelectedIds.size : 0}
        progress={bulkProgress}
        statusOptions={statusOptions}
        memberOptions={memberOptions}
        priorityOptions={priorityOptions}
        labelOptions={labelOptions}
        typeOptions={typeOptions}
        sprintOptions={sprints.filter(sprint => sprint.status !== 'completed').map(sprint => ({
          value: sprint.id,
          label: sprint.name,
        }))}
        canArchive={canArchive}
        onApply={(action, value) => onBulkUpdate?.(
          action,
          action === 'status' ? { mode: 'status', id: value } : value,
          selectedIssues,
        )}
        onClear={clearSelection}
      />
    </div>
  );
}
