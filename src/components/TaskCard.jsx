'use client';
// src/components/TaskCard.jsx — Light theme kanban card
import { Clock, User, AlertCircle, Tag } from 'lucide-react';
import UserAvatar from './UserAvatar';

const PRIORITY_CONFIG = {
  critical: { label: 'Критичний', color: '#ef4444', bg: '#fef2f2' },
  high:     { label: 'Високий',   color: '#f97316', bg: '#fff7ed' },
  medium:   { label: 'Середній',  color: '#eab308', bg: '#fefce8' },
  low:      { label: 'Низький',   color: '#9a9a9a', bg: '#f7f7f7' },
};

const TYPE_CONFIG = {
  task:    { label: 'Задача', color: '#6366f1' },
  bug:     { label: 'Баг',    color: '#ef4444' },
  feature: { label: 'Фіча',  color: '#10b981' },
  request: { label: 'Запит', color: '#f97316' },
};

export default function TaskCard({ task, teamMembers = [], onClick, isDragging }) {
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.low;
  const type = TYPE_CONFIG[task.type] || TYPE_CONFIG.task;

  const assignees = (task.assignees || [])
    .map(uid => teamMembers.find(m => m.uid === uid || m.id === uid))
    .filter(Boolean);

  const dueDate = task.dueDate?.toDate ? task.dueDate.toDate() : task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && dueDate < new Date() && task.status !== 'done';

  const subtotalDone = task.subtasks?.filter(s => s.done)?.length ?? 0;
  const subtotalAll = task.subtasks?.length ?? 0;

  const formatDate = (d) => d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });

  return (
    <div
      onClick={onClick}
      className={`
        bg-white border border-[#e9e9e9] rounded-[12px] p-[14px] cursor-pointer
        hover:border-[#cfcfcf] hover:shadow-sm transition-all duration-150 select-none
        ${isDragging ? 'opacity-50 rotate-1 shadow-lg' : ''}
      `}
    >
      {/* Type + Priority */}
      <div className="flex items-center justify-between mb-[10px]">
        <span className="text-[10px] font-semibold px-[7px] py-[2px] rounded-full" style={{ color: type.color, background: type.color + '18' }}>
          {type.label}
        </span>
        <span className="text-[10px] font-semibold px-[7px] py-[2px] rounded-full" style={{ color: priority.color, background: priority.bg }}>
          {priority.label}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-[13px] font-semibold text-[#1f1f1f] leading-snug mb-[10px] line-clamp-2">
        {task.title}
      </h3>

      {/* Subtasks progress */}
      {subtotalAll > 0 && (
        <div className="mb-[10px]">
          <div className="flex items-center justify-between mb-[4px]">
            <span className="text-[10px] text-[#9a9a9a]">Підзадачі</span>
            <span className="text-[10px] text-[#9a9a9a] font-medium">{subtotalDone}/{subtotalAll}</span>
          </div>
          <div className="h-[2px] bg-[#f0f0f0] rounded-full overflow-hidden">
            <div className="h-full bg-[#1f1f1f] rounded-full transition-all" style={{ width: `${subtotalAll ? (subtotalDone / subtotalAll) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* Footer: date + assignees + time */}
      <div className="flex items-center justify-between gap-2 mt-auto">
        <div className="flex items-center gap-[10px]">
          {dueDate && (
            <div className={`flex items-center gap-[4px] text-[10px] font-medium ${isOverdue ? 'text-red-500' : 'text-[#9a9a9a]'}`}>
              <Clock size={10} />
              {formatDate(dueDate)}
            </div>
          )}
          {task.totalTime > 0 && (
            <div className="flex items-center gap-[4px] text-[10px] text-[#9a9a9a]">
              <Clock size={10} />
              {formatMinutes(task.totalTime)}
            </div>
          )}
        </div>

        {/* Assignees */}
        {assignees.length > 0 && (
          <div className="flex -space-x-[6px]">
            {assignees.slice(0, 3).map(m => (
              <UserAvatar key={m.uid || m.id} user={m} size={22} className="ring-2 ring-white" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}г ${m}хв`;
  return `${m}хв`;
}
