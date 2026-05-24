'use client';
// src/app/workspace/[projectId]/page.js — Kanban board for a project
import { use, useState, useEffect } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useTasks } from '@/lib/hooks/useTasks';
import { useTeamMembers } from '@/lib/hooks/useTeamMembers';
import { useStagesForProject } from '@/lib/hooks/useStagesForProject';
import { useStore } from '@/store/useStore';
import KanbanBoard from '@/components/KanbanBoard';
import CreateTaskModal from '@/components/CreateTaskModal';
import TaskDetailPanel from '@/components/TaskDetailPanel';
import Link from 'next/link';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app';

export default function ProjectKanbanPage({ params }) {
  const { projectId } = use(params);
  const { projects } = useAppContext();
  const { tasks, loading, createTask, updateTask, deleteTask, moveTask } = useTasks(projectId);
  const { stages } = useStagesForProject(projectId);
  const showToast = useStore(s => s.showToast);

  const project = projects?.find(p => p.id === projectId);
  const { members: teamMembers } = useTeamMembers(project?.team);

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Keep selectedTask in sync with real-time updates
  useEffect(() => {
    if (!selectedTask) return;
    const updated = tasks.find(t => t.id === selectedTask.id);
    if (updated) setSelectedTask(updated);
  }, [tasks]);

  const handleCreate = async (data) => {
    await createTask(data);
    showToast('Задачу створено ✓');
  };

  const handleUpdate = async (id, data) => {
    await updateTask(id, data);
    showToast('Оновлено ✓');
  };

  const handleDelete = async (id) => {
    await deleteTask(id);
    if (selectedTask?.id === id) setSelectedTask(null);
    showToast('Задачу видалено');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#111]">
      {/* Top bar */}
      <div className="px-[24px] pt-[18px] pb-[14px] border-b border-white/[0.06] flex items-center justify-between gap-[14px] shrink-0">
        <div className="flex items-center gap-[12px] min-w-0">
          <Link href="/workspace" className="text-white/25 hover:text-white/60 transition-colors shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="text-white text-[16px] font-bold truncate">{project?.name || '...'}</h1>
            <p className="text-white/25 text-[11px] mt-[1px]">{tasks.length} задач · {stages.length} етапів</p>
          </div>
        </div>

        <div className="flex items-center gap-[8px] shrink-0">
          <a
            href={`${PORTAL_URL}/project/${projectId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-[5px] text-white/30 hover:text-white/60 text-[11px] px-[9px] py-[5px] rounded-[8px] border border-white/[0.07] hover:border-white/[0.14] transition-all"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Портал
          </a>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-[6px] bg-white text-[#111] px-[12px] py-[6px] rounded-[9px] text-[12px] font-bold hover:bg-white/90 transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Нова задача
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        {/* Kanban */}
        <div className="flex-1 overflow-hidden p-[20px]" onClick={() => setSelectedTask(null)}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-[32px] h-[32px] border-[3px] border-white/10 border-t-white/40 rounded-full animate-spin" />
            </div>
          ) : (
            <div onClick={e => e.stopPropagation()} className="h-full">
              <KanbanBoard
                tasks={tasks}
                moveTask={moveTask}
                teamMembers={teamMembers}
                onAddTask={() => setCreateOpen(true)}
                onSelectTask={setSelectedTask}
              />
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedTask && (
          <div className="w-[360px] shrink-0 h-full overflow-hidden border-l border-white/[0.06]" onClick={e => e.stopPropagation()}>
            <TaskDetailPanel
              task={selectedTask}
              stages={stages}
              teamMembers={teamMembers}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          </div>
        )}
      </div>

      <CreateTaskModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        stages={stages}
        teamMembers={teamMembers}
      />
    </div>
  );
}
