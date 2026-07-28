'use client';
import { MessageCircle } from 'lucide-react';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';

export default function TeamMemberCard({
  avatar,
  name,
  role,
  status = 'offline',
  onClick,
  className = '',
}) {
  const statusConfig = {
    online: { label: 'Онлайн', color: '#10b981' },
    away: { label: 'Відсутній', color: '#eab308' },
    offline: { label: 'Офлайн', color: '#9a9a9a' },
  };

  const currentStatus = statusConfig[status] || statusConfig.offline;

  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-[16px] p-[16px]
        border border-transparent hover:border-ink/10 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)]
        transition-all duration-200 cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)]
        flex flex-col items-center text-center ${className}
      `}
    >
      {/* Avatar with Status Indicator */}
      <div className="relative mb-[12px]">
        <UserAvatar user={avatar} size={48} />
        <div
          className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white"
          style={{ backgroundColor: currentStatus.color }}
          title={currentStatus.label}
        />
      </div>

      {/* Name & Role */}
      <h3 className="text-[14px] font-semibold text-ink mb-[4px] line-clamp-1">
        {name}
      </h3>
      <p className="text-[12px] font-medium text-muted mb-[12px] line-clamp-1">
        {role}
      </p>

      {/* Status Badge */}
      <span
        className="text-[10px] font-bold px-[8px] py-[3px] rounded-full uppercase tracking-wider mb-[12px]"
        style={{ color: currentStatus.color, backgroundColor: currentStatus.color + '15' }}
      >
        {currentStatus.label}
      </span>

      {/* Message Button */}
      <button
        type="button"
        className="w-full flex items-center justify-center gap-[6px] h-[32px] bg-[#f0f0f0] hover:bg-line rounded-[10px] transition-colors text-ink font-bold text-[12px]"
      >
        <MessageCircle size={14} />
        Повідомлення
      </button>
    </div>
  );
}
