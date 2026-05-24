'use client';
// src/components/KanbanBoard.jsx
import { useCallback } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import KanbanColumn from './KanbanColumn';

const STATUSES = ['todo', 'in-progress', 'review', 'done'];

export default function KanbanBoard({ tasks, moveTask, teamMembers, onAddTask, onSelectTask }) {
  const handleDragEnd = useCallback(async ({ destination, source, draggableId }) => {
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    await moveTask(draggableId, destination.droppableId, destination.index);
  }, [moveTask]);

  const byStatus = STATUSES.reduce((acc, s) => {
    acc[s] = tasks
      .filter(t => t.status === s)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return acc;
  }, {});

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex flex-row gap-[16px] h-full overflow-x-auto pb-[8px]">
        {STATUSES.map(s => (
          <KanbanColumn
            key={s}
            status={s}
            tasks={byStatus[s]}
            teamMembers={teamMembers}
            onAddTask={s === 'todo' ? onAddTask : undefined}
            onSelectTask={onSelectTask}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
