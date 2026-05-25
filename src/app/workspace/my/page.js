'use client';
// src/app/workspace/my/page.js — My Tasks: Global Kanban Board
import { useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useAllMyTasks } from '@/lib/hooks/useAllMyTasks';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useStore } from '@/store/useStore';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import IssueCard from '@/components/workspace/IssueCard';

const COLUMNS = [
  { id: 'todo',             label: 'To Do',           color: '#6366f1' },
  { id: 'in-progress',      label: 'In Progress',     color: '#0891b2' },
  { id: 'code-review',      label: 'Code Review',     color: '#d97706' },
  { id: 'done',             label: 'Done',            color: '#10b981' },
];

const FILTERS = [
  { id: 'all',      label: 'Всі' },
  { id: 'today',    label: 'Сьогодні' },
  { id: 'week',     label: 'Цей тиждень' },
  { id: 'overdue',  label: 'Прострочені' },
];

function filterTasks(tasks, filter) {
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const weekEnd  = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);

  return tasks.filter(t => {
    const due = t.dueDate?.toDate ? t.dueDate.toDate() : t.dueDate ? new Date(t.dueDate) : null;
    if (filter === 'today')   return due && due <= todayEnd;
    if (filter === 'week')    return due && due <= weekEnd;
    if (filter === 'overdue') return due && due < now && t.columnId !== 'done';
    return true;
  });
}

export default function MyTasksPage() {
  const { currentUser, projects } = useAppContext();
  const { members } = useOrganization();
  const { tasks, loading, updateTask } = useAllMyTasks(currentUser?.uid);
  const showToast = useStore(s => s.showToast);
  const [filter, setFilter] = useState('all');

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

  const filtered = filterTasks(tasks, filter);
  
  const now = new Date();
  const overdueCount = tasks.filter(t => {
    const due = t.dueDate?.toDate ? t.dueDate.toDate() : t.dueDate ? new Date(t.dueDate) : null;
    return due && due < now && t.columnId !== 'done';
  }).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f7f7f7]">
      {/* Header */}
      <div className="pt-[32px] mb-[32px] px-[16px] md:px-[32px] shrink-0">
        <div>
          <h1 className="text-[26px] md:text-[36px] font-bold text-[#1f1f1f] tracking-tight leading-tight truncate">
            Мої задачі
          </h1>
          <p className="text-[#9a9a9a] mt-[4px] text-[14px]">
            {tasks.filter(t => t.columnId !== 'done').length} активних задач
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-[16px] md:px-[32px] pb-4 flex items-center gap-2 shrink-0">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-4 py-[6px] rounded-full text-[12px] font-semibold transition-all ${
              filter === f.id
                ? 'bg-[#1f1f1f] text-white'
                : 'bg-white text-[#9a9a9a] border border-[#e9e9e9] hover:border-[#9a9a9a] hover:text-[#1f1f1f]'
            }`}>
            {f.label}
            {f.id === 'overdue' && overdueCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-[9px] font-bold px-[5px] py-[1px] rounded-full">{overdueCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Kanban Board Content */}
      <div className="flex-1 overflow-hidden px-[16px] md:px-[32px] pb-8">
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
                   // Map custom columns to closest global equivalents
                   if (col.id === 'todo' && ['todo', 'backlog'].includes(cId)) return true;
                   if (col.id === 'in-progress' && cId === 'in-progress') return true;
                   if (col.id === 'code-review' && ['code-review', 'qa', 'client-approval', 'review'].includes(cId)) return true;
                   if (col.id === 'done' && cId === 'done') return true;
                   return false;
                });

                return (
                  <div key={col.id} className="flex flex-col w-[280px] shrink-0 bg-[#f1f2f4] rounded-[14px] overflow-hidden" style={{ height: 'calc(100vh - 180px)' }}>
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
                          className={`flex-1 overflow-y-auto px-3 flex flex-col gap-2 transition-colors ${snapshot.isDraggingOver ? 'bg-[#e5e7eb]/50' : ''}`}
                        >
                          {colIssues.map((issue, index) => (
                            <IssueCard 
                              key={issue.id} 
                              issue={issue} 
                              members={members} 
                              index={index} 
                              projectId={issue.projectId} 
                            />
                          ))}
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
    </div>
  );
}
