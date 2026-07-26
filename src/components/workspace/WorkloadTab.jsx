'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutDashboard,
  ListChecks,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import {
  Button,
  EmptyState,
  KpiCard,
  Segmented,
} from '@/components/ui';
import {
  DEFAULT_PRIORITIES,
  getCompletedAtMillis,
  useWorkflowConfig,
} from '@/lib/hooks/useWorkflowConfig';
import { parseDueDate } from '@/lib/utils/date';
import {
  effectiveTimeLogDate,
  effectiveTimeLogMillis,
  isCalendarEventTimeLog,
} from '@/lib/utils/timeLogDates.mjs';
import {
  calendarEventHref,
  calendarEventOccurrenceKey,
} from '@/lib/utils/calendarEventNavigation.mjs';
import TimesheetTab from '@/components/workspace/TimesheetTab';
import VelocityTab from '@/components/workspace/VelocityTab';

const PRIORITY_META = Object.fromEntries(DEFAULT_PRIORITIES.map(priority => [priority.id, priority]));

function fmtH(minutes) {
  if (!minutes) return '0г';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}хв`;
  return rest ? `${hours}г ${rest}хв` : `${hours}г`;
}

function memberId(member) {
  return member?.id || member?.uid || '';
}

function memberName(member) {
  return member?.name || member?.displayName || member?.email || 'Без імені';
}

function timestampMillis(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function issueStatusLabel(issue, statuses) {
  const statusId = issue.columnId || issue.status;
  return statuses.find(status => status.id === statusId)?.label || statusId || 'Без статусу';
}

function positionLabel(member, positions) {
  return positions.find(position => position.id === member?.positionId)?.label
    || member?.title
    || 'Посада не вказана';
}

function latestActivityMillis(memberIssues, memberLogs) {
  const issueTime = memberIssues.reduce(
    (latest, issue) => Math.max(
      latest,
      timestampMillis(issue.updatedAt),
      timestampMillis(issue.createdAt),
    ),
    0,
  );
  return memberLogs.reduce(
    (latest, log) => Math.max(latest, effectiveTimeLogMillis(log)),
    issueTime,
  );
}

function relativeActivity(value, now) {
  if (!value) return 'Активності ще немає';
  const days = Math.floor((now - value) / 86_400_000);
  if (days <= 0) return 'Сьогодні';
  if (days === 1) return 'Вчора';
  if (days < 7) return `${days} дн. тому`;
  return new Date(value).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

function riskMeta(stat) {
  if (stat.overdue > 0) {
    return {
      label: `${stat.overdue} прострочено`,
      className: 'bg-red-50 text-red-600',
    };
  }
  if (stat.open >= 8) {
    return {
      label: 'Високе навантаження',
      className: 'bg-amber-50 text-amber-700',
    };
  }
  if (stat.open > 0 && stat.minutes === 0) {
    return {
      label: 'Час не списано',
      className: 'bg-slate-100 text-slate-600',
    };
  }
  return {
    label: 'Стабільно',
    className: 'bg-emerald-50 text-emerald-700',
  };
}

function WorkloadBar({ open, done, overdue }) {
  const total = Math.max(open + done, 1);
  const doneWidth = (done / total) * 100;
  const openWidth = (open / total) * 100;
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-canvas">
        <span className="h-full bg-emerald-500" style={{ width: `${doneWidth}%` }} />
        <span
          className={overdue > 0 ? 'h-full bg-red-500' : 'h-full bg-ink'}
          style={{ width: `${openWidth}%` }}
        />
      </div>
      <span className="w-[74px] shrink-0 text-right text-[11px] font-semibold text-muted">
        {open} відкрито
      </span>
    </div>
  );
}

function TeamOverview({ stats, summary, period, positions, now, onSelectMember }) {
  return (
    <div className="w-full pb-16">
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={Clock}

          value={fmtH(summary.minutes)}
          label={`Списано за ${period}д`}
          sub="за задачами та подіями"
        />
        <KpiCard
          icon={CheckCircle2}

          value={summary.done}
          label={`Завершено за ${period}д`}
          sub="сума по учасниках"
        />
        <KpiCard
          icon={ListChecks}

          value={summary.open}
          label="Відкритих завдань"
          sub={`${stats.filter(stat => stat.inProgress > 0).length} людей мають роботу в процесі`}
        />
        <KpiCard
          icon={AlertTriangle}

          value={summary.overdue}
          label="Прострочених"
          sub={summary.overdue ? 'потребують рішення керівника' : 'критичних затримок немає'}
        />
      </div>

      <div className="overflow-hidden rounded-[18px] bg-white">
        <div className="hidden grid-cols-[minmax(230px,1.4fr)_minmax(220px,1.2fr)_80px_80px_90px_115px] gap-4 border-b border-line px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted lg:grid">
          <span>Учасник</span>
          <span>Поточний фокус</span>
          <span className="text-center">Готово</span>
          <span className="text-center">В роботі</span>
          <span className="text-center">Час</span>
          <span className="text-right">Стан</span>
        </div>

        <div className="divide-y divide-line">
          {stats.map(stat => {
            const risk = riskMeta(stat);
            return (
              <button
                key={stat.uid}
                type="button"
                onClick={() => onSelectMember(stat.uid)}
                className="grid w-full gap-4 px-4 py-4 text-left transition-colors hover:bg-canvas/70 sm:px-5 lg:grid-cols-[minmax(230px,1.4fr)_minmax(220px,1.2fr)_80px_80px_90px_115px] lg:items-center"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <UserAvatar user={stat.member} size={42} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold text-ink">
                      {memberName(stat.member)}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted">
                      {positionLabel(stat.member, positions)} · {relativeActivity(stat.lastActivity, now)}
                    </span>
                  </span>
                </span>

                <span className="min-w-0">
                  {stat.inProgressItems.length > 0 ? (
                    <>
                      <span className="block truncate text-[12px] font-semibold text-ink">
                        {stat.inProgressItems[0].title}
                      </span>
                      <span className="mt-1 block text-[10px] text-muted">
                        {stat.inProgressItems.length > 1
                          ? `+ ще ${stat.inProgressItems.length - 1} в роботі`
                          : 'Зараз у роботі'}
                      </span>
                    </>
                  ) : (
                    <span className="text-[12px] text-faint">Немає задач у статусі «В роботі»</span>
                  )}
                </span>

                <span className="grid grid-cols-3 gap-3 lg:contents">
                  <span className="text-center">
                    <span className="block text-[15px] font-bold text-emerald-600">{stat.done}</span>
                    <span className="text-[9px] uppercase text-faint lg:hidden">готово</span>
                  </span>
                  <span className="text-center">
                    <span className="block text-[15px] font-bold text-ink">{stat.inProgress}</span>
                    <span className="text-[9px] uppercase text-faint lg:hidden">в роботі</span>
                  </span>
                  <span className="text-center">
                    <span className="block text-[13px] font-bold text-cyan-700">{fmtH(stat.minutes)}</span>
                    <span className="text-[9px] uppercase text-faint lg:hidden">час</span>
                  </span>
                </span>

                <span className="flex items-center justify-between gap-3 lg:block lg:text-right">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${risk.className}`}>
                    {risk.label}
                  </span>
                  <ChevronRight size={15} className="text-faint lg:hidden" />
                </span>

                <span className="lg:col-span-6">
                  <WorkloadBar open={stat.open} done={stat.done} overdue={stat.overdue} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const MEMBER_VIEWS = [
  { id: 'overview', label: 'Огляд', description: 'Ключові показники', icon: LayoutDashboard },
  { id: 'work', label: 'Робота', description: 'Завдання й активність', icon: ListChecks },
  { id: 'timesheet', label: 'Табель', description: 'Робочий час', icon: Clock },
  { id: 'productivity', label: 'Продуктивність', description: 'Динаміка роботи', icon: TrendingUp },
];

