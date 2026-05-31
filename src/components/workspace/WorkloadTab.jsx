'use client';
// src/components/workspace/WorkloadTab.jsx — Full rebuild with real capacity bars, time logs and overdue
import { useMemo } from 'react';
import { Users, AlertTriangle, Clock, CheckCircle2, Circle, TrendingUp } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtH(min) {
  if (!min) return '0г';
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? (m > 0 ? `${h}г ${m}хв` : `${h}г`) : `${m}хв`;
}

const PRIORITY_COLORS = {
  blocker: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
};

// ── Capacity Bar ──────────────────────────────────────────────────────────────
function CapacityBar({ open, done, overdue, max = 10 }) {
  const safeMax = Math.max(max, open + done, 1);
  const openPct = Math.min((open / safeMax) * 100, 100);
  const donePct = Math.min((done / safeMax) * 100, 100);
  const overloaded = open > max;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-[6px] bg-[#f0f0f0] rounded-full overflow-hidden flex">
        <div
          className="h-full rounded-l-full transition-all"
          style={{
            width: `${donePct}%`,
            background: '#10b981',
          }}
        />
        <div
          className="h-full transition-all"
          style={{
            width: `${openPct}%`,
            background: overloaded ? '#ef4444' : '#6366f1',
          }}
        />
      </div>
      <div className="flex items-center gap-2 shrink-0 text-[11px]">
        <span className="font-semibold text-[#10b981]">{done}✓</span>
        <span className="font-semibold text-[#6366f1]">{open}</span>
        {overdue > 0 && <span className="font-bold text-red-500">!{overdue}</span>}
      </div>
    </div>
  );
}

