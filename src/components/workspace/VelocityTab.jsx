'use client';
// src/components/workspace/VelocityTab.jsx — Продуктивність: тренди, burndown, cycle time
// Період керується з фільтрів сторінки (prop `period`), власного селектора немає.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Zap, TrendingUp, CheckCircle2, Calendar, Activity, Folders, Shapes, TrendingDown } from 'lucide-react';
import {
  Alert, BarList, Card, ColumnChart, DetailSection, EmptyState, KpiCard, TaskListCard, TrendChart,
} from '@/components/ui';
import { useWorkflowConfig, getCompletedAtMillis } from '@/lib/hooks/useWorkflowConfig';
import { plural } from '@/lib/utils/plural.mjs';
import { summarizeCycleTimes } from '@/lib/utils/velocityMetrics.mjs';
import { buildVelocityExport } from '@/lib/utils/analyticsExport.mjs';

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtShortDate(date) {
  return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

// The two series every chart on this screen plots. Opened is context — it is
// there so closed has something to be measured against — so it wears the
// de-emphasis grey and closed wears the measure. This used to be ink at 60%
// opacity against emerald, which is two colours nobody chose and one of them
// invented by an opacity.
const FLOW_SERIES = [
  { label: 'Закрито', color: 'var(--color-chart-1)' },
  { label: 'Відкрито', color: 'var(--color-chart-context)' },
];

function ChartCard({ icon, title, meta, children, className = '' }) {
  return (
    <Card preset="borderless" padding="lg" className={className}>
      <DetailSection icon={icon} title={title} meta={meta}>
        {children}
      </DetailSection>
    </Card>
  );
}

// ── Burndown ─────────────────────────────────────────────────────────────────
// The work remaining, against the pace that would have finished it evenly. The
// dashed line is the only dashed stroke in the product, and it earns that:
// dashing means "projected, not measured", which is exactly what it is.
function useBurndown(issues, days, closedSet, now) {
  return useMemo(() => {
    const total = issues.length;
    if (total === 0) return [];
    const span = Math.min(days, 30);
    return Array.from({ length: span }, (_, index) => {
      const dayEnd = new Date(now - (span - 1 - index) * 86400000).setHours(23, 59, 59, 999);
      const label = new Date(now - (span - 1 - index) * 86400000).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
      const remaining = issues.filter(issue => {
        const created = issue.createdAt?.toMillis?.() ?? 0;
        if (created > dayEnd) return false;
        if (!closedSet.has(issue.columnId || issue.status)) return true;
        return getCompletedAtMillis(issue) > dayEnd;
      }).length;
      return { label, value: remaining, reference: Math.round(total - (total / span) * index) };
    });
  }, [issues, days, closedSet, now]);
}

function useWeeklyVelocity(issues, weeksBack, deliveredSet, now) {
  return useMemo(() => Array.from({ length: weeksBack }, (_, index) => {
    const weekIndex = weeksBack - 1 - index;
    const weekStart = now - (weekIndex + 1) * 7 * 86400000;
    const weekEnd = now - weekIndex * 7 * 86400000;
    const closed = issues.filter(issue => {
      if (!deliveredSet.has(issue.columnId || issue.status)) return false;
      const at = getCompletedAtMillis(issue);
      return at >= weekStart && at < weekEnd;
    }).length;
    const created = issues.filter(issue => {
      const at = issue.createdAt?.toMillis?.() ?? 0;
      return at >= weekStart && at < weekEnd;
    }).length;
    return { label: fmtShortDate(new Date(weekStart)), values: [closed, created] };
  }), [issues, weeksBack, deliveredSet, now]);
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function VelocityTab({
  issues = [],
  projects = [],
  members = [],
  period = 30,
  // Passed only by the screen that owns the header button. This component is
  // also drawn inside a member's page, where the member's own export is the
  // one the button must write.
  onExportReady,
  selectedProjectIds = [],
  formatDate,
}) {
  const { closedStatusIds, deliveredStatusIds, types = [] } = useWorkflowConfig();
  // The burndown draws work *remaining*, so a cancelled task leaves the line the
  // same way a finished one does — that is the closed set. Everything else here
  // measures output, and cancelling something produces none of it.
  const closedSet = useMemo(() => new Set(closedStatusIds), [closedStatusIds]);
  const deliveredSet = useMemo(() => new Set(deliveredStatusIds), [deliveredStatusIds]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const periodAgo = now - period * 86400000;
    const prevPeriodAgo = now - period * 2 * 86400000;

    const doneAll = issues.filter(i => deliveredSet.has(i.columnId || i.status));

    const donePeriod = doneAll.filter(i => {
      const t = getCompletedAtMillis(i);
      return t >= periodAgo;
    });

    const donePrev = doneAll.filter(i => {
      const t = getCompletedAtMillis(i);
      return t >= prevPeriodAgo && t < periodAgo;
    });

    const createdPeriod = issues.filter(i => {
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
        // Closed first, because closed is the measure and opened is the context
        // it is read against — the order the legend and the tooltip follow too.
        values: [
          issues.filter(iss => { if (!deliveredSet.has(iss.columnId || iss.status)) return false; const t = getCompletedAtMillis(iss); return t >= dayStart && t <= dayEnd; }).length,
          issues.filter(iss => { const t = iss.createdAt?.toMillis?.() ?? 0; return t >= dayStart && t <= dayEnd; }).length,
        ],
      };
    });

    // By type breakdown — types come from the shared workflow config
    const byType = types.map(({ id: type, label, color }) => {
      const typeIssues = issues.filter(i => i.type === type);
      const typeDone = typeIssues.filter(i => deliveredSet.has(i.columnId || i.status));
      return { type, label, color, total: typeIssues.length, done: typeDone.length, pct: typeIssues.length > 0 ? Math.round((typeDone.length / typeIssues.length) * 100) : 0 };
    }).filter(t => t.total > 0);

    // Per-project velocity
    const byProject = projects.map(p => {
      const pIssues = issues.filter(i => i.projectId === p.id);
      const pDone = pIssues.filter(i => deliveredSet.has(i.columnId || i.status) && getCompletedAtMillis(i) >= periodAgo);
      return { p, count: pDone.length, total: pIssues.length };
    }).filter(p => p.total > 0).sort((a, b) => b.count - a.count);

    return {
      donePeriod: donePeriod.length,
      velocityTrend,
      createdPeriod: createdPeriod.length,
      totalDone: doneAll.length,
      completionPct: issues.length > 0
        ? Math.round((doneAll.length / issues.length) * 100)
        : 0,
      avgCycleTime: cycleSummary.averageDays,
      invalidCycleCount: cycleSummary.invalidIssueIds.length,
      days,
      byType,
      byProject,
    };
  }, [issues, projects, period, deliveredSet, now, types]);

  const recentlyClosed = useMemo(
    () => issues
      .filter(issue => (
        deliveredSet.has(issue.columnId || issue.status)
        && getCompletedAtMillis(issue) >= now - period * 86400000
      ))
      .sort((left, right) => getCompletedAtMillis(right) - getCompletedAtMillis(left)),
    [issues, deliveredSet, now, period],
  );

  const burndown = useBurndown(issues, period, closedSet, now);
  const weeklyVelocity = useWeeklyVelocity(issues, 8, deliveredSet, now);

  // Every chart here is a count, so the file is those counts: the same days,
  // the same weeks, the same rows behind the bars.
  const buildExport = useCallback(() => buildVelocityExport({
    stats,
    weeklyVelocity,
    recentlyClosed,
    period,
    projects,
    selectedProjectIds,
    formatDate,
    completedAtOf: getCompletedAtMillis,
  }), [formatDate, period, projects, recentlyClosed, selectedProjectIds, stats, weeklyVelocity]);
  useEffect(() => {
    onExportReady?.(issues.length > 0 ? buildExport : null);
    return () => onExportReady?.(null);
  }, [issues.length, buildExport, onExportReady]);

  if (issues.length === 0) {
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
      <div className="flex w-full flex-col gap-4 pb-16">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard icon={Zap} trend={stats.velocityTrend ?? undefined}
            value={stats.donePeriod}
            label={`Закрито за ${period} ${plural(period, ['день', 'дні', 'днів'])}`}
            series={stats.days.map(day => day.values[0])}
            sub="проти попереднього періоду" />
          <KpiCard icon={CheckCircle2}
            value={stats.totalDone} label="Всього закрито" sub={`${stats.completionPct}% від усіх завдань`} />
          <KpiCard icon={Calendar}
            value={stats.avgCycleTime !== null ? `${stats.avgCycleTime}д` : '—'}
            label="Середній цикл" sub="від відкриття до закриття" />
          <KpiCard icon={stats.createdPeriod > stats.donePeriod ? TrendingUp : TrendingDown}
            value={stats.createdPeriod}
            label={`Відкрито за ${period} ${plural(period, ['день', 'дні', 'днів'])}`}
            series={stats.days.map(day => day.values[1])}
            sub={stats.createdPeriod > stats.donePeriod
              ? 'Більше відкривається, ніж закривається'
              : stats.createdPeriod < stats.donePeriod
                ? 'Команда випереджає потік'
                : 'Відкривається і закривається порівну'} />
        </div>

        {stats.invalidCycleCount > 0 && (
          <Alert variant="error" title="Помилка даних cycle time">
            Виявлено {stats.invalidCycleCount} {plural(stats.invalidCycleCount, ['завдання', 'завдання', 'завдань'])} з датою закриття раніше за початок циклу. Некоректні значення не включено в середнє.
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ChartCard
            icon={Activity}
            title="Активність"
            meta={`${period} ${plural(period, ['день', 'дні', 'днів'])}`}
            className="md:col-span-2"
          >
            <ColumnChart data={stats.days} series={FLOW_SERIES} height={130} />
          </ChartCard>

          <ChartCard icon={Shapes} title="По типах">
            {/* The type owns its colour, and «зроблено з усього» is the number
                the bar is a picture of — it used to be printed beside a bar
                scaled to a different quantity entirely. */}
            <BarList
              items={stats.byType.map(({ type, label, color, total, done }) => ({
                id: type,
                label,
                value: done,
                color,
                meta: `з ${total}`,
              }))}
              emptyText="Немає даних"
            />
          </ChartCard>
        </div>

        <ChartCard
          icon={TrendingDown}
          title="Скільки роботи лишилось"
          meta={`${period} ${plural(period, ['день', 'дні', 'днів'])}`}
        >
          <TrendChart
            data={burndown}
            valueLabel="Фактично лишилось"
            referenceLabel="Рівний темп"
            height={140}
          />
        </ChartCard>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ChartCard icon={Zap} title="Velocity по тижнях" meta="8 тижнів">
            <ColumnChart data={weeklyVelocity} series={FLOW_SERIES} height={130} />
          </ChartCard>

          {stats.byProject.length > 0 && (
            <ChartCard
              icon={Folders}
              title="По проєктах"
              meta={`закрито за ${period} ${plural(period, ['день', 'дні', 'днів'])}`}
            >
              <BarList
                items={stats.byProject.map(({ p, count }) => ({ id: p.id, label: p.name, value: count }))}
                emptyText="Немає закритих завдань"
              />
            </ChartCard>
          )}
        </div>

        {/* Recent done issues. These were the one list of tasks in the product
            you could not click: a title, a project and a cycle time, drawn by
            hand. They are `TaskListCard` rows now, like every other list. */}
        <TaskListCard
          title="Нещодавно закриті завдання"
          icon={CheckCircle2}
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
