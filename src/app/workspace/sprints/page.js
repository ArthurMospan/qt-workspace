'use client';
// src/app/workspace/sprints/page.js — Global Sprints & Planning styled like Project page
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { useSprints } from '@/lib/hooks/useSprints';
import { useWorkspaceAnalytics } from '@/lib/hooks/useWorkspaceAnalytics';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import IssueCard from '@/components/workspace/IssueCard';
import CreateTaskModal from '@/components/CreateTaskModal';
import IssueModal from '@/components/workspace/IssueModal';
import PageHeader from '@/components/workspace/PageHeader';
import { can } from '@/lib/utils/can';
import { 
  Plus, Play, Check, Trash2, Edit2, Calendar, 
  ChevronDown, ChevronRight, ChevronUp, Zap, 
  AlertCircle, AlertOctagon, ArrowUp, Minus, ArrowDown,
  Star, Bug, CheckSquare, Filter
} from 'lucide-react';
import { Select, MultiSelect } from '@/components/ui/Select';

const COLUMNS_ORDER = ['backlog','todo','in-progress','code-review','qa','client-approval','done'];
const COLUMN_LABEL  = { backlog:'Backlog', todo:'To Do', 'in-progress':'In Progress', 'code-review':'Code Review', qa:'QA', 'client-approval':'Client Approval', done:'Done' };
const PRIORITY_CFG  = { blocker:{c:'#dc2626',i:AlertOctagon}, high:{c:'#f97316',i:ArrowUp}, medium:{c:'#eab308',i:Minus}, low:{c:'#9a9a9a',i:ArrowDown} };
const TYPE_CFG      = { epic:{c:'#8b5cf6',i:Zap}, feature:{c:'#0891b2',i:Star}, task:{c:'#059669',i:CheckSquare}, bug:{c:'#dc2626',i:Bug} };

const COLUMNS = [
  { id: 'todo',        label: 'To Do',       color: '#6366f1' },
  { id: 'in-progress', label: 'In Progress', color: '#0891b2' },
  { id: 'done',        label: 'Done',        color: '#10b981' },
];

function Badge({ label, color }) {
  return <span className="text-[10px] font-bold px-[6px] py-[2px] rounded-[5px]" style={{ color, background: color + '18' }}>{label}</span>;
}

