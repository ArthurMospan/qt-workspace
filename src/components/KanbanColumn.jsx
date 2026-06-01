'use client';
// src/components/KanbanColumn.jsx — Light theme
import { Droppable, Draggable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import { Plus } from 'lucide-react';

const STATUS_COLORS = {
  'todo':        '#9a9a9a',
  'in-progress': '#6366f1',
  'review':      '#f97316',
  'done':        '#10b981',
};

export default function KanbanColumn({ columnId, label, color, tasks, teamMembers, onAddTask, onSelectTask }) {
  const dotColor = color || STATUS_COLORS[columnId] || '#9a9a9a';

  return (
    <div className="flex flex-col w-[280px] shrink-0 h-full">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="w-[8px] h-[8px] rounded-full shrink-0" style={{ background: dotColor }} />
          <h2 className="text-[13px] font-semibold text-[#1f1f1f]">{label}</h2>
          <span className="text-[11px] text-[#9a9a9a] font-medium bg-[#f0f0f0] px-[6px] py-[1px] rounded-full">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={onAddTask}
          className="w-[24px] h-[24px] flex items-center justify-center rounded-[6px] text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#e9e9e9] transition-all"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={columnId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 flex flex-col gap-[8px] overflow-y-auto pb-[8px] px-[2px] rounded-[12px] transition-colors duration-150 min-h-[100px] ${
              snapshot.isDraggingOver ? 'bg-[#e9e9e9]/50' : ''
            }`}
          >
            {tasks.map((task, index) => (
              <Draggable key={task.id} draggableId={task.id} index={index}>
                {(prov, snap) => (
                  <div
                    ref={prov.innerRef}
                    {...prov.draggableProps}
                    {...prov.dragHandleProps}
                  >
                    <TaskCard
                      task={task}
                      teamMembers={teamMembers}
                      onClick={() => onSelectTask(task)}
                      isDragging={snap.isDragging}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}

            {/* Empty state */}
            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex flex-col items-center justify-center py-8 text-[#cfcfcf]">
                <div className="w-[32px] h-[32px] rounded-full border-2 border-dashed border-[#e9e9e9] mb-2" />
                <p className="text-[11px]">Немає завдань</p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
