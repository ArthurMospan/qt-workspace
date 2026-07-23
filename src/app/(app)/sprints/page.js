'use client';
// src/app/workspace/sprints/page.js — Global Sprints & Planning styled like Project page
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useWorkflowConfig, DEFAULT_PRIORITIES, DEFAULT_TYPES, PRIORITY_ICONS, TYPE_ICONS } from '@/lib/hooks/useWorkflowConfig';
import { useSprints } from '@/lib/hooks/useSprints';
import { useWorkspaceAnalytics } from '@/lib/hooks/useWorkspaceAnalytics';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import IssueCard from '@/components/workspace/IssueCard';
import TaskRow from '@/components/ui/TaskManagement/TaskRow';
import CreateTaskModal from '@/components/CreateTaskModal';
import IssueModal from '@/components/workspace/IssueModal';
import { PageHeader, useConfirm, Dialog, Input, Textarea } from '@/components/ui';
import { can } from '@/lib/utils/can';
import { createIssueViaApi } from '@/lib/services/issues';
import { useLocalization } from '@/lib/hooks/useLocalization';
import {
  Plus, Play, Check, Trash2, Edit2, Calendar,
  ChevronDown, ChevronRight, ChevronUp,
  AlertCircle, Filter
} from 'lucide-react';
import { Select, MultiSelect } from '@/components/ui/Select';
import FilterBar from '@/components/ui/FilterBar';
import Surface from '@/components/ui/Surface';
import Button from '@/components/ui/Button';
import { fromDateInput, toLocalDateInput } from '@/lib/utils/date';

const PRIORITY_CFG  = Object.fromEntries(DEFAULT_PRIORITIES.map(p => [p.id, { c: p.color, i: PRIORITY_ICONS[p.id] }]));
const TYPE_CFG      = Object.fromEntries(DEFAULT_TYPES.map(t => [t.id, { c: t.color, i: TYPE_ICONS[t.id] }]));

function Badge({ label, color }) {
  return <span className="text-[10px] font-bold px-[6px] py-[2px] rounded-[5px]" style={{ color, background: color + '18' }}>{label}</span>;
}

function SprintEditModal({ sprint, onClose, onSave }) {
  const [name, setName] = useState(sprint.name || '');
  const [goal, setGoal] = useState(sprint.goal || '');
  const [startDate, setStartDate] = useState(() => toLocalDateInput(sprint.startDate));
  const [endDate, setEndDate] = useState(() => toLocalDateInput(sprint.endDate));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name,
      goal,
      startDate: fromDateInput(startDate),
      endDate: fromDateInput(endDate, { endOfDay: true })
    });
  };

  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      title="Редагувати спринт"
      size="sm"
      footer={
        <>
          <Button style="secondary" size="md" onClick={onClose} type="button">Скасувати</Button>
          <Button style="primary" size="md" type="submit" form="sprint-edit-form">Зберегти</Button>
        </>
      }
    >
        <form id="sprint-edit-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-bold text-muted uppercase tracking-wide block mb-1">Назва спринта</label>
            <Input type="text" required value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted uppercase tracking-wide block mb-1">Ціль спринта</label>
            <Textarea value={goal} onChange={e => setGoal(e.target.value)} rows={2} />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-[11px] font-bold text-muted uppercase tracking-wide block mb-1">Дата початку</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-bold text-muted uppercase tracking-wide block mb-1">Дата завершення</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
        </form>
    </Dialog>
  );
}

function SprintCreateModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name,
      goal,
      startDate: fromDateInput(startDate),
      endDate: fromDateInput(endDate, { endOfDay: true })
    });
  };

  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      title="Створити спринт"
      size="sm"
      footer={
        <>
          <Button style="secondary" size="md" onClick={onClose} type="button">Скасувати</Button>
          <Button style="primary" size="md" type="submit" form="sprint-create-form">Створити</Button>
        </>
      }
    >
        <form id="sprint-create-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-bold text-muted uppercase tracking-wide block mb-1">Назва спринта</label>
            <Input type="text" required placeholder="Наприклад: Спринт 1" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted uppercase tracking-wide block mb-1">Ціль спринта</label>
            <Textarea value={goal} placeholder="Опишіть ціль цього спринта..." onChange={e => setGoal(e.target.value)} rows={2} />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-[11px] font-bold text-muted uppercase tracking-wide block mb-1">Дата початку</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-bold text-muted uppercase tracking-wide block mb-1">Дата завершення</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
        </form>
    </Dialog>
  );
}

