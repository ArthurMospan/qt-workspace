'use client';
import { Clock, Trash2, Edit2 } from 'lucide-react';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';

function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}г ${m > 0 ? m + 'хв' : ''}`;
  return `${m}хв`;
}

function formatDate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: '2-digit' });
}

function formatTime(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

export default function TimeLogDisplay({
  task,
  duration = 0,
  date,
  billable = false,
  user,
  onEdit,
  onDelete,
  className = '',
}) {
  return (
    <div
      className={`
        bg-white rounded-[12px] p-[12px]
        border border-[#f0f0f0] hover:border-line
        hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]
        transition-all duration-200
        flex items-center justify-between ${className}
      `}
    >
      {/* Left: Task & Duration */}
      <div className="flex-1 min-w-0">
        {/* Task Name */}
        <div className="flex items-center gap-[8px] mb-[4px]">
          <Clock size={14} className="text-muted shrink-0" />
          <h4 className="text-[13px] font-bold text-ink truncate">
            {task}
          </h4>
        </div>

        {/* Duration + Date + Billable */}
        <div className="flex items-center gap-[12px] ml-[22px]">
          <span className="text-[12px] font-bold text-ink">
            {formatMinutes(duration)}
          </span>
          {date && (
            <span className="text-[11px] font-medium text-muted">
              {formatDate(date)} {formatTime(date)}
            </span>
          )}
          {billable && (
            <span className="text-[10px] font-bold px-[6px] py-[2px] rounded-[4px] bg-[#ecfdf5] text-[#065f46]">
              Оплачується
            </span>
          )}
        </div>
      </div>

      {/* Right: User Avatar & Actions */}
      <div className="flex items-center gap-[12px] ml-[16px] shrink-0">
        {user && <UserAvatar user={user} size={28} />}

        {/* Actions */}
        <div className="flex items-center gap-[6px]">
          {onEdit && (
            <button
              onClick={() => onEdit?.()}
              className="p-[6px] hover:bg-[#f0f0f0] rounded-[6px] transition-colors text-muted hover:text-ink"
              title="Редагувати"
            >
              <Edit2 size={12} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete?.()}
              className="p-[6px] hover:bg-[#fef2f2] rounded-[6px] transition-colors text-muted hover:text-[#ef4444]"
              title="Видалити"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
