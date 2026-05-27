'use client';
// src/components/workspace/ProjectTeamTab.jsx
import UserAvatar from '@/components/UserAvatar';
import { Mail, Phone } from 'lucide-react';

export default function ProjectTeamTab({ members = [] }) {
  if (members.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
        <div className="w-[48px] h-[48px] rounded-full bg-[#f7f7f7] flex items-center justify-center mb-4">
          <span className="text-[#9a9a9a] text-[20px]">👥</span>
        </div>
        <p className="text-[13px] text-[#9a9a9a] font-medium text-center">
          У цьому проєкті ще немає учасників.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white px-[20px] pt-[16px] pb-[20px]">
      <div className="w-full">
        <h2 className="text-[16px] font-bold text-[#1f1f1f] mb-6">Команда проєкту</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map(member => (
            <div key={member.id || member.uid} className="bg-[#f7f7f7] rounded-[12px] p-4 flex items-center gap-4 cursor-default">
              <UserAvatar 
                user={member} 
                size={48} 
                className="shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-[14px] font-bold text-[#1f1f1f] truncate">
                  {member.name || 'Анонім'}
                </h3>
                {member.role && (
                  <p className="text-[12px] text-[#6366f1] font-medium capitalize mt-[2px] truncate">
                    {member.role}
                  </p>
                )}
                {(member.email || member.phone) && (
                  <div className="flex flex-col gap-1 mt-2">
                    {member.email && (
                      <div className="flex items-center gap-[6px] text-[#9a9a9a]">
                        <Mail size={12} className="shrink-0" />
                        <span className="text-[11px] truncate">{member.email}</span>
                      </div>
                    )}
                    {member.phone && (
                      <div className="flex items-center gap-[6px] text-[#9a9a9a]">
                        <Phone size={12} className="shrink-0" />
                        <span className="text-[11px] truncate">{member.phone}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
