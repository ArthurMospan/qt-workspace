'use client';
// src/app/workspace/[projectId]/page.js — Trello-like board page
import { use, useState, useEffect } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useTasks } from '@/lib/hooks/useTasks';
import { useTeamMembers } from '@/lib/hooks/useTeamMembers';
import { useStore } from '@/store/useStore';
import Board from '@/components/Board';
import CardModal from '@/components/CardModal';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function BoardPage({ params }) {
  const { projectId } = use(params);
  const { projects } = useAppContext();
  const { tasks, loading, createTask, updateTask, deleteTask, moveTask } = useTasks(projectId);
  const showToast = useStore(s => s.showToast);

  const project = projects?.find(p => p.id === projectId);

  // Safe team fetch — guard against non-array
  const teamUids = Array.isArray(project?.team) ? project.team : [];
  const { members } = useTeamMembers(teamUids);

  const [activeCard, setActiveCard] = useState(null);

  // Keep active card in sync with live task data
  useEffect(() => {
    if (!activeCard) return;
    const updated = tasks.find(t => t.id === activeCard.id);
    if (updated) setActiveCard(updated);
  }, [tasks]); // eslint-disable-line

  const handleAddCard = async (status, title) => {
    try {
      await createTask({ title, status, priority: 'low' });
      showToast('Картку додано ✓');
    } catch (err) {
      console.error(err);
      showToast('Помилка: ' + (err.message || 'невідома'));
    }
  };

  const handleUpdate = async (id, patch) => {
    try {
      await updateTask(id, patch);
    } catch (err) {
      console.error(err);
      showToast('Помилка збереження');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteTask(id);
      showToast('Картку видалено');
    } catch (err) {
      console.error(err);
    }
  };

  const handleMove = async (taskId, newStatus, newOrder) => {
    try {
      await moveTask(taskId, newStatus, newOrder);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#e9e9e9] shrink-0">
        <Link href="/workspace" className="text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-[15px] font-bold text-[#1f1f1f]">{project?.name || '...'}</h1>
        <span className="text-[12px] text-[#9a9a9a]">· {tasks.length} задач</span>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-hidden p-5 bg-[#f7f7f7]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-[28px] h-[28px] border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
          </div>
        ) : (
          <Board
            tasks={tasks}
            members={members}
            onCardClick={setActiveCard}
            onAddCard={handleAddCard}
            onMoveCard={handleMove}
          />
        )}
      </div>

      {/* Card modal */}
      {activeCard && (
        <CardModal
          task={activeCard}
          members={members}
          onClose={() => setActiveCard(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
