'use client';
// src/components/workspace/BacklogTab.jsx — Issue list with filters, navigates to full page on click
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTeamMembers } from '@/lib/hooks/useTeamMembers';
import UserAvatar from '@/components/UserAvatar';
import {
  AlertOctagon, ArrowUp, Minus, ArrowDown,
  Zap, Bug, Star, CheckSquare,
  ChevronUp, ChevronDown as ChevronDn, Filter, Plus,
} from 'lucide-react';

const COLUMNS_ORDER = ['backlog','todo','in-progress','code-review','qa','client-approval','done'];
const COLUMN_LABEL  = { backlog:'Backlog', todo:'To Do', 'in-progress':'In Progress', 'code-review':'Code Review', qa:'QA', 'client-approval':'Client Approval', done:'Done' };
const PRIO_CFG = { blocker:{c:'#dc2626',i:AlertOctagon}, high:{c:'#f97316',i:ArrowUp}, medium:{c:'#eab308',i:Minus}, low:{c:'#9a9a9a',i:ArrowDown} };
const TYPE_CFG = { epic:{c:'#8b5cf6',i:Zap}, feature:{c:'#0891b2',i:Star}, task:{c:'#059669',i:CheckSquare}, bug:{c:'#dc2626',i:Bug} };

export default function BacklogTab({ issues, loading, projectId, members, onAddIssue }) {
  const router = useRouter();
  const [filters, setFilters] = useState({ status: 'all', priority: 'all', type: 'all' });
  const [sortKey, setSortKey] = useState('order');
  const [sortDir, setSortDir] = useState('asc');
  const [newTitle, setNewTitle] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = issues
    .filter(i => filters.status   === 'all' || i.columnId  === filters.status)
    .filter(i => filters.priority === 'all' || i.priority  === filters.priority)
    .filter(i => filters.type     === 'all' || i.type      === filters.type)
    .sort((a, b) => {
      let av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      if (sortKey === 'priority') { const O = {blocker:0,high:1,medium:2,low:3}; av = O[a.priority]??3; bv = O[b.priority]??3; }
      if (sortKey === 'columnId') { av = COLUMNS_ORDER.indexOf(a.columnId); bv = COLUMNS_ORDER.indexOf(b.columnId); }
      const res = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return sortDir === 'asc' ? res : -res;
    });

  const SortArrow = ({ k }) => sortKey !== k ? null :
    sortDir === 'asc' ? <ChevronUp size={10} className="inline ml-1 opacity-60" /> : <ChevronDn size={10} className="inline ml-1 opacity-60" />;

  const th = (label, key) => (
    <th onClick={() => toggleSort(key)}
      className="text-left text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide px-4 py-3 cursor-pointer hover:text-[#1f1f1f] select-none">
      {label}<SortArrow k={key} />
    </th>
  );

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await onAddIssue('backlog', newTitle.trim());
    setNewTitle(''); setShowAdd(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[#e9e9e9] bg-white shrink-0 flex-wrap">
        <Filter size={12} className="text-[#9a9a9a] shrink-0" />
        {[
          { key: 'status',   opts: [['all','Всі статуси'], ...COLUMNS_ORDER.map(c => [c, COLUMN_LABEL[c]])] },
          { key: 'priority', opts: [['all','Всі пріоритети'],['blocker','Blocker'],['high','High'],['medium','Medium'],['low','Low']] },
          { key: 'type',     opts: [['all','Всі типи'],['epic','Epic'],['feature','Feature'],['task','Task'],['bug','Bug']] },
        ].map(({ key, opts }) => (
          <select key={key} value={filters[key]} onChange={e => setFilter(key, e.target.value)}
            className="px-3 py-[5px] bg-[#f7f7f7] border border-[#e9e9e9] rounded-[8px] text-[11px] font-medium text-[#1f1f1f] cursor-pointer hover:border-[#9a9a9a] transition-colors focus:outline-none">
            {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        <span className="ml-auto text-[11px] text-[#9a9a9a]">{filtered.length} задач</span>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1 px-3 py-[5px] bg-[#1f1f1f] text-white rounded-[8px] text-[11px] font-bold hover:bg-[#303030] transition-colors">
          <Plus size={11} /> Нова задача
        </button>
      </div>

      {/* Quick add */}
      {showAdd && (
        <div className="flex items-center gap-2 px-5 py-2 bg-[#f7f7f7] border-b border-[#e9e9e9] shrink-0">
          <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowAdd(false); }}
            placeholder="Назва задачі... (Enter — зберегти)"
            className="flex-1 px-3 py-[7px] bg-white border border-[#e9e9e9] rounded-[8px] text-[12px] text-[#1f1f1f] focus:border-[#1f1f1f] focus:outline-none"
          />
          <button onClick={handleAdd} className="px-4 py-[7px] bg-[#1f1f1f] text-white rounded-[8px] text-[11px] font-bold">Додати</button>
          <button onClick={() => setShowAdd(false)} className="px-3 py-[7px] text-[#9a9a9a] text-[11px]">✕</button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-white border border-[#e9e9e9] rounded-[14px] overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#f7f7f7] border-b border-[#e9e9e9]">
                <tr>
                  {th('ID', 'issueKey')}
                  {th('Назва', 'title')}
                  {th('Тип', 'type')}
                  {th('Статус', 'columnId')}
                  {th('Пріоритет', 'priority')}
                  <th className="text-left text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide px-4 py-3">Виконавці</th>
                  {th('Час', 'spentMinutes')}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f7f7f7]">
                {filtered.map(issue => {
                  const prio = PRIO_CFG[issue.priority] || PRIO_CFG.medium;
                  const type = TYPE_CFG[issue.type]     || TYPE_CFG.task;
                  const PrioIcon = prio.i;
                  const TypeIcon = type.i;
                  const assignees = (issue.assigneeIds || [])
                    .map(uid => members.find(m => (m.id || m.uid) === uid))
                    .filter(Boolean);

                  return (
                    <tr key={issue.id}
                      onClick={() => router.push(`/workspace/${projectId}/issue/${issue.id}`)}
                      className="hover:bg-[#fafafa] cursor-pointer transition-colors">
                      <td className="px-4 py-[10px]">
                        <span className="font-mono text-[11px] font-bold text-[#9a9a9a]">{issue.issueKey || '—'}</span>
                      </td>
                      <td className="px-4 py-[10px] max-w-[280px]">
                        <p className="text-[13px] font-semibold text-[#1f1f1f] truncate">{issue.title}</p>
                      </td>
                      <td className="px-4 py-[10px]">
                        <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: type.c }}>
                          <TypeIcon size={11} /> {issue.type}
                        </span>
                      </td>
                      <td className="px-4 py-[10px]">
                        <span className="text-[10px] font-bold px-[6px] py-[2px] rounded-[5px] bg-[#f0f0f0] text-[#9a9a9a]">
                          {COLUMN_LABEL[issue.columnId] || issue.columnId}
                        </span>
                      </td>
                      <td className="px-4 py-[10px]">
                        <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: prio.c }}>
                          <PrioIcon size={11} /> {issue.priority}
                        </span>
                      </td>
                      <td className="px-4 py-[10px]">
                        <div className="flex -space-x-1">
                          {assignees.slice(0, 3).map(m => (
                            <UserAvatar key={m.id || m.uid} user={m} size={20}
                              className="ring-[1.5px] ring-white" />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-[10px] text-[11px] text-[#9a9a9a]">
                        {issue.spentMinutes > 0
                          ? `${Math.floor(issue.spentMinutes / 60)}г ${issue.spentMinutes % 60}хв`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-[13px] text-[#cfcfcf]">
                    Задачі не знайдено
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
