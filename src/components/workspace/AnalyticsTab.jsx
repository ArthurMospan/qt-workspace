'use client';
// src/components/workspace/AnalyticsTab.jsx — Burn rate + time per member + issues by status
import { useProjectTimeLogs } from '@/lib/hooks/useProjectTimeLogs';
import UserAvatar from '@/components/UserAvatar';
import { Clock, CheckCircle, AlertTriangle, TrendingUp, ListChecks } from 'lucide-react';

const COLUMNS_ORDER = ['backlog','todo','in-progress','code-review','qa','client-approval','done'];
const COLUMN_LABEL = { backlog:'Backlog', todo:'To Do', 'in-progress':'In Progress', 'code-review':'Code Review', qa:'QA', 'client-approval':'Client Approval', done:'Done' };
const COLUMN_COLOR = { backlog:'#9a9a9a', todo:'#6366f1', 'in-progress':'#0891b2', 'code-review':'#d97706', qa:'#7c3aed', 'client-approval':'#db2777', done:'#10b981' };

function StatCard({ icon: Icon, label, value, sub, color = '#1f1f1f' }) {
  return (
    <div className="bg-white border border-[#e9e9e9] rounded-[14px] p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ background: color + '18' }}>
          <Icon size={15} style={{ color }} />
        </div>
        <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-[26px] font-bold text-[#1f1f1f] leading-none">{value}</p>
      {sub && <p className="text-[11px] text-[#9a9a9a] mt-2">{sub}</p>}
    </div>
  );
}

export default function AnalyticsTab({ issues, members, project, projectId }) {
  const { totalMinutes, byUser } = useProjectTimeLogs(projectId);

  const budget     = (project?.totalBudgetHours || 0) * 60;
  const spentHours = +(totalMinutes / 60).toFixed(1);
  const burnPct    = budget > 0 ? Math.min(Math.round((totalMinutes / budget) * 100), 100) : 0;
  const remaining  = budget > 0 ? +(Math.max(0, (budget - totalMinutes) / 60).toFixed(1)) : null;

  const doneCount  = issues.filter(i => i.columnId === 'done').length;
  const totalCount = issues.length;
  const openCount  = totalCount - doneCount;

  const byStatus = COLUMNS_ORDER
    .map(col => ({ col, count: issues.filter(i => i.columnId === col).length }))
    .filter(s => s.count > 0);
  const maxCount = Math.max(...byStatus.map(s => s.count), 1);

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f7f7] px-6 py-6">
      <div className="max-w-[860px] flex flex-col gap-5">

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Clock}         label="Витрачено"  value={`${spentHours}г`}
            sub={budget > 0 ? `з ${project?.totalBudgetHours}г бюджету` : 'без бюджету'} color="#6366f1" />
          <StatCard icon={TrendingUp}    label="Burn Rate"  value={`${burnPct}%`}
            sub={remaining !== null ? `залишилось ~${remaining}г` : '—'} color={burnPct >= 90 ? '#dc2626' : '#10b981'} />
          <StatCard icon={CheckCircle}   label="Виконано"   value={doneCount}
            sub={`з ${totalCount} задач`} color="#10b981" />
          <StatCard icon={AlertTriangle} label="Відкрито"   value={openCount}
            sub="активних задач"          color="#f97316" />
        </div>

        {/* Burn rate bar */}
        {budget > 0 && (
          <div className="bg-white border border-[#e9e9e9] rounded-[14px] p-5">
            <h3 className="text-[13px] font-bold text-[#1f1f1f] mb-4">Бюджет часу</h3>
            <div className="flex items-center gap-4 mb-2">
              <span className="text-[11px] text-[#9a9a9a]">0г</span>
              <div className="flex-1 h-[10px] bg-[#f0f0f0] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${burnPct >= 90 ? 'bg-red-500' : burnPct >= 70 ? 'bg-yellow-400' : 'bg-[#6366f1]'}`}
                  style={{ width: `${burnPct}%` }}
                />
              </div>
              <span className="text-[11px] text-[#9a9a9a]">{project?.totalBudgetHours}г</span>
            </div>
            <p className="text-[11px] text-[#9a9a9a]">
              {spentHours}г витрачено · {remaining}г залишилось · {burnPct}% бюджету
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Time per member */}
          {members.length > 0 && (
            <div className="bg-white border border-[#e9e9e9] rounded-[14px] p-5">
              <h3 className="text-[13px] font-bold text-[#1f1f1f] mb-4">Час по команді</h3>
              {Object.keys(byUser).length === 0 ? (
                <p className="text-[12px] text-[#cfcfcf]">Час ще не списано</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {members
                    .map(m => ({ m, min: byUser[m.id || m.uid] || 0 }))
                    .sort((a, b) => b.min - a.min)
                    .map(({ m, min }) => {
                      const hrs = +(min / 60).toFixed(1);
                      const pct = totalMinutes > 0 ? Math.round((min / totalMinutes) * 100) : 0;
                      return (
                        <div key={m.id || m.uid} className="flex items-center gap-3">
                          <UserAvatar user={m} size={28} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[12px] font-semibold text-[#1f1f1f]">{m.name || m.email}</span>
                              <span className="text-[11px] text-[#9a9a9a]">{hrs}г · {pct}%</span>
                            </div>
                            <div className="h-[5px] bg-[#f0f0f0] rounded-full overflow-hidden">
                              <div className="h-full bg-[#6366f1] rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* Issues by status */}
          {byStatus.length > 0 && (
            <div className="bg-white border border-[#e9e9e9] rounded-[14px] p-5">
              <h3 className="text-[13px] font-bold text-[#1f1f1f] mb-4 flex items-center gap-2">
                <ListChecks size={14} className="text-[#9a9a9a]" /> Задачі по статусах
              </h3>
              <div className="flex flex-col gap-3">
                {byStatus.map(({ col, count }) => (
                  <div key={col} className="flex items-center gap-3">
                    <span className="w-[110px] text-[11px] font-semibold text-[#9a9a9a] shrink-0 truncate">{COLUMN_LABEL[col]}</span>
                    <div className="flex-1 h-[6px] bg-[#f0f0f0] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(count / maxCount) * 100}%`, background: COLUMN_COLOR[col] }} />
                    </div>
                    <span className="text-[11px] font-bold text-[#1f1f1f] w-5 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