function SprintEditModal({ sprint, onClose, onSave }) {
  const [name, setName] = useState(sprint.name || '');
  const [goal, setGoal] = useState(sprint.goal || '');
  const [startDate, setStartDate] = useState(sprint.startDate ? new Date(sprint.startDate.toDate ? sprint.startDate.toDate() : sprint.startDate).toISOString().substring(0, 10) : '');
  const [endDate, setEndDate] = useState(sprint.endDate ? new Date(sprint.endDate.toDate ? sprint.endDate.toDate() : sprint.endDate).toISOString().substring(0, 10) : '');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name,
      goal,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[24px] shadow-xl w-[480px] p-6 max-w-[90%] border border-[#efefef]">
        <h3 className="text-[18px] font-bold text-[#1f1f1f] mb-4">Редагувати спринт</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wide block mb-1">Назва спринта</label>
            <input 
              type="text" 
              required
              value={name} 
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-[#f7f7f7] border border-[#efefef] rounded-xl text-[14px] font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1f1f1f]"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wide block mb-1">Ціль спринта</label>
            <textarea 
              value={goal} 
              onChange={e => setGoal(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-[#f7f7f7] border border-[#efefef] rounded-xl text-[13px] font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1f1f1f] resize-none"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wide block mb-1">Дата початку</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#f7f7f7] border border-[#efefef] rounded-xl text-[13px] font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1f1f1f]"
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wide block mb-1">Дата завершення</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#f7f7f7] border border-[#efefef] rounded-xl text-[13px] font-medium text-[#1f1f1f] focus:outline-none focus:border-[#1f1f1f]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-bold text-[#9a9a9a] hover:text-[#1f1f1f] transition-all"
            >
              Скасувати
            </button>
            <button 
              type="submit"
              className="px-5 py-2 bg-[#1f1f1f] text-white rounded-xl text-[13px] font-bold hover:bg-[#303030] transition-all"
            >
              Зберегти
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function GlobalSprintsPage() {
  const router = useRouter();
  const { currentUser, projects, activeOrgId, orgRole } = useAppContext();
  const { members } = useOrganization();
  const { labels } = useWorkflowConfig();
  const showToast = useWorkspaceStore(s => s.showToast);

  // No breadcrumbs for main pages
  useEffect(() => {
    return () => useWorkspaceStore.setState({ breadcrumbs: [] });
  }, []);

  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'planning'
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [editingSprint, setEditingSprint] = useState(null);
  const [activeIssue, setActiveIssue] = useState(null);
  const [sectionExpansion, setSectionExpansion] = useState({});
  const [projectFilters, setProjectFilters] = useState([]);
  const [sortKey, setSortKey]  = useState('order');
  const [sortDir, setSortDir]  = useState('asc');

  const isManager = can(orgRole, 'manage:sprints');
  const projectIds = (projects || []).map(p => p.id);
  const { issues, loading: issuesLoading } = useWorkspaceAnalytics(projectIds);
  const { sprints, loading: sprintsLoading, createSprint, updateSprint, deleteSprint, startSprint, completeSprint } = useSprints();

  const loading = issuesLoading || sprintsLoading;

  const onDragEnd = async ({ draggableId, source, destination }) => {
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const issueId = draggableId;

    if (activeTab === 'active') {
      try {
        const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        
        await updateDoc(doc(db, 'issues', issueId), {
          columnId: destination.droppableId,
          status: destination.droppableId,
          updatedAt: serverTimestamp()
        });
        showToast('Статус оновлено ✓');
      } catch (err) {
        console.error(err);
        showToast('Помилка оновлення статусу');
      }
    } else {
      try {
        const targetSprintId = destination.droppableId === 'backlog' ? null : destination.droppableId;
        const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        
        await updateDoc(doc(db, 'issues', issueId), {
          sprintId: targetSprintId,
          updatedAt: serverTimestamp()
        });
        showToast('Спринт оновлено ✓');
      } catch (err) {
        console.error(err);
        showToast('Помилка оновлення спринта');
      }
    }
  };

  const handleCreateSprint = async () => {
    try {
      await createSprint({});
      showToast('Спринт створено ✓');
    } catch (e) {
      console.error(e);
      showToast('Помилка створення спринта');
    }
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // Filter & Sort issues
  const filteredIssues = issues.filter(i => {
    if (projectFilters.length > 0 && !projectFilters.includes(i.projectId)) return false;
    return true;
  });

  const getSortedIssues = (issueList) => {
    return [...issueList].sort((a, b) => {
      let av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      if (sortKey === 'priority') { 
        const O = { blocker: 0, high: 1, medium: 2, low: 3 }; 
        av = O[a.priority] ?? 3; 
        bv = O[b.priority] ?? 3; 
      }
      if (sortKey === 'columnId') { 
        av = COLUMNS_ORDER.indexOf(a.columnId); 
        bv = COLUMNS_ORDER.indexOf(b.columnId); 
      }
      const res = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return sortDir === 'asc' ? res : -res;
    });
  };

  const activeSprintList = (sprints || []).filter(s => s.status === 'active');
  const plannedSprintList = (sprints || []).filter(s => s.status === 'planned');
  const completedSprintList = (sprints || []).filter(s => s.status === 'completed');

  const activeSprintIds = new Set(activeSprintList.map(s => s.id));
  const sprintMap = (sprints || []).reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {});

  const activeBoardIssues = filteredIssues.filter(i => i.sprintId && activeSprintIds.has(i.sprintId));
  const backlogIssues = filteredIssues.filter(i => !i.sprintId || !sprintMap[i.sprintId]);

  const formatSprintDates = (startDate, endDate) => {
    if (!startDate || !endDate) return null;
    const start = startDate.toDate ? startDate.toDate() : new Date(startDate);
    const end = endDate.toDate ? endDate.toDate() : new Date(endDate);
    return `${start.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  const toggleSection = (id) => {
    setSectionExpansion(prev => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id]
    }));
  };

  const isSectionExpanded = (sprintId, def = true) => {
    if (sectionExpansion[sprintId] !== undefined) {
      return sectionExpansion[sprintId];
    }
    return def;
  };

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return null;
    return sortDir === 'asc' ? <ChevronUp size={11} className="inline ml-1" /> : <ChevronDown size={11} className="inline ml-1" />;
  };

  const IssueTable = ({ issueList, droppableId, isBacklogCol = false }) => {
    const sorted = getSortedIssues(issueList);
    return (
      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div className="overflow-x-auto min-h-[60px]" ref={provided.innerRef} {...provided.droppableProps}>
            <table className="w-full relative border-separate border-spacing-y-2 px-4 pb-4 bg-transparent table-fixed">
              <thead>
                <tr>
                  <th onClick={() => toggleSort('issueKey')} className="w-[90px] text-left text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide px-3 py-2 cursor-pointer hover:text-[#1f1f1f] select-none">
                    ID <SortIcon k="issueKey" />
                  </th>
                  <th onClick={() => toggleSort('title')} className="text-left text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide px-3 py-2 cursor-pointer hover:text-[#1f1f1f] select-none">
                    Назва <SortIcon k="title" />
                  </th>
                  {!isBacklogCol && (
                    <>
                      <th onClick={() => toggleSort('projectId')} className="w-[140px] text-left text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide px-3 py-2 cursor-pointer hover:text-[#1f1f1f] select-none">
                        Проєкт <SortIcon k="projectId" />
                      </th>
                      <th onClick={() => toggleSort('type')} className="w-[90px] text-left text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide px-3 py-2 cursor-pointer hover:text-[#1f1f1f] select-none">
                        Тип <SortIcon k="type" />
                      </th>
                      <th onClick={() => toggleSort('columnId')} className="w-[110px] text-left text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide px-3 py-2 cursor-pointer hover:text-[#1f1f1f] select-none">
                        Статус <SortIcon k="columnId" />
                      </th>
                    </>
                  )}
                  <th onClick={() => toggleSort('priority')} className="w-[100px] text-left text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide px-3 py-2 cursor-pointer hover:text-[#1f1f1f] select-none">
                    Пріоритет <SortIcon k="priority" />
                  </th>
                  {!isBacklogCol && (
                    <th className="w-[100px] text-left text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide px-3 py-2 select-none">
                      Виконавці
                    </th>
                  )}
                  <th onClick={() => toggleSort('storyPoints')} className="w-[60px] text-left text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide px-3 py-2 cursor-pointer hover:text-[#1f1f1f] select-none">
                    SP <SortIcon k="storyPoints" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((issue, index) => {
                  const pri = PRIORITY_CFG[issue.priority] || PRIORITY_CFG.medium;
                  const type = TYPE_CFG[issue.type] || TYPE_CFG.task;
                  const PrioIcon = pri.i;
                  const TypeIcon = type.i;
                  const assignees = (issue.assigneeIds || []).map(uid => members.find(m => (m.id || m.uid) === uid)).filter(Boolean);
                  const pName = projects.find(p => p.id === issue.projectId)?.name || '—';

                  return (
                    <Draggable key={issue.id} draggableId={issue.id} index={index}>
                      {(provided, snapshot) => (
                        <tr
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          onClick={() => setActiveIssue(issue)}
                          className={`bg-white hover:bg-white/95 hover:translate-y-[-1px] cursor-pointer transition-all shadow-[0_1px_4px_rgba(0,0,0,0.02)] group ${
                            snapshot.isDragging ? 'bg-[#f0f4ff] scale-[1.01] border-2 border-indigo-500 z-[100]' : ''
                          }`}
                        >
                          <td className="px-3 py-2.5 first:rounded-l-[12px] border-y border-l border-[#efefef]">
                            <span className="font-mono text-[11px] font-bold text-[#9a9a9a] group-hover:text-[#6366f1] transition-colors">{issue.issueKey || '—'}</span>
                          </td>
                          <td className="px-3 py-2.5 border-y border-[#efefef] truncate">
                            <div className="flex flex-col min-w-0">
                              <p className="text-[12px] font-semibold text-[#1f1f1f] truncate">{issue.title}</p>
                              {isBacklogCol && (
                                <span className="text-[9px] font-medium text-[#6366f1] truncate mt-0.5 max-w-[120px]">
                                  {pName}
                                </span>
                              )}
                            </div>
                          </td>
                          {!isBacklogCol && (
                            <>
                              <td className="px-3 py-2.5 border-y border-[#efefef] truncate">
                                <span className="text-[10px] font-bold text-[#6366f1] bg-[#e0e7ff] px-2 py-0.5 rounded truncate max-w-[120px] inline-block">
                                  {pName}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 border-y border-[#efefef]">
                                <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: type.c }}>
                                  <TypeIcon size={11} /> {issue.type}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 border-y border-[#efefef]">
                                <Badge label={COLUMN_LABEL[issue.columnId] || issue.columnId} color="#9a9a9a" />
                              </td>
                            </>
                          )}
                          <td className="px-3 py-2.5 border-y border-[#efefef]">
                            <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: pri.c }}>
                              <PrioIcon size={11} /> {issue.priority}
                            </span>
                          </td>
                          {!isBacklogCol && (
                            <td className="px-3 py-2.5 border-y border-[#efefef]">
                              <div className="flex -space-x-1">
                                {assignees.slice(0, 3).map(m => (
                                  <img 
                                    key={m.id || m.uid} 
                                    src={m.avatar || m.photoURL || `https://ui-avatars.com/api/?name=${m.name}&size=20`}
                                    alt={m.name} 
                                    title={m.name}
                                    className="w-[20px] h-[20px] rounded-full ring-[1.5px] ring-white object-cover" 
                                  />
                                ))}
                              </div>
                            </td>
                          )}
                          <td className="px-3 py-2.5 last:rounded-r-[12px] border-y border-r border-[#efefef] text-[11px] text-[#9a9a9a]">
                            {issue.storyPoints > 0 ? `${issue.storyPoints} SP` : '—'}
                          </td>
                        </tr>
                      )}
                    </Draggable>
                  );
                })}
                {issueList.length === 0 && (
                  <tr>
                    <td colSpan={isBacklogCol ? 4 : 8} className="px-3 py-8 text-center text-[12px] text-[#cfcfcf]">
                      Задач не знайдено в цьому списку
                    </td>
                  </tr>
                )}
                {provided.placeholder}
              </tbody>
            </table>
          </div>
        )}
      </Droppable>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f7f7f7]">
      
      {/* ── PageHeader ── */}
      <PageHeader
        variant="main"
        title="Спринти"
        className="px-[32px]"
        tabs={[
          { id: 'active', label: 'Активна дошка' },
          { id: 'planning', label: 'Планування' }
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        actions={
          <>
            {activeTab === 'planning' && isManager && (
              <button
                onClick={handleCreateSprint}
                className="flex items-center justify-center gap-[6px] px-[20px] h-[36px] bg-white border border-[#efefef] text-[#1f1f1f] rounded-[10px] text-[14px] font-bold hover:bg-[#f7f7f7] transition-all shadow-sm"
              >
                <Plus size={16} /> Створити спринт
              </button>
            )}
            <button
              onClick={() => setShowCreateTaskModal(true)}
              className="flex items-center justify-center gap-[6px] px-[20px] h-[36px] bg-[#1f1f1f] text-white rounded-[10px] text-[14px] font-bold hover:bg-[#303030] transition-colors"
            >
              <Plus size={16} /> Створити задачу
            </button>
          </>
        }
        filters={
          activeTab === 'planning' ? (
            <div className="flex items-center gap-2 text-[13px] text-[#9a9a9a] font-semibold ml-auto">
              <Filter size={14} className="text-[#9a9a9a]" />
              <MultiSelect
                value={projectFilters}
                onChange={setProjectFilters}
                options={projects.map(p => ({ value: p.id, label: p.name }))}
                placeholder="Всі проєкти"
                searchPlaceholder="Пошук проєкту..."
                className="w-[200px]"
              />
            </div>
          ) : null
        }
      />

      {/* ── Content area ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center bg-white">
          <div className="w-[28px] h-[28px] border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
        </div>
      ) : activeTab === 'active' ? (
        /* ACTIVE BOARD TAB */
        <div className="flex-1 overflow-hidden px-[20px] pt-[16px] pb-[20px] flex flex-col bg-white">
          {activeSprintList.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <AlertCircle size={32} className="text-[#9a9a9a] mb-2" />
              <h3 className="text-[16px] font-bold text-[#1f1f1f]">Немає активних спринтів</h3>
              <p className="text-[13px] text-[#9a9a9a] max-w-[320px] mt-1">
                Перейдіть на вкладку «Планування», щоб створити та почати спринт для вашої команди.
              </p>
              <button 
                onClick={() => setActiveTab('planning')}
                className="mt-4 px-4 py-2 bg-[#1f1f1f] text-white font-bold text-[12px] rounded-xl hover:bg-[#303030] transition-all"
              >
                До планування
              </button>
            </div>
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="flex flex-col h-full min-h-0">
                <div className="flex items-center gap-2 mb-3 bg-[#f7f7f7] rounded-[14px] px-4 py-2 border border-[#efefef] w-fit">
                  <span className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wide">Активні спринти:</span>
                  {activeSprintList.map(s => (
                    <span key={s.id} className="text-[11px] font-bold text-[#1f1f1f] bg-white px-2 py-0.5 rounded shadow-sm border border-[#efefef]">
                      {s.name}
                    </span>
                  ))}
                </div>
                <div className="flex gap-4 h-full overflow-x-auto pb-2 pr-1">
                  {COLUMNS.map(col => {
                    const colIssues = activeBoardIssues.filter(i => {
                      const cId = i.columnId || i.status || 'todo';
                      if (col.id === 'todo')        return ['todo', 'backlog'].includes(cId);
                      if (col.id === 'in-progress') return ['in-progress', 'code-review', 'qa', 'client-approval'].includes(cId);
                      if (col.id === 'done')        return cId === 'done';
                      return false;
                    });

                    return (
                      <div key={col.id} className="flex flex-col w-[280px] shrink-0 bg-[#f7f7f7] rounded-[24px] overflow-hidden" style={{ height: 'calc(100vh - 210px)' }}>
                        <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
                          <div className="flex items-center gap-[8px]">
                            <span className="w-[8px] h-[8px] rounded-full" style={{ background: col.color }} />
                            <h3 className="text-[12px] font-bold text-[#1f1f1f] uppercase tracking-wide">{col.label}</h3>
                            <span className="text-[11px] font-bold text-[#9a9a9a] bg-white/60 px-[6px] py-[2px] rounded-full">
                              {colIssues.length}
                            </span>
                          </div>
                        </div>

                        <Droppable droppableId={col.id}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`flex-1 overflow-y-auto px-[8px] flex flex-col gap-[8px] transition-colors ${snapshot.isDraggingOver ? 'bg-[#f0f0f0]' : ''}`}
                            >
                              {colIssues.length === 0 ? (
                                <div className="flex items-center justify-center h-20 text-[13px] text-[#cfcfcf]">
                                  Немає задач
                                </div>
                              ) : (
                                colIssues.map((issue, index) => {
                                  const pName = projects.find(p => p.id === issue.projectId)?.name;
                                  return (
                                    <IssueCard
                                      key={issue.id}
                                      issue={issue}
                                      members={members}
                                      labels={labels}
                                      index={index}
                                      projectId={issue.projectId}
                                      projectName={pName}
                                    />
                                  );
                                })
                              )}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    );
                  })}
                </div>
              </div>
            </DragDropContext>
          )}
        </div>
      ) : (
        /* PLANNING TAB */
        <div className="flex-1 flex flex-col min-h-0 bg-white px-[20px] pt-[16px] pb-[20px] overflow-hidden">
          
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex-1 flex flex-row gap-6 min-h-0 items-stretch">
              
              {/* Left Column: Sprints (65%) */}
              <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2 min-h-0">
                {sprints.map(sprint => {
                  const sprintIssues = filteredIssues.filter(i => i.sprintId === sprint.id);
                  const isExpanded = isSectionExpanded(sprint.id, sprint.status !== 'completed');
                  const totalSP = sprintIssues.reduce((sum, i) => sum + (i.storyPoints || 0), 0);

                  return (
                    <div key={sprint.id} className="bg-[#f7f7f7] rounded-[24px] border border-transparent shadow-none overflow-hidden shrink-0">
                      <div className="px-5 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={() => toggleSection(sprint.id)}>
                          {isExpanded ? <ChevronDown size={16} className="text-[#9a9a9a]" /> : <ChevronRight size={16} className="text-[#9a9a9a]" />}
                          <h3 className="text-[14px] font-bold text-[#1f1f1f] truncate">{sprint.name}</h3>
                          {sprint.status === 'active' && <Badge label="Активний" color="#10b981" />}
                          {sprint.status === 'planned' && <Badge label="Запланований" color="#9a9a9a" />}
                          {sprint.status === 'completed' && <Badge label="Завершено" color="#cbd5e1" />}
                          <span className="text-[11px] text-[#9a9a9a] shrink-0">{sprintIssues.length} задач</span>
                          {totalSP > 0 && <span className="text-[11px] text-[#6366f1] shrink-0">({totalSP} SP)</span>}
                          {sprint.startDate && (
                            <span className="text-[11px] text-[#9a9a9a] hidden sm:inline ml-2">
                              {formatSprintDates(sprint.startDate, sprint.endDate)}
                            </span>
                          )}
                        </div>

                        {isManager && (
                          <div className="flex items-center gap-2">
                            {sprint.status === 'planned' && (
                              <button onClick={() => startSprint(sprint.id)} className="flex items-center gap-1 text-[11px] font-bold bg-[#1f1f1f] text-white px-3 py-1.5 rounded-[10px] hover:bg-[#303030] transition-colors">
                                <Play size={10} /> Почати спринт
                              </button>
                            )}
                            {sprint.status === 'active' && (
                              <button onClick={() => completeSprint(sprint.id)} className="flex items-center gap-1 text-[11px] font-bold bg-[#10b981] text-white px-3 py-1.5 rounded-[10px] hover:bg-[#059669] transition-colors">
                                <Check size={10} /> Завершити спринт
                              </button>
                            )}
                            <button onClick={() => setEditingSprint(sprint)} className="p-1.5 text-[#9a9a9a] hover:text-[#1f1f1f] rounded-[10px] hover:bg-white transition-colors" title="Редагувати">
                              <Edit2 size={12} />
                            </button>
                            {sprint.status !== 'active' && (
                              <button onClick={() => { if(confirm('Видалити спринт?')) deleteSprint(sprint.id); }} className="p-1.5 text-[#9a9a9a] hover:text-red-500 rounded-[10px] hover:bg-white transition-colors" title="Видалити">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {isExpanded && sprint.goal && (
                        <p className="px-5 pb-2 text-[12px] text-[#9a9a9a] italic">Ціль: {sprint.goal}</p>
                      )}

                      {isExpanded && (
                        <IssueTable issueList={sprintIssues} droppableId={sprint.id} />
                      )}
                    </div>
                  );
                })}
                {sprints.length === 0 && (
                  <div className="py-12 text-center text-[13px] text-[#cfcfcf] bg-[#f7f7f7] rounded-[24px]">
                    Немає запланованих або активних спринтів. Створіть новий спринт, щоб розпочати планування.
                  </div>
                )}
              </div>

              {/* Right Column: Backlog (35%) */}
              <div className="w-[35%] min-w-[320px] bg-[#f7f7f7] rounded-[24px] overflow-hidden flex flex-col min-h-0 border border-[#efefef]">
                <div className="px-5 py-4 flex items-center justify-between shrink-0 border-b border-[#efefef] bg-white/50 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[14px] font-bold text-[#1f1f1f]">Backlog</h3>
                    <span className="text-[11px] font-bold text-[#9a9a9a] bg-[#efefef] px-2 py-0.5 rounded-full">{backlogIssues.length} задач</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <IssueTable issueList={backlogIssues} droppableId="backlog" isBacklogCol={true} />
                </div>
              </div>

            </div>
          </DragDropContext>
        </div>
      )}

      {/* Edit Sprint Modal */}
      {editingSprint && (
        <SprintEditModal
          sprint={editingSprint}
          onClose={() => setEditingSprint(null)}
          onSave={async (updates) => {
            try {
              await updateSprint(editingSprint.id, updates);
              setEditingSprint(null);
              showToast('Спринт оновлено ✓');
            } catch (err) {
              console.error(err);
              showToast('Помилка оновлення спринта');
            }
          }}
        />
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={showCreateTaskModal}
        onClose={() => setShowCreateTaskModal(false)}
        onSubmit={async (formData) => {
          if (!formData.projectId) {
            throw new Error('Будь ласка, оберіть проєкт');
          }
          const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase');
          
          await addDoc(collection(db, 'issues'), {
            issueKey: `WS-${Date.now()}`,
            organizationId: activeOrgId,
            projectId: formData.projectId,
            title: formData.title,
            description: formData.description || '',
            columnId: formData.status || 'todo',
            status: formData.status || 'todo',
            priority: formData.priority || 'medium',
            type: formData.type || 'task',
            assigneeIds: formData.assignees || [],
            labelIds: formData.labelIds || [],
            dueDate: formData.dueDate || null,
            sprintId: formData.sprintId || null,
            createdAt: serverTimestamp(),
            createdBy: currentUser?.uid || currentUser?.id
          });
          showToast('Задачу створено ✓');
        }}
        projects={projects}
        stages={[]}
        teamMembers={members}
        sprints={sprints}
      />

      {/* Issue Detail Modal */}
      {activeIssue && (
        <IssueModal 
          issue={activeIssue} 
          onClose={() => setActiveIssue(null)} 
        />
      )}
    </div>
  );
}
