'use client';
// src/app/workspace/[projectId]/backlog/page.js — Flat issue list with filters
import { use, useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useIssues } from '@/lib/hooks/useIssues';
import { useSprints } from '@/lib/hooks/useSprints';
import { useTeamMembers } from '@/lib/hooks/useTeamMembers';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import IssueModal from '@/components/workspace/IssueModal';
import { useTimeLogs } from '@/lib/hooks/useTimeLogs';
import { useComments } from '@/lib/hooks/useComments';
import { useAuditLog } from '@/lib/hooks/useAuditLog';
import { useEffect } from 'react';
import {
  AlertOctagon, ArrowUp, Minus, ArrowDown,
  Zap, Bug, Star, CheckSquare,
  ChevronUp, ChevronDown as ChevronDn, Filter, Plus,
} from 'lucide-react';
import Link from 'next/link';
import { Select } from '@/components/ui/Select';

const COLUMNS_ORDER = ['backlog','todo','in-progress','code-review','qa','client-approval','done'];
const COLUMN_LABEL  = { backlog:'Backlog', todo:'To Do', 'in-progress':'In Progress', 'code-review':'Code Review', qa:'QA', 'client-approval':'Client Approval', done:'Done' };
const PRIORITY_CFG  = { blocker:{c:'#dc2626',i:AlertOctagon}, high:{c:'#f97316',i:ArrowUp}, medium:{c:'#eab308',i:Minus}, low:{c:'#9a9a9a',i:ArrowDown} };
const TYPE_CFG      = { epic:{c:'#8b5cf6',i:Zap}, feature:{c:'#0891b2',i:Star}, task:{c:'#059669',i:CheckSquare}, bug:{c:'#dc2626',i:Bug} };

function Badge({ label, color }) {
  return <span className="text-[10px] font-bold px-[6px] py-[2px] rounded-[5px]" style={{ color, background: color + '18' }}>{label}</span>;
}

function SortIcon({ k, sortKey, sortDir }) {
  if (sortKey !== k) return null;
  return sortDir === 'asc' ? <ChevronUp size={11} className="inline ml-1" /> : <ChevronDn size={11} className="inline ml-1" />;
}

function TableHeader({ label, sortKey, tableKey, onSort, sortDir }) {
  return (
    <th onClick={() => onSort(tableKey)}
      className="text-left text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide px-4 py-3 cursor-pointer hover:text-[#1f1f1f] transition-colors select-none">
      {label}<SortIcon k={tableKey} sortKey={sortKey} sortDir={sortDir} />
    </th>
  );
}

