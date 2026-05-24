'use client';
// src/components/KanbanColumn.jsx
import { Droppable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';

const COL = {
  'todo':        { label: 'До виконання', color: 'text-white/40',   dot: 'bg-white/25',   bg: 'bg-white/[0.03]' },
  'in-progress': { label: 'В роботі',     color: 'text-blue-400',   dot: 'bg-blue-400',   bg: 'bg-blue-400/[0.06]' },
  'review':      { label: 'На перевірці', color: 'text-yellow-400', dot: 'bg-yellow-400', bg: 'bg-yellow-400/[0.06]' },
  'done':        { label: 'Готово',       color: 'text-green-400',  dot: 'bg-green-400',  bg: 'bg-green-400/[0.06]' },
};

export default function KanbanColumn({ status, tasks, teamMembers, onAddTask, onSelectTask }) {
  const cfg = COL[status] || COL['todo'];

  return (
    <div className="flex flex-col w-[280px] shrink-0 h-full">
      {/* Header */}
      <div className={`flex items-center justify-between px-[14px] py-[10px] rounded-[12px] mb-[10px] ${cfg.bg}`}>
        <div className="flex items-center gap-[8px]">
          <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${cfg.dot}`} />
          <span className={`text-[11px] font-bold uppercase tracking-[0.08em] ${cfg.color}`}>{cfg.label}</span>
          <span className="text-white/20 text-[11px] font-bold">{tasks.length}</span>
        </div>
        {status === 'todo' && (
          <button
            onClick={onAddTask}
            className="w-[22px] h-[22px] rounded-[6px] bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/40 hover:text-white transition-all"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        )}
      </div>

      {/* Droppable */}
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 flex flex-col gap-[8px] overflow-y-auto pb-[12px] rounded-[12px] transition-colors duration-100 ${
              snapshot.isDraggingOver ? 'bg-white/[0.025]' : ''
            }`}
          >
            {tasks.map((task, i) => (
              <TaskCard
                key={task.id}
                task={task}
                index={i}
                teamMembers={teamMembers}
                onSelect={onSelectTask}
              />
            ))}
            {provided.placeholder}
            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex items-center justify-center py-[32px] border border-dashed border-white/[0.06] rounded-[12px]">
                <p className="text-white/20 text-[11px]">Пусто</p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
