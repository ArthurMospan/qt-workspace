'use client';
// src/app/workspace/my/page.js — My Tasks: Global Kanban Board & Sprints
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import { useAllMyTasks } from '@/lib/hooks/useAllMyTasks';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { useSprints } from '@/lib/hooks/useSprints';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import IssueCard from '@/components/workspace/IssueCard';
import CreateTaskModal from '@/components/CreateTaskModal';
import PageHeader from '@/components/workspace/PageHeader';
import { Plus, ChevronDown, ChevronRight, Calendar } from 'lucide-react';
import { Select, MultiSelect } from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/Feedback/LoadingSpinner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Layout/Card';

const COLUMNS = [
  { id: 'todo',        label: 'To Do',       color: '#6366f1' },
  { id: 'in-progress', label: 'In Progress', color: '#0891b2' },
  { id: 'done',        label: 'Done',        color: '#10b981' },
];

function fmtDate(raw) {
  if (!raw) return null;
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

function filterTasks(tasks, filters) {
  const { projects, priority, type } = filters;

  return tasks.filter(t => {
    if (projects && projects.length > 0 && !projects.includes(t.projectId)) return false;
    if (priority !== 'all' && t.priority !== priority) return false;
    if (type !== 'all' && t.type !== type) return false;
    return true;
  });
}

export default function MyTasksPage() {
  const router = useRouter();
  const { currentUser, projects, activeOrgId } = useAppContext();
  const { members } = useOrganization();
  const { labels } = useWorkflowConfig();
  const uid = currentUser?.uid || currentUser?.id;
  const { tasks, loading, updateTask } = useAllMyTasks(uid);
  const { sprints, loading: sprintsLoading } = useSprints();
  const showToast = useWorkspaceStore(s => s.showToast);
  
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'sprints'
  const [sectionExpansion, setSectionExpansion] = useState({});
  const [filters, setFilters] = useState({
    projects: [],
    priority: 'all',
    type: 'all'
  });
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

  const onDragEnd = async ({ draggableId, source, destination }) => {
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    
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

  const filtered = filterTasks(tasks, filters);

  // Group sprints by status
  const sprintMap = (sprints || []).reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {});

  const activeSprintsList = (sprints || []).filter(s => s.status === 'active');
  const plannedSprintsList = (sprints || []).filter(s => s.status === 'planned');
  const completedSprintsList = (sprints || []).filter(s => s.status === 'completed');

  const formatSprintDates = (startDate, endDate) => {
    if (!startDate || !endDate) return null;
    const start = startDate.toDate ? startDate.toDate() : new Date(startDate);
    const end = endDate.toDate ? endDate.toDate() : new Date(endDate);
    return `${start.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}`;
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
      goal: 'Задачі без призначеного спринта',
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
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent">
      <PageHeader
        variant="main"
        title="Мої задачі"
        className="px-[32px]"
        tabs={[
          { id: 'kanban', label: 'Дошка' },
          { id: 'sprints', label: 'Спринти' }
        ]}
        activeTab={viewMode}
        onTabChange={setViewMode}
        actions={
          <Button
            onClick={() => setShowCreateTaskModal(true)}
            icon={Plus}
            size="lg"
            style="primary"
            color="dark"
          >
            Створити задачу
          </Button>
        }
        filters={
          <>
            <MultiSelect
              value={filters.projects}
              onChange={(val) => setFilters(f => ({ ...f, projects: val }))}
              options={projects.map(p => ({ value: p.id, label: p.name }))}
              placeholder="Всі проєкти"
              searchPlaceholder="Пошук проєкту..."
              className="w-[180px]"
            />
            <Select
              value={filters.priority}
              onChange={(val) => setFilters(f => ({ ...f, priority: val }))}
              options={[
                { value: 'all', label: 'Будь-який пріоритет' },
                { value: 'blocker', label: 'Blocker', dotColor: '#ef4444' },
                { value: 'high', label: 'High', dotColor: '#f97316' },
                { value: 'medium', label: 'Medium', dotColor: '#eab308' },
                { value: 'low', label: 'Low', dotColor: '#3b82f6' }
              ]}
              className="w-[180px]"
            />
            <Select
              value={filters.type}
              onChange={(val) => setFilters(f => ({ ...f, type: val }))}
              options={[
                { value: 'all', label: 'Будь-який тип' },
                { value: 'epic', label: 'Epic' },
                { value: 'feature', label: 'Feature' },
                { value: 'task', label: 'Task' },
                { value: 'bug', label: 'Bug' }
              ]}
              className="w-[160px]"
            />
          </>
        }
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-[32px] pb-[32px]">
        {loading || sprintsLoading ? (
          <div className="flex items-center justify-center h-40">
            <LoadingSpinner size="md" />
          </div>
        ) : viewMode === 'kanban' ? (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 h-full overflow-x-auto pb-2 pr-1">
              {COLUMNS.map(col => {
                const colIssues = filtered.filter(i => {
                  const cId = i.columnId || i.status || 'todo';
                  if (col.id === 'todo')        return ['todo', 'backlog'].includes(cId);
                  if (col.id === 'in-progress') return ['in-progress', 'code-review', 'qa', 'client-approval'].includes(cId);
                  if (col.id === 'done')        return cId === 'done';
                  return false;
                });

                return (
                  <div key={col.id} className="flex flex-col w-[280px] shrink-0 bg-[#f7f7f7] rounded-[24px] overflow-hidden" style={{ height: 'calc(100vh - 180px)' }}>
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
          </DragDropContext>
        ) : (
          <div className="flex flex-col max-w-[1200px]">
            {sprintSections.map(section => {
              const isExpanded = isSectionExpanded(section);
              return (
                <Card key={section.id} variant="gray" padding="lg" className="mb-6">
                  <div 
                    onClick={() => toggleSection(section.id)}
                    className="flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-[12px] min-w-0">
                      {isExpanded ? <ChevronDown size={20} className="text-[#9a9a9a] shrink-0" /> : <ChevronRight size={20} className="text-[#9a9a9a] shrink-0" />}
                      <h3 className="text-[16px] font-bold text-[#1f1f1f] truncate">{section.title}</h3>
                      <span className="text-[11px] font-bold text-[#9a9a9a] bg-white/60 px-[8px] py-[2px] rounded-full shrink-0">
                        {section.issues.length}
                      </span>
                      {section.badgeText && (
                        <span className={`text-[10px] font-bold px-[8px] py-[2px] rounded-md shrink-0 uppercase tracking-wider ${section.badgeColor}`}>
                          {section.badgeText}
                        </span>
                      )}
                      {section.dates && (
                        <span className="text-[12px] font-medium text-[#9a9a9a] hidden sm:inline ml-2">
                          ({section.dates})
                        </span>
                      )}
                    </div>
                    {section.goal && !isExpanded && (
                      <p className="text-[12px] text-[#9a9a9a] italic truncate max-w-[200px] hidden md:block">
                        {section.goal}
                      </p>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-4 flex flex-col gap-2">
                      {section.goal && (
                        <p className="text-[12px] text-[#9a9a9a] italic mb-2">
                          Ціль: {section.goal}
                        </p>
                      )}
                      {section.issues.length === 0 ? (
                        <div className="text-center py-6 text-[13px] text-[#cfcfcf]">
                          Немає задач
                        </div>
                      ) : (
                        section.issues.map(issue => {
                          const pName = projects.find(p => p.id === issue.projectId)?.name;
                          return (
                            <div 
                              key={issue.id} 
                              onClick={() => router.push(`/workspace/${issue.projectId}/issue/${issue.id}`)}
                              className="bg-white border border-[#efefef] hover:border-[#dfdfdf] rounded-[18px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)] cursor-pointer"
                            >
                              <div className="flex items-start gap-[12px] min-w-0 flex-1">
                                <div className="flex flex-col gap-1 min-w-0">
                                  <div className="flex items-center gap-[8px] flex-wrap">
                                    <span className="text-[10px] font-bold text-[#9a9a9a] bg-[#f5f5f5] px-2 py-0.5 rounded tracking-wide">
                                      {issue.issueKey || 'TASK'}
                                    </span>
                                    {pName && (
                                      <span className="text-[10px] font-bold text-[#6366f1] bg-[#e0e7ff] px-2 py-0.5 rounded truncate max-w-[150px]">
                                        {pName}
                                      </span>
                                    )}
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                      issue.priority === 'blocker' || issue.priority === 'high' 
                                        ? 'bg-red-50 text-red-600 border border-red-100' 
                                        : issue.priority === 'medium'
                                        ? 'bg-yellow-50 text-yellow-600 border border-yellow-100'
                                        : 'bg-blue-50 text-blue-600 border border-blue-100'
                                    }`}>
                                      {issue.priority}
                                    </span>
                                  </div>
                                  <h4 className="text-[14px] font-bold text-[#1a1a1a] mt-1 truncate">
                                    {issue.title}
                                  </h4>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end" onClick={e => e.stopPropagation()}>
                                {issue.dueDate && (
                                  <div className="flex items-center gap-1 text-[11px] font-semibold text-[#9a9a9a]">
                                    <Calendar size={13} />
                                    <span>{fmtDate(issue.dueDate)}</span>
                                  </div>
                                )}
                                
                                <div className="w-[140px]">
                                  <Select
                                    value={issue.columnId || issue.status || 'todo'}
                                    onChange={async (newVal) => {
                                      try {
                                        await updateTask(issue.id, { 
                                          columnId: newVal, 
                                          status: newVal 
                                        });
                                        showToast('Статус оновлено ✓');
                                      } catch (e) {
                                        console.error(e);
                                        showToast('Помилка оновлення');
                                      }
                                    }}
                                    options={[
                                      { value: 'todo', label: 'To Do', dotColor: '#6366f1' },
                                      { value: 'in-progress', label: 'In Progress', dotColor: '#0891b2' },
                                      { value: 'done', label: 'Done', dotColor: '#10b981' }
                                    ]}
                                    buttonClassName="bg-[#f7f7f7] hover:bg-[#ebebeb] rounded-[10px] px-[12px] py-[8px]"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

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
            createdBy: uid
          });
          showToast('Задачу створено ✓');
        }}
        projects={projects}
        stages={[]}
        teamMembers={members}
        sprints={sprints}
      />
    </div>
  );
}
