'use client';
// src/components/ui/TaskManagement/TaskRow.jsx — Beautiful list-row representation of a task
import { Calendar, Clock, CheckSquare, Lock } from 'lucide-react';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import Tag from '@/components/ui/DataDisplay/Tag';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { parseDueDate } from '@/lib/utils/date';
import { useAppContext } from '@/lib/context/AppContext';
import TypeBadge from '@/components/ui/DataDisplay/TypeBadge';
import { existingParentIssueId } from '@/lib/utils/issueHierarchyModel.mjs';
import { openBlockerIssues } from '@/lib/utils/issueExecution.mjs';

function hexToRgba(hex, alpha) {
  let r = 0, g = 0, b = 0;
  if (!hex) return `rgba(154,154,154,${alpha})`;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

function fmtDate(raw) {
  if (!raw) return null;
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

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
  isTimerActive,
  onClick,
}) {
  const router = useRouter();
  const { currentUser } = useAppContext();
  const currentUserId = currentUser?.uid || currentUser?.id;
  const isDraggingRef = useRef(false);
  const { types, priorities, doneStatusIds } = useWorkflowConfig();

  const task = issue;
  if (!task) return null;

  const typeObj = types.find(t => t.id === task.type) || {
    id: task.type || 'task',
    label: task.type === 'epic' ? 'Епік (legacy)' : 'Задача',
    color: task.type === 'epic' ? '#8b5cf6' : '#9a9a9a',
  };
  const typeLabel = typeObj.label;

  const priObj = priorities.find(p => p.id === task.priority) || priorities[0];
  const pri = {
    label: priObj ? priObj.label.toUpperCase() : 'СЕРЕДНІЙ',
    dot: priObj ? priObj.color : '#eab308',
    glow: priObj ? hexToRgba(priObj.color, 0.05) : 'transparent',
    bg: priObj ? hexToRgba(priObj.color, 0.08) : '#fefce8'
  };

  const assignees = (task.assigneeIds || task.assignees || [])
    .map(uid => members.find(m => (m.id || m.uid) === uid))
    .filter(Boolean);

  const due = parseDueDate(task.dueDate);
  const isOverdue = due && due < new Date() && !doneStatusIds.includes(task.columnId) && !doneStatusIds.includes(task.status);

  const contextIssues = allIssues || issues;
  const parentIssueId = existingParentIssueId(task);
  const parentIssue = contextIssues.find(candidate => candidate.id === parentIssueId);
  const childIssues = contextIssues.filter(candidate => existingParentIssueId(candidate) === task.id);
  const childAll = childIssues.length;
  const childDone = childIssues.filter(child => doneStatusIds.includes(child.columnId || child.status)).length;
  const checklistAll = (task.subtasks || []).length;
  const checklistDone = (task.subtasks || []).filter(item => item.done).length;

  const msgCount = task.commentCount || task.commentsCount || task.comments?.length || (task.hasUnreadChat ? 1 : 0);
  const hasUnreadChat = Boolean(
    task.lastCommentAt &&
    task.lastCommentAuthorId !== currentUserId &&
    !(task.lastCommentReadBy || []).includes(currentUserId)
  );
  const isMentioned = hasUnreadChat && (task.lastCommentMentionIds || []).includes(currentUserId);

  // Generate dynamic, readable project prefix instead of generic WS-
  const getDisplayKey = () => {
    if (task.issueKey && !task.issueKey.startsWith('WS-')) {
      return task.issueKey;
    }
    const pName = projectName || projectId || 'WS';
    const cleanProj = pName.replace(/[^a-zA-Z]/g, '');
    let prefix = cleanProj.slice(0, 3).toUpperCase();
    if (prefix.length < 2) {
      prefix = pName.slice(0, 2).toUpperCase();
    }
    const numPart = task.issueKey?.split('-')[1] || task.id?.slice(0, 4) || '101';
    return `${prefix}-${numPart}`;
  };

  const displayKey = getDisplayKey();

  const isBlocked = openBlockerIssues(
    task.id,
    contextIssues,
    issueLinks,
    doneStatusIds,
  ).length > 0;

  const handleRowClick = (e) => {
    if (onClick) {
      onClick(e);
      return;
    }
    if (projectId && task.id) {
      router.push(`/${projectId}/issue/${task.id}`);
    }
  };

  return (
    <div
      onClick={handleRowClick}
      className={`relative group overflow-hidden rounded-[12px] bg-white cursor-pointer select-none border border-[#f0f0f0] transition-all duration-200 flex items-center justify-between p-[12px] hover:bg-[#fcfcfc] hover:!ring-4 hover:!ring-[#ECECEC] ${isTimerActive ? 'ring-2 ring-ink/30' : ''}`}
    >
      {/* Priority Left Indicator Bar - Rounded Pill */}
      <div 
        className="absolute left-[4px] top-[8px] bottom-[8px] w-[4px] rounded-full transition-all duration-200 group-hover:w-[5px]"
        style={{ backgroundColor: pri.dot }}
      />

      {/* Main Row Grid/Flex */}
      <div className="pl-[12px] flex items-center justify-between w-full flex-wrap md:flex-nowrap gap-[16px] min-w-0">
        
        {/* Left Section: Title & ID (2 lines) */}
        <div className="flex flex-col gap-[2px] min-w-0 flex-1">
          {/* Issue Key, Project, Due Date, Subtasks (Top Row) */}
          <div className="flex items-center gap-[8px] flex-wrap">
            <span className="font-mono text-[#c5c5c5] font-bold text-[9px] tracking-wider select-none shrink-0">
              {displayKey}{showProjectName && projectName ? ` • ${projectName.toUpperCase()}` : ''}
            </span>
            {parentIssueId && (
              <span className="max-w-[160px] truncate text-[8px] font-semibold text-muted" title={parentIssue?.title || 'Підзадача'}>
                ↳ {parentIssue?.issueKey || 'ПІДЗАДАЧА'}
              </span>
            )}

            {/* Due Date */}
            {due && (
              <div className={`flex items-center gap-[3px] text-[9px] font-bold shrink-0 ml-1 ${
                isOverdue ? 'text-[#ef4444]' : 'text-[#a3a3a3]'
              }`}>
                <Calendar size={10} strokeWidth={2} className="shrink-0" />
                <span>{fmtDate(due)}</span>
                {isOverdue && <span className="font-bold uppercase text-[8px] ml-0.5">• Прострочено</span>}
              </div>
            )}

            {/* Real child issue progress */}
            {childAll > 0 && (
              <div className="flex items-center gap-[4px] text-[9px] text-[#555555] font-bold shrink-0 ml-1">
                <span className="text-[#1a1a1a]">{childDone}/{childAll} підзадач</span>
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
                <CheckSquare size={9} />
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

            {/* Chat Count */}
            {msgCount > 0 && (
              <div className={`flex items-center gap-[4px] text-[11px] font-bold select-none shrink-0 ${hasUnreadChat ? 'text-ink' : 'text-muted'}`} title={isMentioned ? 'Вас згадали в новому повідомленні' : hasUnreadChat ? 'Є нові повідомлення' : `${msgCount} повідомлень в чаті`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {isMentioned && <span className="rounded-full bg-ink px-1.5 py-0.5 text-[8px] leading-none text-white">@</span>}
                {hasUnreadChat && !isMentioned && <span className="h-1.5 w-1.5 rounded-full bg-ink" />}
                <span className="font-mono text-[10px]">{msgCount}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Metadata, Badges, Assignees */}
        <div className="flex items-center gap-[16px] shrink-0 flex-wrap md:flex-nowrap">
          
          {/* Type Badge */}
          {typeObj && (
            <TypeBadge
              label={typeLabel}
              color={typeObj.color || '#9a9a9a'}
            />
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
            <div className="flex items-center gap-[4px] shrink-0">
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
            </div>
          )}

          {/* Assignees */}
          <div className="flex -space-x-[6px] overflow-visible items-center min-w-[32px] justify-end">
            {assignees.length > 0 ? (
              assignees.map((m, idx) => (
                <div key={idx} title={m.name || m.email?.split('@')[0]} className="relative">
                  <UserAvatar user={m} size="xs" className="ring-2 ring-white hover:scale-110 hover:z-20 transition-all" />
                </div>
              ))
            ) : (
              <span className="text-[10px] text-faint italic">Н/В</span>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
