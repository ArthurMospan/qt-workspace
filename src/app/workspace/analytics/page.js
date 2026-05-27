
'use client';
// src/app/workspace/analytics/page.js — Workspace-wide analytics + Billing (admin/owner only)
import { useMemo, useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import Link from 'next/link';
import {
  BarChart2, TrendingUp, CheckCircle2, AlertTriangle, Clock,
  Users, Zap, Target, Receipt, ArrowRight, Activity, AlertCircle,
} from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { useTeamMembers } from '@/lib/hooks/useTeamMembers';
import { useWorkspaceAnalytics } from '@/lib/hooks/useWorkspaceAnalytics';
import BillingTab from '@/components/workspace/BillingTab';
import TimesheetTab from '@/components/workspace/TimesheetTab';
import WorkloadTab from '@/components/workspace/WorkloadTab';
import VelocityTab from '@/components/workspace/VelocityTab';
// ── Helpers ─────────────────────────────────────────────────────────
function fmtH(min) {
  if (!min) return '0г';
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? (m > 0 ? `${h}г ${m}хв` : `${h}г`) : `${m}хв`;
}

const COL_COLOR = {
  backlog:'#9a9a9a', todo:'#6366f1', 'in-progress':'#0891b2',
  'code-review':'#d97706', qa:'#7c3aed', 'client-approval':'#db2777', done:'#10b981',
};
const COL_LABEL = {
  backlog:'Backlog', todo:'To Do', 'in-progress':'In Progress',
  'code-review':'Code Review', qa:'QA', 'client-approval':'Client Approval', done:'Done',
};

// ── Sub-components ───────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color = '#6366f1', onClick }) {
  const inner = (
    <div className="bg-[#f7f7f7] border border-transparent rounded-[24px] p-5 group-hover:bg-[#f0f0f0] transition-colors">
      <div className="w-9 h-9 rounded-[12px] flex items-center justify-center mb-3" style={{ background: color + '15' }}>
        <Icon size={16} style={{ color }} />
      </div>
      <p className="text-[26px] font-bold text-[#1f1f1f] leading-none mb-1">{value}</p>
      <p className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wide">{label}</p>
      {sub && <p className="text-[11px] text-[#cfcfcf] mt-1">{sub}</p>}
    </div>
  );
  if (onClick) return <div onClick={onClick} className="group cursor-pointer">{inner}</div>;
  return <div>{inner}</div>;
}

function SectionTitle({ children }) {
  return <h2 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-3">{children}</h2>;
}

