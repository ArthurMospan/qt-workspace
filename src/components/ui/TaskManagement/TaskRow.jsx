'use client';
// src/components/ui/TaskManagement/TaskRow.jsx — Beautiful list-row representation of a task
import { Clock, Lock } from 'lucide-react';
import { CalendarIcon, TaskIcon } from '@/lib/design/icons';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import Tag from '@/components/ui/DataDisplay/Tag';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { isDueDateOverdue, parseDueDate } from '@/lib/utils/date';
import { organizationTimeZone } from '@/lib/utils/timeZone.mjs';
import { useAppContext } from '@/lib/context/AppContext';
import TypeBadge from '@/components/ui/DataDisplay/TypeBadge';
import Pill from '@/components/ui/DataDisplay/Pill';
import TaskCounters from './TaskCounters';
import TaskIdentity from './TaskIdentity';
import { existingParentIssueId } from '@/lib/utils/issueHierarchyModel.mjs';
import { openBlockerIssues } from '@/lib/utils/issueExecution.mjs';
import { issuePath } from '@/lib/utils/issueKeys.mjs';
import { taskTypeIcon } from '@/lib/design/taskTypeIcons';
import PriorityIcon from '@/components/ui/DataDisplay/PriorityIcon';
import { priorityPresentation } from '@/lib/utils/priorities.mjs';
import Checkbox from '@/components/ui/Forms/Checkbox';

function fmtDate(raw, timeZone) {
  if (!raw) return null;
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', timeZone });
}

/**
 * One task as a row: key, title, type, status, assignee, labels, and the timer
 * dot when it is running.
 *
 * @param {object} props.issue The task this row shows.
 * @param {object[]} props.issues Its siblings, for resolving the parent key.
 * @param {object[]} props.allIssues Every task in scope, for links that leave the current list.
 * @param {object[]} props.members Workspace members, for the assignee avatar.
 * @param {object[]} props.labels Label definitions, for the chips.
 * @param {object[]} props.sprints Sprint definitions.
 * @param {object[]} props.issueLinks Relations, for the link count.
 * @param {boolean} props.isTimerActive A timer is running on this task.
 * @param {string} props.projectId Current project.
 * @param {string} props.projectName Its name.
 * @param {boolean} props.showProjectName Whether the row names its project — true only on cross-project lists.
 * @param {boolean} props.showStatusName Whether the row names its status — true only where the section heading cannot, i.e. a category holding several statuses.
 * @param {() => void} props.onClick Opens the task.
 * @param {boolean} props.selected Whether this task is part of the active bulk selection.
 * @param {boolean} props.selectionActive Whether the row is showing its selection control instead of priority.
 * @param {(issueId: string, options?: {shiftKey?: boolean}) => void} props.onSelect Toggles this task in the active selection.
 */