function SprintCompleteModal({ sprint, sprints, incompleteIssues, onClose, onConfirm }) {
  const [moveToSprintId, setMoveToSprintId] = useState('backlog');

  const upcomingSprints = sprints.filter(s => s.status === 'planned');

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(moveToSprintId === 'backlog' ? null : moveToSprintId);
  };

  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      title={`Завершити спринт: ${sprint.name}`}
      size="sm"
      presentation="dialog"
      footer={
        <>
          <Button style="secondary" size="md" onClick={onClose} type="button">Скасувати</Button>
          <Button style="primary" size="md" type="submit" form="sprint-complete-form">Завершити спринт</Button>
        </>
      }
    >
        <p className="text-[13px] text-muted mb-4">
          У цьому спринті залишилось <strong className="text-ink">{incompleteIssues.length} незавершених завдань</strong>. Куди їх перенести?
        </p>
        <form id="sprint-complete-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-bold text-muted uppercase tracking-wide block mb-1">Перенести завдання в</label>
            <select 
              value={moveToSprintId} 
              onChange={e => setMoveToSprintId(e.target.value)}
              className="w-full px-3 py-2 bg-canvas border border-[#efefef] rounded-xl text-[14px] font-medium text-ink focus:outline-none focus:border-ink"
            >
              <option value="backlog">Беклог</option>
              {upcomingSprints.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </form>
    </Dialog>
  );
}

