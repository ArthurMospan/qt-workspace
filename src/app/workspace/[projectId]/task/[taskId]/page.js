'use client';
// src/app/workspace/[projectId]/task/[taskId]/page.js — Full-page task detail
import { use, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { useTasks } from '@/lib/hooks/useTasks';
import { useTeamMembers } from '@/lib/hooks/useTeamMembers';
import { useStagesForProject } from '@/lib/hooks/useStagesForProject';
import { useStore } from '@/store/useStore';
import TaskDetailPanel from '@/components/TaskDetailPanel';
import Link from 'next/link';

export default function TaskDetailPage({ params }) {
  const { projectId, taskId } = use(params);
  const { projects } = useAppContext();
  const { updateTask, deleteTask } = useTasks(projectId);
  const { stages } = useStagesForProject(projectId);
  const showToast = useStore(s => s.showToast);

  const project = projects?.find(p => p.id === projectId);
  const { members: teamMembers } = useTeamMembers(project?.team);

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskId) return;
    const unsub = onSnapshot(doc(db, 'tasks', taskId), snap => {
      setTask(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    }, (err) => {
      console.warn('[TaskDetailPage] error loading task:', err.message);
      setLoading(false);
    });
    return () => unsub();
  }, [taskId]);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-[#111]">
      <div className="w-[32px] h-[32px] border-[3px] border-white/10 border-t-white/40 rounded-full animate-spin" />
    </div>
  );

  if (!task) return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#111] text-white/40">
      <p className="text-[16px] font-medium mb-[8px]">Задачу не знайдено</p>
      <Link href={`/workspace/${projectId}`} className="text-blue-400 text-[13px] hover:underline">← Назад до дошки</Link>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col bg-[#111] overflow-hidden">
      <div className="px-[24px] pt-[16px] pb-[12px] border-b border-white/[0.06] shrink-0">
        <Link href={`/workspace/${projectId}`}
          className="flex items-center gap-[7px] text-white/30 hover:text-white/60 text-[12px] font-medium transition-colors w-fit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          {project?.name || 'Дошка'}
        </Link>
      </div>
      <div className="flex-1 overflow-hidden max-w-[680px] w-full mx-auto">
        <TaskDetailPanel
          task={task}
          stages={stages}
          teamMembers={teamMembers}
          onUpdate={async (id, data) => { await updateTask(id, data); showToast('Оновлено ✓'); }}
          onDelete={async (id) => { await deleteTask(id); showToast('Видалено'); window.history.back(); }}
        />
      </div>
    </div>
  );
}
