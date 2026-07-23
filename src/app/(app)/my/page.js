'use client';
// src/app/workspace/my/page.js — My Tasks: Global Kanban Board & Sprints
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import { useLocalization } from '@/lib/hooks/useLocalization';
import { useAllMyTasks } from '@/lib/hooks/useAllMyTasks';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { useSprints } from '@/lib/hooks/useSprints';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import IssueCard from '@/components/workspace/IssueCard';
import TaskRow from '@/components/ui/TaskManagement/TaskRow';
import CreateTaskModal from '@/components/CreateTaskModal';
import { PageHeader } from '@/components/ui';
import { Plus, ChevronDown, ChevronRight, ChevronLeft, Settings2, X, EyeOff, Eye, LayoutGrid, List, Kanban } from 'lucide-react';
import { Select, MultiSelect } from '@/components/ui/Select';
import Tabs from '@/components/ui/Tabs';
import LoadingSpinner from '@/components/ui/Feedback/LoadingSpinner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Layout/Card';
import Surface from '@/components/ui/Surface';
import FilterBar from '@/components/ui/FilterBar';
import { createIssueViaApi } from '@/lib/services/issues';



function fmtDate(raw) {
  if (!raw) return null;
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

function filterTasks(tasks, filters, sprintMap) {
  const { projects, priority, type, sprint } = filters;

  return tasks.filter(t => {
    if (projects && projects.length > 0 && !projects.includes(t.projectId)) return false;
    if (priority !== 'all' && t.priority !== priority) return false;
    if (type !== 'all' && t.type !== type) return false;
    if (sprint !== 'all') {
      if (sprint === 'none') {
        if (t.sprintId) return false;
      } else if (sprint === 'active') {
        const s = sprintMap[t.sprintId];
        if (!s || s.status !== 'active') return false;
      } else {
        if (t.sprintId !== sprint) return false;
      }
    }
    return true;
  });
}

export default function MyTasksPage() {
  const router = useRouter();
  const { currentUser, projects, activeOrgId } = useAppContext();
  const { members } = useOrganization();
  const { labels } = useWorkflowConfig();
  const uid = currentUser?.uid || currentUser?.id;
  const { tasks, issueLinks, loading, updateTask } = useAllMyTasks(uid);
  const { sprints, loading: sprintsLoading } = useSprints();
  const { formatDate } = useLocalization();
  const showToast = useWorkspaceStore(s => s.showToast);
  const myTaskSearch = useWorkspaceStore(s => s.myTaskSearch);
  
  const [viewMode, setViewMode] = useState('kanban'); // kanban | list
  const [sectionExpansion, setSectionExpansion] = useState({});
  const [filters, setFilters] = useState({
    projects: [],
    priority: 'all',
    type: 'all',
    sprint: 'all'
  });
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [createTaskStatus, setCreateTaskStatus] = useState(null);
  const [collapsedCols, setCollapsedCols] = useState(['__hidden__']);
  const { statuses } = useWorkflowConfig();

  const toggleColumnCollapse = (id) => {
    setCollapsedCols(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const [hiddenColumns, setHiddenColumns] = useState(() => {
    if (typeof window !== 'undefined') {
      try { return JSON.parse(localStorage.getItem('qt_my_tasks_hidden')) || []; } catch(e){}
    }
    return [];
  });

  const toggleHiddenColumn = (id) => {
    setHiddenColumns(prev => {
      const next = prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id];
      localStorage.setItem('qt_my_tasks_hidden', JSON.stringify(next));
      return next;
    });
  };

  const onDragEnd = async ({ draggableId, source, destination }) => {
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    if (destination.droppableId === '__hidden__') return; // cannot drop into the combined container
    
    try {
      await updateTask(draggableId, { 
        columnId: destination.droppableId, 
        status: destination.droppableId 
      });
      showToast('Статус оновлено ✓');
    } catch (err) {
      console.error(err);
      showToast('Помилка оновлення статусу');
    }
  };

  // Group sprints by status
  const sprintMap = (sprints || []).reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {});

  const normalizedSearch = myTaskSearch.trim().toLowerCase();
  const filtered = filterTasks(tasks, filters, sprintMap).filter(t => {
    const p = projects.find(proj => proj.id === t.projectId);
    if (!p || p.status === 'archived') return false;
    if (!normalizedSearch) return true;
    return [t.issueKey, t.title, t.description, p.name]
      .some(value => String(value || '').toLowerCase().includes(normalizedSearch));
  });

  const activeSprintsList = (sprints || []).filter(s => s.status === 'active');
  const plannedSprintsList = (sprints || []).filter(s => s.status === 'planned');
  const completedSprintsList = (sprints || []).filter(s => s.status === 'completed');

  const formatSprintDates = (startDate, endDate) => {
    if (!startDate || !endDate) return null;
    const start = startDate.toDate ? startDate.toDate() : new Date(startDate);
    const end = endDate.toDate ? endDate.toDate() : new Date(endDate);
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const activeSprintSections = activeSprintsList.map(sprint => ({
    id: sprint.id,
    title: sprint.name,
    goal: sprint.goal,
    dates: formatSprintDates(sprint.startDate, sprint.endDate),
    issues: filtered.filter(i => i.sprintId === sprint.id),
    status: 'active',
    badgeColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    badgeText: 'Активний'
  }));

  const plannedSprintSections = plannedSprintsList.map(sprint => ({
    id: sprint.id,
    title: sprint.name,
    goal: sprint.goal,
    dates: formatSprintDates(sprint.startDate, sprint.endDate),
    issues: filtered.filter(i => i.sprintId === sprint.id),
    status: 'planned',
    badgeColor: 'bg-blue-50 text-blue-700 border border-blue-200',
    badgeText: 'Запланований'
  }));

  const completedSprintSections = completedSprintsList.map(sprint => ({
    id: sprint.id,
    title: sprint.name,
    goal: sprint.goal,
    dates: formatSprintDates(sprint.startDate, sprint.endDate),
    issues: filtered.filter(i => i.sprintId === sprint.id),
    status: 'completed',
    badgeColor: 'bg-gray-100 text-gray-600 border border-gray-200',
    badgeText: 'Завершено'
  }));

  const backlogIssuesList = filtered.filter(i => !i.sprintId || !sprintMap[i.sprintId]);

  const sprintSections = [
    ...activeSprintSections,
    ...plannedSprintSections,
    ...completedSprintSections,
    {
      id: 'backlog',
      title: 'Беклог',
      goal: 'Завдання без призначеного спринта',
      issues: backlogIssuesList,
      status: 'backlog',
      badgeColor: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
      badgeText: 'Беклог'
    }
  ];

  const toggleSection = (id) => {
    setSectionExpansion(prev => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id]
    }));
  };

  const isSectionExpanded = (section) => {
    if (sectionExpansion[section.id] !== undefined) {
      return sectionExpansion[section.id];
    }
    return section.status === 'active' || section.status === 'backlog';
  };

  return (
    <div className={`flex-1 h-full bg-transparent ${viewMode === 'kanban' ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden custom-scrollbar'}`}>
      <div className={`w-full flex flex-col gap-2 page-gutter pt-[56px] ${viewMode === 'kanban' ? 'h-full pb-0' : 'min-h-full pb-[120px]'}`}>
        <PageHeader
          variant="main"
          title="Мої завдання"
          actions={
            <div className="flex gap-2">
              <Button
                onClick={() => { setCreateTaskStatus(null); setShowCreateTaskModal(true); }}
                icon={Plus}
                size="lg"
                style="primary"
                color="dark"
                collapseAt="sm"
                title="Створити завдання"
              >
                Створити завдання
              </Button>
            </div>
          }
          filters={
            <div className="flex items-center justify-between w-full">
              <FilterBar>
                <MultiSelect
                  variant="ghost"
                  value={filters.projects}
                onChange={(val) => setFilters(f => ({ ...f, projects: val }))}
                options={projects.map(p => ({ value: p.id, label: p.name }))}
                placeholder="Всі проєкти"
                searchPlaceholder="Пошук проєкту..."
                className="w-[200px]"
              />
              <Select
                variant="ghost"
                value={filters.priority}
                onChange={(val) => setFilters(f => ({ ...f, priority: val }))}
                options={[
                  { value: 'all', label: 'Всі пріоритети' },
                  { value: 'blocker', label: 'Blocker', dotColor: '#ef4444' },
                  { value: 'high', label: 'High', dotColor: '#f97316' },
                  { value: 'medium', label: 'Medium', dotColor: '#eab308' },
                  { value: 'low', label: 'Low', dotColor: '#9a9a9a' }
                ]}
              />
              <Select
                variant="ghost"
                value={filters.type}
                onChange={(val) => setFilters(f => ({ ...f, type: val }))}
                options={[
                  { value: 'all', label: 'Всі типи' },
                  { value: 'epic', label: 'Epic' },
                  { value: 'feature', label: 'Feature' },
                  { value: 'task', label: 'Task' },
                  { value: 'bug', label: 'Bug' }
                ]}
              />
              <Select
                variant="ghost"
                value={filters.sprint}
                onChange={(val) => setFilters(f => ({ ...f, sprint: val }))}
                options={[
                  { value: 'all', label: 'Всі спринти' },
                  { value: 'active', label: 'Тільки активні' },
                  { value: 'none', label: 'Без спринта (Беклог)' },
                  ...(sprints || []).map(s => ({ value: s.id, label: s.name }))
                ]}
              />
            </FilterBar>
            
            <div className="flex items-center gap-2 ml-auto">
              {viewMode === 'kanban' && (
                <Button
                  onClick={() => setShowSettingsModal(true)}
                  icon={Settings2}
                  size="icon-lg"
                  style="secondary"
                  title="Налаштування дошки"
                />
              )}
              <Tabs
                tabs={[
                  { id: 'kanban', icon: Kanban },
                  { id: 'list', icon: List },
                ]}
                activeTab={viewMode}
                onTabChange={setViewMode}
              />
            </div>
          </div>
          }
        />

        {/* Main Content Area */}
        <div>
        {loading || sprintsLoading ? (
          <div className="flex items-center justify-center h-40">
            <LoadingSpinner size="md" />
          </div>
        ) : viewMode === 'kanban' ? (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 h-full overflow-x-auto pb-2 snap-x snap-mandatory md:snap-none full-bleed">
              {(() => {
                 const visibleColumns = statuses.filter(s => !hiddenColumns.includes(s.id));
                 const hiddenColIds = hiddenColumns.filter(id => statuses.some(s => s.id === id));
                 const renderCols = [...visibleColumns];
                 if (hiddenColIds.length > 0) {
                   renderCols.push({ id: '__hidden__', label: 'Приховані колонки', color: '#cfcfcf', isHiddenContainer: true, colIds: hiddenColIds });
                 }
                 
                 return renderCols.map(col => {
                    const colIssues = filtered.filter(i => {
                       const cId = i.columnId || i.status || statuses[0]?.id;
                       if (col.isHiddenContainer) return col.colIds.includes(cId);
                       return cId === col.id;
                    }).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
                    const isCollapsed = collapsedCols.includes(col.id);

                    if (isCollapsed) {
                      return (
                        <div key={col.id} className="flex flex-col w-[48px] shrink-0 bg-canvas rounded-[16px] overflow-hidden items-center py-4 cursor-pointer hover:bg-[#f0f0f2] transition-colors" style={{ height: 'calc(100dvh - 180px)' }} onClick={() => toggleColumnCollapse(col.id)}>
                          <button className="text-muted mb-4">
                            <ChevronRight size={16} />
                          </button>
                          <div className="flex-1 flex flex-col items-center gap-4">
                            <span className="w-[8px] h-[8px] rounded-full shrink-0" style={{ background: col.color }} />
                            <h3 className="text-[12px] font-bold text-ink uppercase tracking-wide whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{col.label}</h3>
                            <span className="text-[11px] font-bold text-muted bg-white/60 px-[2px] py-[6px] rounded-full text-center" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                              {colIssues.length}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div key={col.id} className="flex flex-col w-[82vw] max-w-[320px] md:w-[280px] md:max-w-none shrink-0 snap-center bg-canvas hover:bg-[#f0f0f2] rounded-[16px] overflow-hidden transition-all duration-200" style={{ height: 'calc(100dvh - 180px)' }}>
                        <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
                          <div className="flex items-center gap-[6px]">
                            <button
                              onClick={() => toggleColumnCollapse(col.id)}
                              className="text-muted hover:text-ink hover:bg-white rounded-[6px] p-[2px] transition-colors -ml-2"
                              title="Згорнути колонку"
                            >
                              <ChevronLeft size={16} />
                            </button>
                            <span className="w-[8px] h-[8px] rounded-full" style={{ background: col.color }} />
                            <h3 className="text-[12px] font-bold text-ink uppercase tracking-wide">{col.label}</h3>
                            <span className="text-[11px] font-bold text-muted bg-white/60 px-[6px] py-[2px] rounded-full ml-1">
                              {colIssues.length}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {!col.isHiddenContainer && (
                              <button
                                onClick={() => { setCreateTaskStatus(col.id); setShowCreateTaskModal(true); }}
                                className="text-muted hover:text-ink hover:bg-white rounded-[6px] p-[2px] transition-colors"
                                title="Додати завдання"
                              >
                                <Plus size={16} />
                              </button>
                            )}
                          </div>
                        </div>

                        <Droppable droppableId={col.id} isDropDisabled={col.isHiddenContainer}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`flex-1 overflow-y-auto p-[8px] flex flex-col gap-[8px] transition-colors custom-scrollbar ${snapshot.isDraggingOver ? 'bg-[#f0f0f0]' : ''}`}
                            >
                              {colIssues.length === 0 ? (
                                <div className="flex items-center justify-center h-20 text-[13px] text-faint">
                                  Немає завдань
                                </div>
                              ) : (
                                colIssues.map((issue, index) => {
                                  const pName = projects.find(p => p.id === issue.projectId)?.name;
                                  return (
                                    <IssueCard
                                      key={issue.id}
                                      issue={issue}
                                      issues={tasks}
                                      sprints={sprints}
                                      members={members}
                                      labels={labels}
                                      index={index}
                                      projectId={issue.projectId}
                                      projectName={pName}
                                      issueLinks={issueLinks}
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
                 });
              })()}
            </div>
          </DragDropContext>
        ) : (
          <div className="flex flex-col gap-6 w-full">
            {(() => {
              const visibleStatuses = statuses.filter(s => !hiddenColumns.includes(s.id));
              const hasAnyTasks = filtered.length > 0;
              
              if (!hasAnyTasks) {
                return (
                  <div className="text-center py-12 text-[13px] text-faint bg-canvas rounded-[16px]">
                    Завдань не знайдено
                  </div>
                );
              }

              return visibleStatuses.map(status => {
                const statusIssues = filtered.filter(i => {
                  const cId = i.columnId || i.status || statuses[0]?.id;
                  return cId === status.id;
                });

                if (statusIssues.length === 0) return null;

                return (
                  <Surface key={status.id} variant="panel" padding="lg" className="w-full">
                    {/* Header */}
                    <div className="flex items-center gap-2 pb-2 border-b border-line mb-4 select-none">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: status.color }} />
                      <h3 className="text-[12px] font-bold text-ink uppercase tracking-wide">{status.label}</h3>
                      <span className="text-[11px] font-bold text-muted bg-white/80 px-[6px] py-[2px] rounded-full ml-1">
                        {statusIssues.length}
                      </span>
                    </div>

                    {/* Task rows */}
                    <div className="flex flex-col gap-2">
                      {statusIssues.map(issue => {
                        const pName = projects.find(p => p.id === issue.projectId)?.name;
                        return (
                          <TaskRow
                            key={issue.id}
                            issue={issue}
                            members={members}
                            labels={labels}
                            sprints={sprints}
                            projectId={issue.projectId}
                            projectName={pName}
                            issueLinks={issueLinks}
                            issues={tasks}
                          />
                        );
                      })}
                    </div>
                  </Surface>
                );
              });
            })()}
          </div>
        )}
        </div>
      </div>

      <CreateTaskModal
        isOpen={showCreateTaskModal}
        onClose={() => { setShowCreateTaskModal(false); setCreateTaskStatus(null); }}
        initialStatus={createTaskStatus}
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
              reporterId: uid,
            },
          });

          showToast('Задачу створено ✓');
        }}
        projects={projects}
        stages={[]}
        teamMembers={members}
        sprints={sprints}
      />

      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 backdrop-blur-sm">
          <div className="flex h-[94dvh] w-full flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl sm:h-full sm:w-[480px] sm:rounded-none sm:rounded-l-[24px]">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <h2 className="text-[16px] font-bold text-ink">Налаштування дошки</h2>
              <Button style="secondary" size="icon" icon={X} onClick={() => setShowSettingsModal(false)}>
                Закрити
              </Button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
              <div>
                <h3 className="text-[14px] font-bold text-ink mb-2">Видимість колонок</h3>
                <p className="text-[13px] text-muted mb-4">
                  Оберіть, які колонки ви хочете приховати з вашої особистої дошки. 
                  Завдання з прихованих колонок будуть зібрані в одну загальну колонку праворуч.
                </p>

                <div className="flex flex-col gap-2">
                  {statuses.map((status) => {
                    const isHidden = hiddenColumns.includes(status.id);
                    return (
                      <div 
                        key={status.id} 
                        onClick={() => toggleHiddenColumn(status.id)}
                        className={`flex items-center justify-between border rounded-[12px] p-3 cursor-pointer transition-colors ${
                          isHidden ? 'bg-canvas border-line opacity-60' : 'bg-white border-faint hover:border-ink'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-3 h-3 rounded-full" style={{ background: status.color }} />
                          <span className={`text-[14px] font-semibold ${isHidden ? 'text-muted' : 'text-ink'}`}>
                            {status.label}
                          </span>
                        </div>
                        <div className="text-muted">
                          {isHidden ? <EyeOff size={18} /> : <Eye size={18} className="text-[#10b981]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-line flex justify-end gap-3 bg-canvas">
              <Button 
                style="primary"
                size="md"
                onClick={() => setShowSettingsModal(false)} 
              >
                Готово
              </Button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
