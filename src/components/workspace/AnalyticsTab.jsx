'use client';
// src/components/workspace/AnalyticsTab.jsx — Real reports: velocity, burndown, assignee stats, overdue
import { useEffect, useMemo, useState } from 'react';
import { useProjectTimeLogs } from '@/lib/hooks/useProjectTimeLogs';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import {
  Clock, AlertCircle, Users, Target, Zap, BarChart2, AlertTriangle, ClipboardList,
} from 'lucide-react';
import { useWorkflowConfig, getCompletedAtMillis } from '@/lib/hooks/useWorkflowConfig';
import KpiCard from '@/components/ui/DataDisplay/KpiCard';
import { parseDueDate } from '@/lib/utils/date';
import EmptyState from '@/components/ui/Feedback/EmptyState';
import TaskRow from '@/components/ui/TaskManagement/TaskRow';
import { selectActionableIssues } from '@/lib/utils/issueAccounting.mjs';
import { openBlockerIssues } from '@/lib/utils/issueExecution.mjs';

function fmtH(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? (m > 0 ? `${h}г ${m}хв` : `${h}г`) : `${m}хв`;
}
function SectionTitle({ children }) {
  return <h3 className="ui-type-eyebrow text-muted uppercase tracking-wider mb-3">{children}</h3>;
}

