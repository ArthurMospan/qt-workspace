'use client';
// src/components/workspace/AnalyticsTab.jsx — Real reports: velocity, burndown, assignee stats, overdue
import { useMemo } from 'react';
import { useProjectTimeLogs } from '@/lib/hooks/useProjectTimeLogs';
import UserAvatar from '@/components/UserAvatar';
import {
  Clock, CheckCircle2, AlertCircle, TrendingUp, TrendingDown,
  Users, Target, Zap, BarChart2, Calendar, AlertTriangle,
} from 'lucide-react';

const COL_ORDER  = ['backlog','todo','in-progress','code-review','qa','client-approval','done'];
const COL_LABEL  = { backlog:'Backlog', todo:'To Do', 'in-progress':'In Progress', 'code-review':'Code Review', qa:'QA', 'client-approval':'Client Approval', done:'Done' };
const COL_COLOR  = { backlog:'#9a9a9a', todo:'#6366f1', 'in-progress':'#0891b2', 'code-review':'#d97706', qa:'#7c3aed', 'client-approval':'#db2777', done:'#10b981' };

function fmtH(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? (m > 0 ? `${h}г ${m}хв` : `${h}г`) : `${m}хв`;
}
function fmtDate(ts) {
  if (!ts) return null;
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

function KpiCard({ icon: Icon, label, value, sub, color = '#6366f1', trend }) {
  return (
    <div className="bg-[#f7f7f7] rounded-[24px] p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-[12px] flex items-center justify-center" style={{ background: color + '18' }}>
          <Icon size={16} style={{ color }} />
        </div>
        {trend !== undefined && (
          <span className={`text-[11px] font-semibold flex items-center gap-1 ${trend >= 0 ? 'text-[#10b981]' : 'text-red-500'}`}>
            {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-[28px] font-bold text-[#1f1f1f] leading-none mb-1">{value}</p>
      <p className="text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide">{label}</p>
      {sub && <p className="text-[11px] text-[#cfcfcf] mt-1">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }) {
  return <h3 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-3">{children}</h3>;
}

export default function AnalyticsTab({ issues, members, project, projectId }) {
  const { totalMinutes, byUser } = useProjectTimeLogs(projectId);

  const stats = useMemo(() => {
    const now     = Date.now();
    const total   = issues.length;
    const done    = issues.filter(i => i.columnId === 'done').length;
    const inProg  = issues.filter(i => i.columnId === 'in-progress').length;
    const blocked = issues.filter(i => i.priority === 'blocker').length;
    const overdue = issues.filter(i => {
      const due = i.dueDate?.toDate ? i.dueDate.toDate() : i.dueDate ? new Date(i.dueDate) : null;
      return due && due.getTime() < now && i.columnId !== 'done';
    });
    const noAssignee = issues.filter(i => !i.assigneeIds?.length && i.columnId !== 'done');
    const unestimated = issues.filter(i => !i.estimateMinutes && i.columnId !== 'backlog' && i.columnId !== 'done');
    const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;

    // Budget
    const budget      = (project?.totalBudgetHours || 0) * 60;
    const spentHours  = +(totalMinutes / 60).toFixed(1);
    const burnPct     = budget > 0 ? Math.min(Math.round((totalMinutes / budget) * 100), 100) : null;
    const remainH     = budget > 0 ? Math.max(0, (budget - totalMinutes) / 60).toFixed(1) : null;

    // Velocity: done tasks in last 7 days
    const weekAgo = now - 7 * 24 * 3600 * 1000;
    const recentDone = issues.filter(i => {
      if (i.columnId !== 'done') return false;
      const t = i.updatedAt?.toMillis?.() ?? 0;
      return t > weekAgo;
    }).length;

    // By status distribution
    const byStatus = COL_ORDER.map(col => ({
      col, count: issues.filter(i => i.columnId === col).length,
      label: COL_LABEL[col], color: COL_COLOR[col],
    })).filter(s => s.count > 0);

    // By priority
    const byPriority = ['blocker','high','medium','low'].map(p => ({
      p, count: issues.filter(i => i.priority === p && i.columnId !== 'done').length,
    })).filter(s => s.count > 0);

    // Per-member stats
    const memberStats = members.map(m => {
      const uid    = m.id || m.uid;
      const mine   = issues.filter(i => i.assigneeIds?.includes(uid));
      const mDone  = mine.filter(i => i.columnId === 'done').length;
      const mOpen  = mine.filter(i => i.columnId !== 'done').length;
      const mOverdue = mine.filter(i => {
        const due = i.dueDate?.toDate ? i.dueDate.toDate() : i.dueDate ? new Date(i.dueDate) : null;
        return due && due.getTime() < now && i.columnId !== 'done';
      }).length;
      const mMin  = byUser[uid] || 0;
      return { m, uid, total: mine.length, done: mDone, open: mOpen, overdue: mOverdue, minutes: mMin };
    }).filter(s => s.total > 0).sort((a, b) => b.total - a.total);

    return {
      total, done, inProg, blocked, overdue, noAssignee, unestimated,
      completionPct, budget, spentHours, burnPct, remainH, recentDone,
      byStatus, byPriority, memberStats,
    };
  }, [issues, members, project, totalMinutes, byUser]);

  const maxStatus  = Math.max(...stats.byStatus.map(s => s.count), 1);

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="w-full px-[20px] pt-[16px] pb-[20px] flex flex-col gap-5">

        {/* ── KPI row ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={Target}       label="Завершено задач" color="#10b981"
            value={`${stats.done} / ${stats.total}`}
            sub={`${stats.completionPct}% завершення`} />
          <KpiCard icon={Zap}          label="Velocity (7 днів)" color="#6366f1"
            value={stats.recentDone}
            sub="задач закрито за тиждень" />
          <KpiCard icon={AlertCircle}  label="Прострочено" color={stats.overdue.length > 0 ? '#dc2626' : '#10b981'}
            value={stats.overdue.length}
            sub="задач після дедлайну" />
          <KpiCard icon={Users}        label="В роботі" color="#0891b2"
            value={stats.inProg}
            sub="активних задач" />
        </div>

        {/* ── Budget burn ──────────────────────────────────────────── */}
        {stats.burnPct !== null && (
          <div className="bg-[#f7f7f7] rounded-[24px] p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle>Бюджет часу</SectionTitle>
              <span className={`text-[11px] font-bold px-2 py-[3px] rounded-full ${
                stats.burnPct >= 90 ? 'bg-red-50 text-red-600'
                : stats.burnPct >= 70 ? 'bg-yellow-50 text-yellow-600'
                : 'bg-[#e9e9e9] text-[#1f1f1f]'
              }`}>
                {stats.burnPct}% використано
              </span>
            </div>
            <div className="h-[8px] bg-white rounded-full overflow-hidden mb-3">
              <div className={`h-full rounded-full transition-all ${
                stats.burnPct >= 90 ? 'bg-red-500' : stats.burnPct >= 70 ? 'bg-yellow-400' : 'bg-[#1f1f1f]'
              }`} style={{ width: `${stats.burnPct}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide">Витрачено</p>
                <p className="text-[18px] font-bold text-[#1f1f1f]">{stats.spentHours}г</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide">Залишилось</p>
                <p className="text-[18px] font-bold text-[#1f1f1f]">{stats.remainH}г</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide">Бюджет</p>
                <p className="text-[18px] font-bold text-[#1f1f1f]">{project?.totalBudgetHours}г</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Status distribution + Priority breakdown ─────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#f7f7f7] rounded-[24px] p-5">
            <SectionTitle>Задачі по статусах</SectionTitle>
            {stats.byStatus.length === 0 ? (
              <p className="text-[12px] text-[#cfcfcf] py-4">Задач немає</p>
            ) : (
              <div className="flex flex-col gap-[10px]">
                {stats.byStatus.map(({ col, count, label, color }) => (
                  <div key={col} className="flex items-center gap-3">
                    <span className="w-[100px] text-[11px] font-medium text-[#9a9a9a] shrink-0 truncate">{label}</span>
                    <div className="flex-1 h-[6px] bg-white rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(count / maxStatus) * 100}%`, background: color }} />
                    </div>
                    <span className="text-[12px] font-bold text-[#1f1f1f] w-[24px] text-right shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#f7f7f7] rounded-[24px] p-5">
            <SectionTitle>Відкриті по пріоритету</SectionTitle>
            {stats.byPriority.length === 0 ? (
              <p className="text-[12px] text-[#cfcfcf] py-4">Немає відкритих задач</p>
            ) : (
              <div className="flex flex-col gap-3">
                {stats.byPriority.map(({ p, count }) => {
                  const colors = { blocker: '#dc2626', high: '#f97316', medium: '#eab308', low: '#9a9a9a' };
                  const labels = { blocker: 'Blocker', high: 'High', medium: 'Medium', low: 'Low' };
                  return (
                    <div key={p} className="flex items-center gap-3">
                      <span className="text-[11px] font-semibold px-2 py-[3px] rounded-full w-[66px] text-center shrink-0"
                        style={{ background: colors[p] + '18', color: colors[p] }}>
                        {labels[p]}
                      </span>
                      <div className="flex-1 h-[6px] bg-white rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min((count / Math.max(stats.total,1)) * 100 * 3, 100)}%`, background: colors[p] }} />
                      </div>
                      <span className="text-[12px] font-bold text-[#1f1f1f] w-[24px] text-right shrink-0">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Overdue issues ───────────────────────────────────────── */}
        {stats.overdue.length > 0 && (
          <div className="bg-[#f7f7f7] rounded-[24px] p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={13} className="text-red-500" />
              <SectionTitle>Прострочені задачі ({stats.overdue.length})</SectionTitle>
            </div>
            <div className="flex flex-col gap-0 divide-y divide-white">
              {stats.overdue.slice(0, 8).map(issue => {
                const due = issue.dueDate?.toDate ? issue.dueDate.toDate() : new Date(issue.dueDate);
                const daysOver = Math.floor((Date.now() - due.getTime()) / 86400000);
                const assignees = (issue.assigneeIds || []).map(uid => members.find(m => (m.id || m.uid) === uid)).filter(Boolean);
                return (
                  <div key={issue.id} className="flex items-center gap-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#1f1f1f] truncate">{issue.title}</p>
                      <div className="flex items-center gap-2 mt-[2px]">
                        <span className="text-[10px] font-semibold px-[6px] py-[1px] rounded-full"
                          style={{ background: COL_COLOR[issue.columnId] + '18', color: COL_COLOR[issue.columnId] }}>
                          {COL_LABEL[issue.columnId]}
                        </span>
                        <span className="text-[10px] text-[#9a9a9a]">{issue.issueKey}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {assignees.slice(0,2).map(m => <UserAvatar key={m.id||m.uid} user={m} size={22} />)}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-bold text-red-500">+{daysOver}д</p>
                      <p className="text-[10px] text-[#9a9a9a]">{fmtDate(issue.dueDate)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Per-member table ─────────────────────────────────────── */}
        {stats.memberStats.length > 0 && (
          <div className="bg-[#f7f7f7] rounded-[24px] p-5">
            <SectionTitle>Навантаження по виконавцях</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white">
                    {['Учасник','Всього','Виконано','Відкрито','Прострочено','Час'].map(h => (
                      <th key={h} className="pb-3 text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide pr-6 last:pr-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white">
                  {stats.memberStats.map(({ m, total, done, open, overdue: od, minutes }) => (
                    <tr key={m.id || m.uid}>
                      <td className="py-3 pr-6">
                        <div className="flex items-center gap-2">
                          <UserAvatar user={m} size={26} />
                          <span className="text-[12px] font-medium text-[#1f1f1f]">{m.name || m.email}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-6 text-[13px] font-semibold text-[#1f1f1f]">{total}</td>
                      <td className="py-3 pr-6"><span className="text-[12px] font-semibold text-[#10b981]">{done}</span></td>
                      <td className="py-3 pr-6"><span className="text-[12px] font-semibold text-[#0891b2]">{open}</span></td>
                      <td className="py-3 pr-6">
                        {od > 0
                          ? <span className="text-[12px] font-semibold text-red-500">{od}</span>
                          : <span className="text-[12px] text-[#cfcfcf]">—</span>
                        }
                      </td>
                      <td className="py-3 text-[12px] text-[#9a9a9a]">{minutes > 0 ? fmtH(minutes) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Warnings ─────────────────────────────────────────────── */}
        {(stats.noAssignee.length > 0 || stats.unestimated.length > 0 || stats.blocked > 0) && (
          <div className="bg-[#f7f7f7] rounded-[24px] p-5">
            <SectionTitle>Увага</SectionTitle>
            <div className="flex flex-col gap-3">
              {stats.blocked > 0 && (
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-[12px]">
                  <AlertTriangle size={14} className="text-red-500 shrink-0" />
                  <p className="text-[12px] font-medium text-red-700">
                    <span className="font-bold">{stats.blocked}</span> задача з пріоритетом Blocker
                  </p>
                </div>
              )}
              {stats.noAssignee.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-[12px]">
                  <Users size={14} className="text-yellow-600 shrink-0" />
                  <p className="text-[12px] font-medium text-yellow-700">
                    <span className="font-bold">{stats.noAssignee.length}</span> задач без виконавця
                  </p>
                </div>
              )}
              {stats.unestimated.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-[#eef2ff] rounded-[12px]">
                  <Clock size={14} className="text-[#6366f1] shrink-0" />
                  <p className="text-[12px] font-medium text-[#3730a3]">
                    <span className="font-bold">{stats.unestimated.length}</span> задач без оцінки часу
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────── */}
        {stats.total === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <BarChart2 size={36} className="text-[#e9e9e9] mb-3" />
            <p className="text-[14px] font-semibold text-[#cfcfcf] mb-1">Даних немає</p>
            <p className="text-[12px] text-[#e0e0e0]">Аналітика з'явиться після створення задач</p>
          </div>
        )}

      </div>
    </div>
  );
}
