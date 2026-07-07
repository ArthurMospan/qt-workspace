'use client';
// src/components/workspace/AnalyticsTab.jsx — Real reports: velocity, burndown, assignee stats, overdue
import { useMemo, useState } from 'react';
import { useProjectTimeLogs } from '@/lib/hooks/useProjectTimeLogs';
import UserAvatar from '@/components/UserAvatar';
import {
  Clock, CheckCircle2, AlertCircle, TrendingUp, TrendingDown,
  Users, Target, Zap, BarChart2, Calendar, AlertTriangle
} from 'lucide-react';
import { Select } from '@/components/ui/Select';
import FilterBar from '@/components/ui/FilterBar';
import { useWorkflowConfig, DEFAULT_PRIORITIES } from '@/lib/hooks/useWorkflowConfig';
import KpiCard from '@/components/ui/DataDisplay/KpiCard';

function fmtH(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? (m > 0 ? `${h}г ${m}хв` : `${h}г`) : `${m}хв`;
}
function fmtDate(ts) {
  if (!ts) return null;
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

function SectionTitle({ children }) {
  return <h3 className="text-[11px] font-bold text-muted uppercase tracking-wider mb-3">{children}</h3>;
}

export default function AnalyticsTab({ issues, members, project, projectId }) {
  const { totalMinutes, byUser } = useProjectTimeLogs(projectId);
  const { statuses, doneStatusIds } = useWorkflowConfig();
  const [filters, setFilters] = useState({ priority: 'all', type: 'all' });

  const doneSet = useMemo(() => new Set(doneStatusIds), [doneStatusIds]);
  const statusById = useMemo(() => Object.fromEntries((statuses || []).map(s => [s.id, s])), [statuses]);
  const firstStatusId = statuses?.[0]?.id;

  const filteredIssues = useMemo(() => {
    return issues.filter(i => {
      if (filters.priority !== 'all' && i.priority !== filters.priority) return false;
      if (filters.type !== 'all' && i.type !== filters.type) return false;
      return true;
    });
  }, [issues, filters]);

  const stats = useMemo(() => {
    const now     = Date.now();
    const total   = filteredIssues.length;
    const done    = filteredIssues.filter(i => doneSet.has(i.columnId)).length;
    const inProg  = filteredIssues.filter(i => i.columnId === 'in-progress').length;
    const blocked = filteredIssues.filter(i => i.priority === 'blocker').length;
    const overdue = filteredIssues.filter(i => {
      const due = i.dueDate?.toDate ? i.dueDate.toDate() : i.dueDate ? new Date(i.dueDate) : null;
      return due && due.getTime() < now && !doneSet.has(i.columnId);
    });
    const noAssignee = filteredIssues.filter(i => !i.assigneeIds?.length && !doneSet.has(i.columnId));
    const unestimated = filteredIssues.filter(i => !i.estimateMinutes && i.columnId !== firstStatusId && !doneSet.has(i.columnId));
    const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;

    // Budget
    const budget      = (project?.totalBudgetHours || 0) * 60;
    const spentHours  = +(totalMinutes / 60).toFixed(1);
    const burnPct     = budget > 0 ? Math.min(Math.round((totalMinutes / budget) * 100), 100) : null;
    const remainH     = budget > 0 ? Math.max(0, (budget - totalMinutes) / 60).toFixed(1) : null;

    // Velocity: done tasks in last 7 days (+ trend vs previous 7 days, as in VelocityTab)
    const weekAgo = now - 7 * 24 * 3600 * 1000;
    const twoWeeksAgo = now - 14 * 24 * 3600 * 1000;
    const recentDone = filteredIssues.filter(i => {
      if (!doneSet.has(i.columnId)) return false;
      const t = i.updatedAt?.toMillis?.() ?? 0;
      return t > weekAgo;
    }).length;
    const prevDone = filteredIssues.filter(i => {
      if (!doneSet.has(i.columnId)) return false;
      const t = i.updatedAt?.toMillis?.() ?? 0;
      return t > twoWeeksAgo && t <= weekAgo;
    }).length;
    const velocityTrend = prevDone > 0
      ? Math.round(((recentDone - prevDone) / prevDone) * 100)
      : null;

    // By status distribution — column order & styling come from the live config
    const byStatus = (statuses || []).map(s => ({
      col: s.id, count: filteredIssues.filter(i => i.columnId === s.id).length,
      label: s.label, color: s.color,
    })).filter(s => s.count > 0);

    // By priority
    const byPriority = ['blocker','high','medium','low'].map(p => ({
      p, count: filteredIssues.filter(i => i.priority === p && !doneSet.has(i.columnId)).length,
    })).filter(s => s.count > 0);

    // Per-member stats
    const memberStats = members.map(m => {
      const uid    = m.id || m.uid;
      const mine   = filteredIssues.filter(i => i.assigneeIds?.includes(uid));
      const mDone  = mine.filter(i => doneSet.has(i.columnId)).length;
      const mOpen  = mine.filter(i => !doneSet.has(i.columnId)).length;
      const mOverdue = mine.filter(i => {
        const due = i.dueDate?.toDate ? i.dueDate.toDate() : i.dueDate ? new Date(i.dueDate) : null;
        return due && due.getTime() < now && !doneSet.has(i.columnId);
      }).length;
      const mMin  = byUser[uid] || 0;
      return { m, uid, total: mine.length, done: mDone, open: mOpen, overdue: mOverdue, minutes: mMin };
    }).filter(s => s.total > 0).sort((a, b) => b.total - a.total);

    return {
      total, done, inProg, blocked, overdue, noAssignee, unestimated,
      completionPct, budget, spentHours, burnPct, remainH, recentDone, velocityTrend,
      byStatus, byPriority, memberStats,
    };
  }, [filteredIssues, members, project, totalMinutes, byUser, statuses, doneSet, firstStatusId]);

  const maxStatus  = Math.max(...stats.byStatus.map(s => s.count), 1);

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="w-full pt-[8px] pb-[20px] flex flex-col gap-5">

        {/* ── Filters ─────────────────────────────────────────────── */}
        <FilterBar>
          <Select
            variant="ghost"
            value={filters.priority}
            onChange={(val) => setFilters(f => ({ ...f, priority: val }))}
            options={[
              { value: 'all', label: 'Всі пріоритети' },
              { value: 'blocker', label: 'Blocker', dotColor: '#ef4444' },
              { value: 'high', label: 'High', dotColor: '#f97316' },
              { value: 'medium', label: 'Medium', dotColor: '#eab308' },
              { value: 'low', label: 'Low', dotColor: '#9a9a9a' }
            ]}
          />
          <Select
            variant="ghost"
            value={filters.type}
            onChange={(val) => setFilters(f => ({ ...f, type: val }))}
            options={[
              { value: 'all', label: 'Всі типи' },
              { value: 'epic', label: 'Epic' },
              { value: 'feature', label: 'Feature' },
              { value: 'task', label: 'Task' },
              { value: 'bug', label: 'Bug' }
            ]}
          />
        </FilterBar>

        {/* ── KPI row ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={Target}       label="Завершено завдань" color="#10b981"
            value={`${stats.done} / ${stats.total}`}
            sub={`${stats.completionPct}% завершення`} />
          <KpiCard icon={Zap}          label="Velocity (7 днів)" color="#6366f1"
            value={stats.recentDone}
            sub="завдань закрито за тиждень"
            trend={stats.velocityTrend} />
          <KpiCard icon={AlertCircle}  label="Прострочено" color={stats.overdue.length > 0 ? '#dc2626' : '#10b981'}
            value={stats.overdue.length}
            sub="завдань після дедлайну" />
          <KpiCard icon={Users}        label="В роботі" color="#0891b2"
            value={stats.inProg}
            sub="активних завдань" />
        </div>

        {/* ── Budget burn ──────────────────────────────────────────── */}
        {stats.burnPct !== null && (
          <div className="bg-canvas rounded-[24px] p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle>Бюджет часу</SectionTitle>
              <span className={`text-[11px] font-bold px-2 py-[3px] rounded-full ${
                stats.burnPct >= 90 ? 'bg-red-50 text-red-600'
                : stats.burnPct >= 70 ? 'bg-yellow-50 text-yellow-600'
                : 'bg-line text-ink'
              }`}>
                {stats.burnPct}% використано
              </span>
            </div>
            <div className="h-[8px] bg-white rounded-full overflow-hidden mb-3">
              <div className={`h-full rounded-full transition-all ${
                stats.burnPct >= 90 ? 'bg-red-500' : stats.burnPct >= 70 ? 'bg-yellow-400' : 'bg-ink'
              }`} style={{ width: `${stats.burnPct}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-bold text-muted uppercase tracking-wide">Витрачено</p>
                <p className="text-[18px] font-bold text-ink">{stats.spentHours}г</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted uppercase tracking-wide">Залишилось</p>
                <p className="text-[18px] font-bold text-ink">{stats.remainH}г</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted uppercase tracking-wide">Бюджет</p>
                <p className="text-[18px] font-bold text-ink">{project?.totalBudgetHours}г</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Status distribution + Priority breakdown ─────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-canvas rounded-[24px] p-5">
            <SectionTitle>Завдання по статусах</SectionTitle>
            {stats.byStatus.length === 0 ? (
              <p className="text-[12px] text-faint py-4">Задач немає</p>
            ) : (
              <div className="flex flex-col gap-[10px]">
                {stats.byStatus.map(({ col, count, label, color }) => (
                  <div key={col} className="flex items-center gap-3">
                    <span className="w-[100px] text-[11px] font-medium text-muted shrink-0 truncate">{label}</span>
                    <div className="flex-1 h-[6px] bg-white rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(count / maxStatus) * 100}%`, background: color }} />
                    </div>
                    <span className="text-[12px] font-bold text-ink w-[24px] text-right shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-canvas rounded-[24px] p-5">
            <SectionTitle>Відкриті по пріоритету</SectionTitle>
            {stats.byPriority.length === 0 ? (
              <p className="text-[12px] text-faint py-4">Немає відкритих завдань</p>
            ) : (
              <div className="flex flex-col gap-3">
                {stats.byPriority.map(({ p, count }) => {
                  const colors = Object.fromEntries(DEFAULT_PRIORITIES.map(d => [d.id, d.color]));
                  const labels = Object.fromEntries(DEFAULT_PRIORITIES.map(d => [d.id, d.label]));
                  return (
                    <div key={p} className="flex items-center gap-3">
                      <span className="text-[11px] font-semibold px-2 py-[3px] rounded-full w-[66px] text-center shrink-0"
                        style={{ background: colors[p] + '18', color: colors[p] }}>
                        {labels[p]}
                      </span>
                      <div className="flex-1 h-[6px] bg-white rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min((count / Math.max(stats.total,1)) * 100 * 3, 100)}%`, background: colors[p] }} />
                      </div>
                      <span className="text-[12px] font-bold text-ink w-[24px] text-right shrink-0">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Overdue issues ───────────────────────────────────────── */}
        {stats.overdue.length > 0 && (
          <div className="bg-canvas rounded-[24px] p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={13} className="text-red-500" />
              <SectionTitle>Прострочені завдання ({stats.overdue.length})</SectionTitle>
            </div>
            <div className="flex flex-col gap-0 divide-y divide-white">
              {stats.overdue.slice(0, 8).map(issue => {
                const due = issue.dueDate?.toDate ? issue.dueDate.toDate() : new Date(issue.dueDate);
                const daysOver = Math.floor((Date.now() - due.getTime()) / 86400000);
                const assignees = (issue.assigneeIds || []).map(uid => members.find(m => (m.id || m.uid) === uid)).filter(Boolean);
                return (
                  <div key={issue.id} className="flex items-center gap-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-ink truncate">{issue.title}</p>
                      <div className="flex items-center gap-2 mt-[2px]">
                        <span className="text-[10px] font-semibold px-[6px] py-[1px] rounded-full"
                          style={{ background: (statusById[issue.columnId]?.color || '#9a9a9a') + '18', color: statusById[issue.columnId]?.color || '#9a9a9a' }}>
                          {statusById[issue.columnId]?.label || issue.columnId}
                        </span>
                        <span className="text-[10px] text-muted">{issue.issueKey}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {assignees.slice(0,2).map(m => <UserAvatar key={m.id||m.uid} user={m} size={22} />)}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-bold text-red-500">+{daysOver}д</p>
                      <p className="text-[10px] text-muted">{fmtDate(issue.dueDate)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Per-member table ─────────────────────────────────────── */}
        {stats.memberStats.length > 0 && (
          <div className="bg-canvas rounded-[24px] p-5">
            <SectionTitle>Навантаження по виконавцях</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white">
                    {['Учасник','Всього','Виконано','Відкрито','Прострочено','Час'].map(h => (
                      <th key={h} className="pb-3 text-[10px] font-bold text-muted uppercase tracking-wide pr-6 last:pr-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white">
                  {stats.memberStats.map(({ m, total, done, open, overdue: od, minutes }) => (
                    <tr key={m.id || m.uid}>
                      <td className="py-3 pr-6">
                        <div className="flex items-center gap-2">
                          <UserAvatar user={m} size={26} />
                          <span className="text-[12px] font-medium text-ink">{m.name || m.email}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-6 text-[13px] font-semibold text-ink">{total}</td>
                      <td className="py-3 pr-6"><span className="text-[12px] font-semibold text-[#10b981]">{done}</span></td>
                      <td className="py-3 pr-6"><span className="text-[12px] font-semibold text-[#0891b2]">{open}</span></td>
                      <td className="py-3 pr-6">
                        {od > 0
                          ? <span className="text-[12px] font-semibold text-red-500">{od}</span>
                          : <span className="text-[12px] text-faint">—</span>
                        }
                      </td>
                      <td className="py-3 text-[12px] text-muted">{minutes > 0 ? fmtH(minutes) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Warnings ─────────────────────────────────────────────── */}
        {(stats.noAssignee.length > 0 || stats.unestimated.length > 0 || stats.blocked > 0) && (
          <div className="bg-canvas rounded-[24px] p-5">
            <SectionTitle>Увага</SectionTitle>
            <div className="flex flex-col gap-3">
              {stats.blocked > 0 && (
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-[12px]">
                  <AlertTriangle size={14} className="text-red-500 shrink-0" />
                  <p className="text-[12px] font-medium text-red-700">
                    <span className="font-bold">{stats.blocked}</span> завдання з пріоритетом Blocker
                  </p>
                </div>
              )}
              {stats.noAssignee.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-[12px]">
                  <Users size={14} className="text-yellow-600 shrink-0" />
                  <p className="text-[12px] font-medium text-yellow-700">
                    <span className="font-bold">{stats.noAssignee.length}</span> завдань без виконавця
                  </p>
                </div>
              )}
              {stats.unestimated.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-[#eef2ff] rounded-[12px]">
                  <Clock size={14} className="text-[#6366f1] shrink-0" />
                  <p className="text-[12px] font-medium text-[#3730a3]">
                    <span className="font-bold">{stats.unestimated.length}</span> завдань без оцінки часу
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────── */}
        {stats.total === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <BarChart2 size={36} className="text-line mb-3" />
            <p className="text-[14px] font-semibold text-faint mb-1">Даних немає</p>
            <p className="text-[12px] text-[#e0e0e0]">Аналітика з’явиться після створення завдань</p>
          </div>
        )}

      </div>
    </div>
  );
}
