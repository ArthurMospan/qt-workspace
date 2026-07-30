'use client';
// src/app/workspace/analytics/page.js — Workspace-wide analytics + invoices (admin/owner only)
// Огляд = швидкий стан воркспейсу; Продуктивність = тренди; Табель = час;
// Команда = навантаження; Рахунок = клієнтські рахунки. Всі контроли табу (період,
// тиждень/місяць, учасник, навігація) живуть в ОДНОМУ FilterBar під табами.
import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import Link from 'next/link';
import {
  BarChart2, AlertTriangle, CalendarDays, Clock, Users, Zap, Target, Receipt, ArrowRight,
  ChevronLeft, ChevronRight, Plus, StickyNote, Video,
} from 'lucide-react';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useWorkspaceAnalytics } from '@/lib/hooks/useWorkspaceAnalytics';
import { getCompletedAtMillis, useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import BillingTab from '@/components/workspace/BillingTab';
import TimesheetTab from '@/components/workspace/TimesheetTab';
import WorkloadTab from '@/components/workspace/WorkloadTab';
import VelocityTab from '@/components/workspace/VelocityTab';
import {
  Button, LoadingSpinner, EmptyState, Alert, Card, PageHeader, KpiCard, Segmented, Surface,
} from '@/components/ui';
import { Select, MultiSelect } from '@/components/ui/Select';
import FilterBar from '@/components/ui/FilterBar';
import { parseDueDate } from '@/lib/utils/date';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { useCalendarEvents } from '@/lib/hooks/useCalendarEvents';
import { calendarEventOccurrenceKey } from '@/lib/utils/calendarEventNavigation.mjs';
import {
  effectiveTimeLogMillis,
  isCalendarEventTimeLog,
} from '@/lib/utils/timeLogDates.mjs';
import {
  filterTeamIssues,
  filterTeamTimeLogs,
  memberAnalyticsHref,
} from '@/lib/utils/teamAnalytics.mjs';
import TaskRow from '@/components/ui/TaskManagement/TaskRow';
import {
  selectActionableIssues,
  sumRawTimeLogMinutes,
} from '@/lib/utils/issueAccounting.mjs';
import { openBlockerIssues } from '@/lib/utils/issueExecution.mjs';

// ── Helpers ─────────────────────────────────────────────────────────
function fmtH(min) {
  if (!min) return '0г';
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? (m > 0 ? `${h}г ${m}хв` : `${h}г`) : `${m}хв`;
}

function SectionTitle({ children }) {
  return <h2 className="ui-type-eyebrow text-muted uppercase tracking-wider mb-3">{children}</h2>;
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
}) {
  const { statuses, doneStatusIds } = useWorkflowConfig();
  const doneSet = useMemo(() => new Set(doneStatusIds), [doneStatusIds]);
  const firstStatusId = statuses?.[0]?.id;
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

  const stats = useMemo(() => {
    const periodAgo = now - period * 24 * 3600 * 1000;

    const total      = issues.length;
    const done       = issues.filter(i => doneSet.has(i.columnId || i.status)).length;
    const inProgress = issues.filter(i => i.columnId === 'in-progress').length;
    const blockerPriority = issues.filter(i => (
      i.priority === 'blocker'
      && !doneSet.has(i.columnId || i.status)
    )).length;
    const dependencyBlocked = issues.filter(i => (
      !doneSet.has(i.columnId || i.status)
      && openBlockerIssues(
        i.id,
        issueReferenceIssues,
        issueLinks,
        doneSet,
      ).length > 0
    )).length;

    const overdue = issues.filter(i => {
      const due = parseDueDate(i.dueDate);
      return due && due.getTime() < now && !doneSet.has(i.columnId || i.status);
    });

    const recentDone = issues.filter(i => {
      if (!doneSet.has(i.columnId || i.status)) return false;
      const t = getCompletedAtMillis(i);
      return t > periodAgo;
    }).length;

    const periodLogs = timeLogs.filter(log => effectiveTimeLogMillis(log) >= periodAgo);
    const periodMin = sumRawTimeLogMinutes(periodLogs);

    const byProject = projects.map(p => {
      const pIssues  = issues.filter(i => i.projectId === p.id);
      const pDone    = pIssues.filter(i => doneSet.has(i.columnId || i.status)).length;
      const pOpen    = pIssues.filter(i => !doneSet.has(i.columnId || i.status)).length;
      const pOverdue = pIssues.filter(i => {
        const due = parseDueDate(i.dueDate);
        return due && due.getTime() < now && !doneSet.has(i.columnId || i.status);
      }).length;
      const pMin = sumRawTimeLogMinutes(periodLogs.filter(l => l.projectId === p.id));
      const pPct = pIssues.length > 0 ? Math.round((pDone / pIssues.length) * 100) : 0;
      return { p, total: pIssues.length, done: pDone, open: pOpen, overdue: pOverdue, minutes: pMin, pct: pPct };
    }).sort((a, b) => b.total - a.total);

    const byStatus = (statuses || []).map(({ id, label, color }) => ({
      id, label, color, count: issues.filter(i => i.columnId === id).length,
    })).filter(s => s.count > 0);
    const maxStatus = Math.max(...byStatus.map(s => s.count), 1);

    const noAssignee  = issues.filter(i => !i.assigneeIds?.length && !doneSet.has(i.columnId || i.status)).length;
    const unestimated = issues.filter(i => !i.estimateMinutes && (i.columnId || i.status) !== firstStatusId && !doneSet.has(i.columnId || i.status)).length;

    return {
      total, done, inProgress, blockerPriority, dependencyBlocked, overdue, recentDone, periodMin,
      byProject, byStatus, maxStatus, noAssignee, unestimated,
      completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [
    doneSet,
    firstStatusId,
    issueLinks,
    issueReferenceIssues,
    issues,
    now,
    period,
    projects,
    statuses,
    timeLogs,
  ]);

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

  return (
    <div className="flex-1 overflow-y-auto bg-transparent">
      <div className="w-full pb-16">

        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard icon={Target} label="Всі завдання"
            value={`${stats.done} / ${stats.total}`} sub={`${stats.completionPct}% виконано`} />
          <KpiCard icon={Zap} label={`Закрито за ${period}д`} onClick={() => onTabChange('velocity')}
            value={stats.recentDone} sub="тренди — у Продуктивності" />
          <KpiCard icon={Clock} label={`Списано часу · ${period}д`} onClick={() => onTabChange('timesheet')}
            value={fmtH(stats.periodMin)} sub="деталі — у Табелі" />
          <KpiCard icon={AlertTriangle} label="Прострочено"
            value={stats.overdue.length} sub={stats.overdue.length > 0 ? 'потребують уваги' : 'все вчасно'} />
        </div>

        <SectionTitle>Календар · {period} днів</SectionTitle>
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard icon={CalendarDays} label="Заплановано"
            value={calendarStats.upcoming} sub={`наступні ${period} днів`} />
          <KpiCard icon={Video} label="Мітинги"
            value={calendarStats.meetings} sub={`${fmtH(Math.round(calendarStats.meetingMinutes))} за період`} />
          <KpiCard icon={Clock} label="Фокус-час"
            value={fmtH(Math.round(calendarStats.focusMinutes))} sub={`за останні ${period} днів`} />
          <KpiCard icon={StickyNote} label="Нотатки"
            value={calendarStats.notes} sub="у видимому календарі" />
        </div>

        {/* Statuses + Projects */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card preset="borderless" padding="lg">
            <SectionTitle>По статусах</SectionTitle>
            {/* Label above the bar rather than squeezed into a 90px column:
                at 10px in that width every status name was truncated. */}
            <div className="flex flex-col gap-[14px]">
              {stats.byStatus.map(({ id, label, color, count }) => (
                <div key={id} className="flex flex-col gap-[6px]">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                      <span className="truncate text-[13px] font-semibold text-ink">{label}</span>
                    </span>
                    <span className="shrink-0 text-[14px] font-bold text-ink tabular-nums">{count}</span>
                  </div>
                  <div className="h-[6px] overflow-hidden rounded-full bg-[#f0f0f0]">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(count / stats.maxStatus) * 100}%`, background: color }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card preset="borderless" padding="lg" className="md:col-span-2">
            <SectionTitle>По проєктах</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#f0f0f0]">
                    {['Проєкт', 'Всього', 'Прогрес', 'Відкрито', 'Прострочено', `Час · ${period}д`, ''].map(h => (
                      <th key={h} className="pb-2 text-[10px] font-bold text-muted uppercase tracking-wide pr-4 last:pr-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f8f8f8]">
                  {stats.byProject.map(({ p, total, open, overdue, minutes, pct }) => (
                    <tr key={p.id} className="group">
                      <td className="py-3 pr-4">
                        <p className="text-[13px] font-semibold text-ink">{p.name}</p>
                        <span className="text-[10px] text-faint">{p.visibility === 'internal' ? 'Внутрішній' : 'Клієнтський'}</span>
                      </td>
                      <td className="py-3 pr-4 text-[13px] font-semibold text-ink">{total}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-[80px] h-[5px] bg-[#f0f0f0] rounded-full overflow-hidden">
                            <div className="h-full bg-[#10b981] rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[11px] font-semibold text-muted">{pct}%</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-[12px] text-[#0891b2] font-semibold">{open}</td>
                      <td className="py-3 pr-4">
                        {overdue > 0 ? <span className="text-[12px] font-semibold text-red-500">{overdue}</span>
                          : <span className="text-[12px] text-faint">—</span>}
                      </td>
                      <td className="py-3 pr-4 text-[12px] text-muted">{fmtH(minutes)}</td>
                      <td className="py-3">
                        <Link href={`/${p.id}`}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-faint hover:text-ink flex items-center gap-1 text-[11px] font-medium">
                          Відкрити <ArrowRight size={11} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Overdue + Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.overdue.length > 0 && (
            <Card preset="borderless" padding="lg">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={13} className="shrink-0 text-red-500" />
                <h2 className="ui-type-eyebrow uppercase tracking-wider text-muted">
                  Прострочені ({stats.overdue.length})
                </h2>
              </div>
              <div className="flex flex-col gap-2">
              {stats.overdue.slice(0, 6).map(issue => {
                const proj = projects.find(p => p.id === issue.projectId);
                return (
                  <TaskRow
                    key={issue.id}
                    issue={issue}
                    issues={issueReferenceIssues}
                    members={members}
                    projectId={issue.projectId}
                    projectName={proj?.name}
                    showProjectName
                  />
                );
              })}
              </div>
            </Card>
          )}
          <Card preset="borderless" padding="lg">
            <SectionTitle>Інсайти</SectionTitle>
            <div className="flex flex-col gap-3">
              {stats.dependencyBlocked > 0 && (
                <Alert
                  variant="error"
                  title={`${stats.dependencyBlocked} завдань заблоковано`}
                  description="Їх стримують незавершені залежності"
                />
              )}
              {stats.blockerPriority > 0 && (
                <Alert
                  variant="warning"
                  title={`${stats.blockerPriority} завдань із пріоритетом «Критичний»`}
                  description="Потребують негайної уваги"
                />
              )}
              {stats.noAssignee > 0 && (
                <Alert
                  variant="warning"
                  title={`${stats.noAssignee} завдань без виконавця`}
                />
              )}
              {stats.unestimated > 0 && (
                <Alert
                  variant="info"
                  title={`${stats.unestimated} завдань без оцінки`}
                />
              )}
              {stats.inProgress > 0 && (
                <Alert
                  variant="success"
                  title={`${stats.inProgress} завдань в роботі`}
                />
              )}
              {stats.dependencyBlocked === 0
                && stats.blockerPriority === 0
                && stats.noAssignee === 0
                && stats.overdue.length === 0 && (
                <Alert
                  variant="success"
                  title="Все виглядає добре!"
                />
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── PAGE ─────────────────────────────────────────────────────────────
export default function WorkspaceAnalyticsPage() {
  const router = useRouter();
  const { projects = [], orgRole, currentUser } = useAppContext();
  const analyticsSearch = useWorkspaceStore(state => state.analyticsSearch);
  const [activeTab, setActiveTab] = useState('overview');

  // Only admin/owner can see billing and other members' timesheets
  const canSeeBilling = orgRole === 'owner' || orgRole === 'admin';
  const canSeeTeamTimesheet = canSeeBilling;

  const { members } = useOrganization();
  const { priorities, types } = useWorkflowConfig();

  const {
    issues,
    timeLogs,
    issueLinks,
    loading,
  } = useWorkspaceAnalytics(projects.map(p => p.id));
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
    projects
      .filter(project => `${project.name || ''} ${project.description || ''}`.toLocaleLowerCase('uk-UA').includes(searchQuery))
      .map(project => project.id)
  ), [projects, searchQuery]);

  const filteredIssues = useMemo(() => {
    return issues.filter(i => {
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
      if (priorityFilter !== 'all' && i.priority !== priorityFilter) return false;
      if (typeFilter !== 'all' && i.type !== typeFilter) return false;
      return true;
    });
  }, [issues, searchQuery, searchMatchedProjectIds, projectFilters, assigneeFilter, priorityFilter, typeFilter]);
  const actionableIssueIds = useMemo(
    () => new Set(selectActionableIssues(issues).map(issue => issue.id)),
    [issues],
  );
  const analyticsIssues = useMemo(
    () => filteredIssues.filter(issue => actionableIssueIds.has(issue.id)),
    [actionableIssueIds, filteredIssues],
  );

  const visibleProjects = useMemo(() => {
    if (!searchQuery) return projects;
    const issueProjectIds = new Set(filteredIssues.map(issue => issue.projectId));
    return projects.filter(project => searchMatchedProjectIds.has(project.id) || issueProjectIds.has(project.id));
  }, [projects, filteredIssues, searchMatchedProjectIds, searchQuery]);

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
          const project = projects.find(item => item.id === log.projectId);
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
    projects,
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
  const teamHierarchyIssues = useMemo(
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
  const billingProject = projects.find(p => p.id === billingProjectId) || projects[0];
  const billingIssues = issues.filter(i => i.projectId === billingProject?.id);

  const periodOptions = [7, 14, 30, 90].map(d => ({ value: d, label: `${d}д` }));

  return (
    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-transparent">
      <div className="workspace-page-layout min-h-full pb-[120px]">

        <PageHeader
          variant="main"
          title="Аналітика"
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          mobileActions={
            activeTab === 'timesheet' ? (
              <Button style="primary" size="icon-lg" icon={Plus} onClick={() => setTsLogOpen(true)} title="Списати час" />
            ) : null
          }
          filters={
            activeTab === 'billing' ? (
              <FilterBar>
                <Select
                  filterRole="project"
                  value={billingProject?.id || ''}
                  onChange={setBillingProjectId}
                  options={projects.map(p => ({ value: p.id, label: p.name }))}
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
                    options={projects.map(p => ({ value: p.id, label: p.name }))}
                    placeholder="Всі проєкти"
                    searchPlaceholder="Пошук проєкту..."
                    filterRole="project"
                    variant="ghost"
                  />
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
                </FilterBar>
                <Button style="primary" size="lg" icon={Plus} onClick={() => setTsLogOpen(true)} className="ml-auto max-md:hidden">
                  Списати час
                </Button>
              </>
            ) : activeTab === 'workload' ? (
              <FilterBar>
                <MultiSelect
                  value={projectFilters}
                  onChange={setProjectFilters}
                  options={projects.map(p => ({ value: p.id, label: p.name }))}
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
            ) : (
              <FilterBar>
                <MultiSelect
                  value={projectFilters}
                  onChange={setProjectFilters}
                  options={projects.map(p => ({ value: p.id, label: p.name }))}
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
                    ...priorities.map(priority => ({
                      value: priority.id,
                      label: priority.label,
                      dotColor: priority.color,
                    })),
                  ]}
                  variant="ghost"
                />
                <Select
                  filterRole="type"
                  value={typeFilter}
                  onChange={setTypeFilter}
                  options={[
                    { value: 'all', label: 'Всі типи' },
                    ...types
                      .map(type => ({
                        value: type.id,
                        label: type.label,
                        dotColor: type.color,
                      })),
                  ]}
                  variant="ghost"
                />
                <FilterDivider />
                <Segmented value={period} onChange={setPeriod} options={periodOptions} />
              </FilterBar>
            )
          }
        />

        {/* Content — сіра панель з відступами і скругленнями, як на сторінці
            проєктів; на ній білі картки без обводок */}
        <Surface preset="panel" padding="lg" composition="chart-panel" className="flex-1 flex flex-col">
        {activeTab === 'overview' && (
          <AnalyticsContent
            projects={visibleProjects}
            issues={analyticsIssues}
            issueReferenceIssues={issues}
            issueLinks={issueLinks}
            timeLogs={filteredTimeLogs}
            events={calendarEvents}
            members={members}
            loading={loading || calendarLoading}
            period={period}
            onTabChange={setActiveTab}
          />
        )}

        {activeTab === 'timesheet' && (
          <TimesheetTab
            issues={filteredIssues}
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
          />
        )}

        {activeTab === 'velocity' && (
          <VelocityTab issues={analyticsIssues} projects={visibleProjects} period={period} />
        )}

        {activeTab === 'workload' && (
          <WorkloadTab
            members={members}
            issues={teamIssues}
            hierarchyIssues={teamHierarchyIssues}
            timeLogs={teamTimeLogs}
            events={calendarEvents}
            projects={projects}
            period={period}
            selectedMemberId={teamMemberFilter}
            onSelectMember={selectTeamMember}
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
