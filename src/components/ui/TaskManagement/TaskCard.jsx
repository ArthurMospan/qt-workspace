'use client';
import { Clock } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';

const PRIORITY_CONFIG = {
  critical: { label: 'Критичний', color: '#ef4444', bg: '#fef2f2' },
  high: { label: 'Високий', color: '#f97316', bg: '#fff7ed' },
  medium: { label: 'Середній', color: '#eab308', bg: '#fefce8' },
  low: { label: 'Низький', color: '#9a9a9a', bg: '#f7f7f7' },
};

const STATUS_CONFIG = {
  todo: { label: 'До виконання', color: '#9a9a9a', bg: '#f7f7f7' },
  in_progress: { label: 'В процесі', color: '#3b82f6', bg: '#dbeafe' },
  review: { label: 'На перегляді', color: '#f97316', bg: '#fed7aa' },
  done: { label: 'Виконано', color: '#10b981', bg: '#ecfdf5' },
};

export default function TaskCard({
  title,
  description,
  priority = 'medium',
  status = 'todo',
  assignee,
  dueDate,
  tags = [],
  onClick,
  className = '',
}) {
  const priorityConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.todo;

  const formatDate = (date) => {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  };

  const isOverdue = dueDate && new Date(dueDate) < new Date() && status !== 'done';

  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-[16px] p-[16px] cursor-pointer
        border border-transparent hover:border-[#1f1f1f]/10 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)]
        transition-all duration-200 select-none shadow-[0_1px_3px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)]
        relative min-h-[200px] flex flex-col ${className}
      `}
    >
      {/* Status Badge - Top Left */}
      <div className="absolute top-[12px] left-[12px]">
        <span
          className="text-[10px] font-bold px-[8px] py-[3px] rounded-full uppercase tracking-wider"
          style={{ color: statusConfig.color, backgroundColor: statusConfig.bg }}
        >
          {statusConfig.label}
        </span>
      </div>

      {/* Priority Badge - Top Right */}
      <div className="absolute top-[12px] right-[12px]">
        <span
          className="text-[10px] font-bold px-[8px] py-[3px] rounded-full uppercase tracking-wider"
          style={{ color: priorityConfig.color, backgroundColor: priorityConfig.bg }}
        >
          {priorityConfig.label}
        </span>
      </div>

      {/* Title & Description */}
      <div className="mt-[32px] flex-1">
        <h3 className="text-[14px] font-semibold text-[#1f1f1f] leading-[1.4] mb-[8px] line-clamp-2">
          {title}
        </h3>
        {description && (
          <p className="text-[12px] font-medium text-[#9a9a9a] line-clamp-2">
            {description}
          </p>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-[6px] my-[12px]">
          {tags.slice(0, 3).map((tag, idx) => (
            <span
              key={idx}
              className="text-[10px] font-bold px-[6px] py-[2px] rounded-[4px] bg-[#f0f0f0] text-[#1f1f1f]"
            >
              {tag}
            </span>
          ))}
          {tags.length > 3 && (
            <span className="text-[10px] font-bold px-[6px] py-[2px] text-[#9a9a9a]">
              +{tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer: Due Date & Assignee */}
      <div className="flex items-center justify-between pt-[12px] border-t border-[#f0f0f0]">
        <div>
          {dueDate && (
            <div
              className={`flex items-center gap-[6px] text-[11px] font-bold ${
                isOverdue ? 'text-[#ef4444] bg-[#fef2f2] px-2 py-1 rounded-md' : 'text-[#9a9a9a]'
              }`}
            >
              <Clock size={12} strokeWidth={isOverdue ? 2.5 : 2} />
              {formatDate(dueDate)}
            </div>
          )}
        </div>
        {assignee && (
          <div className="flex items-center gap-[6px]">
            <UserAvatar user={assignee} size={24} />
          </div>
        )}
      </div>
    </div>
  );
}
