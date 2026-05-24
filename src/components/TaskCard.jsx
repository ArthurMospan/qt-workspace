'use client';
// src/components/TaskCard.jsx
import { Draggable } from '@hello-pangea/dnd';
import UserAvatar from './UserAvatar';

const PRIORITY = {
  urgent: { label: 'Терміново', color: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/20',     dot: 'bg-red-400' },
  high:   { label: 'Високий',   color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20', dot: 'bg-orange-400' },
  medium: { label: 'Середній',  color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20', dot: 'bg-yellow-400' },
  low:    { label: 'Низький',   color: 'text-white/30',   bg: 'bg-white/5 border-white/10',           dot: 'bg-white/20' },
};

export default function TaskCard({ task, index, teamMembers, onSelect }) {
  const priority = PRIORITY[task.priority] || PRIORITY.medium;
  const assignees = (task.assignees || [])
    .map(uid => teamMembers?.find(m => m.id === uid))
    .filter(Boolean);

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onSelect?.(task)}
          className={`group bg-[#1e1e1e] border rounded-[14px] p-[14px] flex flex-col gap-[10px] cursor-grab active:cursor-grabbing select-none transition-all duration-150 ${
            snapshot.isDragging
              ? 'border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.6)] scale-[1.02] rotate-[0.8deg]'
              : 'border-white/[0.07] hover:border-white/[0.15] hover:bg-[#222]'
          }`}
        >
          {/* Priority + open icon */}
          <div className="flex items-center justify-between gap-[8px]">
            <span className={`flex items-center gap-[5px] text-[10px] font-bold uppercase tracking-[0.07em] px-[7px] py-[3px] rounded-full border ${priority.bg} ${priority.color}`}>
              <span className={`w-[5px] h-[5px] rounded-full shrink-0 ${priority.dot}`} />
              {priority.label}
            </span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white/25 text-[10px]">
              натисни →
            </span>
          </div>

          {/* Title */}
          <p className="text-white text-[13px] font-semibold leading-snug line-clamp-3">
            {task.title}
          </p>

          {/* Description */}
          {task.description && (
            <p className="text-white/35 text-[11px] leading-relaxed line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-[8px]">
            <div className="flex -space-x-[6px]">
              {assignees.slice(0, 3).map(user => (
                <UserAvatar key={user.id} user={user} className="w-[22px] h-[22px] border-[2px] border-[#1e1e1e]" />
              ))}
              {assignees.length > 3 && (
                <div className="w-[22px] h-[22px] rounded-full bg-white/10 border-[2px] border-[#1e1e1e] flex items-center justify-center">
                  <span className="text-[9px] font-bold text-white/50">+{assignees.length - 3}</span>
                </div>
              )}
              {assignees.length === 0 && (
                <span className="text-white/20 text-[10px]">Без виконавця</span>
              )}
            </div>
            {task.dueDate && (
              <span className={`text-[10px] font-medium ${isOverdue(task.dueDate) ? 'text-red-400' : 'text-white/30'}`}>
                {formatDue(task.dueDate)}
              </span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}

function isOverdue(d) {
  const date = d?.toDate ? d.toDate() : new Date(d);
  return date < new Date();
}
function formatDue(d) {
  const date = d?.toDate ? d.toDate() : new Date(d);
  return date.toLocaleDateString('uk', { day: 'numeric', month: 'short' });
}
