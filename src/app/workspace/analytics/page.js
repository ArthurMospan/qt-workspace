'use client';
// src/app/workspace/analytics/page.js — Workspace-wide analytics + Billing (admin/owner only)
// Огляд = швидкий стан воркспейсу; Продуктивність = тренди; Табель = час;
// Команда = навантаження; Білінг = рахунки. Всі контроли табу (період,
// тиждень/місяць, учасник, навігація) живуть в ОДНОМУ FilterBar під табами.
import { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import Link from 'next/link';
import {
  BarChart2, AlertTriangle, Clock, Users, Zap, Target, Receipt, ArrowRight,
  ChevronLeft, ChevronRight, Plus,
} from 'lucide-react';
import { useTeamMembers } from '@/lib/hooks/useTeamMembers';
import { useWorkspaceAnalytics } from '@/lib/hooks/useWorkspaceAnalytics';
import { getCompletedAtMillis, useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import BillingTab from '@/components/workspace/BillingTab';
import TimesheetTab from '@/components/workspace/TimesheetTab';
import WorkloadTab from '@/components/workspace/WorkloadTab';
import VelocityTab from '@/components/workspace/VelocityTab';
import {
  Button, LoadingSpinner, EmptyState, Alert, Card, PageHeader, KpiCard, Segmented,
} from '@/components/ui';
import { Select, MultiSelect } from '@/components/ui/Select';
import FilterBar from '@/components/ui/FilterBar';

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
function AnalyticsContent({ projects, issues, timeLogs, loading, period, onTabChange }) {
  const { statuses, doneStatusIds } = useWorkflowConfig();
  const doneSet = useMemo(() => new Set(doneStatusIds), [doneStatusIds]);
  const firstStatusId = statuses?.[0]?.id;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    if (!issues.length && !loading) return null;
    const periodAgo = now - period * 24 * 3600 * 1000;

    const total      = issues.length;
    const done       = issues.filter(i => doneSet.has(i.columnId)).length;
    const inProgress = issues.filter(i => i.columnId === 'in-progress').length;
    const blockers   = issues.filter(i => i.priority === 'blocker' && !doneSet.has(i.columnId)).length;

    const overdue = issues.filter(i => {
      const due = i.dueDate?.toDate ? i.dueDate.toDate() : i.dueDate ? new Date(i.dueDate) : null;
      return due && due.getTime() < now && !doneSet.has(i.columnId);
    });

    const recentDone = issues.filter(i => {
      if (!doneSet.has(i.columnId)) return false;
      const t = getCompletedAtMillis(i);
      return t > periodAgo;
    }).length;

    const periodLogs = timeLogs.filter(l => (l.loggedAt?.toMillis?.() ?? 0) >= periodAgo);
    const periodMin  = periodLogs.reduce((s, l) => s + (l.spentMinutes || 0), 0);

    const byProject = projects.map(p => {
      const pIssues  = issues.filter(i => i.projectId === p.id);
      const pDone    = pIssues.filter(i => doneSet.has(i.columnId)).length;
      const pOpen    = pIssues.filter(i => !doneSet.has(i.columnId)).length;
      const pOverdue = pIssues.filter(i => {
        const due = i.dueDate?.toDate ? i.dueDate.toDate() : i.dueDate ? new Date(i.dueDate) : null;
        return due && due.getTime() < now && !doneSet.has(i.columnId);
      }).length;
      const pMin = periodLogs.filter(l => l.projectId === p.id).reduce((s, l) => s + (l.spentMinutes || 0), 0);
      const pPct = pIssues.length > 0 ? Math.round((pDone / pIssues.length) * 100) : 0;
      return { p, total: pIssues.length, done: pDone, open: pOpen, overdue: pOverdue, minutes: pMin, pct: pPct };
    }).sort((a, b) => b.total - a.total);

    const byStatus = (statuses || []).map(({ id, label, color }) => ({
      id, label, color, count: issues.filter(i => i.columnId === id).length,
    })).filter(s => s.count > 0);
    const maxStatus = Math.max(...byStatus.map(s => s.count), 1);

    const noAssignee  = issues.filter(i => !i.assigneeIds?.length && !doneSet.has(i.columnId)).length;
    const unestimated = issues.filter(i => !i.estimateMinutes && i.columnId !== firstStatusId && !doneSet.has(i.columnId)).length;

    return {
      total, done, inProgress, blockers, overdue, recentDone, periodMin,
      byProject, byStatus, maxStatus, noAssignee, unestimated,
      completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [issues, timeLogs, projects, period, loading, statuses, doneSet, firstStatusId, now]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <EmptyState
          icon={BarChart2}
          title="Даних ще немає"
          description="Аналітика з'явиться після створення завдань"
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
          <KpiCard icon={Zap} label={`Закрито за ${period}д`} color="#6366f1" onClick={() => onTabChange('velocity')}
            value={stats.recentDone} sub="тренди — у Продуктивності" />
          <KpiCard icon={Clock} label={`Списано часу · ${period}д`} color="#0891b2" onClick={() => onTabChange('timesheet')}
            value={fmtH(stats.periodMin)} sub="деталі — у Табелі" />
          <KpiCard icon={AlertTriangle} label="Прострочено" color="#ef4444"
            value={stats.overdue.length} sub={stats.overdue.length > 0 ? 'потребують уваги' : 'все вчасно'} />
        </div>

        {/* Statuses + Projects */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card variant="gray" padding="lg">
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

          <Card variant="gray" padding="lg" className="md:col-span-2">
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
                        <Link href={`/workspace/${p.id}`}
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
            <Card variant="gray" padding="lg">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={13} className="text-red-500" />
                <SectionTitle>Прострочені ({stats.overdue.length})</SectionTitle>
              </div>
              {stats.overdue.slice(0, 6).map(issue => {
                const due  = issue.dueDate?.toDate ? issue.dueDate.toDate() : new Date(issue.dueDate);
                const days = Math.floor((now - due.getTime()) / 86400000);
                const proj = projects.find(p => p.id === issue.projectId);
                return (
                  <div key={issue.id} className="py-[10px] flex items-start justify-between gap-3 border-b border-[#f0f0f0] last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-ink truncate">{issue.title}</p>
                      <p className="text-[10px] text-muted">{proj?.name} · {issue.issueKey}</p>
                    </div>
                    <span className="text-[11px] font-bold text-red-500 shrink-0">+{days}д</span>
                  </div>
                );
              })}
            </Card>
          )}
          <Card variant="gray" padding="lg">
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
  const [activeTab, setActiveTab] = useState('overview');

  // Only admin/owner can see billing and other members' timesheets
  const canSeeBilling = orgRole === 'owner' || orgRole === 'admin';
  const canSeeTeamTimesheet = canSeeBilling;

  const allUids = useMemo(() => {
    const set = new Set();
    projects.forEach(p => (p.team || []).forEach(uid => set.add(uid)));
    return [...set];
  }, [projects]);
  const { members } = useTeamMembers(allUids);

  const { issues, timeLogs, loading } = useWorkspaceAnalytics(projects.map(p => p.id));

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

  const filteredIssues = useMemo(() => {
    return issues.filter(i => {
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
  }, [issues, projectFilters, assigneeFilter, priorityFilter, typeFilter]);

  const filteredIssueIds = useMemo(() => new Set(filteredIssues.map(i => i.id)), [filteredIssues]);

  const filteredTimeLogs = useMemo(() => {
    return timeLogs.filter(log => {
      if (projectFilters.length > 0 && !projectFilters.includes(log.projectId)) return false;
      if (assigneeFilter !== 'all' || priorityFilter !== 'all' || typeFilter !== 'all') {
        if (!filteredIssueIds.has(log.issueId)) return false;
      }
      return true;
    });
  }, [timeLogs, projectFilters, assigneeFilter, priorityFilter, typeFilter, filteredIssueIds]);

  // Табель фільтрується лише по проєктах — вимір «хто» задає селектор учасника
  const projectScopedTimeLogs = useMemo(
    () => (projectFilters.length === 0 ? timeLogs : timeLogs.filter(l => projectFilters.includes(l.projectId))),
    [timeLogs, projectFilters]
  );

  const TABS = [
    { id: 'overview', label: 'Огляд', icon: BarChart2 },
    { id: 'timesheet', label: 'Табель', icon: Clock },
    { id: 'velocity', label: 'Продуктивність', icon: Zap },
    { id: 'workload', label: 'Команда', icon: Users },
    ...(canSeeBilling ? [{ id: 'billing', label: 'Білінг', icon: Receipt }] : []),
  ];

  // Білінг — один конкретний проєкт
  const [billingProjectId, setBillingProjectId] = useState('');
  const billingProject = projects.find(p => p.id === billingProjectId) || projects[0];
  const billingIssues  = filteredIssues.filter(i => i.projectId === (billingProject?.id));

  const periodOptions = [7, 14, 30, 90].map(d => ({ value: d, label: `${d}д` }));

  return (
    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-transparent">
      <div className="w-full page-gutter pt-[56px] flex flex-col gap-2 min-h-full pb-[120px]">

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

        {/* Content */}
        {activeTab === 'overview' && (
          <AnalyticsContent
            projects={projects}
            issues={filteredIssues}
            timeLogs={filteredTimeLogs}
            loading={loading}
            period={period}
            onTabChange={setActiveTab}
          />
        )}

        {activeTab === 'timesheet' && (
          <TimesheetTab
            issues={issues}
            timeLogs={projectScopedTimeLogs}
            members={members}
            projects={projects}
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
          <VelocityTab issues={filteredIssues} projects={projects} period={period} />
        )}

        {activeTab === 'workload' && (
          <WorkloadTab members={members} issues={filteredIssues} timeLogs={filteredTimeLogs} period={period} />
        )}

        {activeTab === 'billing' && canSeeBilling && (
          <BillingTab
            issues={billingIssues}
            members={members}
            project={billingProject}
            projectId={billingProject?.id}
          />
        )}
      </div>
    </div>
  );
}
