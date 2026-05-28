'use client';
import Progress from '@/components/ui/DataDisplay/Progress';
import AvatarGroup from '@/components/ui/DataDisplay/AvatarGroup';

export default function ProjectCard({
  name,
  description,
  members = [],
  progress = 0,
  memberCount = 0,
  status = 'active',
  className = '',
}) {
  const statusConfig = {
    active: { label: 'Активний', color: '#10b981', bg: '#ecfdf5' },
    paused: { label: 'Призупинено', color: '#f97316', bg: '#fed7aa' },
    completed: { label: 'Завершено', color: '#6366f1', bg: '#eef2ff' },
    archived: { label: 'Архівовано', color: '#9a9a9a', bg: '#f7f7f7' },
  };

  const currentStatus = statusConfig[status] || statusConfig.active;

  return (
    <div
      className={`
        bg-white rounded-[16px] p-[16px]
        border border-transparent hover:border-[#1f1f1f]/10 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)]
        transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)]
        flex flex-col h-full ${className}
      `}
    >
      {/* Header: Name & Status */}
      <div className="flex items-start justify-between mb-[12px]">
        <h3 className="text-[14px] font-semibold text-[#1f1f1f] flex-1 line-clamp-1">
          {name}
        </h3>
        <span
          className="text-[10px] font-bold px-[8px] py-[3px] rounded-full uppercase tracking-wider whitespace-nowrap ml-[8px]"
          style={{ color: currentStatus.color, backgroundColor: currentStatus.bg }}
        >
          {currentStatus.label}
        </span>
      </div>

      {/* Description */}
      {description && (
        <p className="text-[12px] font-medium text-[#9a9a9a] line-clamp-2 mb-[12px]">
          {description}
        </p>
      )}

      {/* Progress Bar */}
      <div className="mb-[16px]">
        <Progress value={progress} size="md" variant="default" />
        <p className="text-[11px] font-medium text-[#9a9a9a] mt-[4px]">{Math.round(progress)}% завершено</p>
      </div>

      {/* Footer: Members & Member Count */}
      <div className="flex items-center justify-between pt-[12px] border-t border-[#f0f0f0] mt-auto">
        {members.length > 0 ? (
          <AvatarGroup avatars={members} maxDisplay={3} size="md" />
        ) : (
          <span className="text-[11px] font-medium text-[#9a9a9a]">Немає учасників</span>
        )}
        {memberCount > 0 && (
          <span className="text-[11px] font-bold text-[#1f1f1f] bg-[#f0f0f0] px-[8px] py-[4px] rounded-[6px]">
            {memberCount} {memberCount === 1 ? 'учасник' : 'учасників'}
          </span>
        )}
      </div>
    </div>
  );
}
