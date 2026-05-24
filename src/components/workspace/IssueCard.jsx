'use client';
// src/components/workspace/IssueCard.jsx — Enterprise issue card (YouTrack-style)
import UserAvatar from '@/components/UserAvatar';
import { AlertOctagon, ArrowUp, Minus, ArrowDown, Zap, Bug, Star, CheckSquare, Clock, Link2 } from 'lucide-react';
import { Draggable } from '@hello-pangea/dnd';
import { useRouter } from 'next/navigation';

const TYPE_CONFIG = {
  epic:    { icon: Zap,         color: '#8b5cf6', bg: '#f5f3ff', label: 'Epic' },
  feature: { icon: Star,        color: '#0891b2', bg: '#ecfeff', label: 'Feature' },
  task:    { icon: CheckSquare, color: '#059669', bg: '#f0fdf4', label: 'Task' },
  bug:     { icon: Bug,         color: '#dc2626', bg: '#fef2f2', label: 'Bug' },
};

const PRIORITY_CONFIG = {
  blocker: { icon: AlertOctagon, color: '#dc2626', label: 'Blocker' },
  high:    { icon: ArrowUp,     color: '#f97316', label: 'High' },
  medium:  { icon: Minus,       color: '#eab308', label: 'Medium' },
  low:     { icon: ArrowDown,   color: '#9a9a9a', label: 'Low' },
};

function formatMinutes(min) {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}г${m > 0 ? ` ${m}хв` : ''}` : `${m}хв`;
}

export default function IssueCard({ issue, members = [], index, projectId, isTimerActive }) {
  const router   = useRouter();
  const type     = TYPE_CONFIG[issue.type] || TYPE_CONFIG.task;
  const priority = PRIORITY_CONFIG[issue.priority] || PRIORITY_CONFIG.medium;
  const TypeIcon = type.icon;
  const PriorityIcon = priority.icon;

  const assignees = (issue.assigneeIds || [])
    .map(uid => members.find(m => (m.id || m.uid) === uid))
    .filter(Boolean);

  const due = issue.dueDate?.toDate ? issue.dueDate.toDate()
    : issue.dueDate ? new Date(issue.dueDate) : null;
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
          className={`bg-white rounded-[10px] border p-3 cursor-pointer select-none transition-all
            ${snapshot.isDragging
              ? 'border-[#1f1f1f] shadow-xl rotate-[0.5deg] opacity-95'
              : 'border-[#e9e9e9] hover:border-[#cfcfcf] hover:shadow-sm'
            }
            ${isTimerActive ? 'ring-2 ring-[#6366f1]/40' : ''}
          `}
        >
          {/* Row 1: Type + Key + Priority */}
          <div className="flex items-center gap-[6px] mb-[8px]">
            <span className="flex items-center gap-[4px] text-[10px] font-bold px-[6px] py-[2px] rounded-[5px]"
              style={{ color: type.color, background: type.bg }}>
              <TypeIcon size={9} />
              {type.label}
            </span>
            <span className="text-[10px] font-bold text-[#9a9a9a] font-mono">{issue.issueKey}</span>
            <div className="ml-auto flex items-center gap-[4px]">
              {issue.linkedClientMaterialId && (
                <Link2 size={11} className="text-[#6366f1]" title="Прив'язано до матеріалу клієнта" />
              )}
              {isTimerActive && (
                <span className="w-[6px] h-[6px] bg-[#6366f1] rounded-full animate-pulse" title="Таймер активний" />
              )}
              <PriorityIcon size={12} style={{ color: priority.color }} />
            </div>
          </div>

          {/* Title */}
          <p className="text-[13px] font-semibold text-[#1f1f1f] leading-snug line-clamp-2 mb-[8px]">
            {issue.title}
          </p>

          {/* Subtasks progress */}
          {subtasksAll > 0 && (
            <div className="mb-[8px]">
              <div className="h-[2px] bg-[#f0f0f0] rounded-full overflow-hidden">
                <div className="h-full bg-[#10b981] rounded-full"
                  style={{ width: `${(subtasksDone / subtasksAll) * 100}%` }} />
              </div>
              <p className="text-[10px] text-[#9a9a9a] mt-[3px]">{subtasksDone}/{subtasksAll} підзадач</p>
            </div>
          )}

          {/* Footer: time + due + assignees */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-[8px]">
              {issue.spentMinutes > 0 && (
                <span className="flex items-center gap-[3px] text-[10px] text-[#9a9a9a] font-medium">
                  <Clock size={9} />{formatMinutes(issue.spentMinutes)}
                </span>
              )}
              {due && (
                <span className={`text-[10px] font-semibold px-[5px] py-[1px] rounded-[4px] ${
                  isOverdue ? 'bg-red-50 text-red-500' : 'bg-[#f7f7f7] text-[#9a9a9a]'
                }`}>
                  {due.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
            {assignees.length > 0 && (
              <div className="flex -space-x-[5px]">
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
      )}
    </Draggable>
  );
}