export default function AnalyticsTab({
  issues,
  issueLinks = [],
  members,
  project,
  projectId,
  priorityFilter = 'all',
  typeFilter = 'all',
}) {
  const { totalMinutes, byUser } = useProjectTimeLogs(projectId);
  const { statuses, doneStatusIds, priorities } = useWorkflowConfig();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const doneSet = useMemo(() => new Set(doneStatusIds), [doneStatusIds]);
  const firstStatusId = statuses?.[0]?.id;
  const actionableIssues = useMemo(
    () => selectActionableIssues(issues),
    [issues],
  );

  const filteredIssues = useMemo(() => {
    return actionableIssues.filter(i => {
      if (priorityFilter !== 'all' && i.priority !== priorityFilter) return false;
      if (typeFilter !== 'all' && i.type !== typeFilter) return false;
      return true;
    });
  }, [actionableIssues, priorityFilter, typeFilter]);

  const stats = useMemo(() => {
    const total   = filteredIssues.length;
    const done    = filteredIssues.filter(i => doneSet.has(i.columnId || i.status)).length;
    const inProg  = filteredIssues.filter(i => i.columnId === 'in-progress').length;
    const blockerPriority = filteredIssues.filter(i => (
      i.priority === 'blocker'
      && !doneSet.has(i.columnId || i.status)
    )).length;
    const dependencyBlocked = filteredIssues.filter(i => (
      !doneSet.has(i.columnId || i.status)
      && openBlockerIssues(i.id, issues, issueLinks, doneSet).length > 0
    )).length;
    const overdue = filteredIssues.filter(i => {
      const due = parseDueDate(i.dueDate);
      return due && due.getTime() < now && !doneSet.has(i.columnId || i.status);
    });
    const noAssignee = filteredIssues.filter(i => !i.assigneeIds?.length && !doneSet.has(i.columnId || i.status));
    const unestimated = filteredIssues.filter(i => !i.estimateMinutes && (i.columnId || i.status) !== firstStatusId && !doneSet.has(i.columnId || i.status));
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
      if (!doneSet.has(i.columnId || i.status)) return false;
      const t = getCompletedAtMillis(i);
      return t > weekAgo;
    }).length;
    const prevDone = filteredIssues.filter(i => {
      if (!doneSet.has(i.columnId || i.status)) return false;
      const t = getCompletedAtMillis(i);
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
    const byPriority = priorities.map(priority => ({
      p: priority.id,
      label: priority.label,
      color: priority.color,
      count: filteredIssues.filter(i => (
        i.priority === priority.id
        && !doneSet.has(i.columnId || i.status)
      )).length,
    })).filter(s => s.count > 0);

    // Per-member stats
    const memberStats = members.map(m => {
      const uid    = m.id || m.uid;
      const mine   = filteredIssues.filter(i => i.assigneeIds?.includes(uid));
      const mDone  = mine.filter(i => doneSet.has(i.columnId || i.status)).length;
      const mOpen  = mine.filter(i => !doneSet.has(i.columnId || i.status)).length;
      const mOverdue = mine.filter(i => {
        const due = parseDueDate(i.dueDate);
        return due && due.getTime() < now && !doneSet.has(i.columnId || i.status);
      }).length;
      const mMin  = byUser[uid] || 0;
      return { m, uid, total: mine.length, done: mDone, open: mOpen, overdue: mOverdue, minutes: mMin };
    }).filter(s => s.total > 0).sort((a, b) => b.total - a.total);

    return {
      total, done, inProg, blockerPriority, dependencyBlocked, overdue, noAssignee, unestimated,
      completionPct, budget, spentHours, burnPct, remainH, recentDone, velocityTrend,
      byStatus, byPriority, memberStats,
    };
  }, [
    filteredIssues,
    members,
    project,
    totalMinutes,
    byUser,
    statuses,
    priorities,
    doneSet,
    firstStatusId,
    issueLinks,
    issues,
    now,
  ]);

  const maxStatus  = Math.max(...stats.byStatus.map(s => s.count), 1);

  if (filteredIssues.length === 0) {
    return (
      <div className="flex-1 pb-8">
        <div data-ui-surface="panel" data-ui-padding="md" className="ui-surface min-h-[360px]">
          <EmptyState
            icon={ClipboardList}
            title="Немає даних для аналітики"
            description="Створіть завдання або змініть активні фільтри — показники з’являться автоматично."
            context="page"
            surface="card"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col pb-8">
      {/* Сіра панель-підложка, на ній білі картки — як на сторінці проєктів */}
      <div data-ui-surface="panel" data-ui-padding="md" className="ui-surface w-full flex flex-col gap-4">

        {/* ── KPI row ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={Target}       label="Завершено завдань"
            value={`${stats.done} / ${stats.total}`}
            sub={`${stats.completionPct}% завершення`} />
          <KpiCard icon={Zap}          label="Velocity (7 днів)"
            value={stats.recentDone}
            sub="завдань закрито за тиждень"
            trend={stats.velocityTrend} />
          <KpiCard icon={AlertCircle}  label="Прострочено"
            value={stats.overdue.length}
            sub="завдань після дедлайну" />
          <KpiCard icon={Users}        label="В роботі"
            value={stats.inProg}
            sub="активних завдань" />
        </div>

        {/* ── Budget burn ──────────────────────────────────────────── */}
        {stats.burnPct !== null && (
          <div data-ui-surface="card" data-ui-padding="lg" className="ui-surface">
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
            <div className="h-[8px] bg-canvas rounded-full overflow-hidden mb-3">
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
          <div data-ui-surface="card" data-ui-padding="lg" className="ui-surface">
            <SectionTitle>Завдання по статусах</SectionTitle>
            {stats.byStatus.length === 0 ? (
              <p className="text-[12px] text-faint py-4">Задач немає</p>
            ) : (
              <div className="flex flex-col gap-[10px]">
                {stats.byStatus.map(({ col, count, label, color }) => (
                  <div key={col} className="flex items-center gap-3">
                    <span className="w-[100px] text-[11px] font-medium text-muted shrink-0 truncate">{label}</span>
                    <div className="flex-1 h-[6px] bg-canvas rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(count / maxStatus) * 100}%`, background: color }} />
                    </div>
                    <span className="text-[12px] font-bold text-ink w-[24px] text-right shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div data-ui-surface="card" data-ui-padding="lg" className="ui-surface">
            <SectionTitle>Відкриті по пріоритету</SectionTitle>
            {stats.byPriority.length === 0 ? (
              <p className="text-[12px] text-faint py-4">Немає відкритих завдань</p>
            ) : (
              <div className="flex flex-col gap-3">
                {stats.byPriority.map(({ p, label, color, count }) => (
                  <div key={p} className="flex items-center gap-3">
                    <span className="text-[11px] font-semibold px-2 py-[3px] rounded-full w-[82px] text-center shrink-0 truncate"
                      style={{ background: color + '18', color }}>
                      {label}
                    </span>
                    <div className="flex-1 h-[6px] bg-canvas rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min((count / Math.max(stats.total,1)) * 100 * 3, 100)}%`, background: color }} />
                    </div>
                    <span className="text-[12px] font-bold text-ink w-[24px] text-right shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Overdue issues ───────────────────────────────────────── */}
        {stats.overdue.length > 0 && (
          <div data-ui-surface="card" data-ui-padding="lg" className="ui-surface">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={13} className="shrink-0 text-red-500" />
              <h3 className="ui-type-eyebrow uppercase tracking-wider text-muted">
                Прострочені завдання ({stats.overdue.length})
              </h3>
            </div>
            <div className="flex flex-col gap-2">
              {stats.overdue.slice(0, 8).map(issue => (
                <TaskRow
                  key={issue.id}
                  issue={issue}
                  issues={issues}
                  members={members}
                  projectId={projectId}
                  projectName={project?.name}
                  showProjectName
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Per-member table ─────────────────────────────────────── */}
        {stats.memberStats.length > 0 && (
          <div data-ui-surface="card" data-ui-padding="lg" className="ui-surface">
            <SectionTitle>Навантаження по виконавцях</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line">
                    {['Учасник','Всього','Виконано','Відкрито','Прострочено','Час'].map(h => (
                      <th key={h} className="pb-3 text-[10px] font-bold text-muted uppercase tracking-wide pr-6 last:pr-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {stats.memberStats.map(({ m, total, done, open, overdue: od, minutes }) => (
                    <tr key={m.id || m.uid}>
                      <td className="py-3 pr-6">
                        <div className="flex items-center gap-2">
                          <UserAvatar user={m} size="sm" />
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
        {(stats.noAssignee.length > 0
          || stats.unestimated.length > 0
          || stats.blockerPriority > 0
          || stats.dependencyBlocked > 0) && (
          <div data-ui-surface="card" data-ui-padding="lg" className="ui-surface">
            <SectionTitle>Увага</SectionTitle>
            <div className="flex flex-col gap-3">
              {stats.dependencyBlocked > 0 && (
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-[12px]">
                  <AlertTriangle size={14} className="text-red-500 shrink-0" />
                  <p className="text-[12px] font-medium text-red-700">
                    <span className="font-bold">{stats.dependencyBlocked}</span> завдань заблоковано незавершеними залежностями
                  </p>
                </div>
              )}
              {stats.blockerPriority > 0 && (
                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-[12px]">
                  <AlertCircle size={14} className="text-amber-600 shrink-0" />
                  <p className="text-[12px] font-medium text-amber-800">
                    <span className="font-bold">{stats.blockerPriority}</span> завдань із пріоритетом «Блокер»
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
                <div data-ui-surface="nested-panel" data-ui-padding="sm" className="ui-surface flex items-center gap-3">
                  <Clock size={14} className="text-muted shrink-0" />
                  <p className="text-[12px] font-medium text-ink">
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
