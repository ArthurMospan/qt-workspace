'use client';

import React from 'react';
import { User } from 'lucide-react';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import Pill from '@/components/ui/DataDisplay/Pill';
import LoadingSpinner from '@/components/ui/Feedback/LoadingSpinner';
import EmptyState from '@/components/ui/Feedback/EmptyState';

// The team rail: a titled, counted list of people.
//
// Same story as ChannelRail — /ui-kit used to hand-copy this and the copy was
// wrong in five ways at once (8px radius drawn as 10px, the `#ebebeb` selected
// row drawn as white-with-a-shadow, a 32px avatar drawn at 24px, the muted
// `#4a4a4a` name drawn as bold ink, and no presence dot at all). The page and
// the catalogue render this file now, so there is nothing left to drift.
export default function MemberRail({
  title = 'Команда',
  members = [],
  activeId,
  onSelect = () => {},
  action,
  loading = false,
  emptyTitle = 'Нікого не знайдено',
  emptyDescription = 'Спробуйте змінити пошуковий запит.',
}) {
  return (
    <>
      <div className="p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="ui-type-dialog-title text-ink">{title}</h2>
          <Pill appearance="outline" size="md">{members.length}</Pill>
        </div>
        {action}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4 flex flex-col gap-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="sm" />
          </div>
        ) : members.length === 0 ? (
          <EmptyState icon={User} title={emptyTitle} description={emptyDescription} density="compact" />
        ) : (
          members.map(member => {
            const uid = member.id || member.uid;
            const isSelected = uid === activeId;
            return (
              <button
                key={uid}
                type="button"
                onClick={() => onSelect(member)}
                className={`w-full text-left px-3 py-2 rounded-[8px] transition-colors flex items-center gap-3 ${
                  isSelected ? 'bg-[#ebebeb]' : 'hover:bg-[#ebebeb]/50'
                }`}
              >
                <div className="relative shrink-0">
                  <UserAvatar user={member} size="md" />
                  {member.online && (
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#10b981] rounded-full ring-2 ring-canvas" />
                  )}
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className={`text-[13px] font-medium truncate transition-colors flex items-center gap-1 ${
                    isSelected ? 'text-ink' : 'text-[#4a4a4a] group-hover:text-ink'
                  }`}
                  >
                    {member.name || member.email}
                    {member.statusEmoji && <span>{member.statusEmoji}</span>}
                  </span>
                  <span className="text-[11px] font-normal text-muted truncate">
                    {member.positionName}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