// The right-hand slot carries the page's own filters when it has any. It used
// to hold a workload badge and a "Період: N днів" chip — both were read-only
// restatements of state the filters themselves now show.
function MemberHeader({ stat, positions, onBack, standalone, filters }) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-4">
        {!standalone && (
          <Button style="ghost" size="icon-sm" icon={ArrowLeft} onClick={onBack} aria-label="Повернутися до команди" />
        )}
        <UserAvatar user={stat.member} size={standalone ? 64 : 52} />
        <div className="min-w-0 flex-1">
          <h1 className={`truncate font-bold tracking-tight text-ink ${standalone ? 'text-[26px]' : 'text-[20px]'}`}>
            {memberName(stat.member)}
          </h1>
          <p className="mt-1 truncate text-[12px] text-muted">
            {positionLabel(stat.member, positions)}
            {stat.member?.email ? ` · ${stat.member.email}` : ''}
          </p>
        </div>
        {filters && (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">{filters}</div>
        )}
      </div>
    </div>
  );
}

function ProjectDistribution({ stat, projects }) {
  const rows = projects
    .map(project => ({
      project,
      minutes: stat.logs
        .filter(log => log.projectId === project.id)
        .reduce((sum, log) => sum + (Number(log.spentMinutes) || 0), 0),
      open: stat.openItems.filter(issue => issue.projectId === project.id).length,
    }))
    .filter(row => row.minutes > 0 || row.open > 0)
    .sort((a, b) => b.minutes - a.minutes || b.open - a.open);
  const maxMinutes = Math.max(...rows.map(row => row.minutes), 1);

  return (
    <div className="rounded-[16px] bg-white p-5">
      <h3 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-muted">Розподіл по проєктах</h3>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-faint">Немає проєктних даних за період</p>
      ) : (
        <div className="space-y-4">
          {rows.slice(0, 8).map(row => (
            <div key={row.project.id}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
                <span className="truncate font-semibold text-ink">{row.project.name}</span>
                <span className="shrink-0 text-muted">{fmtH(row.minutes)} · {row.open} відкрито</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-canvas">
                <div className="h-full rounded-full bg-cyan-600" style={{ width: `${(row.minutes / maxMinutes) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IssueList({
  title,
  issues,
  projects,
  statuses,
  emptyText,
  overdueIssueIds = [],
  limit = 8,
}) {
  const overdueSet = new Set(overdueIssueIds);
  return (
    <div className="rounded-[16px] bg-white p-5">
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted">{title}</h3>
      {issues.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-faint">{emptyText}</p>
      ) : (
        <div className="divide-y divide-line">
          {issues.slice(0, limit).map(issue => {
            const project = projects.find(item => item.id === issue.projectId);
            const overdue = overdueSet.has(issue.id);
            return (
              <Link
                key={issue.id}
                href={`/${issue.projectId}/issue/${issue.id}`}
                className="flex items-center gap-3 py-3 transition-colors hover:text-ink"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: PRIORITY_META[issue.priority]?.color || '#c7c7c7' }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold text-ink">{issue.title}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-muted">
                    {issue.issueKey || 'Завдання'} · {project?.name || 'Без проєкту'} · {issueStatusLabel(issue, statuses)}
                  </span>
                </span>
                {overdue && <span className="shrink-0 text-[10px] font-bold text-red-500">Прострочено</span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RecentTime({ logs, issues, events, projects }) {
  const issuesById = useMemo(
    () => new Map(issues.map(issue => [issue.id, issue])),
    [issues],
  );
  const eventsByKey = useMemo(() => {
    const map = new Map();
    events.forEach(event => {
      map.set(
        calendarEventOccurrenceKey(event.sourceEventId || event.id, event.startAt),
        event,
      );
    });
    return map;
  }, [events]);

  return (
    <div className="rounded-[16px] bg-white p-5">
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted">Останні записи часу</h3>
      {logs.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-faint">Час за вибраний період не списувався</p>
      ) : (
        <div className="divide-y divide-line">
          {logs.slice(0, 10).map(log => {
            const event = isCalendarEventTimeLog(log)
              ? eventsByKey.get(calendarEventOccurrenceKey(log.eventId, log.occurrenceStartAt))
              : null;
            const issue = log.issueId ? issuesById.get(log.issueId) : null;
            const project = projects.find(item => item.id === log.projectId);
            const date = effectiveTimeLogDate(log);
            const content = (
              <>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-canvas text-muted">
                  {event ? <CalendarDays size={14} /> : <BriefcaseBusiness size={14} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold text-ink">
                    {event?.title || issue?.title || log.description || 'Запис часу'}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-muted">
                    {project?.name || 'Без проєкту'}
                    {date ? ` · ${date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] font-bold text-cyan-700">{fmtH(log.spentMinutes)}</span>
              </>
            );
            if (event) {
              return (
                <Link key={log.id} href={calendarEventHref(event)} className="flex items-center gap-3 py-3 hover:bg-canvas/50">
                  {content}
                </Link>
              );
            }
            if (issue) {
              return (
                <Link key={log.id} href={`/${issue.projectId}/issue/${issue.id}`} className="flex items-center gap-3 py-3 hover:bg-canvas/50">
                  {content}
                </Link>
              );
            }
            return <div key={log.id} className="flex items-center gap-3 py-3">{content}</div>;
          })}
        </div>
      )}
    </div>
  );
}