export default function TaskRow({
  issue,
  issues = [],
  allIssues,
  issueLinks = [],
  members = [],
  labels = [],
  sprints = [],
  projectId,
  projectName,
  showProjectName = false,
  showStatusName = false,
  isTimerActive,
  onClick,
  selected = false,
  selectionActive = false,
  onSelect,
}) {
  const router = useRouter();
  const { currentUser, projects = [], activeOrg } = useAppContext();
  const timeZone = organizationTimeZone(activeOrg);
  const project = projects.find(candidate => candidate.id === projectId);
  const currentUserId = currentUser?.uid || currentUser?.id;
  const isDraggingRef = useRef(false);
  const { types, priorities, statuses, closedStatusIds } = useWorkflowConfig();

  const task = issue;
  if (!task) return null;

  // Only where the section heading cannot say it — see `showStatusName`.
  const statusObj = showStatusName
    ? statuses.find(status => status.id === (task.columnId || task.status)) || null
    : null;

  const typeObj = types.find(t => t.id === task.type) || {
    id: task.type || 'task',
    label: task.type === 'epic' ? 'Епік (legacy)' : 'Задача',
    color: task.type === 'epic' ? '#8b5cf6' : '#9a9a9a',
  };
  const typeLabel = typeObj.label;

  const priorityConfig = priorityPresentation(task.priority, priorities);

  const assignees = (task.assigneeIds || task.assignees || [])
    .map(uid => members.find(m => (m.id || m.uid) === uid))
    .filter(Boolean);

  const due = parseDueDate(task.dueDate, { timeZone });
  const isOverdue = isDueDateOverdue(task.dueDate, { timeZone })
    && !closedStatusIds.includes(task.columnId)
    && !closedStatusIds.includes(task.status);

  const contextIssues = allIssues || issues;
  const parentIssueId = existingParentIssueId(task);
  const parentIssue = contextIssues.find(candidate => candidate.id === parentIssueId);
  const childIssues = contextIssues.filter(candidate => existingParentIssueId(candidate) === task.id);
  const childAll = childIssues.length;
  const childDone = childIssues.filter(child => closedStatusIds.includes(child.columnId || child.status)).length;
  const checklistAll = (task.subtasks || []).length;
  const checklistDone = (task.subtasks || []).filter(item => item.done).length;

  const msgCount = task.commentCount || task.commentsCount || task.comments?.length || (task.hasUnreadChat ? 1 : 0);
  const hasUnreadChat = Boolean(
    task.lastCommentAt &&
    task.lastCommentAuthorId !== currentUserId &&
    !(task.lastCommentReadBy || []).includes(currentUserId)
  );
  const mentionCount = Number(task.unreadMentions?.[currentUserId]) || 0;

  const isBlocked = openBlockerIssues(
    task.id,
    contextIssues,
    issueLinks,
    closedStatusIds,
  ).length > 0;

  const handleRowClick = (e) => {
    if (selectionActive && onSelect) {
      e.preventDefault();
      onSelect(task.id, { shiftKey: e.shiftKey });
      return;
    }
    if (onClick) {
      onClick(e);
      return;
    }
    if (projectId && task.id) {
      router.push(issuePath(task, project || projectId));
    }
  };

  return (
    <div
      onClick={handleRowClick}
      // The row carries controls of its own — the timer, the assignee picker —
      // so it cannot be a `<button>` without nesting them inside one. It gets
      // the three things a button would have given it instead: a role, a place
      // in the tab order, and the two keys that activate a button.
      role="button"
      tabIndex={0}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        handleRowClick(event);
      }}
      className={`relative group overflow-hidden rounded-[12px] bg-white cursor-pointer select-none border border-[#f0f0f0] transition-all duration-200 flex items-center justify-between p-[12px] hover:bg-[#fcfcfc] ${selected ? 'ring-2 ring-ink' : 'hover:!ring-4 hover:!ring-[#ECECEC]'} ${isTimerActive ? 'ring-2 ring-ink/30' : ''}`}
    >
      {/* Main Row Grid/Flex */}
      <div className="flex items-center justify-between w-full flex-wrap md:flex-nowrap gap-[16px] min-w-0">

        {/* The priority mark leads the row, because the selection checkbox
            takes its place and a checkbox belongs at the start of a row, not
            floating in the middle of the badges. The box is always drawn so a
            task with no priority does not shift the title left. */}
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
          {selectionActive && onSelect ? (
            <span
              className="flex h-5 w-5 items-center justify-center"
              onClick={event => event.stopPropagation()}
              onMouseDown={event => event.stopPropagation()}
              onTouchStart={event => event.stopPropagation()}
            >
              <Checkbox
                checked={selected}
                onChange={() => onSelect(task.id)}
                size="sm"
                ariaLabel={`Вибрати завдання ${task.issueKey || task.title}`}
              />
            </span>
          ) : (
            <PriorityIcon priority={priorityConfig} size="md" />
          )}
        </span>

        {/* Left Section: Title & ID (2 lines) */}
        <div className="flex flex-col gap-[2px] min-w-0 flex-1">
          {/* Issue Key, Project, Due Date, Subtasks (Top Row) */}
          <div className="flex items-center gap-[8px] flex-wrap">
            <TaskIdentity
              issue={task}
              projectName={projectName}
              showProjectName={showProjectName}
              parentIssue={parentIssueId ? (parentIssue || { issueKey: '' }) : null}
              className="max-w-full"
            />

            {/* Due Date */}
            {due && (
              <div className={`flex items-center gap-[3px] text-[9px] font-bold shrink-0 ml-1 ${
                isOverdue ? 'text-[#ef4444]' : 'text-[#a3a3a3]'
              }`}>
                <CalendarIcon size={10} strokeWidth={2} className="shrink-0" />
                <span>{fmtDate(due, timeZone)}</span>
                {isOverdue && <span className="font-bold uppercase text-[8px] ml-0.5">• Прострочено</span>}
              </div>
            )}

            {/* Real child issue progress */}
            {childAll > 0 && (
              <div className="flex items-center gap-[4px] text-[9px] text-[#555555] font-bold shrink-0 ml-1">
                <span className="text-[#1a1a1a]">{childDone}/{childAll} підзавдань</span>
                <div className="flex gap-[2px]">
                  {Array.from({ length: childAll }).map((_, idx) => (
                    <div 
                      key={idx}
                      className={`h-[1.5px] w-[6px] rounded-full transition-all duration-300 ${
                        idx < childDone ? 'bg-[#1a1a1a]' : 'bg-[#e5e7eb]'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {checklistAll > 0 && (
              <div className="flex items-center gap-[3px] text-[9px] font-bold text-muted">
                <TaskIcon size={9} />
                <span>{checklistDone}/{checklistAll} чекліст</span>
              </div>
            )}

            {isTimerActive && (
              <span className="w-[5px] h-[5px] bg-ink rounded-full animate-pulse shrink-0" />
            )}
          </div>

          {/* Title & Chat Indicator (Bottom Row) */}
          <div className="flex items-center gap-[8px] min-w-0">
            <p className="text-[13px] font-bold text-[#1a1a1a] truncate" title={task.title}>
              {task.title}
            </p>

            {/* The same three counts, in the same order and the same shapes as
                on a board card. A count of messages is a quantity you read, not
                an identifier you retype — it was set in the same monospace as
                the task key, which is what made a bare number beside an icon
                look like a code fragment rather than "12 повідомлень". */}
            <TaskCounters
              mentions={mentionCount}
              messages={msgCount}
              unread={hasUnreadChat}
              size="sm"
            />
          </div>
        </div>

        {/* Right Section: Metadata, Badges, Assignees.
            The assignee stack is pinned to a fixed width: it used to follow the
            number of faces and drag every badge left of it along, which is what
            made a list of ten read as ten ragged lines. The badges keep their
            natural widths — giving them a fixed track too opened a wide hole in
            front of the avatars on every row without labels. */}
        <div className="flex flex-wrap items-center justify-end gap-x-[12px] gap-y-[6px] shrink-0 md:flex-nowrap">
          {/* Type Badge */}
          <span className="flex min-w-0 shrink-0 items-center">
            {typeObj && (
              <TypeBadge
                label={typeLabel}
                color={typeObj.color || '#9a9a9a'}
                icon={taskTypeIcon(typeObj)}
              />
            )}
          </span>

          <span className="flex min-w-0 items-center gap-[8px] overflow-hidden">
            {statusObj && (
              <Pill
                color={statusObj.color || '#9a9a9a'}
                size="sm"
                shape="badge"
                weight="medium"
                title={`Статус: ${statusObj.label}`}
              >
                {statusObj.label}
              </Pill>
            )}

            {isBlocked && (
              <span
                className="flex items-center gap-[4px] text-[10px] font-medium px-[6px] py-[1.5px] rounded-[4px] shrink-0 bg-[#fef2f2] text-[#ef4444]"
                title="Заблоковано іншою задачею"
              >
                <Lock size={10} />
                Заблоковано
              </span>
            )}

            {/* Sprint Name */}
            {task.sprintId && (
              <span className="inline-flex items-center px-[6px] py-[1.5px] bg-[#f0f0f0] text-[#555555] rounded-[4px] text-[10px] font-medium shrink-0">
                {sprints.find(s => s.id === task.sprintId)?.name || 'Спринт'}
              </span>
            )}

            {/* Labels / Tags */}
            {task.labelIds && task.labelIds.length > 0 && (
              <span className="flex items-center gap-[4px] overflow-hidden">
                {task.labelIds.map(id => {
                  const l = labels.find(lbl => lbl.id === id);
                  if (!l) return null;
                  return (
                    <Tag
                      key={id}
                      label={l.label}
                      color={l.color}
                      size="small"
                      className="shrink-0"
                    />
                  );
                })}
              </span>
            )}
          </span>

          {/* Assignees — a fixed box so three faces and none take the same room. */}
          <span className="flex w-[76px] shrink-0 items-center justify-end -space-x-[6px] overflow-visible">
            {assignees.length > 0 ? (
              <>
                {assignees.slice(0, 3).map((m, idx) => (
                  <span key={idx} title={m.name || m.email?.split('@')[0]} className="relative">
                    <UserAvatar user={m} size="xs" className="ring-2 ring-white hover:scale-110 hover:z-20 transition-all" />
                  </span>
                ))}
                {assignees.length > 3 && (
                  <Pill
                    tone="neutral"
                    size="md"
                    preset="avatar-counter"
                    title={assignees.slice(3).map(m => m.name || m.email?.split('@')[0]).join(', ')}
                  >
                    +{assignees.length - 3}
                  </Pill>
                )}
              </>
            ) : (
              <span className="text-[10px] text-faint italic">Н/В</span>
            )}
          </span>

        </div>

      </div>
    </div>
  );
}
