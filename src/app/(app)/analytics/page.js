'use client';
// src/app/workspace/analytics/page.js — Workspace-wide analytics + invoices (admin/owner only)
// Огляд = швидкий стан воркспейсу; Продуктивність = тренди; Табель = час;
// Команда = навантаження; Рахунок = клієнтські рахунки. Всі контроли табу (період,
// тиждень/місяць, учасник, навігація) живуть в ОДНОМУ FilterBar під табами.
import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import {
  BarChart2, AlertTriangle, Clock, Folders, Users, Zap, Target, Receipt,
  ChevronLeft, ChevronRight, Plus,
} from 'lucide-react';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useWorkspaceAnalytics } from '@/lib/hooks/useWorkspaceAnalytics';
import { getCompletedAtMillis, useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import BillingTab from '@/components/workspace/BillingTab';
import TimesheetTab from '@/components/workspace/TimesheetTab';
import WorkloadTab from '@/components/workspace/WorkloadTab';
import VelocityTab from '@/components/workspace/VelocityTab';
import {
  BarList, Button, ChartCard, DataTable, EmptyState, ExportMenu, KpiCard, LoadingSpinner,
  Meter, PageHeader, Segmented, SignalList, Surface, TaskListCard,
} from '@/components/ui';
import { useLocalization } from '@/lib/hooks/useLocalization';
import { buildOverviewExport } from '@/lib/utils/analyticsExport.mjs';
import { Select, MultiSelect } from '@/components/ui/Select';
import FilterBar from '@/components/ui/FilterBar';
import { isDueDateOverdue } from '@/lib/utils/date';
import { organizationTimeZone } from '@/lib/utils/timeZone.mjs';
import { can } from '@/lib/utils/can';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { useCalendarEvents } from '@/lib/hooks/useCalendarEvents';
import { calendarEventOccurrenceKey } from '@/lib/utils/calendarEventNavigation.mjs';
import { usePublishLocalSearchResults } from '@/lib/hooks/usePublishLocalSearchResults';
import {
  effectiveTimeLogMillis,
  isCalendarEventTimeLog,
} from '@/lib/utils/timeLogDates.mjs';
import {
  filterTeamIssues,
  filterTeamTimeLogs,
  memberAnalyticsHref,
} from '@/lib/utils/teamAnalytics.mjs';
import { sumRawTimeLogMinutes } from '@/lib/utils/issueAccounting.mjs';
import { openBlockerIssues } from '@/lib/utils/issueExecution.mjs';
import {
  backlogStatusIds,
  inProgressStatusIds,
} from '@/lib/utils/statusCategories.mjs';
import { taskTypeSelectOption } from '@/lib/design/taskTypeIcons';
import { NO_PRIORITY_ID, prioritySelectOptions } from '@/lib/utils/priorities.mjs';
import { plural } from '@/lib/utils/plural.mjs';

// ── Helpers ─────────────────────────────────────────────────────────
function fmtH(min) {
  if (!min) return '0г';
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? (m > 0 ? `${h}г ${m}хв` : `${h}г`) : `${m}хв`;
}

function FilterDivider() {
  return <span className="w-[1px] h-[16px] bg-[#e3e3e3] mx-[2px] shrink-0" />;
}

// ── ОГЛЯД: стан воркспейсу «на зараз» ────────────────────────────────
// Детальні графіки активності/трендів живуть у «Продуктивності»,
// а навантаження по людях — у «Команді»; тут їх свідомо немає.
function AnalyticsContent({
  projects,
  issues,
  issueReferenceIssues,
  issueLinks,
  timeLogs,
  events,
  members,
  loading,
  period,
  onTabChange,
  onExportReady,
  selectedProjectIds = [],
}) {
  const { activeOrg } = useAppContext();
  const timeZone = organizationTimeZone(activeOrg);
  const { statuses, closedStatusIds, deliveredStatusIds } = useWorkflowConfig();
  // Closed answers "is there work left" — overdue, blockers, open counts.
  // Delivered answers "was anything produced" — completion, velocity. They are
  // the same set of statuses today and stay two questions, because a caller
  // that asks the wrong one is a bug nobody sees until the numbers are read.
  const closedSet = useMemo(() => new Set(closedStatusIds), [closedStatusIds]);
  const deliveredSet = useMemo(() => new Set(deliveredStatusIds), [deliveredStatusIds]);
  // Work still in the backlog is not expected to carry an estimate. That used to
  // be read as "the first status in the list", which is a position, not a
  // meaning — and it missed every other backlog column an org had added.
  const backlogSet = useMemo(() => new Set(backlogStatusIds(statuses)), [statuses]);
  // «У роботі» is a category, never the literal id 'in-progress': an org that
  // renamed or split that column used to report zero here.
  const inProgressSet = useMemo(() => new Set(inProgressStatusIds(statuses)), [statuses]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const calendarStats = useMemo(() => {
    const periodStart = now - period * 24 * 3600 * 1000;
    const periodEnd = now + period * 24 * 3600 * 1000;
    const completedWindow = events.filter(event => {
      const start = new Date(event.startAt).getTime();
      return Number.isFinite(start) && start >= periodStart && start <= now;
    });
    const durationMinutes = event => Math.max(
      0,
      (new Date(event.endAt).getTime() - new Date(event.startAt).getTime()) / 60_000,
    );
    return {
      upcoming: events.filter(event => {
        const start = new Date(event.startAt).getTime();
        return event.type !== 'birthday' && start >= now && start <= periodEnd;
      }).length,
      meetings: completedWindow.filter(event => event.type === 'meeting').length,
      meetingMinutes: completedWindow
        .filter(event => event.type === 'meeting')
        .reduce((sum, event) => sum + durationMinutes(event), 0),
      focusMinutes: completedWindow
        .filter(event => event.type === 'focus')
        .reduce((sum, event) => sum + durationMinutes(event), 0),
      notes: events.filter(event =>
        event.type === 'note' &&
        new Date(event.startAt).getTime() >= periodStart &&
        new Date(event.startAt).getTime() <= periodEnd).length,
    };
  }, [events, now, period]);

  // The shape behind the headline figure. A tile that says "18 closed" and a
  // tile that says "18 closed, and it was 3 all of last week" are different
  // facts, and the row only ever showed the first.
  const closedTrend = useMemo(() => {
    const buckets = Math.min(Math.max(Math.round(period / 3), 6), 14);
    const span = (period * 86_400_000) / buckets;
    const start = now - period * 86_400_000;
    return Array.from({ length: buckets }, (_, index) => {
      const from = start + index * span;
      const to = from + span;
      return issues.filter(issue => {
        if (!deliveredSet.has(issue.columnId || issue.status)) return false;
        const at = getCompletedAtMillis(issue);
        return at >= from && at < to;
      }).length;
    });
  }, [deliveredSet, issues, now, period]);

  const stats = useMemo(() => {
    const periodAgo = now - period * 24 * 3600 * 1000;

    const total      = issues.length;
    const done       = issues.filter(i => deliveredSet.has(i.columnId || i.status)).length;
    const inProgress = issues.filter(i => inProgressSet.has(i.columnId || i.status)).length;
    const blockerPriority = issues.filter(i => (
      i.priority === 'blocker'
      && !closedSet.has(i.columnId || i.status)
    )).length;
    const dependencyBlocked = issues.filter(i => (
      !closedSet.has(i.columnId || i.status)
      && openBlockerIssues(
        i.id,
        issueReferenceIssues,
        issueLinks,
        closedSet,
      ).length > 0
    )).length;

    const overdue = issues.filter(i => (
      isDueDateOverdue(i.dueDate, { now, timeZone })
      && !closedSet.has(i.columnId || i.status)
    ));

    const recentDone = issues.filter(i => {
      if (!deliveredSet.has(i.columnId || i.status)) return false;
      const t = getCompletedAtMillis(i);
      return t > periodAgo;
    }).length;

    const periodLogs = timeLogs.filter(log => effectiveTimeLogMillis(log) >= periodAgo);
    const periodMin = sumRawTimeLogMinutes(periodLogs);

    const byProject = projects.map(p => {
      const pIssues  = issues.filter(i => i.projectId === p.id);
      const pDone    = pIssues.filter(i => deliveredSet.has(i.columnId || i.status)).length;
      const pOpen    = pIssues.filter(i => !closedSet.has(i.columnId || i.status)).length;
      const pOverdue = pIssues.filter(i => (
        isDueDateOverdue(i.dueDate, { now, timeZone })
        && !closedSet.has(i.columnId || i.status)
      )).length;
      const pMin = sumRawTimeLogMinutes(periodLogs.filter(l => l.projectId === p.id));
      const pPct = pIssues.length > 0 ? Math.round((pDone / pIssues.length) * 100) : 0;
      return { p, total: pIssues.length, done: pDone, open: pOpen, overdue: pOverdue, minutes: pMin, pct: pPct };
    }).sort((a, b) => b.total - a.total);

    const byStatus = (statuses || []).map(({ id, label, color }) => ({
      id, label, color, count: issues.filter(i => i.columnId === id).length,
    })).filter(s => s.count > 0);

    const noAssignee  = issues.filter(i => !i.assigneeIds?.length && !closedSet.has(i.columnId || i.status)).length;
    const unestimated = issues.filter(i => !i.estimateMinutes && !backlogSet.has(i.columnId || i.status) && !closedSet.has(i.columnId || i.status)).length;

    return {
      total, done, inProgress, blockerPriority, dependencyBlocked, overdue, recentDone, periodMin,
      byProject, byStatus, noAssignee, unestimated,
      completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [
    closedSet,
    deliveredSet,
    backlogSet,
    inProgressSet,
    issueLinks,
    issueReferenceIssues,
    issues,
    now,
    timeZone,
    period,
    projects,
    statuses,
    timeLogs,
  ]);

  // Where the period's time actually went. Four calendar tiles used to sit here
  // as a second KPI row — a dashboard of counts that answered nothing anybody
  // asks about a calendar. This is one question with one answer.
  //
  // Read above the early returns because the export is built from it, and the
  // export has to be registered by every render, not only the ones that draw a
  // chart.
  const timeSplit = useMemo(() => [
    { id: 'tasks', label: 'Завдання', value: Math.max(0, Math.round(stats.periodMin - calendarStats.meetingMinutes - calendarStats.focusMinutes)) },
    { id: 'meetings', label: 'Мітинги', value: Math.round(calendarStats.meetingMinutes), color: 'var(--color-chart-2)', meta: `${calendarStats.meetings} ${plural(calendarStats.meetings, ['подія', 'події', 'подій'])}` },
    { id: 'focus', label: 'Фокус-час', value: Math.round(calendarStats.focusMinutes), color: 'var(--color-chart-3)' },
  ].filter(row => row.value > 0), [calendarStats, stats.periodMin]);

  // The file is this screen, so it is offered only once the screen has one.
  const buildExport = useCallback(() => buildOverviewExport({
    stats,
    timeSplit,
    period,
    projects,
    selectedProjectIds,
  }), [period, projects, selectedProjectIds, stats, timeSplit]);
  useEffect(() => {
    onExportReady?.(loading ? null : buildExport);
    return () => onExportReady?.(null);
  }, [buildExport, loading, onExportReady]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (stats.total === 0 && stats.periodMin === 0 && events.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <EmptyState
          icon={BarChart2}
          title="Даних ще немає"
          description="Аналітика з’явиться після створення завдань, подій або записів часу"
        />
      </div>
    );
  }

  // The workspace's attention list, ordered by how much each thing matters.
  // This was two stacks of `Alert` — a component built to interrupt — so five
  // findings arrived as five banners in four colours on the calmest screen in
  // the product. None of them interrupt anything; they are a reading.
  const signals = [
    stats.dependencyBlocked > 0 && {
      id: 'blocked',
      tone: 'critical',
      count: stats.dependencyBlocked,
      title: `${plural(stats.dependencyBlocked, ['Завдання заблоковане', 'Завдання заблоковані', 'Завдань заблоковано'])} залежностями`,
      description: 'Їх стримують незавершені задачі',
    },
    stats.overdue.length > 0 && {
      id: 'overdue',
      tone: 'critical',
      count: stats.overdue.length,
      title: 'Прострочені завдання',
      description: 'Дедлайн минув, робота відкрита',
    },
    stats.blockerPriority > 0 && {
      id: 'blocker-priority',
      tone: 'warning',
      count: stats.blockerPriority,
      title: 'Критичний пріоритет',
      description: 'Потребують негайної уваги',
    },
    stats.noAssignee > 0 && {
      id: 'no-assignee',
      tone: 'warning',
      count: stats.noAssignee,
      title: 'Без виконавця',
      description: 'Ніхто не відповідає за результат',
    },
    stats.unestimated > 0 && {
      id: 'unestimated',
      tone: 'info',
      count: stats.unestimated,
      title: 'Без оцінки',
      description: 'Поза беклогом, але без плану за часом',
    },
  ].filter(Boolean);

  return (
    <div className="flex-1 overflow-y-auto bg-transparent">
      <div className="flex w-full flex-col gap-4 pb-16">

        {/* KPI */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard icon={Target} label="Задачі"
            value={`${stats.done} / ${stats.total}`} sub={`${stats.completionPct}% виконано`} />
          <KpiCard icon={Zap} label={`Закрито за ${period} ${plural(period, ['день', 'дні', 'днів'])}`} onClick={() => onTabChange('velocity')}
            value={stats.recentDone} series={closedTrend} sub="тренди — у Продуктивності" />
          <KpiCard icon={Clock} label={`Зафіксовано часу за ${period} ${plural(period, ['день', 'дні', 'днів'])}`} onClick={() => onTabChange('timesheet')}
            value={fmtH(stats.periodMin)} sub="деталі — у Табелі" />
          <KpiCard icon={AlertTriangle} label="Прострочено"
            value={stats.overdue.length} sub={stats.overdue.length > 0 ? 'потребують уваги' : 'усе вчасно'} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard icon={BarChart2} title="По статусах">
            <BarList
              items={stats.byStatus.map(status => ({
                id: status.id,
                label: status.label,
                value: status.count,
                // The status owns this colour: it is configured per workspace
                // and is the same swatch on the board, in the list and here.
                color: status.color,
              }))}
              emptyText="Задач немає"
            />
          </ChartCard>

          <ChartCard
            icon={Clock}
            title={`Куди пішов час · ${period} ${plural(period, ['день', 'дні', 'днів'])}`}
            meta={fmtH(stats.periodMin)}
          >
            <BarList
              scale="total"
              items={timeSplit}
              format={fmtH}
              emptyText="За період час не списували"
            />
            <p className="mt-4 border-t border-[color:var(--color-chart-grid)] pt-3 text-[11px] leading-relaxed text-muted">
              Попереду {calendarStats.upcoming} {plural(calendarStats.upcoming, ['подія', 'події', 'подій'])} на найближчі {period} {plural(period, ['день', 'дні', 'днів'])}
              {calendarStats.notes > 0 ? ` · ${calendarStats.notes} ${plural(calendarStats.notes, ['нотатка', 'нотатки', 'нотаток'])} у календарі` : ''}
            </p>
          </ChartCard>

          <ChartCard icon={AlertTriangle} title="Що потребує уваги">
            <SignalList signals={signals} emptyText="Нічого термінового — усе під контролем" />
          </ChartCard>
        </div>

        <ChartCard icon={Folders} title="По проєктах" count={stats.byProject.length}>
          {/* «Внутрішній / Клієнтський» is gone. Client collaboration lives in
              QuickTeam+, not in the internal workspace, so every project in this
              table was "Внутрішній" — a column that answered a question nobody
              could ask, left over from a model the product no longer has. */}
          <DataTable
            rows={stats.byProject}
            rowKey={row => row.p.id}
            rowHref={row => `/${row.p.id}`}
            emptyText="Проєктів немає"
            columns={[
              {
                id: 'project',
                header: 'Проєкт',
                lead: true,
                cell: row => <span className="block truncate text-[13px] font-semibold text-ink">{row.p.name}</span>,
              },
              { id: 'total', header: 'Задач', align: 'right', width: '92px', cell: row => <span className="ui-type-figure text-ink">{row.total}</span> },
              {
                id: 'progress',
                header: 'Прогрес',
                width: '180px',
                // A bar needs a width to be a bar: stacked on a phone it takes
                // the row rather than half of one.
                wide: true,
                cell: row => <Meter value={row.pct / 100} reading={`${row.pct}%`} height={6} />,
              },
              { id: 'open', header: 'Відкрито', align: 'right', width: '96px', cell: row => <span className="ui-type-figure text-ink">{row.open}</span> },
              {
                id: 'overdue',
                header: 'Прострочено',
                align: 'right',
                width: '112px',
                cell: row => (row.overdue > 0
                  ? <span className="ui-type-figure text-[#ef4444]">{row.overdue}</span>
                  : <span className="ui-type-figure text-faint">—</span>),
              },
              { id: 'time', header: `Час · ${period}д`, align: 'right', width: '110px', cell: row => <span className="ui-type-figure text-muted">{fmtH(row.minutes)}</span> },
            ]}
          />
        </ChartCard>

        {stats.overdue.length > 0 && (
          <TaskListCard
            title="Прострочені"
            icon={AlertTriangle}
            issues={stats.overdue}
            allIssues={issueReferenceIssues}
            members={members}
            projects={projects}
          />
        )}
      </div>
    </div>
  );
}

// ── PAGE ─────────────────────────────────────────────────────────────
export default function WorkspaceAnalyticsPage() {
  const router = useRouter();
  const { activeOrg, projects = [], orgRole, currentUser } = useAppContext();
  const activeProjects = useMemo(
    () => projects.filter(project => project.status !== 'archived'),
    [projects],
  );
  const analyticsSearch = useWorkspaceStore(state => state.analyticsSearch);
  const [activeTab, setActiveTab] = useState('overview');

  // Through the matrix, not beside it: a hand-rolled role comparison is how the
  // documented permission and the shipped one drift apart.
  const canSeeBilling = can(orgRole, 'manage:finance');
  // Minutes are not money. Every record behind this table is already readable
  // by anyone on the project — the worklog is part of the task, exactly as in
  // Jira — so hiding the member selector never protected anything; it only made
  // the screen disagree with `firestore.rules`. What stays behind
  // `manage:finance` is money: rates, invoices and the «Рахунок» tab.
  const canSeeTeamTimesheet = true;

  const { members } = useOrganization();
  const { priorities, types } = useWorkflowConfig();

  // A date in the file follows the organization's timezone and the reader's own
  // date format. The two settings are separate on purpose: which day a record
  // belongs to is a fact about the workspace — it is how this screen already
  // buckets everything — while how that day is written is a preference of
  // whoever opens the file. Reading the day in the browser's zone instead would
  // move records across midnight and make the file disagree with the screen
  // above it.
  const { formatDate } = useLocalization();
  const exportTimeZone = organizationTimeZone(activeOrg);
  const formatExportDate = value => formatDate(value, { timeZone: exportTimeZone });

  // The active tab registers what it is currently showing, and the one button
  // in the header writes it out. A ref rather than state: the tab republishes
  // on every render, and a re-render of the page for that would be a loop.
  const exportBuilderRef = useRef(null);
  const registerExport = useCallback(builder => {
    exportBuilderRef.current = builder;
  }, []);
  const buildActiveExport = useCallback(() => exportBuilderRef.current?.() || null, []);
  const exportMenu = <ExportMenu build={buildActiveExport} className="ml-auto max-md:hidden" />;

  const {
    issues,
    allIssues,
    timeLogs,
    issueLinks,
    loading,
  } = useWorkspaceAnalytics(activeProjects.map(project => project.id));
  const { events: calendarEvents, loading: calendarLoading } = useCalendarEvents();

  // Shared filters (one FilterBar under the tabs; each tab adds its own controls)
  const [projectFilters, setProjectFilters] = useState([]);
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [period, setPeriod] = useState(30);
  const [teamMemberFilter, setTeamMemberFilter] = useState('all');

  // Табель state
  const selfUid = currentUser?.uid || currentUser?.id;
  const [tsMember, setTsMember] = useState(null); // null → default below
  const [tsMode, setTsMode] = useState('week');
  const [tsAnchor, setTsAnchor] = useState(() => new Date());
  const [tsLogOpen, setTsLogOpen] = useState(false);
  const effectiveTsMember = tsMember ?? (canSeeTeamTimesheet ? 'all' : selfUid);

  const shiftAnchor = dir => {
    setTsAnchor(prev => {
      const d = new Date(prev);
      if (tsMode === 'week') d.setDate(d.getDate() + dir * 7);
      else d.setMonth(d.getMonth() + dir);
      return d;
    });
  };
  const selectTeamMember = memberId => {
    if (memberId !== 'all') {
      router.push(memberAnalyticsHref(memberId));
      return;
    }
    setTeamMemberFilter(memberId);
    setAssigneeFilter(memberId);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (memberId === 'all') url.searchParams.delete('teamMember');
      else url.searchParams.set('teamMember', memberId);
      url.searchParams.set('tab', 'workload');
      window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const member = searchParams.get('teamMember');
      if (member) {
        router.replace(memberAnalyticsHref(member));
        return;
      }
      const tab = searchParams.get('tab');
      if (tab) queueMicrotask(() => setActiveTab(tab));
      else if (member) queueMicrotask(() => setActiveTab('workload'));
    }
  }, [router]);

  const searchQuery = analyticsSearch.trim().toLocaleLowerCase('uk-UA');
  const searchMatchedProjectIds = useMemo(() => new Set(
    activeProjects
      .filter(project => `${project.name || ''} ${project.description || ''}`.toLocaleLowerCase('uk-UA').includes(searchQuery))
      .map(project => project.id)
  ), [activeProjects, searchQuery]);

  // Two readings of the same filter. The screens that count open work use the
  // working set; the timesheet and the invoice describe work already done, and
  // an archived task still has to say which task those hours were.
  const filterIssue = useCallback(i => {
      if (searchQuery) {
        const issueText = `${i.issueKey || ''} ${i.title || ''} ${i.description || ''}`.toLocaleLowerCase('uk-UA');
        if (!issueText.includes(searchQuery) && !searchMatchedProjectIds.has(i.projectId)) return false;
      }
      if (projectFilters.length > 0 && !projectFilters.includes(i.projectId)) return false;
      if (assigneeFilter !== 'all') {
        if (assigneeFilter === 'unassigned') {
          if (i.assigneeIds && i.assigneeIds.length > 0) return false;
        } else {
          if (!i.assigneeIds || !i.assigneeIds.includes(assigneeFilter)) return false;
        }
      }
      if (priorityFilter !== 'all' && (i.priority || NO_PRIORITY_ID) !== priorityFilter) return false;
      if (typeFilter !== 'all' && i.type !== typeFilter) return false;
      return true;
  }, [searchQuery, searchMatchedProjectIds, projectFilters, assigneeFilter, priorityFilter, typeFilter]);
  const filteredIssues = useMemo(() => issues.filter(filterIssue), [issues, filterIssue]);
  const filteredIssuesWithArchived = useMemo(
    () => allIssues.filter(filterIssue),
    [allIssues, filterIssue],
  );
  usePublishLocalSearchResults(analyticsSearch, filteredIssues.length);

  const visibleProjects = useMemo(() => {
    if (!searchQuery) return activeProjects;
    const issueProjectIds = new Set(filteredIssues.map(issue => issue.projectId));
    return activeProjects.filter(project => searchMatchedProjectIds.has(project.id) || issueProjectIds.has(project.id));
  }, [activeProjects, filteredIssues, searchMatchedProjectIds, searchQuery]);

  const filteredIssueIds = useMemo(() => new Set(filteredIssues.map(i => i.id)), [filteredIssues]);
  const calendarEventsByKey = useMemo(() => {
    const map = new Map();
    calendarEvents.forEach(event => {
      map.set(
        calendarEventOccurrenceKey(event.sourceEventId || event.id, event.startAt),
        event,
      );
    });
    return map;
  }, [calendarEvents]);

  const filteredTimeLogs = useMemo(() => {
    return timeLogs.filter(log => {
      if (projectFilters.length > 0 && !projectFilters.includes(log.projectId)) return false;
      if (isCalendarEventTimeLog(log)) {
        if (assigneeFilter === 'unassigned') return false;
        if (assigneeFilter !== 'all' && log.userId !== assigneeFilter) return false;
        if (priorityFilter !== 'all' || typeFilter !== 'all') return false;
        if (searchQuery) {
          const event = calendarEventsByKey.get(
            calendarEventOccurrenceKey(log.eventId, log.occurrenceStartAt),
          );
          const project = activeProjects.find(item => item.id === log.projectId);
          const eventText = `${event?.title || ''} ${event?.description || ''} ${event?.location || ''} ${project?.name || ''}`
            .toLocaleLowerCase('uk-UA');
          if (!eventText.includes(searchQuery)) return false;
        }
        return true;
      }
      if (searchQuery || assigneeFilter !== 'all' || priorityFilter !== 'all' || typeFilter !== 'all') {
        if (!filteredIssueIds.has(log.issueId)) return false;
      }
      return true;
    });
  }, [
    assigneeFilter,
    calendarEventsByKey,
    filteredIssueIds,
    priorityFilter,
    projectFilters,
    activeProjects,
    searchQuery,
    timeLogs,
    typeFilter,
  ]);

  // Табель фільтрується лише по проєктах — вимір «хто» задає селектор учасника
  const projectScopedTimeLogs = useMemo(
    () => timeLogs.filter(log => (
      projectFilters.length === 0 || projectFilters.includes(log.projectId)
    )),
    [projectFilters, timeLogs]
  );
  const teamIssues = useMemo(
    () => filterTeamIssues(issues, projectFilters, teamMemberFilter),
    [issues, projectFilters, teamMemberFilter],
  );
  const teamScopedIssues = useMemo(
    () => issues.filter(issue => (
      projectFilters.length === 0 || projectFilters.includes(issue.projectId)
    )),
    [issues, projectFilters],
  );
  const teamTimeLogs = useMemo(
    () => filterTeamTimeLogs(timeLogs, projectFilters, teamMemberFilter),
    [projectFilters, teamMemberFilter, timeLogs],
  );

  const TABS = [
    { id: 'overview', label: 'Огляд', icon: BarChart2 },
    { id: 'timesheet', label: 'Табель', icon: Clock },
    { id: 'velocity', label: 'Продуктивність', icon: Zap },
    { id: 'workload', label: 'Команда', icon: Users },
    ...(canSeeBilling ? [{ id: 'billing', label: 'Рахунок', icon: Receipt }] : []),
  ];

  // Рахунок — один конкретний проєкт
  const [billingProjectId, setBillingProjectId] = useState('');
  const billingProject = activeProjects.find(project => project.id === billingProjectId) || activeProjects[0];
  // Archived included on purpose: an hour recorded against a task somebody
  // later put aside is still an hour that was worked, and leaving it out would
  // quietly bill the client for less than was done.
  const billingIssues = allIssues.filter(i => i.projectId === billingProject?.id);

  const periodOptions = [7, 14, 30, 90].map(d => ({ value: d, label: `${d}д` }));

  return (
    <div className="qt-nav-scroll flex-1 h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-transparent">
      <div className="workspace-page-layout min-h-full pb-[120px]">

        <PageHeader
          title="Аналітика"
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          mobileActions={
            activeTab === 'timesheet' ? (
              <Button style="primary" size="icon-lg" icon={Plus} onClick={() => setTsLogOpen(true)} title="Зафіксувати час" />
            ) : null
          }
          filters={
            activeTab === 'billing' ? (
              <FilterBar>
                <Select
                  filterRole="project"
                  value={billingProject?.id || ''}
                  onChange={setBillingProjectId}
                  options={activeProjects.map(project => ({ value: project.id, label: project.name }))}
                  variant="ghost"
                />
              </FilterBar>
            ) : activeTab === 'timesheet' ? (
              <>
                <FilterBar>
                  {canSeeTeamTimesheet && (
                    <Select
                      filterRole="member"
                      value={effectiveTsMember}
                      onChange={setTsMember}
                      options={[
                        { value: 'all', label: 'Вся команда' },
                        ...members.map(m => ({ value: m.id || m.uid, label: m.name || m.email, user: m })),
                      ]}
                      variant="ghost"
                    />
                  )}
                  <MultiSelect
                    value={projectFilters}
                    onChange={setProjectFilters}
                    options={activeProjects.map(project => ({ value: project.id, label: project.name }))}
                    placeholder="Всі проєкти"
                    searchPlaceholder="Пошук проєкту..."
                    filterRole="project"
                    variant="ghost"
                  />
                  {/* Період — не фільтр, а нижче md рядок фільтрів цілком їде
                      в модалку. Тиждень гортається власним рядком під шапкою. */}
                  <span className="contents max-md:hidden">
                    <FilterDivider />
                    <Segmented
                      value={tsMode}
                      onChange={setTsMode}
                      options={[{ value: 'week', label: 'Тиждень' }, { value: 'month', label: 'Місяць' }]}
                    />
                    <FilterDivider />
                    <Button style="ghost" size="icon-sm" icon={ChevronLeft} onClick={() => shiftAnchor(-1)} aria-label="Попередній період" />
                    <Button style="ghost" size="sm" onClick={() => setTsAnchor(new Date())}>Сьогодні</Button>
                    <Button style="ghost" size="icon-sm" icon={ChevronRight} onClick={() => shiftAnchor(1)} aria-label="Наступний період" />
                  </span>
                </FilterBar>
                {exportMenu}
                <Button style="primary" size="lg" icon={Plus} onClick={() => setTsLogOpen(true)} className="max-md:hidden">
                  Зафіксувати час
                </Button>
              </>
            ) : activeTab === 'workload' ? (
              <>
              <FilterBar>
                <MultiSelect
                  value={projectFilters}
                  onChange={setProjectFilters}
                  options={activeProjects.map(project => ({ value: project.id, label: project.name }))}
                  placeholder="Всі проєкти"
                  searchPlaceholder="Пошук проєкту..."
                  filterRole="project"
                  variant="ghost"
                />
                <Select
                  filterRole="member"
                  value={teamMemberFilter}
                  onChange={selectTeamMember}
                  options={[
                    { value: 'all', label: 'Вся команда' },
                    ...members.map(member => ({
                      value: member.id || member.uid,
                      label: member.name || member.email,
                      user: member,
                    })),
                  ]}
                  variant="ghost"
                />
                <FilterDivider />
                <Segmented value={period} onChange={setPeriod} options={periodOptions} />
              </FilterBar>
              {exportMenu}
              </>
            ) : (
              <>
              <FilterBar>
                <MultiSelect
                  value={projectFilters}
                  onChange={setProjectFilters}
                  options={activeProjects.map(project => ({ value: project.id, label: project.name }))}
                  placeholder="Всі проєкти"
                  searchPlaceholder="Пошук проєкту..."
                  filterRole="project"
                  variant="ghost"
                />
                <Select
                  filterRole="member"
                  value={assigneeFilter}
                  onChange={setAssigneeFilter}
                  options={[
                    { value: 'all', label: 'Всі виконавці' },
                    { value: 'unassigned', label: 'Без виконавця' },
                    ...members.map(m => ({ value: m.id || m.uid, label: m.name || m.email, user: m }))
                  ]}
                  variant="ghost"
                />
                <Select
                  filterRole="priority"
                  value={priorityFilter}
                  onChange={setPriorityFilter}
                  options={[
                    { value: 'all', label: 'Всі пріоритети' },
                    ...prioritySelectOptions(priorities),
                  ]}
                  variant="ghost"
                />
                <Select
                  filterRole="type"
                  value={typeFilter}
                  onChange={setTypeFilter}
                  options={[
                    { value: 'all', label: 'Всі типи' },
                    ...types.map(taskTypeSelectOption),
                  ]}
                  variant="ghost"
                />
                <FilterDivider />
                <Segmented value={period} onChange={setPeriod} options={periodOptions} />
              </FilterBar>
              {exportMenu}
              </>
            )
          }
        />

        {/* Тиждень/місяць і сам період, на телефоні. */}
        {activeTab === 'timesheet' && (
          <div className="mb-[12px] flex items-center gap-[8px] md:hidden">
            <Button style="secondary" size="icon" icon={ChevronLeft} onClick={() => shiftAnchor(-1)} aria-label="Попередній період" />
            <Segmented
              className="min-w-0 flex-1"
              value={tsMode}
              onChange={setTsMode}
              options={[{ value: 'week', label: 'Тиждень' }, { value: 'month', label: 'Місяць' }]}
            />
            <Button style="secondary" size="sm" onClick={() => setTsAnchor(new Date())}>Сьогодні</Button>
            <Button style="secondary" size="icon" icon={ChevronRight} onClick={() => shiftAnchor(1)} aria-label="Наступний період" />
          </div>
        )}

        {/* Content — сіра панель з відступами і скругленнями, як на сторінці
            проєктів; на ній білі картки без обводок */}
        <Surface preset="panel" padding="lg" composition="chart-panel" className="flex-1 flex flex-col">
        {activeTab === 'overview' && (
          <AnalyticsContent
            projects={visibleProjects}
            issues={filteredIssues}
            issueReferenceIssues={issues}
            issueLinks={issueLinks}
            timeLogs={filteredTimeLogs}
            events={calendarEvents}
            members={members}
            loading={loading || calendarLoading}
            period={period}
            onTabChange={setActiveTab}
            onExportReady={registerExport}
            selectedProjectIds={projectFilters}
          />
        )}

        {activeTab === 'timesheet' && (
          <TimesheetTab
            issues={filteredIssuesWithArchived}
            events={calendarEvents}
            timeLogs={projectScopedTimeLogs}
            members={members}
            projects={visibleProjects}
            member={effectiveTsMember}
            mode={tsMode}
            anchor={tsAnchor}
            onSelectMember={uid => setTsMember(uid)}
            onSelectDay={d => { setTsAnchor(d); setTsMode('week'); }}
            logModalOpen={tsLogOpen}
            onCloseLogModal={() => setTsLogOpen(false)}
            onExportReady={registerExport}
            formatDate={formatExportDate}
          />
        )}

        {activeTab === 'velocity' && (
          <VelocityTab
            issues={filteredIssues}
            projects={visibleProjects}
            members={members}
            period={period}
            onExportReady={registerExport}
            selectedProjectIds={projectFilters}
            formatDate={formatExportDate}
          />
        )}

        {activeTab === 'workload' && (
          <WorkloadTab
            members={members}
            issues={teamIssues}
            scopedIssues={teamScopedIssues}
            logIssues={filteredIssuesWithArchived}
            timeLogs={teamTimeLogs}
            events={calendarEvents}
            projects={activeProjects}
            period={period}
            selectedMemberId={teamMemberFilter}
            onSelectMember={selectTeamMember}
            onExportReady={registerExport}
            selectedProjectIds={projectFilters}
            formatDate={formatExportDate}
          />
        )}

        {activeTab === 'billing' && canSeeBilling && (
          <BillingTab
            issues={billingIssues}
            events={calendarEvents}
            members={members}
            project={billingProject}
            projectId={billingProject?.id}
          />
        )}
        </Surface>
      </div>
    </div>
  );
}