function MemberOverview({ stat, projects, statuses, events, period }) {
  const completionRate = stat.done + stat.open > 0
    ? Math.round((stat.done / (stat.done + stat.open)) * 100)
    : 0;
  const averagePerDay = stat.minutes > 0 ? Math.round(stat.minutes / Math.max(period, 1)) : 0;
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={Clock} value={fmtH(stat.minutes)} label="Списано часу" sub={`≈ ${fmtH(averagePerDay)} на календарний день`} />
        <KpiCard icon={CheckCircle2} value={stat.done} label="Завершено" sub={`${completionRate}% від активного набору`} />
        <KpiCard icon={Target} value={stat.inProgress} label="Зараз у роботі" sub={`${stat.open} відкритих загалом`} />
        <KpiCard icon={AlertTriangle} value={stat.overdue} label="Прострочено" sub={stat.overdue ? 'потребує уваги' : 'затримок немає'} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <IssueList
          title="Поточний фокус"
          issues={stat.inProgressItems}
          projects={projects}
          statuses={statuses}
          emptyText="Немає задач у статусі «В роботі»"
          overdueIssueIds={stat.overdueItems.map(issue => issue.id)}
          limit={6}
        />
        <ProjectDistribution stat={stat} projects={projects} />
        <IssueList
          title={`Завершено за ${period} днів`}
          issues={stat.doneItems}
          projects={projects}
          statuses={statuses}
          emptyText="За вибраний період задач не завершено"
          overdueIssueIds={stat.overdueItems.map(issue => issue.id)}
          limit={8}
        />
        <RecentTime logs={stat.logs} issues={stat.issues} events={events} projects={projects} />
      </div>
    </>
  );
}

