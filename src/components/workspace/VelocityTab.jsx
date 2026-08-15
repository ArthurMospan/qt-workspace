'use client';
// src/components/workspace/VelocityTab.jsx — Продуктивність: тренди, burndown, cycle time
// Період керується з фільтрів сторінки (prop `period`), власного селектора немає.
import { useEffect, useMemo, useState } from 'react';
import { Zap, TrendingUp, CheckCircle2, Calendar } from 'lucide-react';
import { Alert, EmptyState, KpiCard, Pill, TaskListCard } from '@/components/ui';
import { useWorkflowConfig, getCompletedAtMillis } from '@/lib/hooks/useWorkflowConfig';
import { selectActionableIssues } from '@/lib/utils/issueAccounting.mjs';
import { plural } from '@/lib/utils/plural.mjs';
import { summarizeCycleTimes } from '@/lib/utils/velocityMetrics.mjs';

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtShortDate(date) {
  return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

// ── Mini Bar Chart ────────────────────────────────────────────────────────────
function BarChart({ data, colorA = '#1f1f1f', colorB = '#10b981', labelA = 'Створено', labelB = 'Закрито', height = 120 }) {
  const maxVal = Math.max(...data.map(d => Math.max(d.a, d.b ?? 0)), 1);
  return (
    <div>
      <div className="flex items-end gap-[4px]" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end gap-[2px] h-full" title={`${d.label}: +${d.a} ✓${d.b ?? ''}`}>
            {d.b !== undefined && (
              <div
                className="w-full rounded-t-[3px] transition-all"
                style={{ height: `${(d.b / maxVal) * 100}%`, minHeight: d.b > 0 ? 3 : 0, background: colorB }}
              />
            )}
            <div
              className="w-full rounded-t-[3px] transition-all opacity-60"
              style={{ height: `${(d.a / maxVal) * 100}%`, minHeight: d.a > 0 ? 3 : 0, background: colorA }}
            />
          </div>
        ))}
      </div>
      {/* X labels — show only first and last */}
      <div className="flex justify-between mt-2">
        <span className="text-[9px] text-faint">{data[0]?.label}</span>
        <span className="text-[9px] text-faint">{data[data.length - 1]?.label}</span>
      </div>
      <div className="flex items-center gap-4 mt-2">
        <span className="flex items-center gap-1.5 text-[10px] text-muted">
          <span className="w-2 h-2 rounded-sm inline-block opacity-60" style={{ background: colorA }} />
          {labelA}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-muted">
          <span className="w-2 h-2 rounded-sm inline-block" style={{ background: colorB }} />
          {labelB}
        </span>
      </div>
    </div>
  );
}

