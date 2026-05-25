'use client';
// src/components/workspace/IssueCard.jsx — Priority-highlighted Kanban card
import UserAvatar from '@/components/UserAvatar';
import { AlertOctagon, ArrowUp, Minus, ArrowDown, Zap, Bug, Star, CheckSquare, Clock, Link2, MessageSquare } from 'lucide-react';
import { Draggable } from '@hello-pangea/dnd';
import { useRouter } from 'next/navigation';

const TYPE_CONFIG = {
  epic:    { icon: Zap,         color: '#8b5cf6', bg: '#f5f3ff', label: 'Epic' },
  feature: { icon: Star,        color: '#0891b2', bg: '#ecfeff', label: 'Feature' },
  task:    { icon: CheckSquare, color: '#059669', bg: '#f0fdf4', label: 'Task' },
  bug:     { icon: Bug,         color: '#dc2626', bg: '#fef2f2', label: 'Bug' },
};

const PRIORITY_CONFIG = {
  blocker: { icon: AlertOctagon, color: '#dc2626', glow: 'rgba(220,38,38,0.12)',  border: 'rgba(220,38,38,0.35)',  label: 'Blocker' },
  high:    { icon: ArrowUp,     color: '#f97316', glow: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.30)', label: 'High' },
  medium:  { icon: Minus,       color: '#eab308', glow: 'rgba(234,179,8,0.08)',  border: 'rgba(234,179,8,0.25)',  label: 'Medium' },
  low:     { icon: ArrowDown,   color: '#9a9a9a', glow: 'rgba(0,0,0,0)',         border: 'rgba(200,200,200,0.4)', label: 'Low' },
};

function formatMinutes(min) {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}г${m > 0 ? ` ${m}хв` : ''}` : `${m}хв`;
}

export default function IssueCard({ issue, members = [], index, projectId, isTimerActive }) {
  const router      = useRouter();
  const type        = TYPE_CONFIG[issue.type]         || TYPE_CONFIG.task;
  const priority    = PRIORITY_CONFIG[issue.priority] || PRIORITY_CONFIG.medium;
  const TypeIcon    = type.icon;
  const PriorityIcon = priority.icon;

  const assignees = (issue.assigneeIds || [])
    .map(uid => members.find(m => (m.id || m.uid) === uid))
    .filter(Boolean);

  const due       = issue.dueDate?.toDate ? issue.dueDate.toDate() : issue.dueDate ? new Date(issue.dueDate) : null;
  const isOverdue = due && due < new Date() && issue.columnId !== 'done';

  const subtasksDone = (issue.subtasks || []).filter(s => s.done).length;
  const subtasksAll  = (issue.subtasks || []).length;

  return (
    <Draggable draggableId={issue.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => router.push(`/workspace/${projectId}/issue/${issue.id}`)}
          className="relative rounded-[8px] bg-white border cursor-pointer select-none transition-all overflow-hidden group"
          style={{
            borderColor: snapshot.isDragging ? '#6366f1' : '#e9e9e9',
            boxShadow: snapshot.isDragging
              ? '0 12px 32px rgba(0,0,0,0.1)'
              : isTimerActive
                ? '0 0 0 2px rgba(99,102,241,0.35)'
                : '0 1px 2px rgba(0,0,0,0.02)',
            transform: snapshot.isDragging ? 'rotate(1.5deg) scale(1.02)' : 'none',
          }}
        >
          {/* Priority accent strip — left edge */}
          <div
            className="absolute left-0 top-0 bottom-0 w-[3px] transition-all"
            style={{
              background: priority.color,
              opacity: issue.priority === 'low' ? 0.3 : 0.8,
            }}
          />

          {/* Content — left padding to clear the strip */}
          <div className="pl-[12px] p-3">

            {/* Row 1: Type + Key + Priority icon */}
            <div className="flex items-center gap-[6px] mb-[7px]">
              <span
                className="flex items-center gap-[4px] text-[10px] font-bold px-[6px] py-[2px] rounded-[5px] leading-none"
                style={{ color: type.color, background: type.bg }}
              >
                <TypeIcon size={9} />
                {type.label}
              </span>
              <span className="text-[9px] font-bold text-[#cfcfcf] font-mono">{issue.issueKey}</span>
              <div className="ml-auto flex items-center gap-[5px]">
                {issue.linkedClientMaterialId && (
                  <Link2 size={10} className="text-[#6366f1]" title="Прив'язано до матеріалу клієнта" />
                )}
                {isTimerActive && (
                  <span className="w-[5px] h-[5px] bg-[#6366f1] rounded-full animate-pulse" title="Таймер активний" />
                )}
                {/* Priority badge */}
                <span
                  className="flex items-center gap-[2px] text-[9px] font-bold px-[5px] py-[1px] rounded-full"
                  style={{ color: priority.color, background: priority.glow || `${priority.color}15` }}
                >
                  <PriorityIcon size={9} />
                  {priority.label}
                </span>
              </div>
            </div>

            {/* Title */}
            <p className="text-[13px] font-semibold text-[#1f1f1f] leading-snug line-clamp-2 mb-[9px]">
              {issue.title}
            </p>

            {/* Subtasks progress */}
            {subtasksAll > 0 && (
              <div className="mb-[8px]">
                <div className="h-[3px] bg-[#f0f0f0] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(subtasksDone / subtasksAll) * 100}%`,
                      background: subtasksDone === subtasksAll ? '#10b981' : '#6366f1',
                    }}
                  />
                </div>
                <p className="text-[9px] text-[#cfcfcf] mt-[2px] font-medium">
                  {subtasksDone}/{subtasksAll} підзадач
                </p>
              </div>
            )}

            {/* Footer: spent time + due + assignees */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-[6px] flex-wrap">
                {issue.spentMinutes > 0 && (
                  <span className="flex items-center gap-[3px] text-[10px] text-[#9a9a9a] font-medium">
                    <Clock size={9} />{formatMinutes(issue.spentMinutes)}
                  </span>
                )}
                {due && (
                  <span className={`text-[10px] font-semibold px-[5px] py-[1px] rounded-[4px] ${
                    isOverdue ? 'bg-red-50 text-red-500' : 'bg-[#f7f7f7] text-[#9a9a9a]'
                  }`}>
                    {isOverdue && '⚠ '}
                    {due.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
                  </span>
                )}
                {(issue.subtasks || []).length === 0 && issue.description && (
                  <span className="w-[5px] h-[5px] bg-[#e9e9e9] rounded-full" title="Є опис" />
                )}
              </div>

              {assignees.length > 0 && (
                <div className="flex -space-x-[5px] shrink-0">
                  {assignees.slice(0, 3).map(m => (
                    <UserAvatar key={m.id || m.uid} user={m} size={20} className="ring-[1.5px] ring-white" />
                  ))}
                  {assignees.length > 3 && (
                    <span className="w-5 h-5 rounded-full bg-[#f0f0f0] text-[9px] font-bold text-[#9a9a9a] flex items-center justify-center ring-[1.5px] ring-white">
                      +{assignees.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
