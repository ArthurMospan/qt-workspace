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
  ChevronUp, ChevronDown as ChevronDn, Filter, Plus, Trash2, Play, Check, Lock
} from 'lucide-react';
import { Select } from '@/components/ui/Select';
import FilterBar from '@/components/ui/FilterBar';
import Button from '@/components/ui/Button';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const COLUMNS_ORDER = ['backlog','todo','in-progress','code-review','qa','client-approval','done'];
const COLUMN_LABEL  = { backlog:'Backlog', todo:'To Do', 'in-progress':'In Progress', 'code-review':'Code Review', qa:'QA', 'client-approval':'Client Approval', done:'Done' };
const PRIORITY_CFG  = { blocker:{c:'#dc2626',i:AlertOctagon}, high:{c:'#f97316',i:ArrowUp}, medium:{c:'#eab308',i:Minus}, low:{c:'#9a9a9a',i:ArrowDown} };
const TYPE_CFG      = { epic:{c:'#8b5cf6',i:Zap}, feature:{c:'#0891b2',i:Star}, task:{c:'#059669',i:CheckSquare}, bug:{c:'#dc2626',i:Bug} };

function Badge({ label, color }) {
  return <span className="text-[10px] font-bold px-[6px] py-[2px] rounded-[6px]" style={{ color, background: color + '18' }}>{label}</span>;
}

function SortIcon({ k, sortKey, sortDir }) {
  if (sortKey !== k) return null;
  return sortDir === 'asc' ? <ChevronUp size={11} className="inline ml-1" /> : <ChevronDn size={11} className="inline ml-1" />;
}