// ── Time Bar ─────────────────────────────────────────────────────────────────
function TimeBar({ minutes, maxMinutes }) {
  const pct = maxMinutes > 0 ? Math.min((minutes / maxMinutes) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-[80px] h-[4px] bg-[#f0f0f0] rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-[#0891b2] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-medium text-[#9a9a9a] w-[48px]">{fmtH(minutes)}</span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function WorkloadTab({ members = [], issues = [], timeLogs = [] }) {
  const stats = useMemo(() => {
    const now = Date.now();

    const memberStats = members.map(m => {
      const uid = m.id || m.uid;
      const mine = issues.filter(i => i.assigneeIds?.includes(uid));
      const open = mine.filter(i => i.columnId !== 'done');
      const done = mine.filter(i => i.columnId === 'done');
      const overdue = open.filter(i => {
        const due = i.dueDate?.toDate ? i.dueDate.toDate() : i.dueDate ? new Date(i.dueDate) : null;
        return due && due.getTime() < now;
      });
      const inProg = open.filter(i => i.columnId === 'in-progress');
      const minutes = timeLogs.filter(l => l.userId === uid).reduce((s, l) => s + (l.spentMinutes || 0), 0);

      // Priority breakdown of open tasks
      const priorities = { blocker: 0, high: 0, medium: 0, low: 0 };
      open.forEach(i => { if (priorities[i.priority] !== undefined) priorities[i.priority]++; });

      return {
        m, uid,
        total: mine.length,
        open: open.length,
        done: done.length,
        overdue: overdue.length,
        inProg: inProg.length,
        minutes,
        priorities,
      };
    }).filter(s => s.total > 0 || s.minutes > 0)
      .sort((a, b) => b.open - a.open || b.total - a.total);

    const maxOpen = Math.max(...memberStats.map(s => s.open), 5);
    const maxMinutes = Math.max(...memberStats.map(s => s.minutes), 1);

    return { memberStats, maxOpen, maxMinutes };
  }, [members, issues, timeLogs]);

  if (stats.memberStats.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Users size={36} className="text-[#e9e9e9] mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-[#cfcfcf]">Немає даних про команду</p>
          <p className="text-[12px] text-[#e0e0e0] mt-1">Призначте виконавців на задачі</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="w-full pb-16">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[#f4f4f5] rounded-[24px] p-5">
            <div className="w-9 h-9 rounded-[12px] flex items-center justify-center bg-[#6366f1]/10 mb-3">
              <Users size={16} className="text-[#6366f1]" />
            </div>
            <p className="text-[28px] font-bold text-[#1f1f1f] leading-none mb-1">{stats.memberStats.length}</p>
            <p className="text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide">Учасників із задачами</p>
          </div>

          <div className="bg-[#f4f4f5] rounded-[24px] p-5">
            <div className="w-9 h-9 rounded-[12px] flex items-center justify-center bg-[#0891b2]/10 mb-3">
              <Circle size={16} className="text-[#0891b2]" />
            </div>
            <p className="text-[28px] font-bold text-[#1f1f1f] leading-none mb-1">
              {stats.memberStats.reduce((s, m) => s + m.open, 0)}
            </p>
            <p className="text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide">Відкритих задач</p>
            <p className="text-[11px] text-[#cfcfcf] mt-1">
              ~{Math.round(stats.memberStats.reduce((s, m) => s + m.open, 0) / Math.max(stats.memberStats.length, 1))} на людину
            </p>
          </div>

          <div className="bg-[#f4f4f5] rounded-[24px] p-5">
            <div className="w-9 h-9 rounded-[12px] flex items-center justify-center bg-[#ef4444]/10 mb-3">
              <AlertTriangle size={16} className="text-[#ef4444]" />
            </div>
            <p className="text-[28px] font-bold text-[#1f1f1f] leading-none mb-1">
              {stats.memberStats.reduce((s, m) => s + m.overdue, 0)}
            </p>
            <p className="text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide">Прострочених</p>
            <p className="text-[11px] text-[#cfcfcf] mt-1">потребують уваги</p>
          </div>
        </div>

        {/* Member cards */}
        <div className="flex flex-col gap-3">
          {stats.memberStats.map(({ m, uid, total, open, done, overdue, inProg, minutes, priorities }) => {
            const isOverloaded = open > stats.maxOpen * 0.7;
            return (
              <div
                key={uid}
                className={`bg-[#f4f4f5] rounded-[24px] p-5 transition-all ${isOverloaded ? 'ring-1 ring-[#ef4444]/20' : ''}`}
              >
                <div className="flex items-start gap-4 mb-4">
                  {/* Avatar + name */}
                  <div className="relative shrink-0">
                    <UserAvatar user={m} size={40} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[14px] font-bold text-[#1f1f1f] truncate">{m.name || m.email}</p>
                      {isOverloaded && (
                        <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full shrink-0">Перевантажений</span>
                      )}
                      {overdue > 0 && (
                        <span className="text-[10px] font-bold text-[#d97706] bg-yellow-50 px-2 py-0.5 rounded-full shrink-0">
                          {overdue} прострочено
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#9a9a9a]">{m.role || m.email}</p>
                  </div>

                  {/* Stats pill row */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-center">
                      <p className="text-[16px] font-bold text-[#1f1f1f]">{total}</p>
                      <p className="text-[9px] font-bold text-[#cfcfcf] uppercase">Всього</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[16px] font-bold text-[#10b981]">{done}</p>
                      <p className="text-[9px] font-bold text-[#cfcfcf] uppercase">Готово</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[16px] font-bold text-[#6366f1]">{open}</p>
                      <p className="text-[9px] font-bold text-[#cfcfcf] uppercase">Відкрито</p>
                    </div>
                    {minutes > 0 && (
                      <div className="text-center">
                        <p className="text-[16px] font-bold text-[#0891b2]">{fmtH(minutes)}</p>
                        <p className="text-[9px] font-bold text-[#cfcfcf] uppercase">Час</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Capacity bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide">Завантаженість</span>
                    <span className="text-[10px] text-[#9a9a9a]">
                      {inProg > 0 && `${inProg} в роботі · `}{open} відкрито
                    </span>
                  </div>
                  <CapacityBar open={open} done={done} overdue={overdue} max={stats.maxOpen} />
                </div>

                {/* Time bar */}
                {minutes > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide">Залоговано часу</span>
                    </div>
                    <TimeBar minutes={minutes} maxMinutes={stats.maxMinutes} />
                  </div>
                )}

                {/* Priority breakdown */}
                {open > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {Object.entries(priorities).filter(([, count]) => count > 0).map(([p, count]) => (
                      <span
                        key={p}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: PRIORITY_COLORS[p] + '18', color: PRIORITY_COLORS[p] }}
                      >
                        {count} {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 mt-5 px-1">
          <span className="flex items-center gap-1.5 text-[11px] text-[#9a9a9a]">
            <span className="w-3 h-3 rounded-full bg-[#10b981] inline-block" /> Завершено
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-[#9a9a9a]">
            <span className="w-3 h-3 rounded-full bg-[#6366f1] inline-block" /> Відкрито
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-[#9a9a9a]">
            <span className="w-3 h-3 rounded-full bg-[#ef4444] inline-block" /> Перевантажений
          </span>
        </div>
      </div>
    </div>
  );
}