export default function GlobalSprintsPage() {
  const router = useRouter();
  const { currentUser, projects, activeOrgId, orgRole } = useAppContext();
  const { members } = useOrganization();
  const { labels, statuses, doneStatusIds } = useWorkflowConfig();
  const statusOrder = statuses.map(s => s.id);
  const isDoneCol = (id) => doneStatusIds.includes(id);
  const { formatDate } = useLocalization();
  const showToast = useWorkspaceStore(s => s.showToast);
  const sprintSearch = useWorkspaceStore(s => s.sprintSearch);
  const confirmDialog = useConfirm();

  // No breadcrumbs for main pages
  useEffect(() => {
    return () => useWorkspaceStore.setState({ breadcrumbs: [] });
  }, []);

  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showCreateSprintModal, setShowCreateSprintModal] = useState(false);
  const [showCompleteSprintModal, setShowCompleteSprintModal] = useState(null); // sprint object
  const [editingSprint, setEditingSprint] = useState(null);
  const [activeIssue, setActiveIssue] = useState(null);
  const [sectionExpansion, setSectionExpansion] = useState({});
  const [projectFilters, setProjectFilters] = useState([]);
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortKey, setSortKey]  = useState('order');
  const [sortDir, setSortDir]  = useState('asc');

  const isManager = can(orgRole, 'manage:sprints');
  const projectIds = (projects || []).map(p => p.id);
  const { issues, issueLinks, loading: issuesLoading } = useWorkspaceAnalytics(projectIds);
  const { sprints, loading: sprintsLoading, createSprint, updateSprint, deleteSprint, startSprint, completeSprint } = useSprints();

  const loading = issuesLoading || sprintsLoading;

  const onDragEnd = async ({ draggableId, source, destination }) => {
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const issueId = draggableId;

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
  };

  const handleCreateSprint = async (sprintData) => {
    try {
      await createSprint(sprintData);
      setShowCreateSprintModal(false);
      showToast('Спринт створено ✓');
    } catch (e) {
      console.error(e);
      showToast('Помилка створення спринта');
    }
  };

  const handleStartSprint = async (sprintId) => {
    try {
      await startSprint(sprintId);
      showToast('Спринт розпочато ✓');
    } catch (error) {
      showToast(error.message || 'Помилка запуску спринта', 'error');
    }
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // Filter & Sort issues
  const filteredIssues = issues.filter(i => {
    const normalizedSearch = sprintSearch.trim().toLowerCase();
    if (normalizedSearch) {
      const projectName = projects.find(project => project.id === i.projectId)?.name || '';
      const sprintName = sprints.find(sprint => sprint.id === i.sprintId)?.name || '';
      const matches = [i.issueKey, i.title, i.description, projectName, sprintName]
        .some(value => String(value || '').toLowerCase().includes(normalizedSearch));
      if (!matches) return false;
    }
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

  const getSortedIssues = (issueList) => {
    return [...issueList].sort((a, b) => {
      let av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      if (sortKey === 'priority') { 
        const O = { blocker: 0, high: 1, medium: 2, low: 3 }; 
        av = O[a.priority] ?? 3; 
        bv = O[b.priority] ?? 3; 
      }
      if (sortKey === 'columnId') {
        av = statusOrder.indexOf(a.columnId);
        bv = statusOrder.indexOf(b.columnId);
      }
      const res = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return sortDir === 'asc' ? res : -res;
    });
  };

  const activeSprintList = (sprints || []).filter(s => s.status === 'active');
  const plannedSprintList = (sprints || []).filter(s => s.status === 'planned');
  const completedSprintList = (sprints || []).filter(s => s.status === 'completed');

  const sprintMap = (sprints || []).reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {});

  const backlogIssues = filteredIssues.filter(i => !i.sprintId || !sprintMap[i.sprintId]);

  const formatSprintDates = (startDate, endDate) => {
    if (!startDate || !endDate) return null;
    const start = startDate.toDate ? startDate.toDate() : new Date(startDate);
    const end = endDate.toDate ? endDate.toDate() : new Date(endDate);
    return `${formatDate(start)} - ${formatDate(end)}`;
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

  const renderIssueTable = (issueList, droppableId, isBacklogCol = false) => {
    const sorted = getSortedIssues(issueList);
    return (
      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div 
            className="flex flex-col gap-[8px] px-4 pb-4 pt-1 min-h-[60px]" 
            ref={provided.innerRef} 
            {...provided.droppableProps}
          >
            {sorted.map((issue, index) => {
              const pName = projects.find(p => p.id === issue.projectId)?.name || '';
              if (isBacklogCol) {
                return (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    issues={issueList}
                    sprints={sprints}
                    members={members}
                    labels={labels}
                    index={index}
                    projectId={issue.projectId}
                    projectName={pName}
                    issueLinks={issueLinks}
                  />
                );
              }
              return (
                <Draggable key={issue.id} draggableId={issue.id} index={index}>
                  {(draggableProvided, draggableSnapshot) => (
                    <div
                      ref={draggableProvided.innerRef}
                      {...draggableProvided.draggableProps}
                      {...draggableProvided.dragHandleProps}
                      style={{
                        ...draggableProvided.draggableProps.style,
                        opacity: draggableSnapshot.isDragging ? 0.8 : 1,
                      }}
                    >
                      <TaskRow
                        issue={issue}
                        members={members}
                        labels={labels}
                        sprints={sprints}
                        projectId={issue.projectId}
                        projectName={pName}
                        onClick={() => setActiveIssue(issue)}
                      />
                    </div>
                  )}
                </Draggable>
              );
            })}
            {issueList.length === 0 && (
              <div className="py-8 text-center text-[12px] text-faint">
                Задач не знайдено в цьому списку
              </div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    );
  };

  return (
    <div className="flex-1 h-full overflow-hidden bg-transparent">
      <div className="w-full h-full page-gutter pt-[56px] pb-[24px] flex flex-col gap-2">
      
      <PageHeader
        variant="main"
        title="Спринти"
        actions={
          <>
            {isManager && (
              <Button
                style="primary"
                size="lg"
                icon={Plus}
                onClick={() => setShowCreateSprintModal(true)}
                collapseAt="sm"
                title="Створити спринт"
              >
                Створити спринт
              </Button>
            )}
          </>
        }
        filters={
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
            </FilterBar>
        }
      />

      {/* ── Content area ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center bg-transparent">
          <div className="w-[28px] h-[28px] border-[3px] border-line border-t-[#1f1f1f] rounded-full animate-spin" />
        </div>
      ) : (
        /* PLANNING TAB */
        <div className="flex-1 flex flex-col min-h-[600px]">
          
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 items-stretch">

              {/* Left Column: Sprints (65%) */}
              <div className="flex-1 flex flex-col gap-4 overflow-visible lg:overflow-y-auto custom-scrollbar lg:pr-2 min-h-0">
                {sprints.map(sprint => {
                  const sprintIssues = filteredIssues.filter(i => i.sprintId === sprint.id);
                  const isExpanded = isSectionExpanded(sprint.id, sprint.status !== 'completed');

                  return (
                    <div key={sprint.id} className="bg-canvas rounded-[16px] border border-transparent shadow-none overflow-hidden shrink-0">
                      <div className="px-5 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={() => toggleSection(sprint.id)}>
                          {isExpanded ? <ChevronDown size={16} className="text-muted" /> : <ChevronRight size={16} className="text-muted" />}
                          <h3 className="text-[14px] font-bold text-ink truncate">{sprint.name}</h3>
                          {sprint.status === 'active' && <Badge label="Активний" color="#10b981" />}
                          {sprint.status === 'planned' && <Badge label="Запланований" color="#9a9a9a" />}
                          {sprint.status === 'completed' && <Badge label="Завершено" color="#cbd5e1" />}
                          <span className="text-[11px] text-muted shrink-0">{sprintIssues.length} завдань</span>
                          {sprint.startDate && (
                            <span className="text-[11px] text-muted hidden sm:inline ml-2">
                              {formatSprintDates(sprint.startDate, sprint.endDate)}
                            </span>
                          )}
                        </div>

                        {isManager && (
                          <div className="flex items-center gap-2">
                            {sprint.status === 'planned' && (
                              <Button
                                style="primary"
                                size="sm"
                                icon={Play}
                                onClick={() => handleStartSprint(sprint.id)}
                              >
                                Почати спринт
                              </Button>
                            )}
                            {sprint.status === 'active' && (
                              <Button
                                style="primary"
                                size="sm"
                                icon={Check}
                                onClick={() => setShowCompleteSprintModal(sprint)}
                              >
                                Завершити
                              </Button>
                            )}
                            <Button
                              style="secondary"
                              size="icon"
                              icon={Edit2}
                              onClick={() => setEditingSprint(sprint)}
                            >
                              Редагувати
                            </Button>
                            {sprint.status !== 'active' && (
                              <Button
                                style="secondary"
                                size="icon"
                                color="red"
                                icon={Trash2}
                                onClick={async () => {
                                  if (await confirmDialog({ title: 'Видалити спринт?', confirmText: 'Видалити', danger: true })) deleteSprint(sprint.id);
                                }}
                              >
                                Видалити
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {isExpanded && sprint.goal && (
                        <p className="px-5 pb-2 text-[12px] text-muted italic">Ціль: {sprint.goal}</p>
                      )}

                      {isExpanded && (
                        renderIssueTable(sprintIssues, sprint.id)
                      )}
                    </div>
                  );
                })}
                {sprints.length === 0 && (
                  <div className="py-12 text-center text-[13px] text-faint bg-canvas rounded-[16px]">
                    Немає запланованих або активних спринтів. Створіть новий спринт, щоб розпочати планування.
                  </div>
                )}
              </div>

              {/* Right Column: Backlog (28%) — mobile: full-width block under sprints */}
              <Surface variant="panel" padding="none" className="w-full max-h-[60vh] lg:max-h-none lg:w-[28%] lg:min-w-[280px] overflow-hidden flex flex-col min-h-0">
                <div className="px-5 pt-4 pb-2 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[14px] font-bold text-ink">Backlog</h3>
                    <span className="text-[11px] font-bold text-muted bg-[#efefef] px-2 py-0.5 rounded-full">{backlogIssues.length} завдань</span>
                  </div>
                  <button
                    onClick={() => setShowCreateTaskModal(true)}
                    className="text-muted hover:text-ink hover:bg-white rounded-[6px] p-[2px] transition-colors"
                    title="Додати завдання в беклог"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {renderIssueTable(backlogIssues, 'backlog', true)}
                </div>
              </Surface>

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

      {/* Create Sprint Modal */}
      {showCreateSprintModal && (
        <SprintCreateModal
          onClose={() => setShowCreateSprintModal(false)}
          onSave={handleCreateSprint}
        />
      )}

      {/* Complete Sprint Modal */}
      {showCompleteSprintModal && (
        <SprintCompleteModal
          sprint={showCompleteSprintModal}
          sprints={sprints}
          incompleteIssues={issues.filter(i => i.sprintId === showCompleteSprintModal.id && !isDoneCol(i.status) && !isDoneCol(i.columnId))}
          onClose={() => setShowCompleteSprintModal(null)}
          onConfirm={async (moveToSprintId) => {
            try {
              await completeSprint(showCompleteSprintModal.id, moveToSprintId);
              setShowCompleteSprintModal(null);
              showToast('Спринт успішно завершено ✓');
            } catch (err) {
              console.error(err);
              showToast('Помилка завершення спринта');
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
          await createIssueViaApi({
            organizationId: activeOrgId,
            projectId: formData.projectId,
            data: {
              title: formData.title,
              description: formData.description || '',
              status: formData.status || 'todo',
              priority: formData.priority || 'medium',
              type: formData.type || 'task',
              assigneeIds: formData.assignees || [],
              labelIds: formData.labelIds || [],
              dueDate: formData.dueDate || null,
              sprintId: formData.sprintId || null,
              reporterId: currentUser?.uid || currentUser?.id,
            },
          });

          showToast('Задачу створено ✓');
        }}
        projects={projects}
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
    </div>
  );
}