function MemberWork({ stat, projects, statuses, events }) {
  const [filter, setFilter] = useState('open');
  const visibleIssues = useMemo(() => {
    if (filter === 'done') return stat.doneItems;
    if (filter === 'overdue') return stat.overdueItems;
    if (filter === 'all') return stat.issues;
    return stat.openItems;
  }, [filter, stat]);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: `Відкриті ${stat.open}` },
            { value: 'done', label: `Завершені ${stat.done}` },
            { value: 'overdue', label: `Прострочені ${stat.overdue}` },
            { value: 'all', label: `Усі ${stat.issues.length}` },
          ]}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <IssueList
          title="Завдання"
          issues={visibleIssues}
          projects={projects}
          statuses={statuses}
          emptyText="За цим фільтром завдань немає"
          overdueIssueIds={stat.overdueItems.map(issue => issue.id)}
          limit={50}
        />
        <RecentTime logs={stat.logs} issues={stat.issues} events={events} projects={projects} />
      </div>
    </div>
  );
}

function MemberTimesheet({ stat, members, projects, events }) {
  const [mode, setMode] = useState('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const shift = direction => {
    setAnchor(previous => {
      const next = new Date(previous);
      if (mode === 'week') next.setDate(next.getDate() + direction * 7);
      else next.setMonth(next.getMonth() + direction);
      return next;
    });
  };
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[14px] bg-white p-2">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'week', label: 'Тиждень' },
            { value: 'month', label: 'Місяць' },
          ]}
        />
        <span className="mx-1 h-5 w-px bg-line" />
        <Button style="ghost" size="icon-sm" icon={ChevronLeft} onClick={() => shift(-1)} aria-label="Попередній період" />
        <Button style="ghost" size="sm" onClick={() => setAnchor(new Date())}>Сьогодні</Button>
        <Button style="ghost" size="icon-sm" icon={ChevronRight} onClick={() => shift(1)} aria-label="Наступний період" />
      </div>
      <TimesheetTab
        issues={stat.issues}
        events={events}
        timeLogs={stat.allLogs}
        members={members}
        projects={projects}
        member={stat.uid}
        mode={mode}
        anchor={anchor}
      />
    </div>
  );
}

