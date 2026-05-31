'use client';
// src/components/TaskCard.jsx — Clean, minimalist kanban card (Linear style)
import { Clock, CheckSquare } from 'lucide-react';
import UserAvatar from './UserAvatar';
import { useLocalization } from '@/lib/hooks/useLocalization';

const PRIORITY_CONFIG = {
  critical: { label: 'Критичний', color: '#ef4444', bg: '#fef2f2' },
  high:     { label: 'Високий',   color: '#f97316', bg: '#fff7ed' },
  medium:   { label: 'Середній',  color: '#eab308', bg: '#fefce8' },
  low:      { label: 'Низький',   color: '#9a9a9a', bg: '#f4f4f5' },
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

  const { formatDate } = useLocalization();

  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-[16px] p-[16px] cursor-pointer
        border border-[#f0f0f0] hover:border-[#cfcfcf] hover:bg-[#fcfcfc] hover:ring-4 hover:ring-[#1f1f1f]/5
        transition-all duration-200 select-none
        ${isDragging ? 'opacity-80 rotate-2 border-[#1f1f1f]/20 scale-105 z-50' : ''}
      `}
    >
      {/* Type & Priority Header */}
      <div className="flex items-center justify-between mb-[12px]">
        <span className="text-[10px] font-bold px-[8px] py-[3px] rounded-full uppercase tracking-wider" 
              style={{ color: type.color, background: type.color + '12' }}>
          {type.label}
        </span>
        
        {task.priority !== 'low' && (
           <span className="text-[10px] font-bold px-[8px] py-[3px] rounded-full uppercase tracking-wider" 
                 style={{ color: priority.color, background: priority.bg }}>
             {priority.label}
           </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-[14px] font-semibold text-[#1f1f1f] leading-[1.4] mb-[12px] line-clamp-3">
        {task.title}
      </h3>

      {/* Subtasks progress */}
      {subtotalAll > 0 && (
        <div className="mb-[16px]">
          <div className="flex items-center gap-[6px] mb-[6px]">
            <CheckSquare size={12} className="text-[#9a9a9a]" />
            <span className="text-[11px] font-semibold text-[#1f1f1f]">{subtotalDone}/{subtotalAll}</span>
            <span className="text-[11px] font-medium text-[#cfcfcf]">підзадач</span>
          </div>
          <div className="h-[3px] bg-[#f0f0f0] rounded-full overflow-hidden">
            <div className="h-full bg-[#1f1f1f] rounded-full transition-all duration-500" 
                 style={{ width: `${subtotalAll ? (subtotalDone / subtotalAll) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* Footer: Date & Assignees */}
      <div className="flex items-center justify-between mt-auto pt-[4px]">
        <div className="flex items-center gap-[12px]">
          {dueDate && (
            <div className={`flex items-center gap-[6px] text-[11px] font-bold ${isOverdue ? 'text-red-500 bg-red-50 px-2 py-1 rounded-[6px]' : 'text-[#9a9a9a]'}`}>
              <Clock size={12} strokeWidth={isOverdue ? 2.5 : 2} />
              {formatDate(dueDate)}
            </div>
          )}
          {task.totalTime > 0 && !dueDate && (
            <div className="flex items-center gap-[4px] text-[11px] font-bold text-[#9a9a9a]">
              <Clock size={12} strokeWidth={2} />
              {formatMinutes(task.totalTime)}
            </div>
          )}
        </div>

        {/* Assignees */}
        {assignees.length > 0 && (
          <div className="flex -space-x-[8px]">
            {assignees.slice(0, 3).map(m => (
              <UserAvatar key={m.uid || m.id} user={m} size={24} className="ring-2 ring-white" />
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
  if (h > 0) return `${h}г ${m > 0 ? m + 'хв' : ''}`;
  return `${m}хв`;
}