export default function BacklogTab({ projectId, project, currentUser }) {
  const { issues, issueLinks, loading: issuesLoading, updateIssue, deleteIssue } = useIssues(projectId);
  const { sprints, loading: sprintsLoading, createSprint, startSprint, completeSprint, deleteSprint } = useSprints(projectId);
  const { showToast } = useWorkspaceStore();
  const loading = issuesLoading || sprintsLoading;

  const teamUids = Array.isArray(project?.team) ? project.team : [];
  const { members } = useTeamMembers(teamUids);

  const [activeIssue, setActiveIssue] = useState(null);
  const [filters, setFilters]  = useState({ status: 'all', priority: 'all', type: 'all', sprint: 'all', assignee: 'all' });
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
    .filter(i => {
      if (filters.sprint === 'all') return true;
      if (filters.sprint === 'backlog') return !i.sprintId;
      return i.sprintId === filters.sprint;
    })
    .filter(i => {
      if (filters.assignee === 'all') return true;
      if (filters.assignee === 'unassigned') return !i.assigneeIds || i.assigneeIds.length === 0;
      return i.assigneeIds && i.assigneeIds.includes(filters.assignee);
    })
    .sort((a, b) => {
      let av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      if (sortKey === 'priority') { const O = {blocker:0,high:1,medium:2,low:3}; av = O[a.priority]??3; bv = O[b.priority]??3; }
      if (sortKey === 'columnId') { av = COLUMNS_ORDER.indexOf(a.columnId); bv = COLUMNS_ORDER.indexOf(b.columnId); }
      const res = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return sortDir === 'asc' ? res : -res;
    });

  const handleUpdate  = async (patch) => { if (activeIssue) await updateIssue(activeIssue.id, patch, currentUser?.id, currentUser?.name); };
  const handleDelete  = async () => { if (activeIssue) { await deleteIssue(activeIssue.id); setActiveIssue(null); showToast('Видалено'); } };
  const handleComment = async (text) => { 
    if (activeIssue) {
      await addComment(activeIssue.id, text, currentUser);
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      await updateDoc(doc(db, 'projects', projectId), { updatedAt: serverTimestamp() }).catch(() => {});
    }
  };
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

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    
    const targetSprintId = destination.droppableId === 'backlog' ? null : destination.droppableId.replace('sprint-', '');
    await updateIssue(draggableId, { sprintId: targetSprintId }, currentUser?.id || currentUser?.uid, currentUser?.name);
  };

  const activeOrPlannedSprints = sprints.filter(s => s.status === 'active' || s.status === 'planned');
  const backlogIssues = filtered.filter(i => !i.sprintId);

  const TableHeaderItem = ({ label, tableKey }) => (
    <th onClick={() => toggleSort(tableKey)} className="text-left text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide px-4 py-3 cursor-pointer hover:text-[#1f1f1f] transition-colors select-none">
      {label}<SortIcon k={tableKey} sortKey={sortKey} sortDir={sortDir} />
    </th>
  );

  const IssueTable = ({ issueList, droppableId }) => (
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
        <Droppable droppableId={droppableId} type="issue">
          {(provided) => (
            <tbody ref={provided.innerRef} {...provided.droppableProps}>
              {issueList.map((issue, index) => {
                const pri = PRIORITY_CFG[issue.priority] || PRIORITY_CFG.medium;
                const type = TYPE_CFG[issue.type] || TYPE_CFG.task;
                const PrioIcon = pri.i;
                const TypeIcon = type.i;
                const assignees = (issue.assigneeIds||[]).map(uid => members.find(m=>(m.id||m.uid)===uid)).filter(Boolean);

                return (
                  <Draggable key={issue.id} draggableId={issue.id} index={index}>
                    {(provided, snapshot) => (
                      <tr 
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        onClick={() => setActiveIssue(issue)}
                        className={`bg-white cursor-pointer transition-all duration-200 group ${snapshot.isDragging ? 'shadow-lg ring-2 ring-[#6366f1]' : 'hover:bg-[#fcfcfc] hover:ring-4 hover:ring-[#1f1f1f]/5'}`}
                        style={provided.draggableProps.style}
                      >
                        <td className="px-4 py-3 w-[100px] first:rounded-l-[16px] border-y border-l border-[#efefef]">
                          <span className="font-mono text-[11px] font-bold text-[#9a9a9a] group-hover:text-[#6366f1] transition-colors">{issue.issueKey || '—'}</span>
                        </td>
                        <td className="px-4 py-3 max-w-[280px] border-y border-[#efefef]">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-semibold text-[#1f1f1f] truncate">{issue.title}</p>
                            {issueLinks?.some(l => 
                              l.targetIssueId === issue.id && 
                              l.relationType === 'blocks' && 
                              issues.some(i => i.id === l.sourceIssueId && i.columnId !== 'done')
                            ) && (
                              <span title="Заблоковано іншою завданням" className="flex items-center gap-[2px] px-[4px] py-[2px] bg-[#fef2f2] text-[#ef4444] rounded-[4px] text-[9px] font-bold">
                                <Lock size={10} /> Blocked
                              </span>
                            )}
                          </div>
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
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
              {issueList.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[12px] text-[#cfcfcf]">Задач не знайдено в цьому списку</td></tr>
              )}
            </tbody>
          )}
        </Droppable>
      </table>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white px-[20px] pt-[16px] pb-[20px]">
      {/* Filters */}
      <div className="flex items-center justify-between mb-4">
        <FilterBar>
          <Select
            value={filters.sprint}
            onChange={val => setFilter('sprint', val)}
            options={[
              { value: 'all', label: 'Всі спринти' },
              { value: 'backlog', label: 'Backlog (Без спринта)' },
              ...sprints.map(s => ({ value: s.id, label: s.name }))
            ]}
            variant="ghost"
          />
          <Select
            value={filters.assignee}
            onChange={val => setFilter('assignee', val)}
            options={[
              { value: 'all', label: 'Всі виконавці' },
              { value: 'unassigned', label: 'Без виконавця' },
              ...members.map(m => ({ value: m.id || m.uid, label: m.name || m.email }))
            ]}
            variant="ghost"
          />
          <Select
            value={filters.status}
            onChange={val => setFilter('status', val)}
            options={[
              { value: 'all', label: 'Всі статуси' },
              ...COLUMNS_ORDER.map(c => ({ value: c, label: COLUMN_LABEL[c] }))
            ]}
            variant="ghost"
          />
          <Select
            value={filters.priority}
            onChange={val => setFilter('priority', val)}
            options={[
              { value: 'all', label: 'Всі пріоритети' },
              { value: 'blocker', label: 'Blocker', dotColor: '#ef4444' },
              { value: 'high', label: 'High', dotColor: '#f97316' },
              { value: 'medium', label: 'Medium', dotColor: '#eab308' },
              { value: 'low', label: 'Low', dotColor: '#3b82f6' },
            ]}
            variant="ghost"
          />
          <Select
            value={filters.type}
            onChange={val => setFilter('type', val)}
            options={[
              { value: 'all', label: 'Всі типи' },
              { value: 'epic', label: 'Epic' },
              { value: 'feature', label: 'Feature' },
              { value: 'task', label: 'Task' },
              { value: 'bug', label: 'Bug' },
            ]}
            variant="ghost"
          />
        </FilterBar>
        <Button style="primary" size="md" icon={Plus} onClick={handleCreateSprint}>
          Створити спринт
        </Button>
      </div>

      {/* Main Content */}
      <DragDropContext onDragEnd={handleDragEnd}>
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
                <div key={sprint.id} className="bg-[#f4f4f5] rounded-[16px] border border-transparent shadow-none mb-6 overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="text-[14px] font-bold text-[#1f1f1f]">{sprint.name}</h3>
                      {sprint.status === 'active' && <Badge label="Активний" color="#10b981" />}
                      {sprint.status === 'planned' && <Badge label="Запланований" color="#9a9a9a" />}
                      <span className="text-[11px] text-[#9a9a9a]">{sprintIssues.length} завдань</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {sprint.status === 'planned' && (
                        <Button style="primary" size="sm" icon={Play} onClick={() => startSprint(sprint.id)}>Почати спринт</Button>
                      )}
                      {sprint.status === 'active' && (
                        <Button style="primary" size="sm" icon={Check} onClick={() => completeSprint(sprint.id)}>Завершити спринт</Button>
                      )}
                      {sprint.status !== 'active' && (
                        <Button style="secondary" color="red" size="icon" icon={Trash2} onClick={() => { if(confirm('Видалити спринт?')) deleteSprint(sprint.id); }}>Видалити</Button>
                      )}
                    </div>
                  </div>
                  <IssueTable issueList={sprintIssues} droppableId={`sprint-${sprint.id}`} />
                </div>
              );
            })}

            {/* Backlog */}
            <div className="bg-[#f4f4f5] rounded-[16px] border border-transparent shadow-none overflow-hidden mt-4">
              <div className="px-5 py-4 flex items-center gap-3">
                <h3 className="text-[14px] font-bold text-[#1f1f1f]">Backlog</h3>
                <span className="text-[11px] text-[#9a9a9a]">{backlogIssues.length} завдань</span>
              </div>
              <IssueTable issueList={backlogIssues} droppableId="backlog" />
            </div>
          </div>
        )}
      </div>
      </DragDropContext>

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
