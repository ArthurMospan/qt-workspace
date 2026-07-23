'use client';
// src/components/workspace/TimesheetTab.jsx — Табель (YouTrack-style timesheet)
// Data comes from the page-level useWorkspaceAnalytics (realtime, whole org),
// so admins/owners can see the whole team, not just their own logs.
// All controls (member, week/month, navigation) live in the page FilterBar;
// this component only renders the grid for the state it receives via props.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import UserAvatar from '@/components/UserAvatar';
import { Dialog, Button, Select, Input, EmptyState } from '@/components/ui';
import { DatePicker } from '@/components/ui/Forms/DatePicker';

// ── Working-time constants (like YouTrack: 1д = 8г, 1т = 5д) ────────────────
const DAY_MIN = 8 * 60;
const WEEK_MIN = 5 * DAY_MIN;
const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

// ── Helpers ──────────────────────────────────────────────────────────────────
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function fmtMin(min) {
  if (!min) return '0г';
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m}хв`;
  if (m === 0) return `${h}г`;
  return `${h}г ${m}хв`;
}

// Work-duration format: 500хв → "1д 20хв" (1д = 8 робочих годин)
function fmtWork(min) {
  if (!min) return '0г';
  const d = Math.floor(min / DAY_MIN);
  const h = Math.floor((min % DAY_MIN) / 60);
  const m = min % 60;
  const parts = [];
  if (d) parts.push(`${d}д`);
  if (h) parts.push(`${h}г`);
  if (m) parts.push(`${m}хв`);
  return parts.join(' ');
}

// Colored capacity chip: "6г 20хв з 8г"
function DayChip({ minutes, capacity = DAY_MIN, compact = false }) {
  const cls = minutes >= capacity
    ? 'bg-[#dcfce7] text-[#15803d]'
    : minutes > 0
      ? 'bg-[#ffedd5] text-[#c2410c]'
      : 'bg-[#efefef] text-muted';
  return (
    <span className={`inline-flex items-center text-[11px] font-bold px-[8px] py-[3px] rounded-[6px] whitespace-nowrap ${cls}`}>
      {compact ? fmtMin(minutes) : `${fmtMin(minutes)} з ${capacity / 60}г`}
    </span>
  );
}

function logDate(log) {
  return log.loggedAt?.toDate ? log.loggedAt.toDate() : log.loggedAt ? new Date(log.loggedAt) : null;
}

// ── Week view: one member — day columns with task cards (YouTrack style) ─────
function MemberWeek({ days, logs, issuesById, todayKey }) {
  // grid[dayKey] = [{ issue, minutes, logsCount }]
  const byDay = useMemo(() => {
    const map = {};
    days.forEach(d => { map[dayKey(d)] = new Map(); });
    logs.forEach(log => {
      const d = logDate(log);
      if (!d) return;
      const key = dayKey(d);
      if (!map[key]) return;
      const cur = map[key].get(log.issueId) || 0;
      map[key].set(log.issueId, cur + (log.spentMinutes || 0));
    });
    return map;
  }, [days, logs]);

  return (
    <div className="overflow-x-auto hide-scrollbar full-bleed-mobile">
    <div className="grid grid-cols-7 gap-[10px] min-w-[840px] md:min-w-0">
      {days.map((d, i) => {
        const key = dayKey(d);
        const entries = [...(byDay[key]?.entries() || [])];
        const total = entries.reduce((s, [, min]) => s + min, 0);
        const isToday = key === todayKey;
        const isWeekend = i >= 5;
        return (
          <div key={key}
            className={`rounded-[16px] p-[8px] flex flex-col gap-[8px] min-h-[260px] ${
              isToday ? 'bg-[#f0fdf4]' : isWeekend ? 'bg-[#fafafa]' : 'bg-canvas'
            }`}>
            {/* Day header */}
            <div className="flex items-center justify-between px-[4px] pt-[2px]">
              <span className={`text-[11px] font-bold uppercase ${isToday ? 'text-[#15803d]' : 'text-muted'}`}>
                {DAY_LABELS[i]} <span className={`text-[13px] ${isToday ? 'text-[#166534]' : 'text-ink'}`}>{d.getDate()}</span>
              </span>
              <DayChip minutes={total} capacity={isWeekend ? 0 : DAY_MIN} compact={isWeekend && total === 0} />
            </div>
            {/* Task cards */}
            {entries.map(([issueId, minutes]) => {
              const issue = issuesById[issueId];
              return (
                <div key={issueId} className="bg-white border border-line rounded-[12px] px-[10px] py-[8px] hover:border-[#d0d0d0] transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    {issue ? (
                      <Link href={`/${issue.projectId}/issue/${issueId}`}
                        className="text-[12px] font-bold text-ink hover:underline truncate uppercase">
                        {issue.issueKey || issueId.slice(0, 6)}
                      </Link>
                    ) : (
                      <span className="text-[12px] font-bold text-faint uppercase">???</span>
                    )}
                    <span className="text-[12px] font-bold text-ink shrink-0">{fmtMin(minutes)}</span>
                  </div>
                  {issue?.title && (
                    <p className="text-[11px] text-muted mt-[2px] line-clamp-2 leading-snug">{issue.title}</p>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
    </div>
  );
}

// ── Week view: whole team — rows per member (admin/owner) ────────────────────
function TeamWeek({ days, logs, members, todayKey, onSelectMember }) {
  const rows = useMemo(() => {
    const perMember = {};
    logs.forEach(log => {
      const d = logDate(log);
      if (!d) return;
      const key = dayKey(d);
      if (!perMember[log.userId]) perMember[log.userId] = {};
      perMember[log.userId][key] = (perMember[log.userId][key] || 0) + (log.spentMinutes || 0);
    });
    return members
      .map(m => {
        const uid = m.id || m.uid;
        const byDay = perMember[uid] || {};
        const total = days.reduce((s, d) => s + (byDay[dayKey(d)] || 0), 0);
        return { m, uid, byDay, total };
      })
      .sort((a, b) => b.total - a.total);
  }, [days, logs, members]);

  const dayTotals = days.map(d => rows.reduce((s, r) => s + (r.byDay[dayKey(d)] || 0), 0));

  return (
    <div className="bg-white rounded-[16px] overflow-y-hidden overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[760px] md:min-w-0">
        <thead>
          <tr className="border-b border-line bg-[#fafafa]">
            <th className="px-5 py-3 text-[11px] font-bold text-muted uppercase tracking-wider w-[24%]">Учасник</th>
            {days.map((d, i) => (
              <th key={i} className={`px-2 py-3 text-center w-[9%] ${dayKey(d) === todayKey ? 'bg-[#f0fdf4]' : ''}`}>
                <span className={`text-[11px] font-bold uppercase ${dayKey(d) === todayKey ? 'text-[#15803d]' : 'text-muted'}`}>
                  {DAY_LABELS[i]} {d.getDate()}
                </span>
              </th>
            ))}
            <th className="px-4 py-3 text-center text-[11px] font-bold text-ink uppercase tracking-wider w-[13%]">Всього</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eeeeee]">
          {rows.map(({ m, uid, byDay, total }) => (
            <tr key={uid} onClick={() => onSelectMember?.(uid)}
              className="hover:bg-[#efefef] transition-colors cursor-pointer" title="Відкрити табель учасника">
              <td className="px-5 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <UserAvatar user={m} size={26} />
                  <span className="text-[13px] font-semibold text-ink truncate">{m.name || m.email}</span>
                </div>
              </td>
              {days.map((d, i) => {
                const min = byDay[dayKey(d)] || 0;
                return (
                  <td key={i} className={`px-2 py-3 text-center ${dayKey(d) === todayKey ? 'bg-[#f0fdf4]' : ''}`}>
                    {min > 0
                      ? <DayChip minutes={min} capacity={i >= 5 ? 0 : DAY_MIN} compact />
                      : <span className="text-[12px] text-faint">—</span>}
                  </td>
                );
              })}
              <td className="px-4 py-3 text-center">
                <span className="text-[13px] font-bold text-ink">{total > 0 ? fmtMin(total) : '—'}</span>
              </td>
            </tr>
          ))}
          {/* Team totals */}
          <tr className="bg-[#ececec]">
            <td className="px-5 py-3 text-right text-[11px] font-bold text-[#4a4a4a] uppercase tracking-wider">Разом</td>
            {dayTotals.map((min, i) => (
              <td key={i} className="px-2 py-3 text-center">
                <span className={`text-[12px] font-bold ${min > 0 ? 'text-ink' : 'text-muted'}`}>{min > 0 ? fmtMin(min) : '—'}</span>
              </td>
            ))}
            <td className="px-4 py-3 text-center">
              <span className="text-[14px] font-bold text-ink">{fmtMin(dayTotals.reduce((a, b) => a + b, 0))}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Month view: calendar grid with day totals ────────────────────────────────
function MonthGrid({ anchor, logs, todayKey, onSelectDay }) {
  const weeks = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const rows = [];
    let cursor = getWeekStart(first);
    while (cursor <= last) {
      rows.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
      cursor = addDays(cursor, 7);
    }
    return rows;
  }, [anchor]);

  const byDay = useMemo(() => {
    const map = {};
    logs.forEach(log => {
      const d = logDate(log);
      if (!d) return;
      const key = dayKey(d);
      if (!map[key]) map[key] = { minutes: 0, issues: new Set() };
      map[key].minutes += log.spentMinutes || 0;
      if (log.issueId) map[key].issues.add(log.issueId);
    });
    return map;
  }, [logs]);

  return (
    <div className="overflow-x-auto hide-scrollbar full-bleed-mobile">
    <div className="flex flex-col gap-[10px] min-w-[560px] md:min-w-0">
      <div className="grid grid-cols-7 gap-[10px]">
        {DAY_LABELS.map(l => (
          <span key={l} className="text-[11px] font-bold text-muted uppercase text-center">{l}</span>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-[10px]">
          {week.map((d, i) => {
            const key = dayKey(d);
            const cell = byDay[key];
            const inMonth = d.getMonth() === anchor.getMonth();
            const isToday = key === todayKey;
            const isWeekend = i >= 5;
            return (
              <button key={key} type="button" onClick={() => onSelectDay?.(d)}
                title="Відкрити тиждень"
                className={`rounded-[14px] border p-[10px] min-h-[86px] flex flex-col items-start gap-[6px] text-left transition-colors cursor-pointer ${
                  !inMonth ? 'border-black/[0.03] bg-white/60 opacity-45'
                    : isToday ? 'border-emerald-200 bg-white ring-2 ring-emerald-100 hover:border-emerald-300'
                    : isWeekend ? 'border-black/[0.05] bg-white hover:border-black/10'
                    : 'border-black/[0.05] bg-white hover:border-black/10 hover:shadow-sm'
                }`}>
                <span className={`text-[12px] font-bold ${isToday ? 'text-[#15803d]' : inMonth ? 'text-ink' : 'text-muted'}`}>
                  {d.getDate()}
                </span>
                {cell?.minutes > 0 && (
                  <>
                    <DayChip minutes={cell.minutes} capacity={isWeekend ? 0 : DAY_MIN} compact />
                    <span className="text-[10px] text-muted font-medium">
                      {cell.issues.size} завд.
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
    </div>
  );
}

// ── "Списати час" modal ───────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function LogTimeModal({ isOpen, onClose, projects, issues }) {
  const { currentUser, activeOrgId } = useAppContext();
  const showToast = useWorkspaceStore(s => s.showToast);
  const [projectId, setProjectId] = useState('');
  const [issueId, setIssueId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [hours, setHours] = useState('');
  const [mins, setMins] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const effectiveProjectId = projectId || projects[0]?.id || '';
  const projectIssues = useMemo(
    () => issues
      .filter(i => i.projectId === effectiveProjectId)
      .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)),
    [issues, effectiveProjectId]
  );

  const handleSave = async () => {
    const spentMinutes = (parseInt(hours) || 0) * 60 + (parseInt(mins) || 0);
    const targetIssue = issues.find(i => i.id === issueId);
    if (!targetIssue) { showToast('Оберіть завдання', 'error'); return; }
    if (spentMinutes <= 0) { showToast('Вкажіть витрачений час', 'error'); return; }
    setSaving(true);
    try {
      const [y, m, d] = date.split('-').map(Number);
      await addDoc(collection(db, 'timeLogs'), {
        issueId: targetIssue.id,
        projectId: targetIssue.projectId,
        userId: currentUser?.uid || currentUser?.id,
        organizationId: activeOrgId,
        spentMinutes,
        description: desc || '',
        loggedAt: Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0)),
      });
      showToast('Час списано ✓');
      setIssueId(''); setHours(''); setMins(''); setDesc('');
      onClose();
    } catch (err) {
      showToast('Помилка: ' + err.message, 'error');
    }
    setSaving(false);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Списати час"
      size="sm"
      footer={
        <>
          <Button style="secondary" size="md" onClick={onClose}>Скасувати</Button>
          <Button style="primary" size="md" onClick={handleSave} loading={saving}>Зберегти</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-2">Проєкт</label>
            <Select
              value={effectiveProjectId}
              onChange={val => { setProjectId(val); setIssueId(''); }}
              options={projects.map(p => ({ value: p.id, label: p.name }))}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-2">Дата</label>
            <DatePicker value={date} onChange={val => setDate(val || todayStr())} />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-2">Завдання</label>
          <Select
            value={issueId}
            onChange={setIssueId}
            options={[
              { value: '', label: projectIssues.length ? 'Оберіть завдання...' : 'У проєкті немає завдань' },
              ...projectIssues.map(i => ({ value: i.id, label: `${i.issueKey || ''} ${i.title}`.trim() })),
            ]}
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-2">Час</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input type="number" min="0" placeholder="0" value={hours} onChange={e => setHours(e.target.value)} className="pr-8" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-muted pointer-events-none">год</span>
            </div>
            <div className="relative flex-1">
              <Input type="number" min="0" max="59" placeholder="0" value={mins} onChange={e => setMins(e.target.value)} className="pr-7" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-muted pointer-events-none">хв</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-2">Опис (необовʼязково)</label>
          <Input placeholder="Що було зроблено?" value={desc} onChange={e => setDesc(e.target.value)} />
        </div>
      </div>
    </Dialog>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TimesheetTab({
  issues = [],
  timeLogs = [],
  members = [],
  projects = [],
  member = 'all',          // 'all' | uid
  mode = 'week',           // 'week' | 'month'
  anchor = new Date(),
  onSelectMember,
  onSelectDay,
  logModalOpen = false,
  onCloseLogModal,
}) {
  const todayKey = dayKey(new Date());
  const isTeam = member === 'all';

  const issuesById = useMemo(() => {
    const map = {};
    issues.forEach(i => { map[i.id] = i; });
    return map;
  }, [issues]);

  // Range for the current view
  const { rangeStart, rangeEnd, days, rangeLabel, capacity } = useMemo(() => {
    if (mode === 'week') {
      const start = getWeekStart(anchor);
      const end = addDays(start, 7);
      const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      const endDay = addDays(start, 6);
      const sameMonth = start.getMonth() === endDay.getMonth();
      const label = `${start.toLocaleDateString('uk-UA', { day: 'numeric', month: sameMonth ? undefined : 'long' })} – ${endDay.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      return { rangeStart: start, rangeEnd: end, days, rangeLabel: label, capacity: WEEK_MIN };
    }
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    let workdays = 0;
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const wd = d.getDay();
      if (wd !== 0 && wd !== 6) workdays++;
    }
    const label = start.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
    return {
      rangeStart: start, rangeEnd: end, days: [],
      rangeLabel: label.charAt(0).toUpperCase() + label.slice(1),
      capacity: workdays * DAY_MIN,
    };
  }, [mode, anchor]);

  // Logs inside range, for selected member (or the whole team)
  const rangeLogs = useMemo(() => {
    return timeLogs.filter(log => {
      const d = logDate(log);
      if (!d || d < rangeStart || d >= rangeEnd) return false;
      if (!isTeam && log.userId !== member) return false;
      return true;
    });
  }, [timeLogs, rangeStart, rangeEnd, isTeam, member]);

  const totalMin = rangeLogs.reduce((s, l) => s + (l.spentMinutes || 0), 0);
  const selectedMember = !isTeam ? members.find(m => (m.id || m.uid) === member) : null;
  const teamCapacity = isTeam ? capacity * Math.max(members.length, 1) : capacity;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="w-full pb-16">

        {/* Range heading + spent summary */}
        <div className="flex items-end justify-between gap-4 flex-wrap mb-5 pt-1">
          <div className="flex items-center gap-3 min-w-0">
            {selectedMember && (
              <div className="flex items-center gap-2 bg-canvas rounded-full pl-[4px] pr-[12px] py-[4px]">
                <UserAvatar user={selectedMember} size={24} />
                <span className="text-[13px] font-bold text-ink truncate">{selectedMember.name || selectedMember.email}</span>
              </div>
            )}
            <h2 className="text-[20px] font-bold text-ink tracking-tight">{rangeLabel}</h2>
          </div>
          <p className="text-[13px] text-muted font-medium">
            Витрачений час{' '}
            <span className="text-ink font-bold">{fmtWork(totalMin)}</span>
            {' '}з <span className="font-semibold">{fmtWork(teamCapacity)}</span>
            {isTeam && <span className="text-faint"> · {members.length} учасн.</span>}
          </p>
        </div>

        {/* Grid */}
        {timeLogs.length === 0 ? (
          <EmptyState icon={Clock} title="Даних ще немає" description="Логи часу з'являться після трекінгу завдань" />
        ) : mode === 'week' ? (
          isTeam
            ? <TeamWeek days={days} logs={rangeLogs} members={members} todayKey={todayKey} onSelectMember={onSelectMember} />
            : <MemberWeek days={days} logs={rangeLogs} issuesById={issuesById} todayKey={todayKey} />
        ) : (
          <MonthGrid anchor={anchor} logs={rangeLogs} todayKey={todayKey} onSelectDay={onSelectDay} />
        )}

        {mode === 'week' && !isTeam && rangeLogs.length === 0 && (
          <p className="text-center text-[13px] text-muted mt-6">Немає залогованого часу за цей тиждень</p>
        )}
      </div>

      <LogTimeModal
        isOpen={logModalOpen}
        onClose={onCloseLogModal}
        projects={projects}
        issues={issues}
      />
    </div>
  );
}
