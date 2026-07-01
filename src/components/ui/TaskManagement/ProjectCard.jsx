'use client';
import React from 'react';
import { MoreVertical, Users } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';

export default function ProjectCard({
  name,
  description,
  members = [],
  taskCount = 12,
  inProgressCount = 3,
  commentCount = 24,
  isLarge = false,
  lastAction = null, // e.g. { actor: 'Артур', action: 'оновив завдання', actorAvatar: '', issueKey: 'QT-101', title: 'Редизайн', time: '10 хв тому' }
  unreadCount = 0,
  className = '',
}) {
  const teamCount = members.length;

  return (
    <div
      className={`group relative flex flex-col justify-between bg-white rounded-[16px] cursor-pointer overflow-visible transition-all duration-300 hover:ring-4 hover:ring-[#ECECEC] border border-transparent ${
        isLarge 
          ? 'md:col-span-2 md:row-span-2 p-[32px] pb-[40px] gap-[24px] min-h-[300px]' 
          : 'p-[24px] pb-[28px] gap-[20px] min-h-[220px]'
      } ${className}`}
    >
      {/* Top row: avatars + kebab */}
      <div className="flex items-center justify-between z-10">
        <div className="flex -space-x-[10px]">
          {teamCount === 0 && (
            <div className="w-[30px] h-[30px] rounded-full bg-white flex items-center justify-center border-2 border-[#f4f4f5]">
              <Users size={13} className="text-[#9a9a9a]" />
            </div>
          )}
          {members.slice(0, 4).map((m, idx) => (
            <UserAvatar key={idx} user={m} size={30} className="border-2 border-white shadow-none" />
          ))}
          {teamCount > 4 && (
            <div className="w-[30px] h-[30px] rounded-full bg-[#e0e0e0] flex items-center justify-center text-[9px] font-bold text-[#9a9a9a] border-2 border-white">
              +{teamCount - 4}
            </div>
          )}
        </div>

        {/* Kebab menu trigger placeholder */}
        <button className="p-[7px] text-[#9a9a9a] hover:bg-white hover:text-[#1f1f1f] rounded-[8px] transition-all no-nav">
          <MoreVertical size={16} />
        </button>
      </div>

      {/* Title + description */}
      <div className="flex flex-col gap-[8px] z-10">
        <h2 className={`font-bold text-[#1f1f1f] leading-tight transition-all duration-300 flex items-center gap-2 flex-wrap ${
          isLarge ? 'text-[28px]' : 'text-[18px]'
        }`}>
          <span>{name}</span>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center bg-[#1f1f1f] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 min-w-[20px] h-[20px]" title="Непрочитані повідомлення">
              {unreadCount}
            </span>
          )}
        </h2>
        {description && (
          <p className={`text-[#9a9a9a] font-medium leading-[1.5] line-clamp-2 ${
            isLarge ? 'text-[14px] max-w-[560px]' : 'text-[13px]'
          }`}>
            {description}
          </p>
        )}
      </div>

      {/* Bento Grid Element: Last Activity feed layout for Large Cards - Borderless */}
      {isLarge && lastAction && (
        <div className="z-10 bg-[#fafafa]/80 rounded-[12px] p-3 text-[12px] text-[#2a2a2a] flex items-start gap-2.5">
          {/* Actor Avatar */}
          {lastAction.actorAvatar ? (
            <img 
              src={lastAction.actorAvatar} 
              alt={lastAction.actor} 
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-full object-cover shrink-0" 
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[#1f1f1f]/5 text-[#1f1f1f] font-bold flex items-center justify-center text-[9px] shrink-0 uppercase">
              {lastAction.actor ? lastAction.actor.slice(0, 2) : 'АМ'}
            </div>
          )}

          {/* Activity Text details */}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bold text-[#1f1f1f]">{lastAction.actor}</span>
              {lastAction.time && (
                <span className="text-[10px] text-[#9a9a9a] shrink-0 font-medium">{lastAction.time}</span>
              )}
            </div>
            <p className="text-[#9a9a9a] leading-tight line-clamp-1">
              {lastAction.action || 'оновив завдання'}{' '}
              <span className="text-[#1f1f1f] font-semibold underline">{lastAction.issueKey}: {lastAction.title}</span>
            </p>
          </div>
        </div>
      )}

      {/* Modern Monochrome Mini Dashboard Stats */}
      <div className="z-10 mt-auto pt-[14px] border-t border-[#f8f8f8]">
        {/* Shaded stats block with soft custom dividers */}
        <div className="flex items-center justify-between bg-[#fafafa] rounded-[10px] py-[10px]">
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <span className="text-[14px] font-bold text-[#1f1f1f] leading-none mb-1">{taskCount}</span>
            <span className="text-[9px] font-bold text-[#9a9a9a] uppercase tracking-wider">завдань</span>
          </div>
          <div className="w-[1px] h-[16px] bg-[#e9e9e9]" />
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <span className="text-[14px] font-bold text-[#1f1f1f] leading-none mb-1">{inProgressCount}</span>
            <span className="text-[9px] font-bold text-[#9a9a9a] uppercase tracking-wider">в роботі</span>
          </div>
          <div className="w-[1px] h-[16px] bg-[#e9e9e9]" />
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <span className="text-[14px] font-bold text-[#1f1f1f] leading-none mb-1">{commentCount}</span>
            <span className="text-[9px] font-bold text-[#9a9a9a] uppercase tracking-wider">повідомлень</span>
          </div>
        </div>
      </div>
    </div>
  );
}