// ── ANALYTICS CONTENT ────────────────────────────────────────────────
function AnalyticsContent({ projects, issues, timeLogs, members, loading, onTabChange }) {
  const [period, setPeriod] = useState(30);

  const stats = useMemo(() => {
    if (!issues.length && !loading) return null;
    const now     = Date.now();
    const periodAgo = now - period * 24 * 3600 * 1000;

    const total      = issues.length;
    const done       = issues.filter(i => i.columnId === 'done').length;
    const inProgress = issues.filter(i => i.columnId === 'in-progress').length;
    const blockers   = issues.filter(i => i.priority === 'blocker' && i.columnId !== 'done').length;

    const overdue = issues.filter(i => {
      const due = i.dueDate?.toDate ? i.dueDate.toDate() : i.dueDate ? new Date(i.dueDate) : null;
      return due && due.getTime() < now && i.columnId !== 'done';
    });

    const recentDone = issues.filter(i => {
      if (i.columnId !== 'done') return false;
      const t = i.updatedAt?.toMillis?.() ?? 0;
      return t > periodAgo;
    }).length;

    const totalMin = timeLogs.reduce((s, l) => s + (l.spentMinutes || 0), 0);

    const byProject = projects.map(p => {
      const pIssues  = issues.filter(i => i.projectId === p.id);
      const pDone    = pIssues.filter(i => i.columnId === 'done').length;
      const pOpen    = pIssues.filter(i => i.columnId !== 'done').length;
      const pOverdue = pIssues.filter(i => {
        const due = i.dueDate?.toDate ? i.dueDate.toDate() : i.dueDate ? new Date(i.dueDate) : null;
        return due && due.getTime() < now && i.columnId !== 'done';
      }).length;
      const pMin   = timeLogs.filter(l => l.projectId === p.id).reduce((s, l) => s + (l.spentMinutes || 0), 0);
      const pPct   = pIssues.length > 0 ? Math.round((pDone / pIssues.length) * 100) : 0;
      return { p, total: pIssues.length, done: pDone, open: pOpen, overdue: pOverdue, minutes: pMin, pct: pPct };
    }).filter(s => s.total > 0).sort((a, b) => b.total - a.total);

    const byMember = members.map(m => {
      const uid   = m.id || m.uid;
      const mine  = issues.filter(i => i.assigneeIds?.includes(uid));
      const mDone = mine.filter(i => i.columnId === 'done').length;
      const mOpen = mine.filter(i => i.columnId !== 'done').length;
      const mOver = mine.filter(i => {
        const due = i.dueDate?.toDate ? i.dueDate.toDate() : i.dueDate ? new Date(i.dueDate) : null;
        return due && due.getTime() < now && i.columnId !== 'done';
      }).length;
      const mMin  = timeLogs.filter(l => l.userId === uid).reduce((s, l) => s + (l.spentMinutes || 0), 0);
      return { m, uid, total: mine.length, done: mDone, open: mOpen, overdue: mOver, minutes: mMin };
    }).filter(s => s.total > 0 || s.minutes > 0).sort((a, b) => b.total - a.total);

    const byStatus = ['backlog','todo','in-progress','code-review','qa','client-approval','done'].map(col => ({
      col, count: issues.filter(i => i.columnId === col).length,
    })).filter(s => s.count > 0);
    const maxStatus = Math.max(...byStatus.map(s => s.count), 1);

    const days = Array.from({ length: Math.min(period, 30) }, (_, i) => {
      const daysBack = Math.min(period, 30) - 1;
      const base = new Date(now - (daysBack - i) * 86400000);
      const dayStart = new Date(base).setHours(0,0,0,0);
      const dayEnd   = new Date(base).setHours(23,59,59,999);
      return {
        label: base.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }),
        created: issues.filter(iss => {
          const t = iss.createdAt?.toMillis?.() ?? 0;
          return t >= dayStart && t <= dayEnd;
        }).length,
        done: issues.filter(iss => {
          if (iss.columnId !== 'done') return false;
          const t = iss.updatedAt?.toMillis?.() ?? 0;
          return t >= dayStart && t <= dayEnd;
        }).length,
      };
    });
    const maxActivity = Math.max(...days.map(d => Math.max(d.created, d.done)), 1);

    const noAssignee  = issues.filter(i => !i.assigneeIds?.length && i.columnId !== 'done').length;
    const unestimated = issues.filter(i => !i.estimateMinutes && !['backlog','done'].includes(i.columnId)).length;

    return {
      total, done, inProgress, blockers, overdue, recentDone,
      totalMin, byProject, byMember, byStatus, maxStatus, days, maxActivity, noAssignee, unestimated,
      completionPct: total > 0 ? Math.round((done/total)*100) : 0,
      activeProjects: projects.filter(p => p.status !== 'archived').length,
    };
  }, [issues, timeLogs, members, projects, period, loading]); // eslint-disable-line

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20">
        <BarChart2 size={40} className="text-[#e9e9e9] mb-3" />
        <p className="text-[14px] font-semibold text-[#cfcfcf]">Даних ще немає</p>
        <p className="text-[12px] text-[#e0e0e0] mt-1">Аналітика з'явиться після створення задач</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-transparent">
      <div className="w-full px-[32px] pb-16">

        {/* Period filter */}
        <div className="flex justify-end mb-4">
          <div className="flex items-center gap-1 bg-[#f7f7f7] border border-transparent rounded-[12px] p-[3px]">
            {[7, 14, 30, 90].map(d => (
              <button key={d} onClick={() => setPeriod(d)}
                className={`px-3 py-[5px] rounded-[7px] text-[11px] font-semibold transition-all ${
                  period === d ? 'bg-[#1f1f1f] text-white' : 'text-[#9a9a9a] hover:text-[#1f1f1f]'
                }`}>
                {d}д
              </button>
            ))}
          </div>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard icon={Target}       label="Всі задачі" color="#10b981" onClick={() => onTabChange('velocity')}
            value={`${stats.done} / ${stats.total}`} sub={`${stats.completionPct}% прогресу`} />
          <KpiCard icon={Zap}          label="Velocity (7д)" color="#6366f1" onClick={() => onTabChange('velocity')}
            value={stats.recentDone} sub="задач за тиждень" />
          <KpiCard icon={Clock}        label="Списано часу" color="#0891b2" onClick={() => onTabChange('timesheet')}
            value={fmtH(stats.totalMin)} sub={`по ${projects.length} проєктах`} />
          <KpiCard icon={Users}        label="Команда" color="#eab308" onClick={() => onTabChange('workload')}
            value={stats.byMember.length} sub="учасників із задачами" />
        </div>

        {/* Activity + Status */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="col-span-2 bg-[#f7f7f7] border border-transparent rounded-[24px] p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle>Активність (14 днів)</SectionTitle>
              <div className="flex items-center gap-3 text-[10px] text-[#9a9a9a]">
                <span className="flex items-center gap-1"><span className="w-[8px] h-[8px] rounded-sm bg-[#6366f1] inline-block" /> Створено</span>
                <span className="flex items-center gap-1"><span className="w-[8px] h-[8px] rounded-sm bg-[#10b981] inline-block" /> Завершено</span>
              </div>
            </div>
            <div className="flex items-end gap-[6px] h-[120px]">
              {stats.days.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center h-full justify-end" title={`${day.label}: +${day.created} ✓${day.done}`}>
                  <div className="w-full flex flex-col items-center gap-[1px] justify-end h-full">
                    <div className="w-full rounded-t-[3px] bg-[#10b981]"
                      style={{ height: `${(day.done / stats.maxActivity) * 100}%`, minHeight: day.done > 0 ? 3 : 0 }} />
                    <div className="w-full rounded-t-[3px] bg-[#6366f1]/50"
                      style={{ height: `${(day.created / stats.maxActivity) * 100}%`, minHeight: day.created > 0 ? 3 : 0 }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[9px] text-[#cfcfcf]">{stats.days[0]?.label}</span>
              <span className="text-[9px] text-[#cfcfcf]">{stats.days[stats.days.length-1]?.label}</span>
            </div>
          </div>

          <div className="bg-[#f7f7f7] border border-transparent rounded-[24px] p-5">
            <SectionTitle>По статусах</SectionTitle>
            <div className="flex flex-col gap-[10px]">
              {stats.byStatus.map(({ col, count }) => (
                <div key={col} className="flex items-center gap-3">
                  <span className="w-[90px] text-[10px] font-medium text-[#9a9a9a] shrink-0 truncate">{COL_LABEL[col]}</span>
                  <div className="flex-1 h-[5px] bg-[#f0f0f0] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(count / stats.maxStatus) * 100}%`, background: COL_COLOR[col] }} />
                  </div>
                  <span className="text-[11px] font-bold text-[#1f1f1f] w-5 text-right shrink-0">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Projects table */}
        <div className="bg-[#f7f7f7] border border-transparent rounded-[24px] p-5 mb-6">
          <SectionTitle>По проєктах</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#f0f0f0]">
                  {['Проєкт','Всього','Прогрес','Відкрито','Прострочено','Час',''].map(h => (
                    <th key={h} className="pb-2 text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide pr-4 last:pr-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f8f8f8]">
                {stats.byProject.map(({ p, total, done, open, overdue, minutes, pct }) => (
                  <tr key={p.id} className="group">
                    <td className="py-3 pr-4">
                      <p className="text-[13px] font-semibold text-[#1f1f1f]">{p.name}</p>
                      <span className="text-[10px] text-[#cfcfcf]">{p.visibility === 'internal' ? 'Внутрішній' : 'Клієнтський'}</span>
                    </td>
                    <td className="py-3 pr-4 text-[13px] font-semibold text-[#1f1f1f]">{total}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-[80px] h-[5px] bg-[#f0f0f0] rounded-full overflow-hidden">
                          <div className="h-full bg-[#10b981] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] font-semibold text-[#9a9a9a]">{pct}%</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-[12px] text-[#0891b2] font-semibold">{open}</td>
                    <td className="py-3 pr-4">
                      {overdue > 0 ? <span className="text-[12px] font-semibold text-red-500">{overdue}</span>
                        : <span className="text-[12px] text-[#cfcfcf]">—</span>}
                    </td>
                    <td className="py-3 pr-4 text-[12px] text-[#9a9a9a]">{fmtH(minutes)}</td>
                    <td className="py-3">
                      <Link href={`/workspace/${p.id}`}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[#cfcfcf] hover:text-[#1f1f1f] flex items-center gap-1 text-[11px] font-medium">
                        Відкрити <ArrowRight size={11} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Member workload */}
        {stats.byMember.length > 0 && (
          <div className="bg-white border border-[#e9e9e9] rounded-[24px] p-5 mb-6">
            <SectionTitle>Навантаження по команді</SectionTitle>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#f0f0f0]">
                  {['Учасник','Задач','Виконано','Відкрито','Прострочено','Час'].map(h => (
                    <th key={h} className="pb-2 text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide pr-6 last:pr-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f8f8f8]">
                {stats.byMember.map(({ m, total, done, open, overdue, minutes }) => (
                  <tr key={m.id || m.uid}>
                    <td className="py-3 pr-6">
                      <div className="flex items-center gap-2">
                        <UserAvatar user={m} size={26} />
                        <p className="text-[12px] font-semibold text-[#1f1f1f]">{m.name || m.email}</p>
                      </div>
                    </td>
                    <td className="py-3 pr-6 text-[13px] font-semibold text-[#1f1f1f]">{total}</td>
                    <td className="py-3 pr-6 text-[12px] font-semibold text-[#10b981]">{done}</td>
                    <td className="py-3 pr-6 text-[12px] font-semibold text-[#0891b2]">{open}</td>
                    <td className="py-3 pr-6">{overdue > 0
                      ? <span className="text-[12px] font-semibold text-red-500">{overdue}</span>
                      : <span className="text-[12px] text-[#cfcfcf]">—</span>}</td>
                    <td className="py-3 text-[12px] text-[#9a9a9a]">{minutes > 0 ? fmtH(minutes) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Overdue + Insights */}
        <div className="grid grid-cols-2 gap-4">
          {stats.overdue.length > 0 && (
            <div className="bg-white border border-[#e9e9e9] rounded-[24px] p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={13} className="text-red-500" />
                <SectionTitle>Прострочені ({stats.overdue.length})</SectionTitle>
              </div>
              {stats.overdue.slice(0, 6).map(issue => {
                const due  = issue.dueDate?.toDate ? issue.dueDate.toDate() : new Date(issue.dueDate);
                const days = Math.floor((Date.now() - due.getTime()) / 86400000);
                const proj = projects.find(p => p.id === issue.projectId);
                return (
                  <div key={issue.id} className="py-[10px] flex items-start justify-between gap-3 border-b border-[#f0f0f0] last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-[#1f1f1f] truncate">{issue.title}</p>
                      <p className="text-[10px] text-[#9a9a9a]">{proj?.name} · {issue.issueKey}</p>
                    </div>
                    <span className="text-[11px] font-bold text-red-500 shrink-0">+{days}д</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="bg-white border border-[#e9e9e9] rounded-[24px] p-5">
            <SectionTitle>Інсайти</SectionTitle>
            <div className="flex flex-col gap-3">
              {stats.blockers > 0 && (
                <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-[12px]">
                  <AlertCircle size={14} className="text-red-500 shrink-0" />
                  <div>
                    <p className="text-[12px] font-semibold text-red-700">{stats.blockers} Blocker-задачі</p>
                    <p className="text-[11px] text-red-400">Потребують негайної уваги</p>
                  </div>
                </div>
              )}
              {stats.noAssignee > 0 && (
                <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-100 rounded-[12px]">
                  <Users size={14} className="text-yellow-600 shrink-0" />
                  <div>
                    <p className="text-[12px] font-semibold text-yellow-700">{stats.noAssignee} задач без виконавця</p>
                  </div>
                </div>
              )}
              {stats.unestimated > 0 && (
                <div className="flex items-center gap-3 p-3 bg-[#f0f4ff] border border-[#dbeafe] rounded-[12px]">
                  <Clock size={14} className="text-[#6366f1] shrink-0" />
                  <p className="text-[12px] font-semibold text-[#3730a3]">{stats.unestimated} задач без оцінки</p>
                </div>
              )}
              {stats.inProgress > 0 && (
                <div className="flex items-center gap-3 p-3 bg-[#f0fdfa] border border-[#ccfbf1] rounded-[12px]">
                  <Activity size={14} className="text-[#0891b2] shrink-0" />
                  <p className="text-[12px] font-semibold text-[#0e7490]">{stats.inProgress} задач в роботі</p>
                </div>
              )}
              {stats.blockers === 0 && stats.noAssignee === 0 && stats.overdue.length === 0 && (
                <div className="flex items-center gap-3 p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-[12px]">
                  <CheckCircle2 size={14} className="text-[#10b981] shrink-0" />
                  <p className="text-[12px] font-semibold text-[#059669]">Все виглядає добре!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PAGE ─────────────────────────────────────────────────────────────
export default function WorkspaceAnalyticsPage() {
  const { projects = [], orgRole } = useAppContext();
  const [activeTab, setActiveTab] = useState('overview');

  // Only admin/owner can see billing
  const canSeeBilling = orgRole === 'owner' || orgRole === 'admin';

  const allUids = useMemo(() => {
    const set = new Set();
    projects.forEach(p => (p.team || []).forEach(uid => set.add(uid)));
    return [...set];
  }, [projects]);
  const { members } = useTeamMembers(allUids);

  const { issues, timeLogs, loading } = useWorkspaceAnalytics(projects.map(p => p.id));

  const TABS = [
    { id: 'overview', label: 'Огляд',   icon: BarChart2 },
    { id: 'timesheet', label: 'Таймшит', icon: Clock },
    { id: 'velocity', label: 'Продуктивність', icon: Zap },
    { id: 'workload', label: 'Команда', icon: Users },
    ...(canSeeBilling ? [{ id: 'billing', label: 'Білінг', icon: Receipt }] : []),
  ];

  // For BillingTab — flatten all issues + pick the first project (or let user pick)
  const [billingProjectId, setBillingProjectId] = useState('');
  const billingProject = projects.find(p => p.id === billingProjectId) || projects[0];
  const billingIssues  = issues.filter(i => i.projectId === (billingProject?.id));

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-transparent">

      {/* Page header */}
      <div className="px-[32px] shrink-0 mb-[24px]">
        <div className="pt-0 mb-[20px]">
          <h1 className="text-[24px] font-bold text-[#1f1f1f] tracking-tight truncate">Аналітика</h1>
          <p className="text-[13px] font-medium text-[#9a9a9a] mt-[4px]">Усі проєкти · {projects.filter(p => p.status !== 'archived').length} активних</p>
        </div>

        {/* Tabs */}
        <div className="inline-flex items-center bg-[#f7f7f7] rounded-[12px] p-[4px] gap-[2px]">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-[6px] px-[14px] py-[7px] rounded-[9px] text-[13px] font-semibold transition-all ${
                activeTab === id
                  ? id === 'billing'
                    ? 'bg-white text-[#059669] shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                    : 'bg-white text-[#1f1f1f] shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                  : id === 'billing'
                    ? 'text-[#9a9a9a] hover:text-[#059669]'
                    : 'text-[#9a9a9a] hover:text-[#4a4a4a]'
              }`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <AnalyticsContent
          projects={projects}
          issues={issues}
          timeLogs={timeLogs}
          members={members}
          loading={loading}
          onTabChange={setActiveTab}
        />
      )}

      {activeTab === 'timesheet' && (
        <TimesheetTab />
      )}

      {activeTab === 'velocity' && (
        <VelocityTab issues={issues} projects={projects} />
      )}

      {activeTab === 'workload' && (
        <WorkloadTab members={members} issues={issues} timeLogs={timeLogs} />
      )}

      {activeTab === 'billing' && canSeeBilling && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Project selector for billing */}
          {projects.length > 1 && (
            <div className="bg-white border-b border-[#e9e9e9] px-6 py-3 flex items-center gap-3 shrink-0">
              <span className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wide">Проєкт:</span>
              <div className="flex flex-wrap gap-2">
                {projects.map(p => (
                  <button key={p.id} onClick={() => setBillingProjectId(p.id)}
                    className={`text-[11px] font-medium px-3 py-[5px] rounded-full border transition-all ${
                      (billingProjectId === p.id || (!billingProjectId && p.id === projects[0]?.id))
                        ? 'bg-[#1f1f1f] text-white border-[#1f1f1f]'
                        : 'bg-white text-[#9a9a9a] border-[#e9e9e9] hover:border-[#1f1f1f] hover:text-[#1f1f1f]'
                    }`}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <BillingTab
            issues={billingIssues}
            members={members}
            project={billingProject}
            projectId={billingProject?.id}
          />
        </div>
      )}
    </div>
  );
}