function MemberDetail({
  stat,
  members,
  positions,
  projects,
  statuses,
  events,
  period,
  onBack,
  standalone = false,
  filters,
}) {
  const [view, setView] = useState('overview');

  return (
    <div className="w-full pb-16">
      <MemberHeader
        stat={stat}
        positions={positions}
        onBack={onBack}
        standalone={standalone}
        filters={filters}
      />
      <nav
        className="custom-scrollbar mb-6 flex gap-1.5 overflow-x-auto rounded-[16px] bg-[#e9e9e9] p-1.5"
        aria-label="Розділи аналітики учасника"
      >
        {MEMBER_VIEWS.map(item => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => setView(item.id)}
              className={`flex min-w-[150px] flex-1 items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left transition-all ${
                active
                  ? 'bg-white text-ink shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                  : 'text-muted hover:bg-white/50 hover:text-ink'
              }`}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[9px] ${active ? 'bg-ink text-white' : 'bg-white/70 text-muted'}`}>
                <Icon size={14} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-bold">{item.label}</span>
                <span className="mt-0.5 block truncate text-[9px] font-medium text-muted">{item.description}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div key={view}>
        {view === 'overview' && (
          <MemberOverview stat={stat} projects={projects} statuses={statuses} events={events} period={period} />
        )}
        {view === 'work' && (
          <MemberWork stat={stat} projects={projects} statuses={statuses} events={events} />
        )}
        {view === 'timesheet' && (
          <MemberTimesheet stat={stat} members={members} projects={projects} events={events} />
        )}
        {view === 'productivity' && (
          <VelocityTab issues={stat.issues} projects={projects} period={period} />
        )}
      </div>
    </div>
  );
}

export default function WorkloadTab({
  members = [],
  issues = [],
  timeLogs = [],
  events = [],
  projects = [],
  period = 30,
  selectedMemberId = 'all',
  onSelectMember,
  standaloneDetail = false,
  // Rendered in the member header. The standalone member page owns the filter
  // controls but has no header row of its own to put them in.
  detailFilters,
}) {
  const [now, setNow] = useState(() => Date.now());
  const { doneStatusIds, positions = [], statuses = [] } = useWorkflowConfig();
  const doneSet = useMemo(() => new Set(doneStatusIds), [doneStatusIds]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const periodAgo = now - period * 86_400_000;
    return members.map(member => {
      const uid = memberId(member);
      const memberIssues = issues.filter(issue => issue.assigneeIds?.includes(uid));
      const openItems = memberIssues.filter(issue => !doneSet.has(issue.columnId || issue.status));
      const doneItems = memberIssues
        .filter(issue => doneSet.has(issue.columnId || issue.status) && getCompletedAtMillis(issue) >= periodAgo)
        .sort((a, b) => getCompletedAtMillis(b) - getCompletedAtMillis(a));
      const overdueItems = openItems.filter(issue => {
        const due = parseDueDate(issue.dueDate);
        return due && due.getTime() < now;
      });
      const inProgressItems = openItems.filter(issue => issue.columnId === 'in-progress');
      const allLogs = timeLogs
        .filter(log => log.userId === uid)
        .sort((a, b) => effectiveTimeLogMillis(b) - effectiveTimeLogMillis(a));
      const logs = allLogs.filter(log => effectiveTimeLogMillis(log) >= periodAgo);
      const minutes = logs.reduce((sum, log) => sum + (Number(log.spentMinutes) || 0), 0);
      return {
        member,
        uid,
        issues: memberIssues,
        openItems,
        doneItems,
        overdueItems,
        inProgressItems,
        allLogs,
        logs,
        open: openItems.length,
        done: doneItems.length,
        overdue: overdueItems.length,
        inProgress: inProgressItems.length,
        minutes,
        lastActivity: latestActivityMillis(memberIssues, allLogs),
      };
    }).sort((a, b) => {
      if (b.overdue !== a.overdue) return b.overdue - a.overdue;
      if (b.inProgress !== a.inProgress) return b.inProgress - a.inProgress;
      return b.lastActivity - a.lastActivity;
    });
  }, [doneSet, issues, members, now, period, timeLogs]);

  const selectedStat = selectedMemberId !== 'all'
    ? stats.find(stat => stat.uid === selectedMemberId)
    : null;
  const summary = useMemo(() => {
    const periodAgo = now - period * 86_400_000;
    const openItems = issues.filter(issue => !doneSet.has(issue.columnId || issue.status));
    return {
      minutes: timeLogs
        .filter(log => effectiveTimeLogMillis(log) >= periodAgo)
        .reduce((sum, log) => sum + (Number(log.spentMinutes) || 0), 0),
      done: issues.filter(issue => (
        doneSet.has(issue.columnId || issue.status)
        && getCompletedAtMillis(issue) >= periodAgo
      )).length,
      open: openItems.length,
      overdue: openItems.filter(issue => {
        const due = parseDueDate(issue.dueDate);
        return due && due.getTime() < now;
      }).length,
    };
  }, [doneSet, issues, now, period, timeLogs]);

  if (members.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={Users}
          title="У команді ще немає учасників"
          description="Додайте людей до організації, щоб бачити їхню роботу, час і продуктивність."
        />
      </div>
    );
  }

  if (selectedMemberId !== 'all' && !selectedStat) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={Users}
          title="Учасника не знайдено"
          description="Можливо, він більше не входить до організації."
          action="Повернутися до команди"
          onAction={() => onSelectMember?.('all')}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {selectedStat ? (
        <MemberDetail
          key={selectedStat.uid}
          stat={selectedStat}
          members={members}
          positions={positions}
          projects={projects}
          statuses={statuses}
          events={events}
          period={period}
          onBack={() => onSelectMember?.('all')}
          standalone={standaloneDetail}
          filters={detailFilters}
        />
      ) : (
        <TeamOverview
          stats={stats}
          summary={summary}
          positions={positions}
          period={period}
          now={now}
          onSelectMember={onSelectMember}
        />
      )}
    </div>
  );
}
