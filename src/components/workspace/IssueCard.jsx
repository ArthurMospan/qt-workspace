'use client';
// src/components/workspace/IssueCard.jsx
import { Draggable } from '@hello-pangea/dnd';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import { Lock, Paperclip } from 'lucide-react';
import { CalendarIcon, ChatIcon, TaskIcon } from '@/lib/design/icons';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { parseDueDate } from '@/lib/utils/date';
import Tag from '@/components/ui/DataDisplay/Tag';
import { useLocalization } from '@/lib/hooks/useLocalization';
import { useAppContext } from '@/lib/context/AppContext';
import TypeBadge from '@/components/ui/DataDisplay/TypeBadge';
import Pill from '@/components/ui/DataDisplay/Pill';
import { issueDisplayParticipants } from '@/lib/utils/issueParticipants.mjs';
import { existingParentIssueId } from '@/lib/utils/issueHierarchyModel.mjs';
import { openBlockerIssues } from '@/lib/utils/issueExecution.mjs';
import { isIssueUnread } from '@/lib/utils/issueReadState.mjs';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { Counter, TaskIdentity } from '@/components/ui';

function hexToRgba(hex, alpha) {
  let r = 0, g = 0, b = 0;
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



// `showProjectName` is opt-in: cross-project lists (Мої завдання, спринти) need
// the project after the key to tell two identical-looking cards apart, but on a
// project's own board every card would repeat the project you are already in.
// `projectName` is still always accepted — the issue key prefix is derived from
// it below, which has to work whether or not the badge is shown.
export default function IssueCard({ issue, issues = [], allIssues, issueLinks = [], members = [], labels = [], sprints = [], index, projectId, projectName, showProjectName = false, isTimerActive, isArchived, className = '' }) {
  const router   = useRouter();
  const { currentUser } = useAppContext();
  const currentUserId = currentUser?.uid || currentUser?.id;
  const lastSeenAt = useWorkspaceStore(state => state.issueReadState[issue.id] || 0);
  const hasUnreadActivity = isIssueUnread(issue, lastSeenAt, currentUserId);
  const { formatDate } = useLocalization();
  const isDraggingRef = useRef(false);
  const { types, priorities, doneStatusIds } = useWorkflowConfig();
  
  const typeObj = types.find(t => t.id === issue.type) || {
    id: issue.type || 'task',
    label: issue.type === 'epic' ? 'Епік (legacy)' : 'Задача',
    color: issue.type === 'epic' ? '#8b5cf6' : '#9a9a9a',
  };
  const typeLabel = typeObj.label;
  
  const priObj = priorities.find(p => p.id === issue.priority) || priorities[0];
  const pri = {
    label: priObj ? priObj.label.toUpperCase() : 'СЕРЕДНІЙ',
    dot: priObj ? priObj.color : '#eab308',
    glow: priObj ? hexToRgba(priObj.color, 0.05) : 'transparent',
    bg: priObj ? hexToRgba(priObj.color, 0.01) : '#fefce8'
  };

  const participantRoles = issueDisplayParticipants(issue);
  const participants = participantRoles
    .map(participant => {
      const member = members.find(candidate => (candidate.id || candidate.uid) === participant.id);
      return member ? { ...participant, member } : null;
    })
    .filter(Boolean);

  const due       = parseDueDate(issue.dueDate);
  const isOverdue = due && due < new Date() && !doneStatusIds.includes(issue.columnId || issue.status);

  const contextIssues = allIssues || issues;
  const parentIssueId = existingParentIssueId(issue);
  const parentIssue = contextIssues.find(candidate => candidate.id === parentIssueId);
  const childIssues = contextIssues.filter(candidate => existingParentIssueId(candidate) === issue.id);
  const childAll = childIssues.length;
  const childDone = childIssues.filter(child => doneStatusIds.includes(child.columnId || child.status)).length;
  const checklistAll = (issue.subtasks || []).length;
  const checklistDone = (issue.subtasks || []).filter(item => item.done).length;
  const attachCount = (issue.attachments || []).length;

  const isDraggable = typeof index === 'number';

  const isBlocked = openBlockerIssues(
    issue.id,
    contextIssues,
    issueLinks,
    doneStatusIds,
  ).length > 0;

  const renderCardContent = (provided = {}, snapshot = {}) => {
    const { isDragging = false, isDropAnimating = false } = snapshot;
    const libraryTransition = provided.draggableProps?.style?.transition;
    const libraryTransform = provided.draggableProps?.style?.transform;
    const lifted = isDragging && !isDropAnimating;
    // `transition-all` would put `transform` under a CSS transition, but the
    // library drives the card's transform frame by frame during a drag. The two
    // fight each other and the card drifts after the drop, so only paint
    // properties ease here.
    // The hover ring is an `!important` box-shadow, so it outranks the inline
    // lift shadow below — and the cursor is by definition over the card being
    // dragged. Dropping the ring while lifted lets the lift actually show, and
    // stops the shadow swapping abruptly the moment the card is released.
    const hoverRing = lifted ? '' : 'hover:!ring-4 hover:!ring-[#ECECEC]';
    const cardClassName = `relative group overflow-hidden rounded-[16px] bg-white cursor-pointer select-none transition-[box-shadow,border-color] duration-200 flex flex-col justify-between ${hoverRing} ${isTimerActive ? 'ring-2 ring-ink/20' : ''} shrink-0 ${className}`;
    // `none` is the library asking for an instant snap and cannot be combined
    // with further entries — appending to it would void the whole declaration.
    const cardTransition = !libraryTransition || libraryTransition === 'none'
      ? libraryTransition || undefined
      : `${libraryTransition}, box-shadow 0.2s ease, border-color 0.2s ease`;
    const msgCount = issue.commentCount || issue.commentsCount || issue.comments?.length || (issue.hasUnreadChat ? 1 : 0);
    const hasUnreadChat = Boolean(
      issue.lastCommentAt &&
      issue.lastCommentAuthorId !== currentUserId &&
      !(issue.lastCommentReadBy || []).includes(currentUserId)
    );
    const isMentioned = hasUnreadChat && (issue.lastCommentMentionIds || []).includes(currentUserId);

    return (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        onDragStart={() => { isDraggingRef.current = true; }}
        onDragEnd={() => { isDraggingRef.current = false; }}
        onClick={() => { if (!isDraggingRef.current) router.push(`/${projectId}/issue/${issue.id}`); }}
        className={cardClassName}
        style={{
          ...provided.draggableProps?.style,
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: lifted ? '#e4e4e7' : '#ffffff',
          // A deeper shadow now carries the "lifted" feel on its own. There used
          // to be a scale(1.015) here too, but the library measures a Draggable
          // once at drag start and derives every placeholder and displacement
          // offset from that box — visually resizing the card afterwards puts it
          // a few pixels out of step with the slot it is heading for.
          boxShadow: lifted
            ? '0 18px 26px -12px rgba(0, 0, 0, 0.22), 0 6px 8px -4px rgba(0, 0, 0, 0.10)'
            : 'none',
          transform: libraryTransform,
          // Hand the transition straight back to the library while it owns the
          // card. The previous version appended `ring 0.2s ease` — not an
          // animatable property — and that inline value silently overrode the
          // `transition-all duration-200` class, so nothing on the card eased
          // at rest either. Leaving it undefined lets the class do its job.
          transition: cardTransition,
        }}
      >
        {/* ── Priority glow blob ─────────────────────────── */}
        {pri.glow !== 'transparent' && (
          <>
            {/* Resting state: bottom-right */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[16px] transition-opacity duration-300 opacity-100 group-hover:opacity-0"
              style={{
                background: `radial-gradient(ellipse at 90% 100%, ${pri.glow} 0%, transparent 45%)`,
              }}
            />
            {/* Hover state: top-right */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[16px] transition-opacity duration-300 opacity-0 group-hover:opacity-100"
              style={{
                background: `radial-gradient(ellipse at 88% 5%, ${pri.glow} 0%, transparent 45%)`,
              }}
            />
          </>
        )}

        <div className="relative z-10 p-[14px] flex flex-col flex-1">
          {/* Row 1: Code + Project (merged, original mono bold font, separated by •) + Priority */}
          <div className="flex items-center gap-[8px] mb-[10px] flex-wrap">
            <TaskIdentity
              issue={issue}
              projectName={projectName}
              showProjectName={showProjectName}
              parentIssue={parentIssueId ? (parentIssue || { issueKey: '' }) : null}
              className="max-w-[220px]"
            />

            {hasUnreadActivity && (
              <span role="status" aria-label="Непрочитані зміни" title="У задачі є непрочитані зміни">
                <Counter variant="dot" size="sm" status="info" />
              </span>
            )}

            {isTimerActive && (
              <span className="w-[5px] h-[5px] bg-ink rounded-full animate-pulse ml-1 shrink-0" />
            )}

            <div className="ml-auto flex items-center justify-center w-[18px] h-[18px] rounded-full shrink-0"
              style={{ background: pri.bg }} title={`Пріоритет: ${pri.label}`}>
              <span className="w-[8px] h-[8px] rounded-full" style={{ background: pri.dot }} />
            </div>
          </div>

          {/* Row 2: Title */}
          <p className="text-[13px] font-bold text-[#1a1a1a] leading-[1.35] line-clamp-3 mb-[12px]">
            {issue.title}
          </p>

          {/* Real child issues roll up into the parent card. */}
          {childAll > 0 && (
            <div className="mb-[12px] flex items-center gap-[8px] select-none text-[10px] text-[#555555] font-medium">
              <span className="shrink-0">
                <strong className="text-[#1a1a1a] font-semibold">{childDone}/{childAll}</strong> підзадач
              </span>
              <div className="flex items-center gap-[3px] shrink-0">
                {Array.from({ length: childAll }).map((_, idx) => (
                  <div 
                    key={idx}
                    className={`h-[2.5px] w-[12px] rounded-full transition-all duration-300 ${
                      idx < childDone ? 'bg-[#1a1a1a]' : 'bg-[#e5e7eb]'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {checklistAll > 0 && (
            <div className="mb-[12px] flex items-center gap-[5px] text-[10px] font-medium text-muted">
              <TaskIcon size={11} />
              <span><strong className="text-ink">{checklistDone}/{checklistAll}</strong> старий чекліст</span>
            </div>
          )}

          {/* Row 4: Sprint + Type + Labels (Using strict UI Kit Tag atom styling) */}
          <div className="flex flex-wrap gap-[6px] mb-[12px] items-center">
            {typeObj && (
              <TypeBadge
                label={typeLabel}
                color={typeObj.color || '#9a9a9a'}
              />
            )}

            {isBlocked && (
              <Pill
                tone="danger"
                size="sm"
                shape="badge"
                weight="medium"
                title="Заблоковано іншою задачею"
              >
                <Lock size={10} />
                Заблоковано
              </Pill>
            )}

            {/* Sprint: Standard gray badge without emoji */}
            {issue.sprintId && (
              <Pill tone="neutral" size="sm" shape="badge" weight="medium">
                {sprints.find(s => s.id === issue.sprintId)?.name || 'Спринт'}
              </Pill>
            )}

            {/* Labels */}
            {issue.labelIds && issue.labelIds.map(id => {
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

          {/* Row 5: Due date (thinner medium weight, lighter text, thinner stroke width) */}
          {due && (
            <div className={`flex items-center gap-[5px] mb-[12px] text-[11px] font-medium ${
              isOverdue ? 'text-[#ef4444]' : 'text-[#a3a3a3]'
            }`}>
              <CalendarIcon size={11} strokeWidth={1.8} className="shrink-0" />
              <span>{formatDate(due)}</span>
              {isOverdue && <span className="font-semibold">• Прострочено</span>}
            </div>
          )}

          {/* Row 6: Footer with task participants and flat modern indigo chat indicator */}
          <div className="border-t border-[#f5f5f5] pt-[10px] flex items-center justify-between gap-2 mt-auto">
            <div className="flex -space-x-[8px] overflow-visible" aria-label="Учасники завдання">
              {participants.length > 0 ? (
                participants.slice(0, 5).map(({ id, member, roles }) => {
                  const roleLabels = roles.map(role => ({
                    assignee: 'виконавець',
                    author: 'автор',
                    subscriber: 'підписник',
                  })[role]);
                  return (
                    <div
                      key={id}
                      title={`${member.name || member.email?.split('@')[0]} · ${roleLabels.join(', ')}`}
                      className="relative group/avatar"
                    >
                      <UserAvatar user={member} size="sm" stacked className="hover:scale-110 hover:z-20 transition-all cursor-pointer" />
                    </div>
                  );
                })
              ) : (
                <span className="text-[11px] text-faint italic">Без учасників</span>
              )}
              {participants.length > 5 ? (
                <Pill
                  tone="neutral"
                  size="md"
                  preset="avatar-counter"
                  title={`Ще ${participants.length - 5} учасників`}
                >
                  +{participants.length - 5}
                </Pill>
              ) : null}
            </div>

            <div className="flex items-center gap-[10px] shrink-0">
              {/* Attachments indicator */}
              {attachCount > 0 && (
                <div className="flex items-center gap-[4px] text-muted text-[11px] font-bold select-none" title={`${attachCount} вкладень`} aria-label={`${attachCount} вкладень`}>
                  <Paperclip size={12} strokeWidth={2} />
                  <span>{attachCount}</span>
                </div>
              )}

              {/* Chat count indicator: totally flat, no background, no border, no shadow */}
              {msgCount > 0 && (
                <div className={`flex items-center gap-[4px] text-[11px] font-bold select-none ${hasUnreadChat ? 'text-ink' : 'text-muted'}`} title={isMentioned ? 'Вас згадали в новому повідомленні' : hasUnreadChat ? 'Є нові повідомлення' : `${msgCount} повідомлень в чаті`}>
                  {/* Drawn by hand until now, which is why the chat glyph
                      never changed with the rest of the site: a path in a file
                      is invisible to every rename. */}
                  <ChatIcon size={13} />
                  {isMentioned && <Pill tone="dark" size="sm">@</Pill>}
                  {hasUnreadChat && !isMentioned && <span className="h-1.5 w-1.5 rounded-full bg-ink" />}
                  <span>{msgCount}</span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    );
  };

  if (isDraggable) {
    return (
      <Draggable draggableId={issue.id} index={index} isDragDisabled={isArchived}>
        {(provided, snapshot) => renderCardContent(provided, snapshot)}
      </Draggable>
    );
  }

  return renderCardContent();
}
