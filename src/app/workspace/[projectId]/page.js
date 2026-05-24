'use client';
// src/app/workspace/[projectId]/page.js — Light kanban board
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
import { ArrowLeft, ExternalLink, Plus } from 'lucide-react';

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
    showToast('Збережено ✓');
  };

  const handleDelete = async (id) => {
    await deleteTask(id);
    if (selectedTask?.id === id) setSelectedTask(null);
    showToast('Задачу видалено');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f7f7f7]">
      {/* Top bar */}
      <div className="px-6 pt-5 pb-4 border-b border-[#e9e9e9] bg-white flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/workspace" className="text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors shrink-0">
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold text-[#1f1f1f] truncate">{project?.name || '...'}</h1>
            <p className="text-[11px] text-[#9a9a9a]">{tasks.length} задач</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a href={`${PORTAL_URL}/project/${projectId}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-[7px] rounded-[9px] text-[12px] text-[#9a9a9a] border border-[#e9e9e9] hover:border-[#9a9a9a] hover:text-[#1f1f1f] transition-all font-medium">
            <ExternalLink size={12} /> Портал
          </a>
          <button onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-[7px] bg-[#1f1f1f] text-white rounded-[9px] text-[12px] font-bold hover:bg-[#303030] transition-all">
            <Plus size={13} /> Нова задача
          </button>
        </div>
      </div>

      {/* Kanban + Detail */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden p-6" onClick={() => setSelectedTask(null)}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-[28px] h-[28px] border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
            </div>
          ) : (
            <div onClick={e => e.stopPropagation()} className="h-full">
              <KanbanBoard
                tasks={tasks}
                moveTask={moveTask}
                teamMembers={teamMembers}
                onAddTask={() => setCreateOpen(true)}
                onSelectTask={setSelectedTask}
                statuses={stages}
              />
            </div>
          )}
        </div>

        {selectedTask && (
          <div className="w-[360px] shrink-0 h-full overflow-hidden" onClick={e => e.stopPropagation()}>
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
