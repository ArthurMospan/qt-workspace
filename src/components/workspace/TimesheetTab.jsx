'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useWeeklyTimeLogs } from '@/lib/hooks/useWeeklyTimeLogs';
import Button from '@/components/ui/Button';

function fmtTime(minutes) {
  if (!minutes) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}хв`;
  if (m === 0) return `${h}г`;
  return `${h}г ${m}хв`;
}

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const DAYS = ['Пн', 'Вв', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

export default function TimesheetTab() {
  const [currentWeek, setCurrentWeek] = useState(getStartOfWeek(new Date()));
  const { logs, issuesMap, loading } = useWeeklyTimeLogs(currentWeek);

  const handlePrevWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() - 7);
    setCurrentWeek(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + 7);
    setCurrentWeek(d);
  };

  // Build grid data
  // data = { issueId: { title, key, days: [0..6 with minutes] } }
  const grid = {};
  const dayTotals = [0, 0, 0, 0, 0, 0, 0];
  let weekTotal = 0;

  logs.forEach(log => {
    const issue = issuesMap[log.issueId] || { title: 'Невідома завдання', issueKey: '???' };
    if (!grid[log.issueId]) {
      grid[log.issueId] = {
        title: issue.title,
        key: issue.issueKey,
        days: [0, 0, 0, 0, 0, 0, 0]
      };
    }
    const logDate = log.loggedAt?.toDate ? log.loggedAt.toDate() : new Date();
    // 0 = Sunday, 1 = Monday. We want 0 = Monday, 6 = Sunday
    let dayIdx = logDate.getDay() - 1;
    if (dayIdx === -1) dayIdx = 6;

    const mins = log.spentMinutes || 0;
    grid[log.issueId].days[dayIdx] += mins;
    dayTotals[dayIdx] += mins;
    weekTotal += mins;
  });

  const rowKeys = Object.keys(grid);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      
      {/* Controls */}
      <div className="h-[60px] shrink-0 flex items-center justify-between pt-4 w-full">
        <div></div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-[#f4f4f5] rounded-[10px] p-1 border border-[#e9e9e9]">
            <Button style="secondary" size="icon" icon={ChevronLeft} onClick={handlePrevWeek} />
            <span className="text-[13px] font-bold text-[#1f1f1f] px-2 min-w-[120px] text-center">
              {currentWeek.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })} - {new Date(currentWeek.getTime() + 6 * 86400000).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
            </span>
            <Button style="secondary" size="icon" icon={ChevronRight} onClick={handleNextWeek} />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto pt-[20px] pb-16 w-full">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-[#f4f4f5] border-none rounded-[24px] overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                  <th className="px-6 py-4 text-[12px] font-bold text-[#9a9a9a] uppercase tracking-wider w-[30%] border-r border-[#f0f0f0]">Завдання</th>
                  {DAYS.map((d, i) => {
                    const date = new Date(currentWeek);
                    date.setDate(date.getDate() + i);
                    const isToday = new Date().toDateString() === date.toDateString();
                    return (
                      <th key={d} className={`px-2 py-4 text-center border-r border-[#f0f0f0] w-[9%] ${isToday ? 'bg-[#f0fdf4]' : ''}`}>
                        <div className="flex flex-col items-center">
                          <span className={`text-[11px] font-bold uppercase ${isToday ? 'text-[#15803d]' : 'text-[#9a9a9a]'}`}>{d}</span>
                          <span className={`text-[14px] font-bold mt-1 ${isToday ? 'text-[#166534]' : 'text-[#1f1f1f]'}`}>{date.getDate()}</span>
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-4 py-4 text-center text-[12px] font-bold text-[#1f1f1f] uppercase tracking-wider w-[10%]">Всього</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {rowKeys.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-[#9a9a9a] text-[13px]">
                      Немає залоганого часу за цей тиждень
                    </td>
                  </tr>
                ) : (
                  rowKeys.map(issueId => {
                    const row = grid[issueId];
                    const rowTotal = row.days.reduce((a, b) => a + b, 0);
                    return (
                      <tr key={issueId} className="hover:bg-[#fafafa] transition-colors group">
                        <td className="px-6 py-4 border-r border-[#f0f0f0]">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-[#c026d3] mb-1">{row.key}</span>
                            <span className="text-[13px] font-medium text-[#1f1f1f] line-clamp-1">{row.title}</span>
                          </div>
                        </td>
                        {row.days.map((mins, i) => (
                          <td key={i} className="px-2 py-4 text-center border-r border-[#f0f0f0]">
                            <span className={`text-[13px] font-bold ${mins > 0 ? 'text-[#1164A3]' : 'text-[#cfcfcf]'}`}>
                              {fmtTime(mins)}
                            </span>
                          </td>
                        ))}
                        <td className="px-4 py-4 text-center bg-[#fafafa]">
                          <span className="text-[13px] font-bold text-[#1f1f1f]">{fmtTime(rowTotal)}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
                {/* Footer Totals */}
                {rowKeys.length > 0 && (
                  <tr className="bg-[#f0f0f0] border-t-2 border-[#e9e9e9]">
                    <td className="px-6 py-4 text-right text-[12px] font-bold text-[#4a4a4a] uppercase border-r border-[#f0f0f0]">
                      Сума
                    </td>
                    {dayTotals.map((mins, i) => (
                      <td key={i} className="px-2 py-4 text-center border-r border-[#f0f0f0]">
                        <span className={`text-[14px] font-bold ${mins > 0 ? 'text-[#1f1f1f]' : 'text-[#9a9a9a]'}`}>
                          {fmtTime(mins)}
                        </span>
                      </td>
                    ))}
                    <td className="px-4 py-4 text-center">
                      <span className="text-[15px] font-bold text-[#1f1f1f]">{fmtTime(weekTotal)}</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
