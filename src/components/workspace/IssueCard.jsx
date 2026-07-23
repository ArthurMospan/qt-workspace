'use client';
// src/components/workspace/IssueCard.jsx
import { Draggable } from '@hello-pangea/dnd';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import UserAvatar from '@/components/UserAvatar';
import { Calendar, Lock, Paperclip } from 'lucide-react';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { parseDueDate } from '@/lib/utils/date';
import Tag from '@/components/ui/DataDisplay/Tag';
import { useLocalization } from '@/lib/hooks/useLocalization';

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



export default function IssueCard({ issue, issues = [], issueLinks = [], members = [], labels = [], sprints = [], index, projectId, projectName, isTimerActive, isArchived }) {
  const router   = useRouter();
  const { formatDate } = useLocalization();
  const isDraggingRef = useRef(false);
  const { types, priorities, doneStatusIds } = useWorkflowConfig();
  
  const typeObj = types.find(t => t.id === issue.type) || types[0];
  const typeLabel = typeObj ? typeObj.label : 'Task';
  
  const priObj = priorities.find(p => p.id === issue.priority) || priorities[0];
  const pri = {
    label: priObj ? priObj.label.toUpperCase() : 'MEDIUM',
    dot: priObj ? priObj.color : '#eab308',
    glow: priObj ? hexToRgba(priObj.color, 0.05) : 'transparent',
    bg: priObj ? hexToRgba(priObj.color, 0.01) : '#fefce8'
  };

  const assignees = (issue.assigneeIds || [])
    .map(uid => members.find(m => (m.id || m.uid) === uid))
    .filter(Boolean);
  const first = assignees[0] || null;

  const due       = parseDueDate(issue.dueDate);
  const isOverdue = due && due < new Date() && !doneStatusIds.includes(issue.columnId || issue.status);

  const subAll  = (issue.subtasks || []).length;
  const subDone = (issue.subtasks || []).filter(s => s.done).length;
  const attachCount = (issue.attachments || []).length;

  const isDraggable = typeof index === 'number';

  // Generate dynamic, readable project prefix instead of generic WS-
  const getDisplayKey = () => {
    if (issue.issueKey && !issue.issueKey.startsWith('WS-')) {
      return issue.issueKey;
    }
    const pName = projectName || projectId || 'WS';
    const cleanProj = pName.replace(/[^a-zA-Z]/g, '');
    let prefix = cleanProj.slice(0, 3).toUpperCase();
    if (prefix.length < 2) {
      prefix = pName.slice(0, 2).toUpperCase();
    }
    const numPart = issue.issueKey?.split('-')[1] || issue.id?.slice(0, 4) || '101';
    return `${prefix}-${numPart}`;
  };

  const displayKey = getDisplayKey();

  const isBlocked = issueLinks.some(l => 
    l.targetIssueId === issue.id && 
    l.relationType === 'blocks' && 
    issues.some(i => i.id === l.sourceIssueId && !doneStatusIds.includes(i.columnId || i.status))
  );

  const renderCardContent = (provided = {}, isDragging = false) => {
    const msgCount = issue.commentCount || issue.commentsCount || issue.comments?.length || (issue.hasUnreadChat ? 1 : 0);

    return (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        onDragStart={() => { isDraggingRef.current = true; }}
        onDragEnd={() => { isDraggingRef.current = false; }}
        onClick={() => { if (!isDraggingRef.current) router.push(`/${projectId}/issue/${issue.id}`); }}
        className={`relative group overflow-hidden rounded-[16px] bg-white cursor-pointer select-none transition-all duration-200 flex flex-col justify-between hover:!ring-4 hover:!ring-[#ECECEC] ${isTimerActive ? 'ring-2 ring-ink/20' : ''} shrink-0`}
        style={{
          ...provided.draggableProps?.style,
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: isDragging ? '#e4e4e7' : '#ffffff',
          boxShadow: isDragging ? '0 16px 16px -10px rgba(0, 0, 0, 0.16), 0 4px 4px -2px rgba(0, 0, 0, 0.08)' : 'none',
          transform: isDragging && provided.draggableProps?.style?.transform 
            ? `${provided.draggableProps.style.transform} scale(1.015)` 
            : provided.draggableProps?.style?.transform,
          transition: isDragging 
            ? provided.draggableProps?.style?.transition 
            : `${provided.draggableProps?.style?.transition || ''}, ring 0.2s ease`.replace(/^,\s*/, ''),
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
            <span className="font-mono text-[#c5c5c5] font-bold text-[10px] tracking-wider select-none truncate max-w-[180px]">
              {displayKey}{projectName ? ` • ${projectName.toUpperCase()}` : ''}
            </span>

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

          {/* Row 3: Visual Checklist subtasks indicator (flat, 2.5px dashes, text first) */}
          {subAll > 0 && (
            <div className="mb-[12px] flex items-center gap-[8px] select-none text-[10px] text-[#555555] font-medium">
              <span className="shrink-0">
                <strong className="text-[#1a1a1a] font-semibold">{subDone}/{subAll}</strong> підзавдань
              </span>
              <div className="flex items-center gap-[3px] shrink-0">
                {Array.from({ length: subAll }).map((_, idx) => (
                  <div 
                    key={idx}
                    className={`h-[2.5px] w-[12px] rounded-full transition-all duration-300 ${
                      idx < subDone ? 'bg-[#1a1a1a]' : 'bg-[#e5e7eb]'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Row 4: Sprint + Type + Labels (Using strict UI Kit Tag atom styling) */}
          <div className="flex flex-wrap gap-[6px] mb-[12px] items-center">
            {typeObj && (
              <span 
                className="text-[10px] font-medium px-[6px] py-[1.5px] rounded-[4px] shrink-0 backdrop-blur-[2px]"
                style={{
                  background: hexToRgba(typeObj.color || '#9a9a9a', 0.08),
                  color: typeObj.color || '#404040'
                }}
              >
                {typeLabel}
              </span>
            )}

            {isBlocked && (
              <span 
                className="flex items-center gap-[4px] text-[10px] font-medium px-[6px] py-[1.5px] rounded-[4px] shrink-0 bg-[#fef2f2] text-[#ef4444]"
                title="Заблоковано іншою завданням"
              >
                <Lock size={10} />
                Blocked
              </span>
            )}

            {/* Sprint: Standard gray badge without emoji */}
            {issue.sprintId && (
              <span className="inline-flex items-center px-[6px] py-[1.5px] bg-[#f0f0f0] text-[#555555] rounded-[4px] text-[10px] font-medium shrink-0">
                {sprints.find(s => s.id === issue.sprintId)?.name || 'Спринт'}
              </span>
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
              <Calendar size={11} strokeWidth={1.8} className="shrink-0" />
              <span>{formatDate(due)}</span>
              {isOverdue && <span className="font-semibold">• Overdue</span>}
            </div>
          )}

          {/* Row 6: Footer with overlapping assignees and flat modern indigo chat indicator */}
          <div className="border-t border-[#f5f5f5] pt-[10px] flex items-center justify-between gap-2 mt-auto">
            <div className="flex -space-x-[8px] overflow-visible">
              {assignees.length > 0 ? (
                assignees.map((m, idx) => (
                  <div key={idx} title={m.name || m.email?.split('@')[0]} className="relative group/avatar">
                    <UserAvatar user={m} size={22} className="ring-2 ring-white hover:scale-110 hover:z-20 transition-all cursor-pointer" />
                  </div>
                ))
              ) : (
                <span className="text-[11px] text-faint italic">Unassigned</span>
              )}
            </div>

            <div className="flex items-center gap-[10px] shrink-0">
              {/* Attachments indicator */}
              {attachCount > 0 && (
                <div className="flex items-center gap-[4px] text-muted text-[11px] font-bold select-none" title={`${attachCount} вкладень`}>
                  <Paperclip size={12} />
                  <span className="font-mono">{attachCount}</span>
                </div>
              )}

              {/* Chat count indicator: totally flat, no background, no border, no shadow */}
              {msgCount > 0 && (
                <div className="flex items-center gap-[4px] text-muted text-[11px] font-bold select-none" title={`${msgCount} повідомлень в чаті`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="fill-muted/10">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="font-mono">{msgCount}</span>
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
        {(provided, snapshot) => renderCardContent(provided, snapshot.isDragging)}
      </Draggable>
    );
  }

  return renderCardContent();
}