// ── Burndown Chart ────────────────────────────────────────────────────────────
function BurndownChart({ issues, days = 30, closedSet, now }) {
  const data = useMemo(() => {
    const total = issues.length;
    if (total === 0) return [];

    return Array.from({ length: Math.min(days, 30) }, (_, i) => {
      const daysBack = Math.min(days, 30) - 1;
      const dayEnd = new Date(now - (daysBack - i) * 86400000).setHours(23, 59, 59, 999);
      const label = new Date(now - (daysBack - i) * 86400000).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
      // Remaining = issues created before this day that are NOT done yet or done after this day
      const remaining = issues.filter(iss => {
        const created = iss.createdAt?.toMillis?.() ?? 0;
        if (created > dayEnd) return false;
        if (!closedSet.has(iss.columnId || iss.status)) return true;
        const closedAt = getCompletedAtMillis(iss);
        return closedAt > dayEnd;
      }).length;
      return { label, remaining, ideal: Math.round(total - (total / Math.min(days, 30)) * i) };
    });
  }, [issues, days, closedSet, now]);

  const maxVal = Math.max(...data.map(d => Math.max(d.remaining, d.ideal)), 1);

  if (data.length === 0) return (
    <div className="flex items-center justify-center h-[120px]">
      <p className="text-[12px] text-faint">Недостатньо даних для burndown</p>
    </div>
  );

  return (
    <div>
      <div className="relative" style={{ height: 120 }}>
        {/* SVG lines */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 ${data.length - 1} 100`} preserveAspectRatio="none">
          {/* Ideal line (dashed) */}
          <polyline
            points={data.map((d, i) => `${i},${100 - (d.ideal / maxVal) * 100}`).join(' ')}
            fill="none"
            stroke="#cfcfcf"
            strokeWidth="1.5"
            strokeDasharray="4,4"
            vectorEffect="non-scaling-stroke"
          />
          {/* Actual line */}
          <polyline
            points={data.map((d, i) => `${i},${100 - (d.remaining / maxVal) * 100}`).join(' ')}
            fill="none"
            stroke="#1f1f1f"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          {/* Fill area */}
          <polygon
            points={[
              ...data.map((d, i) => `${i},${100 - (d.remaining / maxVal) * 100}`),
              `${data.length - 1},100`,
              `0,100`
            ].join(' ')}
            fill="#1f1f1f"
            fillOpacity="0.08"
          />
        </svg>
      </div>
      <div className="flex justify-between mt-2">
        <span className="text-[9px] text-faint">{data[0]?.label}</span>
        <span className="text-[9px] text-faint">{data[data.length - 1]?.label}</span>
      </div>
      <div className="flex items-center gap-4 mt-2">
        <span className="flex items-center gap-1.5 text-[10px] text-muted">
          <span className="inline-block w-6 border-t border-dashed border-faint" />
          Ідеальний темп
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-muted">
          <span className="inline-block w-6 border-t-2 border-ink" />
          Фактичний
        </span>
      </div>
    </div>
  );
}

// ── Weekly Velocity Chart ─────────────────────────────────────────────────────
function WeeklyVelocityChart({ issues, weeksBack = 8, deliveredSet, now }) {
  const data = useMemo(() => {
    return Array.from({ length: weeksBack }, (_, i) => {
      const weekIdx = weeksBack - 1 - i;
      const weekStart = now - (weekIdx + 1) * 7 * 86400000;
      const weekEnd = now - weekIdx * 7 * 86400000;
      const label = fmtShortDate(new Date(weekStart));
      const closed = issues.filter(iss => {
        if (!deliveredSet.has(iss.columnId || iss.status)) return false;
        const t = getCompletedAtMillis(iss);
        return t >= weekStart && t < weekEnd;
      }).length;
      const created = issues.filter(iss => {
        const t = iss.createdAt?.toMillis?.() ?? 0;
        return t >= weekStart && t < weekEnd;
      }).length;
      return { label, a: created, b: closed };
    });
  }, [issues, weeksBack, deliveredSet, now]);

  return <BarChart data={data} colorA="#1f1f1f" colorB="#10b981" labelA="Відкрито" labelB="Закрито" height={120} />;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function VelocityTab({ issues = [], projects = [], members = [], period = 30 }) {
  const { closedStatusIds, deliveredStatusIds, types = [] } = useWorkflowConfig();
  // The burndown draws work *remaining*, so a cancelled task leaves the line the
  // same way a finished one does — that is the closed set. Everything else here
  // measures output, and cancelling something produces none of it.
  const closedSet = useMemo(() => new Set(closedStatusIds), [closedStatusIds]);
  const deliveredSet = useMemo(() => new Set(deliveredStatusIds), [deliveredStatusIds]);
  const actionableIssues = useMemo(
    () => selectActionableIssues(issues),
    [issues],
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const periodAgo = now - period * 86400000;
    const prevPeriodAgo = now - period * 2 * 86400000;

    const doneAll = actionableIssues.filter(i => deliveredSet.has(i.columnId || i.status));

    const donePeriod = doneAll.filter(i => {
      const t = getCompletedAtMillis(i);
      return t >= periodAgo;
    });

    const donePrev = doneAll.filter(i => {
      const t = getCompletedAtMillis(i);
      return t >= prevPeriodAgo && t < periodAgo;
    });

    const createdPeriod = actionableIssues.filter(i => {
      const t = i.createdAt?.toMillis?.() ?? 0;
      return t >= periodAgo;
    });

    const velocityTrend = donePrev.length > 0
      ? Math.round(((donePeriod.length - donePrev.length) / donePrev.length) * 100)
      : null;

    const cycleSummary = summarizeCycleTimes(donePeriod, getCompletedAtMillis);

    // Daily activity
    const dayCount = Math.min(period, 30);
    const days = Array.from({ length: dayCount }, (_, i) => {
      const daysBack = dayCount - 1;
      const dayStart = new Date(now - (daysBack - i) * 86400000).setHours(0, 0, 0, 0);
      const dayEnd = new Date(now - (daysBack - i) * 86400000).setHours(23, 59, 59, 999);
      const label = new Date(dayStart).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
      return {
        label,
        a: actionableIssues.filter(iss => { const t = iss.createdAt?.toMillis?.() ?? 0; return t >= dayStart && t <= dayEnd; }).length,
        b: actionableIssues.filter(iss => { if (!deliveredSet.has(iss.columnId || iss.status)) return false; const t = getCompletedAtMillis(iss); return t >= dayStart && t <= dayEnd; }).length,
      };
    });

    // By type breakdown — types come from the shared workflow config
    const byType = types.map(({ id: type, label, color }) => {
      const typeIssues = actionableIssues.filter(i => i.type === type);
      const typeDone = typeIssues.filter(i => deliveredSet.has(i.columnId || i.status));
      return { type, label, color, total: typeIssues.length, done: typeDone.length, pct: typeIssues.length > 0 ? Math.round((typeDone.length / typeIssues.length) * 100) : 0 };
    }).filter(t => t.total > 0);

    // Per-project velocity
    const byProject = projects.map(p => {
      const pIssues = actionableIssues.filter(i => i.projectId === p.id);
      const pDone = pIssues.filter(i => deliveredSet.has(i.columnId || i.status) && getCompletedAtMillis(i) >= periodAgo);
      return { p, count: pDone.length, total: pIssues.length };
    }).filter(p => p.total > 0).sort((a, b) => b.count - a.count);

    return {
      donePeriod: donePeriod.length,
      velocityTrend,
      createdPeriod: createdPeriod.length,
      totalDone: doneAll.length,
      completionPct: actionableIssues.length > 0
        ? Math.round((doneAll.length / actionableIssues.length) * 100)
        : 0,
      avgCycleTime: cycleSummary.averageDays,
      invalidCycleCount: cycleSummary.invalidIssueIds.length,
      days,
      byType,
      byProject,
    };
  }, [actionableIssues, projects, period, deliveredSet, now, types]);

  const recentlyClosed = useMemo(
    () => actionableIssues
      .filter(issue => (
        deliveredSet.has(issue.columnId || issue.status)
        && getCompletedAtMillis(issue) >= now - period * 86400000
      ))
      .sort((left, right) => getCompletedAtMillis(right) - getCompletedAtMillis(left)),
    [actionableIssues, deliveredSet, now, period],
  );

  if (actionableIssues.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={Zap}
          title="Немає даних про швидкість"
          description="Завершені завдання сформують velocity, cycle time та інші тренди."
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="w-full pb-16">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard icon={Zap} trend={stats.velocityTrend ?? undefined}
            value={stats.donePeriod} label={`Закрито за ${period}д`} sub="vs попередній період" />
          <KpiCard icon={CheckCircle2}
            value={stats.totalDone} label="Всього закрито" sub={`${stats.completionPct}% від всіх завдань`} />
          <KpiCard icon={Calendar}
            value={stats.avgCycleTime !== null ? `${stats.avgCycleTime}д` : '—'}
            label="Середній цикл" sub="від відкриття до закриття" />
          <KpiCard icon={TrendingUp}
            value={stats.createdPeriod} label={`Відкрито за ${period}д`}
            sub={stats.createdPeriod > stats.donePeriod
              ? '↑ Більше відкривається'
              : stats.createdPeriod < stats.donePeriod
                ? '↓ Команда випереджає'
                : 'Баланс'} />
        </div>

        {stats.invalidCycleCount > 0 && (
          <Alert variant="error" title="Помилка даних cycle time" className="mb-6">
            Виявлено {stats.invalidCycleCount} {plural(stats.invalidCycleCount, ['завдання', 'завдання', 'завдань'])} з датою закриття раніше за початок циклу. Некоректні значення не включено в середнє.
          </Alert>
        )}

        {/* Charts row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Daily Activity */}
          <div data-ui-surface="card" data-ui-padding="lg" className="ui-surface md:col-span-2">
            <h3 className="ui-type-eyebrow text-muted uppercase tracking-wider mb-4">
              Активність ({period} {plural(period, ['день', 'дні', 'днів'])})
            </h3>
            <BarChart data={stats.days} colorA="#1f1f1f" colorB="#10b981" labelA="Відкрито" labelB="Закрито" height={120} />
          </div>

          {/* By type */}
          <div data-ui-surface="card" data-ui-padding="lg" className="ui-surface">
            <h3 className="ui-type-eyebrow text-muted uppercase tracking-wider mb-4">По типах</h3>
            {stats.byType.length === 0 ? (
              <p className="text-[12px] text-faint py-4">Немає даних</p>
            ) : (
              <div className="flex flex-col gap-3">
                {stats.byType.map(({ type, label, color, total, done, pct }) => (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <Pill color={color} size="md" weight="medium">
                        {label}
                      </Pill>
                      <span className="text-[11px] text-muted">{done}/{total}</span>
                    </div>
                    <div className="h-[5px] bg-canvas rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Burndown */}
        <div data-ui-surface="card" data-ui-padding="lg" className="ui-surface mb-6">
          <h3 className="ui-type-eyebrow text-muted uppercase tracking-wider mb-4">
            Burndown Chart ({period} {plural(period, ['день', 'дні', 'днів'])})
          </h3>
          <BurndownChart issues={actionableIssues} days={period} closedSet={closedSet} now={now} />
        </div>

        {/* Weekly velocity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div data-ui-surface="card" data-ui-padding="lg" className="ui-surface">
            <h3 className="ui-type-eyebrow text-muted uppercase tracking-wider mb-4">
              Velocity по тижнях (8 тижнів)
            </h3>
            <WeeklyVelocityChart issues={actionableIssues} weeksBack={8} deliveredSet={deliveredSet} now={now} />
          </div>

          {/* By project */}
          {stats.byProject.length > 0 && (
            <div data-ui-surface="card" data-ui-padding="lg" className="ui-surface">
              <h3 className="ui-type-eyebrow text-muted uppercase tracking-wider mb-4">
                По проєктах (закрито за {period}д)
              </h3>
              <div className="flex flex-col gap-3">
                {stats.byProject.map(({ p, count, total }) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="text-[12px] font-medium text-[#6a6a6a] truncate flex-1 max-w-[120px]">{p.name}</span>
                    <div className="flex-1 h-[5px] bg-canvas rounded-full overflow-hidden">
                      <div className="h-full bg-ink rounded-full transition-all"
                        style={{ width: `${total > 0 ? (count / Math.max(...stats.byProject.map(x => x.count), 1)) * 100 : 0}%` }} />
                    </div>
                    <span className="text-[12px] font-bold text-ink w-6 text-right shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recent done issues. These were the one list of tasks in the product
            you could not click: a title, a project and a cycle time, drawn by
            hand. They are `TaskListCard` rows now, like every other list. */}
        <TaskListCard
          title="Нещодавно закриті завдання"
          icon={CheckCircle2}
          iconClassName="text-emerald-600"
          count={stats.donePeriod}
          issues={recentlyClosed}
          members={members}
          projects={projects}
          emptyText="За вказаний період завдань не закрито"
        />
      </div>
    </div>
  );
}
