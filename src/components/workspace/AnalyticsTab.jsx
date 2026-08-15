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
import { isDueDateOverdue } from '@/lib/utils/date';
import { useAppContext } from '@/lib/context/AppContext';
import { organizationTimeZone } from '@/lib/utils/timeZone.mjs';
import EmptyState from '@/components/ui/Feedback/EmptyState';
import Link from 'next/link';
import { Alert, Card, TaskListCard } from '@/components/ui';
import PriorityIcon from '@/components/ui/DataDisplay/PriorityIcon';
import { memberAnalyticsHref } from '@/lib/utils/teamAnalytics.mjs';
import { selectActionableIssues } from '@/lib/utils/issueAccounting.mjs';
import { openBlockerIssues } from '@/lib/utils/issueExecution.mjs';
import { NO_PRIORITY_ID, selectablePriorities } from '@/lib/utils/priorities.mjs';
import {
  backlogStatusIds,
  inProgressStatusIds,
} from '@/lib/utils/statusCategories.mjs';
import { plural } from '@/lib/utils/plural.mjs';

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
  const { activeOrg } = useAppContext();
  const timeZone = organizationTimeZone(activeOrg);
  const { totalMinutes, byUser } = useProjectTimeLogs(projectId);
  const { statuses, closedStatusIds, deliveredStatusIds, priorities } = useWorkflowConfig();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const closedSet = useMemo(() => new Set(closedStatusIds), [closedStatusIds]);
  // See the workspace analytics page: closed is "no work left", delivered is
  // "something was produced", and only the second may drive a percentage.
  const deliveredSet = useMemo(() => new Set(deliveredStatusIds), [deliveredStatusIds]);
  // Both used to be guessed: the backlog as "the first status in the list", and
  // work in progress as the literal id 'in-progress'. Categories say it outright.
  const backlogSet = useMemo(() => new Set(backlogStatusIds(statuses)), [statuses]);
  const inProgressSet = useMemo(() => new Set(inProgressStatusIds(statuses)), [statuses]);
  const actionableIssues = useMemo(
    () => selectActionableIssues(issues),
    [issues],
  );

  const filteredIssues = useMemo(() => {
    return actionableIssues.filter(i => {
      if (priorityFilter !== 'all' && (i.priority || NO_PRIORITY_ID) !== priorityFilter) return false;
      if (typeFilter !== 'all' && i.type !== typeFilter) return false;
      return true;
    });
  }, [actionableIssues, priorityFilter, typeFilter]);

  const stats = useMemo(() => {
    const total   = filteredIssues.length;
    const done    = filteredIssues.filter(i => deliveredSet.has(i.columnId || i.status)).length;
    const inProg  = filteredIssues.filter(i => inProgressSet.has(i.columnId || i.status)).length;
    const blockerPriority = filteredIssues.filter(i => (
      i.priority === 'blocker'
      && !closedSet.has(i.columnId || i.status)
    )).length;
    const dependencyBlocked = filteredIssues.filter(i => (
      !closedSet.has(i.columnId || i.status)
      && openBlockerIssues(i.id, issues, issueLinks, closedSet).length > 0
    )).length;
    const overdue = filteredIssues.filter(i => {
      return isDueDateOverdue(i.dueDate, { now, timeZone })
        && !closedSet.has(i.columnId || i.status);
    });
    const noAssignee = filteredIssues.filter(i => !i.assigneeIds?.length && !closedSet.has(i.columnId || i.status));
    const unestimated = filteredIssues.filter(i => !i.estimateMinutes && !backlogSet.has(i.columnId || i.status) && !closedSet.has(i.columnId || i.status));
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
      if (!deliveredSet.has(i.columnId || i.status)) return false;
      const t = getCompletedAtMillis(i);
      return t > weekAgo;
    }).length;
    const prevDone = filteredIssues.filter(i => {
      if (!deliveredSet.has(i.columnId || i.status)) return false;
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
    const byPriority = selectablePriorities(priorities).map(priority => ({
      p: priority.id,
      label: priority.label,
      color: priority.color,
      count: filteredIssues.filter(i => (
        (i.priority || NO_PRIORITY_ID) === priority.id
        && !closedSet.has(i.columnId || i.status)
      )).length,
    })).filter(s => s.count > 0);

    // Per-member stats
    const memberStats = members.map(m => {
      const uid    = m.id || m.uid;
      const mine   = filteredIssues.filter(i => i.assigneeIds?.includes(uid));
      const mDone  = mine.filter(i => deliveredSet.has(i.columnId || i.status)).length;
      const mOpen  = mine.filter(i => !closedSet.has(i.columnId || i.status)).length;
      const mOverdue = mine.filter(i => {
        return isDueDateOverdue(i.dueDate, { now, timeZone })
          && !closedSet.has(i.columnId || i.status);
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
    closedSet,
    deliveredSet,
    backlogSet,
    inProgressSet,
    issueLinks,
    issues,
    now,
    timeZone,
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div data-ui-surface="card" data-ui-padding="lg" className="ui-surface">
            <SectionTitle>Завдання по статусах</SectionTitle>
            {stats.byStatus.length === 0 ? (
              <p className="text-[12px] text-faint py-4">Задач немає</p>
            ) : (
              // QUI-129. The same chart as /analytics → «По статусах», which
              // squeezed its label into a 100px column here and truncated every
              // status name. Label above the bar, dot for the status colour,
              // count on the same baseline — one chart, one look.
              <div className="flex flex-col gap-[14px]">
                {stats.byStatus.map(({ col, count, label, color }) => (
                  <div key={col} className="flex flex-col gap-[6px]">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                        <span className="truncate text-[13px] font-semibold text-ink">{label}</span>
                      </span>
                      <span className="shrink-0 text-[14px] font-bold text-ink tabular-nums">{count}</span>
                    </div>
                    <div className="h-[6px] overflow-hidden rounded-full bg-[#f0f0f0]">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(count / maxStatus) * 100}%`, background: color }} />
                    </div>
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
                    <span className="flex w-[110px] shrink-0 items-center gap-2 text-[11px] font-semibold text-ink">
                      <PriorityIcon priority={p} priorities={priorities} />
                      <span className="truncate">{label}</span>
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
          <TaskListCard
            title="Прострочені завдання"
            icon={AlertTriangle}
            iconClassName="text-red-500"
            issues={stats.overdue}
            allIssues={issues}
            members={members}
            projects={project ? [project] : []}
            limit={8}
          />
        )}

        {/* ── Per-member table ─────────────────────────────────────── */}
        {stats.memberStats.length > 0 && (
          <div data-ui-surface="card" data-ui-padding="lg" className="ui-surface">
            <SectionTitle>Навантаження по виконавцях</SectionTitle>
            <div className="space-y-2 md:hidden">
              {stats.memberStats.map(({ m, total, done, open, overdue: od, minutes }) => (
                <Link key={m.id || m.uid} href={memberAnalyticsHref(m.id || m.uid)} className="block">
                  <Card preset="bordered-compact" padding="md" interactive>
                    <div className="flex min-w-0 items-center gap-2">
                      <UserAvatar user={m} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-ink">{m.name || m.email}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-black/[0.05] pt-3">
                      {[
                        ['Всього', total, 'text-ink'],
                        ['Виконано', done, 'text-[#10b981]'],
                        ['Відкрито', open, 'text-[#0891b2]'],
                        ['Прострочено', od || '—', od > 0 ? 'text-red-500' : 'text-faint'],
                      ].map(([label, value, tone]) => (
                        <div key={label} className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-medium text-muted">{label}</span>
                          <span className={`text-[12px] font-bold ${tone}`}>{value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/[0.05] pt-3">
                      <span className="text-[10px] font-medium text-muted">Списано часу</span>
                      <span className="text-[12px] font-bold text-ink">{minutes > 0 ? fmtH(minutes) : '—'}</span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
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
                    <tr key={m.id || m.uid} className="group transition-colors hover:bg-canvas/60">
                      {/* Every other place a person appears in analytics opens
                          their page; here the row named them and went nowhere,
                          which is the one screen where "who is loaded up?" most
                          obviously wants a next click. */}
                      <td className="py-3 pr-6">
                        <Link
                          href={memberAnalyticsHref(m.id || m.uid)}
                          className="flex items-center gap-2 transition-colors hover:text-ink"
                          title={`Аналітика: ${m.name || m.email}`}
                        >
                          <UserAvatar user={m} size="sm" />
                          <span className="text-[12px] font-medium text-ink group-hover:underline">{m.name || m.email}</span>
                        </Link>
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
          // The same notices the workspace overview calls «Інсайти», drawn the
          // same way. This block was four hand-tinted rows — red-50, amber-50,
          // yellow-50 and a grey nested panel — so one screen said these things
          // with `Alert` and the other with four different colours of its own,
          // and no two rows inside it matched either.
          <Card preset="borderless" padding="lg">
            <SectionTitle>Увага</SectionTitle>
            <div className="flex flex-col gap-3">
              {stats.dependencyBlocked > 0 && (
                <Alert
                  variant="error"
                  title={`${stats.dependencyBlocked} ${plural(stats.dependencyBlocked, ['завдання', 'завдання', 'завдань'])} заблоковано`}
                  description="Їх стримують незавершені залежності"
                />
              )}
              {stats.blockerPriority > 0 && (
                <Alert
                  variant="warning"
                  title={`${stats.blockerPriority} ${plural(stats.blockerPriority, ['завдання', 'завдання', 'завдань'])} із пріоритетом «Критичний»`}
                  description="Потребують негайної уваги"
                />
              )}
              {stats.noAssignee.length > 0 && (
                <Alert
                  variant="warning"
                  title={`${stats.noAssignee.length} ${plural(stats.noAssignee.length, ['завдання', 'завдання', 'завдань'])} без виконавця`}
                />
              )}
              {stats.unestimated.length > 0 && (
                <Alert
                  variant="info"
                  title={`${stats.unestimated.length} ${plural(stats.unestimated.length, ['завдання', 'завдання', 'завдань'])} без оцінки`}
                />
              )}
            </div>
          </Card>
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