export default function BacklogPage({ params }) {
  const { projectId } = use(params);
  const { projects, currentUser } = useAppContext();
  const { issues, loading: issuesLoading, updateIssue, deleteIssue } = useIssues(projectId);
  const { sprints, loading: sprintsLoading, createSprint } = useSprints(projectId);
  const { showToast, activeTimer } = useWorkspaceStore();
  const loading = issuesLoading || sprintsLoading;

  const project  = projects?.find(p => p.id === projectId);
  const teamUids = Array.isArray(project?.team) ? project.team : [];
  const { members } = useTeamMembers(teamUids);

  const [activeIssue, setActiveIssue] = useState(null);
  const [filters, setFilters]  = useState({ status: 'all', priority: 'all', type: 'all', sprint: 'all' });
  const [sortKey, setSortKey]  = useState('order');
  const [sortDir, setSortDir]  = useState('asc');

  const { logs: timeLogs, addTimeLog } = useTimeLogs(activeIssue?.id);
  const { comments, addComment }       = useComments(activeIssue?.id);
  const { logs: auditLogs }            = useAuditLog(activeIssue?.id);

  useEffect(() => {
    setActiveIssue(prev => prev ? issues.find(i => i.id === prev.id) ?? prev : null);
  }, [issues]);

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = issues
    .filter(i => filters.status   === 'all' || i.columnId  === filters.status)
    .filter(i => filters.priority === 'all' || i.priority  === filters.priority)
    .filter(i => filters.type     === 'all' || i.type      === filters.type)
    .filter(i => filters.sprint   === 'all' || (filters.sprint === 'backlog' ? !i.sprintId : i.sprintId === filters.sprint))
    .sort((a, b) => {
      let av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      if (sortKey === 'priority') { const O = {blocker:0,high:1,medium:2,low:3}; av = O[a.priority]??3; bv = O[b.priority]??3; }
      if (sortKey === 'columnId') { av = COLUMNS_ORDER.indexOf(a.columnId); bv = COLUMNS_ORDER.indexOf(b.columnId); }
      const res = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return sortDir === 'asc' ? res : -res;
    });

  const handleUpdate  = async (patch) => { if (activeIssue) await updateIssue(activeIssue.id, patch, currentUser?.id, currentUser?.name); };
  const handleDelete  = async () => { if (activeIssue) { await deleteIssue(activeIssue.id); setActiveIssue(null); showToast('Видалено'); } };
  const handleComment = async (text) => { if (activeIssue) await addComment(activeIssue.id, text, currentUser); };
  const handleLogTime = async (minutes, desc) => {
    if (!activeIssue) return;
    await addTimeLog(activeIssue.id, projectId, currentUser?.id || currentUser?.uid, minutes, desc);
    await updateIssue(activeIssue.id, { spentMinutes: (activeIssue.spentMinutes || 0) + minutes });
    showToast(`${minutes} хв списано ✓`);
  };
  const handleAddSubtask    = async (title) => { if (activeIssue) await handleUpdate({ subtasks: [...(activeIssue.subtasks||[]), {title, done:false}] }); };
  const handleToggleSubtask = async (i) => {
    if (!activeIssue) return;
    const subs = [...(activeIssue.subtasks||[])]; subs[i] = {...subs[i], done: !subs[i].done};
    await handleUpdate({ subtasks: subs });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f7f7f7]">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 bg-white border-b border-[#e9e9e9] shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link href={`/workspace/${projectId}`} className="text-[12px] text-[#9a9a9a] hover:text-[#1f1f1f]">← Дошка</Link>
            <span className="text-[#e9e9e9]">/</span>
            <h1 className="text-[16px] font-bold text-[#1f1f1f]">Backlog</h1>
            <span className="text-[11px] text-[#9a9a9a]">{filtered.length} задач</span>
          </div>
          <button 
            onClick={() => createSprint({})}
            className="flex items-center gap-2 px-3 py-[6px] bg-[#1f1f1f] text-white rounded-[8px] text-[12px] font-bold hover:bg-[#303030] transition-colors"
          >
            <Plus size={14} /> Створити спринт
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={12} className="text-[#9a9a9a]" />
          {[
            { key: 'status',   label: 'Статус',   opts: [{value: 'all', label: 'Всі'}, ...COLUMNS_ORDER.map(c => ({value: c, label: COLUMN_LABEL[c]}))] },
            { key: 'sprint',   label: 'Спринт',   opts: [{value: 'all', label: 'Всі'}, {value: 'backlog', label: 'Без спринта'}, ...sprints.map(s => ({value: s.id, label: s.name}))] },
            { key: 'priority', label: 'Пріоритет', opts: [{value: 'all', label: 'Всі'},{value: 'blocker', label: 'Blocker'},{value: 'high', label: 'High'},{value: 'medium', label: 'Medium'},{value: 'low', label: 'Low'}] },
            { key: 'type',     label: 'Тип',       opts: [{value: 'all', label: 'Всі'},{value: 'epic', label: 'Epic'},{value: 'feature', label: 'Feature'},{value: 'task', label: 'Task'},{value: 'bug', label: 'Bug'}] },
          ].map(({ key, opts }) => (
            <div key={key} className="w-[140px]">
              <Select
                value={filters[key]}
                onChange={val => setFilter(key, val)}
                options={opts}
                className="text-[11px]"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-white border border-[#e9e9e9] rounded-[24px] overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#f7f7f7] border-b border-[#e9e9e9]">
                <tr>
                  <TableHeader label="ID" sortKey={sortKey} tableKey="issueKey" onSort={toggleSort} sortDir={sortDir} />
                  <TableHeader label="Назва" sortKey={sortKey} tableKey="title" onSort={toggleSort} sortDir={sortDir} />
                  <TableHeader label="Тип" sortKey={sortKey} tableKey="type" onSort={toggleSort} sortDir={sortDir} />
                  <TableHeader label="Статус" sortKey={sortKey} tableKey="columnId" onSort={toggleSort} sortDir={sortDir} />
                  <TableHeader label="Спринт" sortKey={sortKey} tableKey="sprintId" onSort={toggleSort} sortDir={sortDir} />
                  <TableHeader label="Пріоритет" sortKey={sortKey} tableKey="priority" onSort={toggleSort} sortDir={sortDir} />
                  <th className="text-left text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide px-4 py-3">Виконавці</th>
                  <TableHeader label="Час" sortKey={sortKey} tableKey="spentMinutes" onSort={toggleSort} sortDir={sortDir} />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f7f7f7]">
                {filtered.map(issue => {
                  const prio = PRIORITY_CFG[issue.priority] || PRIORITY_CFG.medium;
                  const type = TYPE_CFG[issue.type] || TYPE_CFG.task;
                  const PrioIcon = prio.i;
                  const TypeIcon = type.i;
                  const assignees = (issue.assigneeIds||[]).map(uid => members.find(m=>(m.id||m.uid)===uid)).filter(Boolean);

                  return (
                    <tr key={issue.id} onClick={() => setActiveIssue(issue)}
                      className="hover:bg-[#fafafa] cursor-pointer transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] font-bold text-[#9a9a9a]">{issue.issueKey || '—'}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[280px]">
                        <p className="text-[13px] font-semibold text-[#1f1f1f] truncate">{issue.title}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: type.c }}>
                          <TypeIcon size={11} /> {issue.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge label={COLUMN_LABEL[issue.columnId] || issue.columnId} color="#9a9a9a" />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-medium text-[#1f1f1f]">
                          {sprints.find(s => s.id === issue.sprintId)?.name || 'Backlog'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: prio.c }}>
                          <PrioIcon size={11} /> {issue.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex -space-x-1">
                          {assignees.slice(0,3).map(m => (
                            <img key={m.id||m.uid} src={m.avatar||m.photoURL||`https://ui-avatars.com/api/?name=${m.name}&size=20`}
                              alt={m.name} title={m.name}
                              className="w-[20px] h-[20px] rounded-full ring-[1.5px] ring-white object-cover" />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-[#9a9a9a]">
                        {issue.spentMinutes > 0 ? `${Math.floor(issue.spentMinutes/60)}г ${issue.spentMinutes%60}хв` : '—'}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-[13px] text-[#cfcfcf]">
                    Задачі не знайдено
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeIssue && (
        <IssueModal issue={activeIssue} members={members} comments={comments} timeLogs={timeLogs} auditLogs={auditLogs} sprints={sprints}
          onClose={() => setActiveIssue(null)} onUpdate={handleUpdate} onDelete={handleDelete}
          onAddComment={handleComment} onLogTime={handleLogTime}
          onAddSubtask={handleAddSubtask} onToggleSubtask={handleToggleSubtask}
        />
      )}
    </div>
  );
}
