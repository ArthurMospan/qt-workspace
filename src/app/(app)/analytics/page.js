'use client';
// src/app/workspace/analytics/page.js — Workspace-wide analytics + invoices (admin/owner only)
// Огляд = швидкий стан воркспейсу; Продуктивність = тренди; Табель = час;
// Команда = навантаження; Рахунок = клієнтські рахунки. Всі контроли табу (період,
// тиждень/місяць, учасник, навігація) живуть в ОДНОМУ FilterBar під табами.
import { useMemo, useState, useEffect } from 'react';
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

// ── Helpers ─────────────────────────────────────────────────────────
function fmtH(min) {
  if (!min) return '0г';
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? (m > 0 ? `${h}г ${m}хв` : `${h}г`) : `${m}хв`;
}

function SectionTitle({ children }) {
  return <h2 className="text-[11px] font-bold text-muted uppercase tracking-wider mb-3">{children}</h2>;
}

function FilterDivider() {
  return <span className="w-[1px] h-[16px] bg-[#e3e3e3] mx-[2px] shrink-0" />;
}

// ── ОГЛЯД: стан воркспейсу «на зараз» ────────────────────────────────
// Детальні графіки активності/трендів живуть у «Продуктивності»,
// а навантаження по людях — у «Команді»; тут їх свідомо немає.
function AnalyticsContent({ projects, issues, timeLogs, events, loading, period, onTabChange }) {
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
    const blockers   = issues.filter(i => i.priority === 'blocker' && !doneSet.has(i.columnId || i.status)).length;

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
    const periodMin  = periodLogs.reduce((s, l) => s + (l.spentMinutes || 0), 0);

    const byProject = projects.map(p => {
      const pIssues  = issues.filter(i => i.projectId === p.id);
      const pDone    = pIssues.filter(i => doneSet.has(i.columnId || i.status)).length;
      const pOpen    = pIssues.filter(i => !doneSet.has(i.columnId || i.status)).length;
      const pOverdue = pIssues.filter(i => {
        const due = parseDueDate(i.dueDate);
        return due && due.getTime() < now && !doneSet.has(i.columnId || i.status);
      }).length;
      const pMin = periodLogs.filter(l => l.projectId === p.id).reduce((s, l) => s + (l.spentMinutes || 0), 0);
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
      total, done, inProgress, blockers, overdue, recentDone, periodMin,
      byProject, byStatus, maxStatus, noAssignee, unestimated,
      completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [issues, timeLogs, projects, period, statuses, doneSet, firstStatusId, now]);

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
          <KpiCard icon={Target} label="Всі завдання" color="#10b981"
            value={`${stats.done} / ${stats.total}`} sub={`${stats.completionPct}% виконано`} />
          <KpiCard icon={Zap} label={`Закрито за ${period}д`} color="#1f1f1f" onClick={() => onTabChange('velocity')}
            value={stats.recentDone} sub="тренди — у Продуктивності" />
          <KpiCard icon={Clock} label={`Списано часу · ${period}д`} color="#0891b2" onClick={() => onTabChange('timesheet')}
            value={fmtH(stats.periodMin)} sub="деталі — у Табелі" />
          <KpiCard icon={AlertTriangle} label="Прострочено" color="#ef4444"
            value={stats.overdue.length} sub={stats.overdue.length > 0 ? 'потребують уваги' : 'все вчасно'} />
        </div>

        <SectionTitle>Календар · {period} днів</SectionTitle>
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard icon={CalendarDays} label="Заплановано" color="#8b5cf6"
            value={calendarStats.upcoming} sub={`наступні ${period} днів`} />
          <KpiCard icon={Video} label="Мітинги" color="#3b82f6"
            value={calendarStats.meetings} sub={`${fmtH(Math.round(calendarStats.meetingMinutes))} за період`} />
          <KpiCard icon={Clock} label="Фокус-час" color="#14b8a6"
            value={fmtH(Math.round(calendarStats.focusMinutes))} sub={`за останні ${period} днів`} />
          <KpiCard icon={StickyNote} label="Нотатки" color="#64748b"
            value={calendarStats.notes} sub="у видимому календарі" />
        </div>

        {/* Statuses + Projects */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card variant="white" padding="lg" className="!border-none">
            <SectionTitle>По статусах</SectionTitle>
            <div className="flex flex-col gap-[10px]">
              {stats.byStatus.map(({ id, label, color, count }) => (
                <div key={id} className="flex items-center gap-3">
                  <span className="w-[90px] text-[10px] font-medium text-muted shrink-0 truncate">{label}</span>
                  <div className="flex-1 h-[5px] bg-[#f0f0f0] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(count / stats.maxStatus) * 100}%`, background: color }} />
                  </div>
                  <span className="text-[11px] font-bold text-ink w-5 text-right shrink-0">{count}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card variant="white" padding="lg" className="md:col-span-2 !border-none">
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
            <Card variant="white" padding="lg" className="!border-none">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={13} className="text-red-500" />
                <SectionTitle>Прострочені ({stats.overdue.length})</SectionTitle>
              </div>
              {stats.overdue.slice(0, 6).map(issue => {
                const due  = issue.dueDate?.toDate ? issue.dueDate.toDate() : new Date(issue.dueDate);
                const days = Math.floor((now - due.getTime()) / 86400000);
                const proj = projects.find(p => p.id === issue.projectId);
                return (
                  <Link href={`/${issue.projectId}/issue/${issue.id}`} key={issue.id} className="py-[10px] flex items-start justify-between gap-3 border-b border-[#f0f0f0] hover:bg-[#f9f9f9] transition-colors rounded-lg px-2 -mx-2 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-ink truncate">{issue.title}</p>
                      <p className="text-[10px] text-muted">{proj?.name} · {issue.issueKey}</p>
                    </div>
                    <span className="text-[11px] font-bold text-red-500 shrink-0 mt-0.5">+{days}д</span>
                  </Link>
                );
              })}
            </Card>
          )}
          <Card variant="white" padding="lg" className="!border-none">
            <SectionTitle>Інсайти</SectionTitle>
            <div className="flex flex-col gap-3">
              {stats.blockers > 0 && (
                <Alert
                  variant="error"
                  title={`${stats.blockers} Blocker-завдання`}
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
              {stats.blockers === 0 && stats.noAssignee === 0 && stats.overdue.length === 0 && (
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
  const { projects = [], orgRole, currentUser } = useAppContext();
  const analyticsSearch = useWorkspaceStore(state => state.analyticsSearch);
  const [activeTab, setActiveTab] = useState('overview');

  // Only admin/owner can see billing and other members' timesheets
  const canSeeBilling = orgRole === 'owner' || orgRole === 'admin';
  const canSeeTeamTimesheet = canSeeBilling;

  const { members } = useOrganization();

  const { issues, timeLogs, loading } = useWorkspaceAnalytics(projects.map(p => p.id));
  const { events: calendarEvents, loading: calendarLoading } = useCalendarEvents();

  // Shared filters (one FilterBar under the tabs; each tab adds its own controls)
  const [projectFilters, setProjectFilters] = useState([]);
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [period, setPeriod] = useState(30);

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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const member = searchParams.get('member');
      if (member) queueMicrotask(() => setAssigneeFilter(member));
      const tab = searchParams.get('tab');
      if (tab) queueMicrotask(() => setActiveTab(tab));
    }
  }, []);

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
  const billingIssues  = filteredIssues.filter(i => i.projectId === (billingProject?.id));

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
                      value={effectiveTsMember}
                      onChange={setTsMember}
                      options={[
                        { value: 'all', label: 'Вся команда' },
                        ...members.map(m => ({ value: m.id || m.uid, label: m.name || m.email })),
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
                    className="w-[200px]"
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
            ) : (
              <FilterBar>
                <MultiSelect
                  value={projectFilters}
                  onChange={setProjectFilters}
                  options={projects.map(p => ({ value: p.id, label: p.name }))}
                  placeholder="Всі проєкти"
                  searchPlaceholder="Пошук проєкту..."
                  className="w-[200px]"
                  variant="ghost"
                />
                <Select
                  value={assigneeFilter}
                  onChange={setAssigneeFilter}
                  options={[
                    { value: 'all', label: 'Всі виконавці' },
                    { value: 'unassigned', label: 'Без виконавця' },
                    ...members.map(m => ({ value: m.id || m.uid, label: m.name || m.email }))
                  ]}
                  variant="ghost"
                />
                <Select
                  value={priorityFilter}
                  onChange={setPriorityFilter}
                  options={[
                    { value: 'all', label: 'Всі пріоритети' },
                    { value: 'blocker', label: 'Blocker', dotColor: '#ef4444' },
                    { value: 'high', label: 'High', dotColor: '#f97316' },
                    { value: 'medium', label: 'Medium', dotColor: '#eab308' },
                    { value: 'low', label: 'Low', dotColor: '#9a9a9a' },
                  ]}
                  variant="ghost"
                />
                <Select
                  value={typeFilter}
                  onChange={setTypeFilter}
                  options={[
                    { value: 'all', label: 'Всі типи' },
                    { value: 'epic', label: 'Epic' },
                    { value: 'feature', label: 'Feature' },
                    { value: 'task', label: 'Task' },
                    { value: 'bug', label: 'Bug' },
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
        <Surface variant="panel" padding="lg" className="flex-1 flex flex-col min-h-[420px]">
        {activeTab === 'overview' && (
          <AnalyticsContent
            projects={visibleProjects}
            issues={filteredIssues}
            timeLogs={filteredTimeLogs}
            events={calendarEvents}
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
          <VelocityTab issues={filteredIssues} projects={visibleProjects} period={period} />
        )}

        {activeTab === 'workload' && (
          <WorkloadTab members={members} issues={filteredIssues} timeLogs={filteredTimeLogs} period={period} />
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
