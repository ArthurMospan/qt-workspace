'use client';
// src/components/workspace/IssueCard.jsx
import { Draggable } from '@hello-pangea/dnd';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import UserAvatar from '@/components/UserAvatar';
import { Calendar } from 'lucide-react';

const PRIORITY = {
  blocker: { label: 'BLOCKER', dot: '#ef4444', glow: 'rgba(239,68,68,0.13)',  text: '#dc2626', bg: '#fef2f2' },
  high:    { label: 'HIGH',    dot: '#f97316', glow: 'rgba(249,115,22,0.10)', text: '#ea580c', bg: '#fff7ed' },
  medium:  { label: 'MEDIUM',  dot: '#eab308', glow: 'rgba(234,179,8,0.07)',  text: '#ca8a04', bg: '#fefce8' },
  low:     { label: 'LOW',     dot: '#d1d5db', glow: 'transparent',           text: '#9a9a9a', bg: '#f7f7f7' },
};

const TYPE_LABEL = { epic: 'EPIC', feature: 'FEATURE', task: 'TASK', bug: 'BUG' };

function fmtDate(raw) {
  if (!raw) return null;
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}
function fmtShort(raw) {
  if (!raw) return null;
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

export default function IssueCard({ issue, issues = [], members = [], labels = [], index, projectId, projectName, isTimerActive }) {
  const router   = useRouter();
  const isDraggingRef = useRef(false);
  const pri      = PRIORITY[issue.priority] || PRIORITY.medium;
  const typeLabel = TYPE_LABEL[issue.type] || 'TASK';

  const assignees = (issue.assigneeIds || [])
    .map(uid => members.find(m => (m.id || m.uid) === uid))
    .filter(Boolean);
  const first = assignees[0] || null;

  const due       = issue.dueDate?.toDate ? issue.dueDate.toDate()
                  : issue.dueDate         ? new Date(issue.dueDate) : null;
  const isOverdue = due && due < new Date() && issue.columnId !== 'done';

  const subAll  = (issue.subtasks || []).length;
  const subDone = (issue.subtasks || []).filter(s => s.done).length;

  return (
    <Draggable draggableId={issue.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onDragStart={() => { isDraggingRef.current = true; }}
          onDragEnd={() => { isDraggingRef.current = false; }}
          onClick={() => { if (!isDraggingRef.current) router.push(`/workspace/${projectId}/issue/${issue.id}`); }}
          className="relative overflow-hidden rounded-[24px] bg-white cursor-pointer select-none transition-all"
          style={{
            border: snapshot.isDragging ? '1.5px solid #6366f1' : '1.5px solid #efefef',
            boxShadow: snapshot.isDragging
              ? '0 18px 44px rgba(0,0,0,0.14)'
              : isTimerActive
                ? '0 0 0 2px rgba(99,102,241,0.35), 0 2px 6px rgba(0,0,0,0.04)'
                : '0 1px 4px rgba(0,0,0,0.04)',
            transform: snapshot.isDragging ? 'rotate(1.5deg) scale(1.02)' : 'none',
          }}
        >
          {/* ── Priority glow blob ─────────────────────────── */}
          {pri.glow !== 'transparent' && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[24px]"
              style={{
                background: `radial-gradient(ellipse at 88% 5%, ${pri.glow} 0%, transparent 62%)`,
              }}
            />
          )}

          <div className="relative z-10 p-[14px]">

            {/* Row 1: type tag + priority pill */}
            <div className="flex items-center gap-[6px] mb-[10px] flex-wrap">
              <span className="text-[9px] font-bold text-[#9a9a9a] bg-[#f5f5f5] px-[7px] py-[3px] rounded-[5px] tracking-widest uppercase">
                {typeLabel}
              </span>
              {projectName && (
                <span className="text-[9px] font-bold text-[#6366f1] bg-[#e0e7ff] px-[7px] py-[3px] rounded-[5px] truncate max-w-[120px]">
                  {projectName}
                </span>
              )}
              {isTimerActive && (
                <span className="w-[5px] h-[5px] bg-[#6366f1] rounded-full animate-pulse" />
              )}
              <div className="ml-auto flex items-center justify-center w-[18px] h-[18px] rounded-full"
                style={{ background: pri.bg }} title={`Пріоритет: ${pri.label}`}>
                <span className="w-[8px] h-[8px] rounded-full" style={{ background: pri.dot }} />
              </div>
            </div>

            {/* Title */}
            <p className="text-[13px] font-bold text-[#1a1a1a] leading-[1.35] line-clamp-2 mb-[10px]">
              {issue.title}
            </p>

            {/* Labels */}
            {issue.labelIds && issue.labelIds.length > 0 && (
              <div className="flex flex-wrap gap-[4px] mb-[10px]">
                {issue.labelIds.map(id => {
                  const l = labels.find(lbl => lbl.id === id);
                  if (!l) return null;
                  return (
                    <span key={id} className="text-[9px] font-bold px-[6px] py-[2px] rounded-[4px]"
                      style={{ background: l.color + '1a', color: l.color }}>
                      {l.label}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Parent Epic Badge */}
            {issue.parentEpicId && (
              <div className="mb-[10px]">
                <span className="inline-flex items-center gap-[4px] px-[6px] py-[2px] bg-[#8b5cf61a] text-[#8b5cf6] rounded-[4px] text-[9px] font-bold">
                  ⚡ {issues.find(i => i.id === issue.parentEpicId)?.title || 'Епік'}
                </span>
              </div>
            )}

            {/* Subtasks bar */}
            {subAll > 0 && (
              <div className="mb-[10px]">
                <div className="h-[3px] bg-[#f0f0f0] rounded-full overflow-hidden mb-[3px]">
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${(subDone / subAll) * 100}%`,
                      background: subDone === subAll ? '#10b981' : '#6366f1',
                    }} />
                </div>
                <p className="text-[9px] text-[#cfcfcf] font-medium">{subDone}/{subAll} підзадач</p>
              </div>
            )}

            {/* Due date */}
            {due && (
              <div className={`flex items-center gap-[5px] mb-[12px] text-[11px] font-semibold ${
                isOverdue ? 'text-[#ef4444]' : 'text-[#9a9a9a]'
              }`}>
                <Calendar size={11} strokeWidth={2.5} />
                <span>{fmtDate(due)}</span>
                {isOverdue && <span className="font-bold">• Overdue</span>}
              </div>
            )}
            
            {/* Story Points */}
            {issue.storyPoints > 0 && (
              <div className="flex items-center gap-[4px] mb-[12px] px-2 py-[2px] bg-[#f5f5f5] rounded-md text-[10px] font-bold text-[#1f1f1f] w-fit">
                <span>{issue.storyPoints} SP</span>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-[#f5f5f5] pt-[10px] flex items-center justify-between gap-2">
              <div className="flex items-center gap-[6px] min-w-0">
                {first ? (
                  <>
                    <UserAvatar user={first} size={18} />
                    <span className="text-[11px] text-[#9a9a9a] font-medium truncate max-w-[80px]">
                      {first.name || first.email?.split('@')[0]}
                    </span>
                    {assignees.length > 1 && (
                      <span className="text-[10px] text-[#cfcfcf]">+{assignees.length - 1}</span>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] text-[#cfcfcf] italic">Unassigned</span>
                )}
              </div>
              <span className="text-[10px] text-[#cfcfcf] font-mono shrink-0">
                {issue.issueKey || fmtShort(issue.createdAt)}
              </span>
            </div>

          </div>
        </div>
      )}
    </Draggable>
  );
}
