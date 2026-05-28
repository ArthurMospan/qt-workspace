import { useState, useEffect } from 'react';
import { useIssues } from '@/lib/hooks/useIssues';
import { useSprints } from '@/lib/hooks/useSprints';
import { useTeamMembers } from '@/lib/hooks/useTeamMembers';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import IssueModal from '@/components/workspace/IssueModal';
import { useTimeLogs } from '@/lib/hooks/useTimeLogs';
import { useComments } from '@/lib/hooks/useComments';
import { useAuditLog } from '@/lib/hooks/useAuditLog';
import {
  AlertOctagon, ArrowUp, Minus, ArrowDown,
  Zap, Bug, Star, CheckSquare,
  ChevronUp, ChevronDown as ChevronDn, Filter, Plus, Trash2, Play, Check
} from 'lucide-react';
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

export default function BacklogTab({ projectId, project, currentUser }) {
  const { issues, loading: issuesLoading, updateIssue, deleteIssue } = useIssues(projectId);
  const { sprints, loading: sprintsLoading, createSprint, startSprint, completeSprint, deleteSprint } = useSprints(projectId);
  const { showToast } = useWorkspaceStore();
  const loading = issuesLoading || sprintsLoading;

  const teamUids = Array.isArray(project?.team) ? project.team : [];
  const { members } = useTeamMembers(teamUids);

  const [activeIssue, setActiveIssue] = useState(null);
  const [filters, setFilters]  = useState({ status: 'all', priority: 'all', type: 'all' });
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

  const handleCreateSprint = async () => {
    try {
      await createSprint({});
      showToast('Спринт створено', 'success');
    } catch(e) {
      showToast('Помилка створення спринта', 'error');
    }
  };

  const activeOrPlannedSprints = sprints.filter(s => s.status === 'active' || s.status === 'planned');
  const backlogIssues = filtered.filter(i => !i.sprintId);

  const TableHeaderItem = ({ label, tableKey }) => (
    <th onClick={() => toggleSort(tableKey)} className="text-left text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide px-4 py-3 cursor-pointer hover:text-[#1f1f1f] transition-colors select-none">
      {label}<SortIcon k={tableKey} sortKey={sortKey} sortDir={sortDir} />
    </th>
  );

  const IssueTable = ({ issueList }) => (
    <div className="overflow-x-auto">
      <table className="w-full relative border-separate border-spacing-y-2 px-4 pb-4 bg-transparent">
        <thead className="bg-transparent">
          <tr>
            <TableHeaderItem label="ID" tableKey="issueKey" />
            <TableHeaderItem label="Назва" tableKey="title" />
            <TableHeaderItem label="Тип" tableKey="type" />
            <TableHeaderItem label="Статус" tableKey="columnId" />
            <TableHeaderItem label="Пріоритет" tableKey="priority" />
            <th className="text-left text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide px-4 py-3">Виконавці</th>
            <TableHeaderItem label="Час" tableKey="spentMinutes" />
          </tr>
        </thead>
        <tbody>
          {issueList.map(issue => {
            const pri = PRIORITY_CFG[issue.priority] || PRIORITY_CFG.medium;
            const type = TYPE_CFG[issue.type] || TYPE_CFG.task;
            const PrioIcon = pri.i;
            const TypeIcon = type.i;
            const assignees = (issue.assigneeIds||[]).map(uid => members.find(m=>(m.id||m.uid)===uid)).filter(Boolean);

            return (
              <tr key={issue.id} onClick={() => setActiveIssue(issue)}
                className="bg-white hover:bg-white/95 hover:translate-y-[-1px] cursor-pointer transition-all shadow-[0_1px_4px_rgba(0,0,0,0.02)] group">
                <td className="px-4 py-3 w-[100px] first:rounded-l-[16px] border-y border-l border-[#efefef]">
                  <span className="font-mono text-[11px] font-bold text-[#9a9a9a] group-hover:text-[#6366f1] transition-colors">{issue.issueKey || '—'}</span>
                </td>
                <td className="px-4 py-3 max-w-[280px] border-y border-[#efefef]">
                  <p className="text-[13px] font-semibold text-[#1f1f1f] truncate">{issue.title}</p>
                </td>
                <td className="px-4 py-3 w-[120px] border-y border-[#efefef]">
                  <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: type.c }}>
                    <TypeIcon size={11} /> {issue.type}
                  </span>
                </td>
                <td className="px-4 py-3 w-[140px] border-y border-[#efefef]">
                  <Badge label={COLUMN_LABEL[issue.columnId] || issue.columnId} color="#9a9a9a" />
                </td>
                <td className="px-4 py-3 w-[120px] border-y border-[#efefef]">
                  <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: pri.c }}>
                    <PrioIcon size={11} /> {issue.priority}
                  </span>
                </td>
                <td className="px-4 py-3 w-[120px] border-y border-[#efefef]">
                  <div className="flex -space-x-1">
                    {assignees.slice(0,3).map(m => (
                      <img key={m.id||m.uid} src={m.avatar||m.photoURL||`https://ui-avatars.com/api/?name=${m.name}&size=20`}
                        alt={m.name} title={m.name}
                        className="w-[20px] h-[20px] rounded-full ring-[1.5px] ring-white object-cover" />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-[11px] text-[#9a9a9a] w-[100px] last:rounded-r-[16px] border-y border-r border-[#efefef]">
                  {issue.spentMinutes > 0 ? `${Math.floor(issue.spentMinutes/60)}г ${issue.spentMinutes%60}хв` : '—'}
                </td>
              </tr>
            );
          })}
          {issueList.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-8 text-center text-[12px] text-[#cfcfcf]">Задач не знайдено в цьому списку</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white px-[20px] pt-[16px] pb-[20px]">
      {/* Filters */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-[#9a9a9a]" />
          {[
            { key: 'status',   label: 'Статус',   opts: [{value: 'all', label: 'Всі'}, ...COLUMNS_ORDER.map(c => ({value: c, label: COLUMN_LABEL[c]}))] },
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
        <button 
          onClick={handleCreateSprint}
          className="flex items-center gap-2 px-4 py-[8px] bg-[#1f1f1f] text-white rounded-[10px] text-[12px] font-bold hover:bg-[#303030] transition-colors"
        >
          <Plus size={14} /> Створити спринт
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-6 pb-20">
            {/* Sprints */}
            {activeOrPlannedSprints.map(sprint => {
              const sprintIssues = filtered.filter(i => i.sprintId === sprint.id);
              return (
                <div key={sprint.id} className="bg-[#f7f7f7] rounded-[24px] border border-transparent shadow-none mb-6 overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="text-[14px] font-bold text-[#1f1f1f]">{sprint.name}</h3>
                      {sprint.status === 'active' && <Badge label="Активний" color="#10b981" />}
                      {sprint.status === 'planned' && <Badge label="Запланований" color="#9a9a9a" />}
                      <span className="text-[11px] text-[#9a9a9a]">{sprintIssues.length} задач</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {sprint.status === 'planned' && (
                        <button onClick={() => startSprint(sprint.id)} className="flex items-center gap-1.5 text-[11px] font-bold bg-[#1f1f1f] text-white px-3.5 py-2 rounded-[10px] hover:bg-[#303030] transition-colors">
                          <Play size={11} /> Почати спринт
                        </button>
                      )}
                      {sprint.status === 'active' && (
                        <button onClick={() => completeSprint(sprint.id)} className="flex items-center gap-1.5 text-[11px] font-bold bg-[#10b981] text-white px-3.5 py-2 rounded-[10px] hover:bg-[#059669] transition-colors">
                          <Check size={11} /> Завершити спринт
                        </button>
                      )}
                      {sprint.status !== 'active' && (
                        <button onClick={() => { if(confirm('Видалити спринт?')) deleteSprint(sprint.id); }} className="p-2 text-[#9a9a9a] hover:text-red-500 rounded-[10px] hover:bg-white transition-colors" title="Видалити спринт">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <IssueTable issueList={sprintIssues} />
                </div>
              );
            })}

            {/* Backlog */}
            <div className="bg-[#f7f7f7] rounded-[24px] border border-transparent shadow-none overflow-hidden mt-4">
              <div className="px-5 py-4 flex items-center gap-3">
                <h3 className="text-[14px] font-bold text-[#1f1f1f]">Backlog</h3>
                <span className="text-[11px] text-[#9a9a9a]">{backlogIssues.length} задач</span>
              </div>
              <IssueTable issueList={backlogIssues} />
            </div>
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
