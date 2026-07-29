'use client';

import { Eye, EyeOff, LockKeyhole } from 'lucide-react';

export default function StatusVisibilityPicker({
  statuses = [],
  hiddenStatusIds = [],
  onChange,
  backlogStatusId = 'backlog',
  disabled = false,
}) {
  const toggleStatus = statusId => {
    if (disabled || statusId === backlogStatusId) return;
    onChange?.(
      hiddenStatusIds.includes(statusId)
        ? hiddenStatusIds.filter(id => id !== statusId)
        : [...hiddenStatusIds, statusId],
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {statuses.map(status => {
        const isBacklog = status.id === backlogStatusId;
        const isHidden = hiddenStatusIds.includes(status.id);
        return (
          <button
            type="button"
            data-ui-control="choice-card"
            key={status.id}
            disabled={disabled || isBacklog}
            onClick={() => toggleStatus(status.id)}
            className={`ui-native-control ${
              isHidden
                ? 'border-line bg-canvas opacity-60'
                : 'border-faint bg-white hover:border-ink'
            } disabled:cursor-default disabled:hover:border-faint`}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: status.color }} />
              <span className={`truncate text-[14px] font-semibold ${isHidden ? 'text-muted' : 'text-ink'}`}>
                {status.label}
              </span>
              {isBacklog && (
                <span className="text-[10px] font-medium text-muted">завжди видимий</span>
              )}
            </span>
            <span className="text-muted">
              {isBacklog
                ? <LockKeyhole size={17} />
                : isHidden
                  ? <EyeOff size={18} />
                  : <Eye size={18} className="text-[#10b981]" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
