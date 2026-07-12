'use client';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import UserAvatar from '@/components/UserAvatar';
import { Mail, Phone, CheckCircle2, Circle, Clock } from 'lucide-react';
import { useProjectTimeLogs } from '@/lib/hooks/useProjectTimeLogs';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';

export default function ProjectTeamTab({ members = [], issues = [], projectId }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { byUser } = useProjectTimeLogs(projectId);
  const { doneStatusIds } = useWorkflowConfig();
  const doneSet = new Set(doneStatusIds);

  if (members.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-transparent">
        <div className="w-[48px] h-[48px] rounded-full bg-canvas flex items-center justify-center mb-4">
          <span className="text-muted text-[20px]">👥</span>
        </div>
        <p className="text-[13px] text-muted font-medium text-center">
          У цьому проєкті ще немає учасників.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col pb-8">
      <div className="w-full pt-[8px]">
        <h2 className="text-[16px] font-bold text-ink mb-6">Команда проєкту</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map(member => {
            const uid = member.id || member.uid;
            const memberIssues = issues.filter(i => i.assigneeIds?.includes(uid));
            const done = memberIssues.filter(i => doneSet.has(i.columnId || i.status)).length;
            const open = memberIssues.length - done;
            const mins = byUser[uid] || 0;
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            const timeStr = h > 0 ? (m > 0 ? `${h}г ${m}хв` : `${h}г`) : (m > 0 ? `${m}хв` : null);

            return (
            <div
              key={uid}
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.set('member', uid);
                router.push(`${pathname}?${params.toString()}`);
              }}
              className="bg-canvas rounded-[24px] p-5 flex flex-col gap-4 cursor-pointer hover:bg-[#f0f0f0] transition-all duration-200"
            >
              <div className="flex items-center gap-4">
                <UserAvatar
                  user={member}
                  size={48}
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-bold text-ink truncate">
                    {member.name || 'Анонім'}
                  </h3>
                  {member.role && (
                    <p className="text-[12px] text-[#6366f1] font-medium capitalize mt-[2px] truncate">
                      {member.role === 'admin' ? 'Адміністратор' : member.role === 'owner' ? 'Власник' : member.role === 'user' ? 'Учасник' : member.role}
                    </p>
                  )}
                  {(member.email || member.phone) && (
                    <div className="flex flex-col gap-1 mt-2">
                      {member.email && (
                        <div className="flex items-center gap-[6px] text-muted">
                          <Mail size={12} className="shrink-0" />
                          <span className="text-[11px] truncate">{member.email}</span>
                        </div>
                      )}
                      {member.phone && (
                        <div className="flex items-center gap-[6px] text-muted">
                          <Phone size={12} className="shrink-0" />
                          <span className="text-[11px] truncate">{member.phone}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Аналітика учасника */}
              <div className="flex gap-2 pt-4 border-t border-line mt-auto">
                <div className="flex flex-col bg-[#f9fafb] border border-line rounded-[10px] px-3 py-1.5 flex-1 min-w-0 text-center">
                  <span className="text-[10px] text-muted font-medium uppercase tracking-wider truncate">Відкриті</span>
                  <span className="text-[14px] font-bold text-ink">{open}</span>
                </div>
                <div className="flex flex-col bg-[#f0fdf4] border border-[#bbf7d0] rounded-[10px] px-3 py-1.5 flex-1 min-w-0 text-center">
                  <span className="text-[10px] text-[#166534] font-medium uppercase tracking-wider truncate">Завершено</span>
                  <span className="text-[14px] font-bold text-[#166534]">{done}</span>
                </div>
                {timeStr && (
                  <div className="flex flex-col bg-[#eef2ff] border border-[#c7d2fe] rounded-[10px] px-3 py-1.5 flex-1 min-w-0 text-center">
                    <span className="text-[10px] text-[#3730a3] font-medium uppercase tracking-wider truncate">Час</span>
                    <span className="text-[14px] font-bold text-[#3730a3]">{timeStr}</span>
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
