'use client';
// src/app/workspace/my/page.js — My Tasks: Global Kanban Board
import { useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useAllMyTasks } from '@/lib/hooks/useAllMyTasks';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import IssueCard from '@/components/workspace/IssueCard';
import CreateTaskModal from '@/components/CreateTaskModal';
import { Plus } from 'lucide-react';
import { Select, MultiSelect } from '@/components/ui/Select';

const COLUMNS = [
  { id: 'todo',        label: 'To Do',       color: '#6366f1' },
  { id: 'in-progress', label: 'In Progress', color: '#0891b2' },
  { id: 'done',        label: 'Done',        color: '#10b981' },
];


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
  const { currentUser, projects, activeOrgId } = useAppContext();
  const { members } = useOrganization();
  const { labels } = useWorkflowConfig();
  const uid = currentUser?.uid || currentUser?.id;
  const { tasks, loading, updateTask } = useAllMyTasks(uid);
  const showToast = useWorkspaceStore(s => s.showToast);
  const [filters, setFilters] = useState({
    projects: [],
    priority: 'all',
    type: 'all'
  });
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

  const onDragEnd = async ({ draggableId, source, destination }) => {
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    
    // Optimistic update could be done here, but updateTask triggers snapshot update
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent">
      <div className="pt-0 -mt-2 mb-[20px] px-[32px] shrink-0 flex items-start justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-[#1f1f1f] tracking-tight truncate">
            Мої задачі
          </h1>
          <p className="text-[13px] font-medium text-[#9a9a9a] mt-[4px]">
            {tasks.filter(t => t.columnId !== 'done').length} активних задач
          </p>
        </div>
        <button
          onClick={() => setShowCreateTaskModal(true)}
          className="flex items-center gap-[6px] px-[24px] py-[12px] bg-[#1f1f1f] text-white rounded-[12px] text-[14px] font-bold hover:bg-[#303030] transition-all"
        >
          <Plus size={14} /> Створити задачу
        </button>
      </div>

      {/* Filter tabs */}
      <div className="px-[32px] pb-[16px] shrink-0 flex items-center gap-[12px] flex-wrap">
        
        {/* Project Filter (MultiSelect) */}
        <MultiSelect
          value={filters.projects}
          onChange={(val) => setFilters(f => ({ ...f, projects: val }))}
          options={projects.map(p => ({ value: p.id, label: p.name }))}
          placeholder="Всі проєкти"
          searchPlaceholder="Пошук проєкту..."
          className="w-[180px]"
        />


        {/* Priority Filter */}
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

        {/* Type Filter */}
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

      </div>

      {/* Kanban Board Content */}
      <div className="flex-1 overflow-hidden px-[32px] pb-[32px]">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-[28px] h-[28px] border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 h-full overflow-x-auto pb-2 pr-1">
              {COLUMNS.map(col => {
                // Map legacy 'backlog' or others into these global columns if needed,
                // but we strictly match columnId or status
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
        )}
      </div>

      <CreateTaskModal
        isOpen={showCreateTaskModal}
        onClose={() => setShowCreateTaskModal(false)}
        onSubmit={async (formData) => {
          // Since it's global, require projectId in formData
          if (!formData.projectId) {
            throw new Error('Будь ласка, оберіть проєкт');
          }
          const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase');
          
          await addDoc(collection(db, 'issues'), {
            issueKey: `WS-${Date.now()}`, // fallback key
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
            createdAt: serverTimestamp(),
            createdBy: uid
          });
          showToast('Задачу створено ✓');
        }}
        projects={projects}
        stages={[]} // Will use defaults, or we can make it dynamic based on selected project
        teamMembers={members}
      />
    </div>
  );
}
