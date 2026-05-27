import React from 'react';
import { Users, AlertTriangle } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';

export default function WorkloadTab({ members, issues, timeLogs }) {
  // Simple workload shell
  return (
    <div className="flex-1 overflow-y-auto bg-transparent px-[32px] pt-[20px] pb-16">
      <div className="w-full bg-[#f7f7f7] rounded-[16px] p-8">
        <div className="flex items-center gap-3 mb-6">
          <Users size={24} className="text-[#6366f1]" />
          <h2 className="text-[20px] font-bold text-[#1f1f1f]">Завантаженість команди</h2>
        </div>
        <p className="text-[14px] text-[#9a9a9a] mb-6">Аналіз розподілу задач між учасниками команди та пошук вузьких місць.</p>
        
        {members.length === 0 ? (
          <p className="text-[#9a9a9a]">Немає даних про команду.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {members.map(m => {
              const uid = m.id || m.uid;
              const mine = issues.filter(i => i.assigneeIds?.includes(uid));
              const open = mine.filter(i => i.columnId !== 'done');
              const done = mine.filter(i => i.columnId === 'done');
              const highPriority = open.filter(i => ['high', 'critical', 'blocker'].includes(i.priority));
              
              return (
                <div key={uid} className="flex items-center gap-6 p-4 bg-white rounded-[12px] transition-colors shadow-sm">
                  <div className="flex items-center gap-3 min-w-[150px]">
                    <UserAvatar user={m} size={36} />
                    <div>
                      <p className="text-[14px] font-bold text-[#1f1f1f]">{m.name || m.email}</p>
                      <p className="text-[11px] text-[#9a9a9a]">{m.role}</p>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex justify-between mb-2">
                      <span className="text-[12px] font-semibold text-[#9a9a9a] uppercase tracking-wide">В роботі: {open.length} задач</span>
                      <span className="text-[12px] font-semibold text-[#10b981] uppercase tracking-wide">Готово: {done.length}</span>
                    </div>
                    {/* Fake capacity bar */}
                    <div className="h-[6px] w-full bg-[#f0f0f0] rounded-full overflow-hidden flex">
                      <div className="h-full bg-[#6366f1]" style={{ width: `${Math.min(open.length * 10, 100)}%` }} />
                    </div>
                  </div>
                  
                  <div className="w-[120px] flex justify-end shrink-0">
                    {highPriority.length > 0 && (
                      <div className="flex items-center gap-2 text-red-500 bg-red-50 px-2 py-1 rounded-[6px]">
                        <AlertTriangle size={14} />
                        <span className="text-[11px] font-bold">{highPriority.length} складних</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
